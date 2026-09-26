/**
 * contraptions/sandbox-core.ts (pure, H1) — the sandbox loop without Phaser (docs/design/20 §2.4b): draft → sim step
 * → pose → ease → describe, plus the goal history (drafts, seconds active, inputs moved, ranges visited, all tokens
 * placed). A goal is reported the FIRST time `meta.goalMet` holds. No runner, no Verify, no grade.
 */
import { smoothingFactor } from "../../../../world/ease";
import type { AnySandboxMeta, Described, SandboxDraft, SandboxHistory, SandboxPoseInput } from "../../../../world/types";

const EMPTY: Described = { chips: [], pins: [], srText: "", nearMiss: null };

export class SandboxCore {
  draft: SandboxDraft | null = null;
  t = 0;
  sim: unknown = null;
  open = false;
  target: unknown = null;
  eased: unknown = null;
  described: Described = EMPTY;
  readonly achieved = new Set<string>();
  private drafts = 0;
  private secondsActive = 0;
  private moved = new Set<string>();
  private ranges: Record<string, [number, number]> = {};
  private simAcc = 0;
  errors = 0;

  constructor(
    readonly meta: AnySandboxMeta,
    private readonly config: unknown,
    private readonly seed: number,
    private readonly reducedMotion: boolean,
    private readonly goal: string | null,
    private readonly warn: (msg: string, err: unknown) => void = () => {},
  ) {
    this.target = this.safe(() => meta.pose(this.input()), null);
    this.eased = this.target;
  }

  private safe<T>(fn: () => T, fallback: T): T {
    try {
      return fn();
    } catch (err) {
      if (this.errors++ === 0) this.warn(`sandbox ${this.meta.id}: a meta function threw`, err);
      return fallback;
    }
  }
  input(): SandboxPoseInput<unknown, unknown> {
    return { config: this.config, draft: this.draft, t: this.t, sim: this.sim, reducedMotion: this.reducedMotion };
  }
  history(): SandboxHistory {
    const inputs = this.safe(() => this.meta.inputs(this.config), []);
    const tokens = inputs.flatMap((i) => (i.kind === "tokens" ? i.tokens.map((t) => t.key) : []));
    const placedAll = tokens.length > 0 && tokens.every((k) => this.draft?.placed[k] !== undefined);
    return { drafts: this.drafts, secondsActive: this.secondsActive, moved: new Set(this.moved), ranges: { ...this.ranges }, placedAll };
  }

  setOpen(open: boolean): void {
    this.open = open;
    if (open && this.meta.sim && this.sim === null) this.sim = this.safe(() => this.meta.sim?.init(this.seed, this.config, null, { draft: null, probe: null, t: this.t, aidTier: 0 }) ?? null, null);
  }

  bind(draft: SandboxDraft | null): void {
    const prev = this.draft;
    this.draft = draft;
    if (!draft) return;
    if (draft.seq !== prev?.seq) this.drafts++;
    for (const [id, v] of Object.entries(draft.values)) {
      if (prev && prev.values[id] !== undefined && prev.values[id] !== v) this.moved.add(id);
      if (!prev && Object.keys(draft.values).length > 0) {
        // the first draft sets the baseline; movement counts from here
      }
      const r = this.ranges[id];
      this.ranges[id] = r ? [Math.min(r[0], v), Math.max(r[1], v)] : [v, v];
    }
    for (const id of Object.keys(draft.placed)) if (prev?.placed[id] !== draft.placed[id]) this.moved.add(id);
  }

  /** One frame; returns the goal reached this frame (first time only), else null. */
  tick(dtMs: number): string | null {
    const dt = Math.max(0, dtMs) / 1000;
    this.t += dt;
    if (this.open) this.secondsActive += dt;
    const sim = this.meta.sim;
    if (sim && this.open && this.sim !== null) {
      this.simAcc += dt;
      let n = 0;
      while (this.simAcc >= sim.fixedDt && n < 4) {
        this.sim = this.safe(() => sim.step(this.sim, sim.fixedDt, { draft: null, probe: null, t: this.t, aidTier: 0 }), this.sim);
        this.simAcc -= sim.fixedDt;
        n++;
      }
      if (n === 4) this.simAcc = 0;
    }
    const input = this.input();
    this.target = this.safe(() => this.meta.pose(input), this.target);
    const k = this.reducedMotion ? 1 : smoothingFactor(dtMs);
    this.eased = this.eased === null ? this.target : this.safe(() => this.meta.lerp(this.eased, this.target, k), this.target);
    this.described = this.safe(() => this.meta.describe(this.eased, input), this.described);
    if (this.goal && !this.achieved.has(this.goal) && this.open) {
      const met = this.safe(() => this.meta.goalMet(this.goal as string, this.history(), this.eased), false);
      if (met) {
        this.achieved.add(this.goal);
        return this.goal;
      }
    }
    return null;
  }

  frameBounds(): { x: number; y: number; w: number; h: number } {
    return this.safe(() => this.meta.frameBounds(this.config), { x: -420, y: -560, w: 840, h: 640 });
  }
  debugState(): Record<string, number | string | boolean> {
    return {
      ...this.safe(() => this.meta.debug(this.eased), {}),
      open: this.open,
      t: Math.round(this.t * 1000) / 1000,
      drafts: this.drafts,
      moved: this.moved.size,
      secondsActive: Math.round(this.secondsActive * 10) / 10,
      goals: [...this.achieved].join(","),
    };
  }
}
