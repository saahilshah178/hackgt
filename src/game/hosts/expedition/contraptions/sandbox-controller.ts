/**
 * contraptions/sandbox-controller.ts (H1) — the station loop for a sandbox (docs/design/20 §2.4b): SandboxCore + the
 * sandbox prefab's PoseView + labels. Goals are reported through `onGoal` the first time they hold; the client
 * records `sandbox_goal` and applies the reward once.
 */
import type Phaser from "phaser";
import type { ResolvedSandbox, SandboxDraft } from "../../../../world/types";
import type { LabelStore } from "../labels/label-store";
import { stubBox } from "./prefabs/_stub";
import { sandboxPrefabFor } from "./registry";
import { SandboxCore } from "./sandbox-core";
import type { FxKit, PoseView, SandboxInstance, SandboxPrefabProps, XY } from "./types";

export interface SandboxDeps {
  scene: Phaser.Scene;
  P: typeof Phaser;
  sandbox: ResolvedSandbox;
  groundY: number;
  palette: Readonly<Record<string, string>>;
  fx: FxKit;
  tex: (key: string) => string;
  anchorsOf: (key: string) => Readonly<Record<string, XY>>;
  labels: LabelStore;
  seed: number;
  reducedMotion: boolean;
  onGoal: (sandboxId: string, goal: string) => void;
  warn: (msg: string, err?: unknown) => void;
}

export class SandboxController implements SandboxInstance {
  readonly sandboxId: string;
  readonly core: SandboxCore;
  readonly view: PoseView<unknown>;

  constructor(private readonly d: SandboxDeps) {
    this.sandboxId = d.sandbox.id;
    this.core = new SandboxCore(d.sandbox.meta, d.sandbox.parsedConfig, d.seed, d.reducedMotion, d.sandbox.goal, (m, e) => d.warn(m, e));
    const props: SandboxPrefabProps<unknown> = {
      sandbox: d.sandbox,
      config: d.sandbox.parsedConfig,
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
      const prefab = sandboxPrefabFor(d.sandbox.contraption);
      if (!prefab) throw new Error(`unknown sandbox ${d.sandbox.contraption}`);
      view = prefab.create(d.scene, d.P, props);
    } catch (err) {
      d.warn(`sandbox prefab ${d.sandbox.contraption} failed; drawing a stand-in`, err);
      view = stubBox(d.scene, { at: d.sandbox.anchor, console: { x: d.sandbox.consoleX, y: d.groundY }, label: d.sandbox.title });
    }
    this.view = view;
    view.root.setDepth(60);
    view.setState("awake");
  }

  bind(draft: SandboxDraft | null): void {
    this.core.bind(draft);
  }
  setOpen(open: boolean): void {
    this.core.setOpen(open);
    this.view.setState(open ? "active" : "awake");
  }
  update(dtMs: number): void {
    const goal = this.core.tick(dtMs);
    try {
      if (this.core.eased !== null) this.view.applyPose(this.core.eased);
      this.view.update?.(dtMs);
    } catch (err) {
      if (this.core.errors++ === 0) this.d.warn(`sandbox prefab ${this.d.sandbox.contraption} threw`, err);
    }
    if (goal) this.d.onGoal(this.sandboxId, goal);
    if (this.core.open) {
      this.core.described.chips.forEach((c, i) => {
        const a = this.view.anchors[c.anchor] ?? { x: 0, y: 0 };
        this.d.labels.set({ id: `chip:${this.sandboxId}:${i}`, kind: "chip", x: this.view.root.x + a.x, y: this.view.root.y + a.y, text: c.text, color: c.color, dy: -34 * i });
      });
      if (this.core.described.srText) this.d.labels.setSr(this.sandboxId, this.core.described.srText);
    }
  }
  frameBounds(): { x: number; y: number; w: number; h: number } {
    const b = this.core.frameBounds();
    return { x: this.d.sandbox.anchor.x + b.x, y: this.d.sandbox.anchor.y + b.y, w: b.w, h: b.h };
  }
  debugState(): Record<string, number | string | boolean> {
    return this.core.debugState();
  }
  destroy(): void {
    try {
      this.view.destroy();
    } catch {
      this.view.root.destroy(true);
    }
  }
}
