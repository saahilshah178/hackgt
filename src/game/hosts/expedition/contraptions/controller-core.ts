/**
 * contraptions/controller-core.ts (pure, H1) — the Phaser-free heart of the ContraptionController (docs/design/20
 * §2.5.3): state, the station clock t, the seeded sim at a fixed step, the aid tier, the probe, draft → target pose,
 * the eased pose (1 − e^(−dt/110 ms); reduced motion snaps), describe(), plans, hint targets, audio params and
 * debugState(). controller.ts adds the PoseView, the label store and the timers around it.
 *
 * Metas never see params or solutions: PoseInput carries the VIEW only (§2.5.6).
 */
import type { PayoffAnim, Station } from "../../../../contracts/world";
import { smoothingFactor } from "../../../../world/ease";
import { hintTargetsFor } from "../../../../world/hint-targets";
import type {
  AidTier, AnyContraptionMeta, AudioParam, Described, Diagnosis, Draft, FailurePlan, HintRung, HintTarget, HintsUsed,
  PoseInput, StaticInput, SuccessPlan,
} from "../../../../world/types";

export type ContraptionState = "dormant" | "awake" | "active" | "solved";
export const MAX_SIM_STEPS = 4;
export const SR_THROTTLE_MS = 1000;

export interface CoreOpts {
  meta: AnyContraptionMeta;
  config: unknown;
  view: unknown;
  skinId: string;
  seed: number;
  reducedMotion: boolean;
  /** the panel shows the RECORD card above this meta's cards (A6) */
  record: boolean;
  payoffAnim: PayoffAnim;
  station: Pick<Station, "hintTargets">;
}

const EMPTY_DESCRIBED: Described = { chips: [], pins: [], srText: "", nearMiss: null };

export class ControllerCore {
  readonly meta: AnyContraptionMeta;
  state: ContraptionState = "dormant";
  draft: Draft | null = null;
  t = 0;
  timeScale = 1;
  aidTier: AidTier = 0;
  hintsUsed: HintsUsed = 0;
  sim: unknown = null;
  open = false;
  solved = false;
  target: unknown = null;
  eased: unknown = null;
  described: Described = EMPTY_DESCRIBED;
  errors = 0;
  private simAcc = 0;
  private lastSr = "";
  private lastSrAt = -Infinity;
  private lastProbe: number | null = null;

  constructor(private readonly o: CoreOpts, private readonly warn: (msg: string, err: unknown) => void = () => {}) {
    this.meta = o.meta;
    this.target = this.safe(() => this.meta.pose(this.poseInput()), null);
    this.eased = this.target;
    this.lastProbe = this.probeValue();
  }

  private safe<T>(fn: () => T, fallback: T): T {
    try {
      return fn();
    } catch (err) {
      if (this.errors++ === 0) this.warn(`contraption ${this.meta.id}: a meta function threw; keeping the last pose`, err);
      return fallback;
    }
  }

  probeSpec() {
    return this.safe(() => this.meta.probe(this.o.config, this.o.view), null);
  }
  /** draft?.probe ?? probeSpec.initial ?? probeSpec.min; null without a probe. */
  probeValue(): number | null {
    const spec = this.probeSpec();
    if (!spec) return null;
    return this.draft?.probe ?? spec.initial ?? spec.min;
  }

  poseInput(): PoseInput<unknown, unknown> {
    return {
      view: this.o.view,
      draft: this.draft,
      config: this.o.config,
      probe: this.probeValue(),
      t: this.t,
      aidTier: this.aidTier,
      hintsUsed: this.hintsUsed,
      sim: this.sim,
      solved: this.solved,
      reducedMotion: this.o.reducedMotion,
    };
  }
  staticInput(): StaticInput<unknown> {
    return {
      view: this.o.view,
      config: this.o.config,
      aidTier: this.aidTier,
      hintsUsed: this.hintsUsed,
      reducedMotion: this.o.reducedMotion,
      skinId: this.o.skinId,
      record: this.o.record,
    };
  }

  private resetsOn(ev: "open" | "settle" | "probe_change" | "arena"): boolean {
    return this.meta.clock?.resetOn.includes(ev) ?? false;
  }
  private initSim(): void {
    const sim = this.meta.sim;
    if (!sim) return;
    this.sim = this.safe(() => sim.init(this.o.seed, this.o.config, this.o.view, { draft: this.draft, probe: this.probeValue(), t: this.t, aidTier: this.aidTier }), null);
    this.simAcc = 0;
  }

  /** Live updates from the panel (drafts through refs, never React state). */
  bind(draft: Draft | null): void {
    const prev = this.draft;
    this.draft = draft;
    if (!this.solved && this.state !== "dormant") this.state = draft ? "active" : "awake";
    const settledNow = !!draft?.settled && !prev?.settled;
    const probe = this.probeValue();
    const probeChanged = probe !== this.lastProbe;
    this.lastProbe = probe;
    if (settledNow && this.resetsOn("settle")) this.t = 0;
    if (probeChanged && this.resetsOn("probe_change")) this.t = 0;
    const simReset = this.meta.sim?.resetOn ?? [];
    if (
      (simReset.includes("draft_change") && draft?.seq !== prev?.seq) ||
      (simReset.includes("probe_change") && probeChanged) ||
      (simReset.includes("settle") && settledNow)
    ) {
      this.initSim();
    }
  }

  /** The panel opened (or closed) on this station: clocks and sims reset per resetOn "open". */
  setOpen(open: boolean): void {
    if (open === this.open) return;
    this.open = open;
    if (!open) return;
    if (this.resetsOn("open")) this.t = 0;
    if (this.meta.sim && (this.sim === null || this.meta.sim.resetOn.includes("open"))) this.initSim();
    if (!this.solved) this.state = this.draft ? "active" : "awake";
  }
  /** A boss arena began (clock resetOn "arena"). */
  arena(): void {
    if (this.resetsOn("arena")) this.t = 0;
  }

  setAidTier(tier: AidTier, hintsUsed: HintsUsed): void {
    this.aidTier = tier;
    this.hintsUsed = hintsUsed;
  }
  setState(state: ContraptionState): void {
    this.state = state;
    if (state === "solved") this.solved = true;
  }

  /** One frame: clock, sim at fixed dt (≤ 4 steps, only while open), target pose, eased pose, describe(). */
  tick(dtMs: number): void {
    const dt = Math.max(0, dtMs) / 1000;
    this.t += dt * this.timeScale;
    const sim = this.meta.sim;
    if (sim && this.open && this.sim !== null) {
      this.simAcc += dt * this.timeScale;
      let n = 0;
      while (this.simAcc >= sim.fixedDt && n < MAX_SIM_STEPS) {
        const ctx = { draft: this.draft, probe: this.probeValue(), t: this.t, aidTier: this.aidTier };
        this.sim = this.safe(() => sim.step(this.sim, sim.fixedDt, ctx), this.sim);
        this.simAcc -= sim.fixedDt;
        n++;
      }
      if (n === MAX_SIM_STEPS) this.simAcc = 0; // drop the backlog after a hitch
    }
    const input = this.poseInput();
    this.target = this.safe(() => (this.solved ? this.meta.solvedPose(input) : this.meta.pose(input)), this.target);
    const k = this.o.reducedMotion ? 1 : smoothingFactor(dtMs);
    this.eased = this.eased === null ? this.target : this.safe(() => this.meta.lerp(this.eased, this.target, k), this.target);
    this.described = this.safe(() => this.meta.describe(this.eased, input), this.described);
  }

  /** The screen-reader line when it changed and a second has passed since the last one (§2.5.3), else null. */
  srDue(nowMs: number): string | null {
    const text = this.described.srText;
    if (!text || text === this.lastSr || nowMs - this.lastSrAt < SR_THROTTLE_MS) return null;
    this.lastSr = text;
    this.lastSrAt = nowMs;
    return text;
  }

  /** Instant solved state (warp, autoSolve, re-entry): D3. */
  settleSolved(): void {
    this.solved = true;
    this.state = "solved";
    const input = this.poseInput();
    this.target = this.safe(() => this.meta.solvedPose(input), this.target);
    this.eased = this.target;
  }

  failurePlan(d: Diagnosis): FailurePlan {
    return this.safe(() => this.meta.failurePlan(d, this.poseInput()), { beats: [], durationMs: 800, cue: "latch_slip" });
  }
  /** input.draft = the solution draft (the client binds it before Verify resolves), solved = true. */
  successPlan(): SuccessPlan {
    return this.safe(() => this.meta.successPlan({ ...this.poseInput(), solved: true }, this.o.payoffAnim), { beats: [], cardEffects: [], durationMs: 1400, cue: "ui_badge" });
  }
  solvedPose(): unknown {
    return this.safe(() => this.meta.solvedPose({ ...this.poseInput(), solved: true }), this.eased);
  }
  hintTargets(rung: HintRung): readonly HintTarget[] {
    return this.safe(() => hintTargetsFor(this.o.station, this.meta, rung, this.staticInput()), []);
  }
  audio(): readonly AudioParam[] {
    return this.safe(() => this.meta.audio(this.eased, this.poseInput()), []);
  }
  frameBounds(): { x: number; y: number; w: number; h: number } {
    return this.safe(() => this.meta.frameBounds(this.o.config, this.o.view), { x: -420, y: -560, w: 840, h: 640 });
  }

  /** {...meta.debug(eased), target.*: meta.debug(target), state, seq, t, aidTier, probe, sim.* readout}. */
  debugState(): Record<string, number | string | boolean> {
    const out: Record<string, number | string | boolean> = {};
    Object.assign(out, this.safe(() => this.meta.debug(this.eased), {}));
    for (const [k, v] of Object.entries(this.safe(() => this.meta.debug(this.target), {}))) out[`target.${k}`] = v;
    out.state = this.state;
    out.seq = this.draft?.seq ?? -1;
    out.t = Math.round(this.t * 1000) / 1000;
    out.aidTier = this.aidTier;
    out.hintsUsed = this.hintsUsed;
    out.open = this.open;
    const probe = this.probeValue();
    if (probe !== null) out.probe = probe;
    const sim = this.meta.sim;
    if (sim && this.sim !== null) for (const [k, v] of Object.entries(this.safe(() => sim.readout(this.sim), {}))) out[`sim.${k}`] = v;
    return out;
  }
}
