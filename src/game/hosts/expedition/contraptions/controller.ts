/**
 * contraptions/controller.ts (H1) — one ContraptionController per station of the current zone (docs/design/20 §2.5.3):
 * ControllerCore (pure: clock, sim, aid tier, probe, draft → target → eased pose, describe, plans) + the prefab's
 * PoseView + the label store (chips, pins, throttled screen-reader text). Written once for every prefab.
 */
import type Phaser from "phaser";
import type { Encounter } from "../../../../contracts/gamespec";
import type { AidTier, Diagnosis, Draft, HintRung, HintsUsed, HintTarget, ResolvedStation } from "../../../../world/types";
import type { LabelStore } from "../labels/label-store";
import { ControllerCore, type ContraptionState } from "./controller-core";
import { prefabFor } from "./registry";
import type { ContraptionInstance, FxKit, PoseView, PrefabProps, XY } from "./types";

export interface ControllerDeps {
  scene: Phaser.Scene;
  P: typeof Phaser;
  station: ResolvedStation;
  encounter: Encounter;
  view: unknown;
  groundY: number;
  palette: Readonly<Record<string, string>>;
  fx: FxKit & { updateBeams?(tMs: number): void };
  tex: (key: string) => string;
  anchorsOf: (key: string) => Readonly<Record<string, XY>>;
  labels: LabelStore;
  seed: number;
  reducedMotion: boolean;
  record: boolean;
  warn: (msg: string, err?: unknown) => void;
}

export const CONTRAPTION_DEPTH = 60;

export class ContraptionController implements ContraptionInstance {
  readonly encounterId: string;
  readonly core: ControllerCore;
  readonly view: PoseView<unknown>;
  private busy = false;
  private clockMs = 0;

  constructor(private readonly d: ControllerDeps) {
    this.encounterId = d.station.encounterId;
    this.core = new ControllerCore(
      {
        meta: d.station.meta,
        config: d.station.parsedConfig,
        view: d.view,
        skinId: d.station.skin,
        seed: d.seed,
        reducedMotion: d.reducedMotion,
        record: d.record,
        payoffAnim: d.station.payoff.anim,
        station: d.station,
      },
      (msg, err) => d.warn(msg, err),
    );
    const props: PrefabProps<unknown> = {
      station: d.station,
      config: d.station.parsedConfig,
      encounter: d.encounter,
      view: d.view,
      groundY: d.groundY,
      palette: d.palette,
      fx: d.fx,
      tex: d.tex,
      anchorsOf: d.anchorsOf,
      seed: d.seed,
      reducedMotion: d.reducedMotion,
    };
    let view: PoseView<unknown>;
    try {
      view = prefabFor(d.station.contraption).create(d.scene, d.P, props);
    } catch (err) {
      d.warn(`prefab ${d.station.contraption}/${d.station.skin} failed to build; using console_slate`, err);
      view = prefabFor("console_slate").create(d.scene, d.P, props);
    }
    this.view = view;
    view.root.setDepth(CONTRAPTION_DEPTH);
    view.setState("dormant");
    this.safeApply(this.core.eased);
  }

  private safeApply(pose: unknown): void {
    if (pose === null || pose === undefined) return;
    try {
      this.view.applyPose(pose);
    } catch (err) {
      if (this.core.errors++ === 0) this.d.warn(`prefab ${this.d.station.contraption}: applyPose threw`, err);
    }
  }

  get state(): ContraptionState {
    return this.core.state;
  }
  get solved(): boolean {
    return this.core.solved;
  }

  bind(draft: Draft | null): void {
    this.core.bind(draft);
    if (!this.core.solved) this.view.setState(this.core.state);
  }
  setOpen(open: boolean): void {
    this.core.setOpen(open);
    if (!this.core.solved) this.view.setState(this.core.state);
  }
  arena(): void {
    this.core.arena();
  }
  setAidTier(tier: AidTier, hintsUsed: HintsUsed): void {
    this.core.setAidTier(tier, hintsUsed);
  }
  hint(rung: HintRung): readonly HintTarget[] {
    return this.core.hintTargets(rung);
  }
  async succeed(): Promise<void> {
    this.busy = true;
    try {
      const plan = this.core.successPlan();
      await this.view.playSucceed(plan, this.core.solvedPose());
    } catch (err) {
      this.d.warn(`prefab ${this.d.station.contraption}: playSucceed threw`, err);
    } finally {
      this.core.settleSolved();
      this.view.setState("solved");
      this.safeApply(this.core.eased);
      this.busy = false;
    }
  }
  async fail(diagnosis: Diagnosis): Promise<void> {
    this.busy = true;
    try {
      const plan = this.core.failurePlan(diagnosis);
      await this.view.playFail(plan, this.core.eased);
    } catch (err) {
      this.d.warn(`prefab ${this.d.station.contraption}: playFail threw`, err);
    } finally {
      this.busy = false;
    }
  }
  settleSolved(): void {
    this.core.settleSolved();
    this.view.setState("solved");
    this.safeApply(this.core.eased);
  }
  setState(state: ContraptionState): void {
    if (this.core.solved && state !== "solved") return;
    this.core.setState(state);
    this.view.setState(state);
  }
  /** World-space frame bounds: station.anchor + meta.frameBounds (amendment 32). */
  frameBounds(): { x: number; y: number; w: number; h: number } {
    const b = this.core.frameBounds();
    return { x: this.d.station.anchor.x + b.x, y: this.d.station.anchor.y + b.y, w: b.w, h: b.h };
  }
  /** World position of a PoseView anchor (the anchor point itself when unknown). */
  anchorWorld(name: string): { x: number; y: number } {
    const a = this.view.anchors[name];
    const r = this.view.root;
    if (!a) return { x: r.x, y: r.y };
    return { x: r.x + a.x * r.scaleX, y: r.y + a.y * r.scaleY };
  }

  update(dtMs: number): void {
    this.clockMs += dtMs;
    this.core.tick(dtMs);
    if (!this.busy) this.safeApply(this.core.eased);
    try {
      this.view.update?.(dtMs);
    } catch (err) {
      if (this.core.errors++ === 0) this.d.warn(`prefab ${this.d.station.contraption}: update threw`, err);
    }
    this.d.fx.updateBeams?.(this.clockMs);
    this.publishLabels();
  }

  private publishLabels(): void {
    const { labels } = this.d;
    const st = this.core.state;
    if (st === "dormant") return;
    const showChips = this.core.open || st === "active";
    const id = this.encounterId;
    if (showChips) {
      const stack = new Map<string, number>();
      this.core.described.chips.forEach((c, i) => {
        const at = this.anchorWorld(c.anchor);
        const n = stack.get(c.anchor) ?? 0;
        stack.set(c.anchor, n + 1);
        labels.set({ id: `chip:${id}:${i}`, kind: "chip", x: at.x, y: at.y, text: c.text, color: c.color, dy: -34 * n });
      });
    }
    const pins = [...this.d.station.pins.map((p) => ({ anchor: p.anchor, text: p.text, glyph: p.glyph })), ...this.core.described.pins];
    pins.forEach((p, i) => {
      if (!p.text && !p.glyph) return;
      const at = this.anchorWorld(p.anchor);
      labels.set({ id: `pin:${id}:${i}`, kind: "pin", x: at.x, y: at.y, text: p.text ?? "", glyph: p.glyph });
    });
    const sr = this.core.srDue(this.clockMs);
    if (sr) labels.setSr(id, sr);
  }

  debugState(): Record<string, number | string | boolean> {
    return { ...this.core.debugState(), busy: this.busy, contraption: this.d.station.contraption, skin: this.d.station.skin };
  }
  destroy(): void {
    try {
      this.view.destroy();
    } catch {
      this.view.root.destroy(true);
    }
  }
}
