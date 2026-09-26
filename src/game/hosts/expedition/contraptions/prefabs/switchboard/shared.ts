/**
 * switchboard prefab shared machinery (docs/design/20 §2.5.5; civil §5.7). Owned by KC (L8) with the prefab core; the
 * skin file plugs a `SwitchboardSkin` (static parts, jacks, lamps, steps) into `createSwitchboardView`, which owns the
 * patch cords (prefabs/_cables Verlet ropes, read only: 12 points, gravity 900, settle ≈ 0.5 s), the failure beats
 * (the cord in `wrongKeys[0]` unseats and drops, its jack flickers amber) and the success beats (lamps turn cyan in
 * sequence, the program prints, the steps rise). Stand-in art in the biome palette; world text is DOM (§5.3).
 */
import type Phaser from "phaser";
import { createCable, type CableHandle, type CableShape, type CableStyle } from "../_cables";
import type { SwitchboardConfig } from "@/world/contraptions/switchboard.config";
import {
  CORD_GRAVITY,
  CORD_SEGMENTS,
  leftJackAt,
  rightJackAt,
  SHEET_AT,
  STEPS_TO,
  type SwitchboardPose,
  type SwitchCord,
  type SwitchJack,
  type XY,
} from "@/world/contraptions/switchboard.meta";
import type { FailBeat, FailurePlan, PairsView, SuccessBeat, SuccessPlan } from "@/world/types";
import type { BiomePalette, ContraptionState, PoseView, PrefabProps } from "../../types";

export const ARCHETYPE_ID = "switchboard";
/** W0 seam (tests/world-contract.test.ts checks every prefab shared.ts keeps it); the skins here no longer use it. */
export { stubBox, type StubBoxOptions } from "../_stub";

export interface SwitchColors {
  wood: number;
  woodDeep: number;
  brass: number;
  brassHi: number;
  brassDeep: number;
  ink: number;
  paper: number;
  cord: number;
  white: number;
  cyan: number;
  cyanHi: number;
  flicker: number;
  dormant: number;
  marble: number;
  marbleShade: number;
}
export function hexOf(palette: BiomePalette, token: string, fallback: number): number {
  const v = palette[token];
  if (typeof v !== "string") return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  return m ? parseInt(m[1], 16) : fallback;
}
export function switchColors(palette: BiomePalette): SwitchColors {
  return {
    wood: hexOf(palette, "bronze.ring", 0x6e4a2e),
    woodDeep: hexOf(palette, "brick.shade", 0x7e4038),
    brass: hexOf(palette, "brass.base", 0xd9a441),
    brassHi: hexOf(palette, "brass.hi", 0xf6d27a),
    brassDeep: hexOf(palette, "brass.deep", 0xa8782e),
    ink: hexOf(palette, "ink", 0x2b3a44),
    paper: hexOf(palette, "paper", 0xf7f1e3),
    cord: hexOf(palette, "paper.aged", 0xe9d8b4),
    white: 0xffffff,
    cyan: hexOf(palette, "recordlight", 0x6ed2f2),
    cyanHi: hexOf(palette, "recordlight.hi", 0xc9f3ff),
    flicker: hexOf(palette, "autumn", 0xe48c5e),
    dormant: hexOf(palette, "dormant", 0xa9a3b8),
    marble: hexOf(palette, "stone.lit", 0xfbf1de),
    marbleShade: hexOf(palette, "stone.shade", 0xd9c3a0),
  };
}

/** Transient per-jack state (ms counters count down in update). */
export interface JackFx {
  flash: number; // amber flicker
  cyan: boolean; // the success sequence reached it
}
export interface SwitchDyn {
  now: number;
  print: number | null; // 0 → 1 the program outfeed
  rise: number | null; // 0 → 1 the steps sweeping solid
  sheetFlash: number; // ms left of the margin-note glow on the sheet
  stepCyan: Set<number>; // step lamps lit by the success sequence
  state: ContraptionState;
}

export interface SwitchCtx {
  scene: Phaser.Scene;
  props: PrefabProps<SwitchboardConfig>;
  colors: SwitchColors;
  consoleLocal: XY;
  groundLocal: number;
  reducedMotion: boolean;
}
export interface SwitchboardSkin {
  skinId: string;
  /** static parts (cabinet, jack field, sheet stand, the steps' wireframe); returns skin anchors */
  build(ctx: SwitchCtx, back: Phaser.GameObjects.Graphics): Record<string, XY>;
  drawJack(g: Phaser.GameObjects.Graphics, j: SwitchJack, fx: JackFx, ctx: SwitchCtx, now: number): void;
  /** the program sheet, step lamps, steps and outfeed (every frame) */
  drawDynamic(g: Phaser.GameObjects.Graphics, pose: SwitchboardPose, dyn: SwitchDyn, ctx: SwitchCtx): void;
  cordStyle(ctx: SwitchCtx, lit: boolean): Partial<CableStyle>;
}

const NO_FX: JackFx = { flash: 0, cyan: false };
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function cordShape(c: Pick<SwitchCord, "shape" | "sag">, floorY: number): CableShape {
  return c.shape === "catenary" ? { kind: "sag", sag: c.sag, segments: 16 } : { kind: "verlet", segments: CORD_SEGMENTS, gravity: CORD_GRAVITY, slack: 1.12, floorY };
}

function rowsOf(view: unknown): { lefts: string[]; rights: string[] } {
  const v = view as Partial<PairsView> | null;
  const keys = (rows: unknown) => (Array.isArray(rows) ? rows.map((r) => (r as { key?: unknown })?.key).filter((k): k is string => typeof k === "string") : []);
  return { lefts: keys(v?.lefts), rights: keys(v?.rights) };
}

export function createSwitchboardView(scene: Phaser.Scene, props: PrefabProps<SwitchboardConfig>, skin: SwitchboardSkin): PoseView<SwitchboardPose> {
  const anchor = props.station.anchor;
  const ctx: SwitchCtx = {
    scene,
    props,
    colors: switchColors(props.palette),
    consoleLocal: { x: props.station.consoleX - anchor.x, y: props.groundY - anchor.y },
    groundLocal: props.groundY - anchor.y,
    reducedMotion: props.reducedMotion,
  };
  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics();
  const cordsLayer = scene.add.container(0, 0);
  const front = scene.add.graphics();
  const dynamic = scene.add.graphics();
  root.add([back, dynamic, front, cordsLayer]);

  const anchors: Record<string, XY> & { console: XY } = { ...skin.build(ctx, back), console: ctx.consoleLocal };
  const { lefts, rights } = rowsOf(props.view);
  lefts.forEach((k, i) => {
    anchors[`left_${i}`] = leftJackAt(i, lefts.length);
    anchors[`jack_${k}`] = anchors[`left_${i}`];
  });
  rights.forEach((k, j) => {
    anchors[`right_${j}`] = rightJackAt(j, rights.length);
    anchors[`jack_${k}`] = anchors[`right_${j}`];
  });
  if (!anchors.sheet) anchors.sheet = SHEET_AT;
  if (!anchors.steps) anchors.steps = { x: (STEPS_TO.x + 200) / 2, y: STEPS_TO.y / 2 };
  anchors.payoff = anchors.steps;

  const cords = new Map<string, { cable: CableHandle; cord: SwitchCord; lit: boolean }>();
  const fx = new Map<string, JackFx>();
  const timers: Phaser.Time.TimerEvent[] = [];
  const dyn: SwitchDyn = { now: 0, print: null, rise: null, sheetFlash: 0, stepCyan: new Set(), state: "dormant" };
  let pose: SwitchboardPose | null = null;
  let destroyed = false;

  const fxOf = (k: string): JackFx => fx.get(k) ?? NO_FX;
  const setFx = (k: string, patch: Partial<JackFx>) => fx.set(k, { ...fxOf(k), ...patch });
  const later = (ms: number, fn: () => void) => {
    if (ms <= 0 || ctx.reducedMotion) {
      fn();
      return;
    }
    timers.push(scene.time.delayedCall(ms, () => !destroyed && fn()));
  };
  const wait = (ms: number) => new Promise<void>((resolve) => later(ms, resolve));
  const floorY = ctx.groundLocal - 30;

  const syncCords = (p: SwitchboardPose) => {
    const seen = new Set<string>();
    for (const c of p.cords) {
      const id = `${c.leftKey}>${c.rightKey}`;
      seen.add(id);
      const cur = cords.get(id);
      if (cur) {
        cur.cord = c;
        cur.cable.setEnds(c.a, c.b);
        continue;
      }
      const cable = createCable(scene, cordsLayer, { from: c.a, to: c.b, shape: cordShape(c, floorY), style: skin.cordStyle(ctx, false), reducedMotion: ctx.reducedMotion });
      cords.set(id, { cable, cord: c, lit: false });
    }
    for (const [id, e] of cords) {
      if (seen.has(id)) continue;
      e.cable.destroy();
      cords.delete(id);
    }
  };
  const reseatAll = () => {
    for (const e of cords.values()) {
      e.cable.unseat(null);
      e.cable.setShape(cordShape(e.cord, floorY));
    }
  };

  const view: PoseView<SwitchboardPose> = {
    root,
    anchors,
    applyPose(p: SwitchboardPose) {
      pose = p;
      syncCords(p);
      if (p.solved) {
        for (const e of cords.values()) {
          if (e.lit) continue;
          e.lit = true;
          e.cable.setStyle(skin.cordStyle(ctx, true));
        }
      }
    },
    setState(state: ContraptionState) {
      dyn.state = state;
      try {
        props.fx.dormancy(root, state === "dormant");
      } catch {
        root.setAlpha(state === "dormant" ? 0.6 : 1);
      }
    },
    async playSucceed(plan: SuccessPlan, p: SwitchboardPose) {
      for (const b of plan.beats as readonly SuccessBeat[]) {
        later(b.atMs, () => {
          if (b.action === "light_sequence") {
            const li = Number(b.anchor.replace("left_", ""));
            const lk = lefts[li];
            const cord = pose?.cords.find((c) => c.leftKey === lk);
            if (lk) setFx(lk, { cyan: true });
            if (cord) {
              setFx(cord.rightKey, { cyan: true });
              const e = cords.get(`${cord.leftKey}>${cord.rightKey}`);
              if (e) {
                e.lit = true;
                e.cable.setStyle(skin.cordStyle(ctx, true));
              }
            }
          } else if (b.action === "print") dyn.print = 0;
          else if (b.action === "rise") dyn.rise = 0;
          else if (b.action === "ignite") dyn.stepCyan.add(num(b.params?.lamp, 0));
        });
      }
      await wait(plan.durationMs);
      if (destroyed) return;
      dyn.print = 1;
      dyn.rise = 1;
      view.applyPose(p);
    },
    async playFail(plan: FailurePlan, p: SwitchboardPose) {
      for (const b of plan.beats as readonly FailBeat[]) {
        later(b.atMs, () => {
          if (b.action === "unseat") {
            const lk = typeof b.params?.leftKey === "string" ? b.params.leftKey : null;
            for (const e of cords.values()) if (e.cord.leftKey === lk) e.cable.unseat("to");
          } else if (b.action === "flash" && b.anchor === "sheet") dyn.sheetFlash = 1200;
          else if (b.action === "flash") {
            const k = typeof b.params?.key === "string" ? b.params.key : null;
            if (k) setFx(k, { flash: 800 });
          }
        });
      }
      await wait(Math.min(1600, plan.durationMs));
      if (destroyed) return;
      fx.clear();
      reseatAll(); // back to the draft pose: the draft still holds that cord
      view.applyPose(pose ?? p);
    },
    update(dtMs: number) {
      if (destroyed) return;
      const dt = Math.max(0, dtMs);
      dyn.now += dt;
      dyn.sheetFlash = Math.max(0, dyn.sheetFlash - dt);
      for (const [k, f] of fx) if (f.flash > 0) fx.set(k, { ...f, flash: Math.max(0, f.flash - dt) });
      const step = (v: number | null, ms: number) => (v === null ? null : Math.min(1, v + (ctx.reducedMotion ? 1 : dt / ms)));
      dyn.print = step(dyn.print, 700);
      dyn.rise = step(dyn.rise, 900);
      for (const e of cords.values()) e.cable.update(dt);
      front.clear();
      dynamic.clear();
      if (!pose) return;
      for (const j of [...pose.lefts, ...pose.rights]) skin.drawJack(front, j, fxOf(j.key), ctx, dyn.now);
      skin.drawDynamic(dynamic, pose, dyn, ctx);
    },
    destroy() {
      destroyed = true;
      for (const t of timers) t.remove(false);
      for (const e of cords.values()) e.cable.destroy();
      cords.clear();
      root.destroy(true);
    },
  };
  return view;
}
