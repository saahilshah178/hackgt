/**
 * cause_tubes prefab shared machinery (docs/design/20 §2.5.5; civil §5.5, §5.6, §5.11). Owned by KC (L8) with the
 * prefab core; the three skin files (relay_line, broadcast_relay, big_board) plug a `TubesSkin` into
 * `createTubesView`, which does everything the skins share: the housing layer, the wires (from prefabs/_cables, read
 * only), wire growth and settling, arrow ticks, the success carrier, and the failure and success beat playback.
 *
 * Everything drawn here is code-drawn stand-in art in the biome palette (KC4 swaps hero parts in through
 * `partTexture` once `pnpm art:build` has produced them). World TEXT is never drawn here: node captions, the wire
 * counter and the gauge reading are DOM chips from `meta.describe()` (§5.3).
 */
import type Phaser from "phaser";
import { createCable, pathLength, type CableHandle, type CableShape, type CableStyle } from "../_cables";
import type { CauseTubesConfig } from "@/world/contraptions/cause-tubes.config";
import { housingPositions, type CauseTubesPose, type TubeHousing, type TubeWire, type XY } from "@/world/contraptions/cause-tubes.meta";
import type { ChainView, FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import type { BiomePalette, ContraptionState, PoseView, PrefabProps } from "../../types";
import { arrowTicks, carrierAt, wireGrowU } from "./motion";

export const ARCHETYPE_ID = "cause_tubes";
/** W0 seam (tests/world-contract.test.ts checks every prefab shared.ts keeps it); the skins here no longer use it. */
export { stubBox, type StubBoxOptions } from "../_stub";

// ---------------------------------------------------------------- palette

export interface TubeColors {
  brass: number;
  brassHi: number;
  brassDeep: number;
  ink: number;
  paper: number;
  cyan: number;
  cyanHi: number;
  amber: number;
  flicker: number;
  dormant: number;
  steel: number;
  steelShade: number;
  glass: number;
  wall: number;
}
/** "#rrggbb" palette token → 0xrrggbb, or the fallback when the token is missing or malformed. */
export function hexOf(palette: BiomePalette, token: string, fallback: number): number {
  const v = palette[token];
  if (typeof v !== "string") return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  return m ? parseInt(m[1], 16) : fallback;
}
export function tubeColors(palette: BiomePalette): TubeColors {
  return {
    brass: hexOf(palette, "brass.base", 0xd9a441),
    brassHi: hexOf(palette, "brass.hi", 0xf6d27a),
    brassDeep: hexOf(palette, "brass.deep", 0xa8782e),
    ink: hexOf(palette, "ink", 0x2b3a44),
    paper: hexOf(palette, "paper", 0xf7f1e3),
    cyan: hexOf(palette, "recordlight", 0x6ed2f2),
    cyanHi: hexOf(palette, "recordlight.hi", 0xc9f3ff),
    amber: hexOf(palette, "lamp", 0xf6d27a),
    flicker: hexOf(palette, "autumn", 0xe48c5e),
    dormant: hexOf(palette, "dormant", 0xa9a3b8),
    steel: hexOf(palette, "steel", 0x9aa3b8),
    steelShade: hexOf(palette, "steel.shade", 0x646c85),
    glass: hexOf(palette, "crystal.hi", 0xc9f3ff),
    wall: hexOf(palette, "brick.shade", 0x7e4038),
  };
}

// ---------------------------------------------------------------- per-housing and per-view effects

/** Transient failure/success state of one housing (ms counters count down in update). */
export interface HousingFx {
  spark: number; // ms left of the spark star
  flash: number; // ms left of the amber flicker
  eject: number; // ms left of the card/capsule popping out
  dim: number; // alpha multiplier (1 = normal)
  fog: number; // 0…1 fogged glass (big_board jam)
  droop: number; // radians the dish droops (broadcast_relay)
  lit: boolean; // the success carrier has reached it
}
export const NO_FX: HousingFx = { spark: 0, flash: 0, eject: 0, dim: 1, fog: 0, droop: 0, lit: false };

/** Skin-level transient state. Progress values run 0 → 1 once started (null = not started). */
export interface DynamicFx {
  now: number;
  payoff: number | null; // the gate / lift / launcher animation progress
  board: number | null; // relay_line: the departures board flip cascade
  rail: number | null; // relay_line: the divider rail lifting away
  beam: number | null; // broadcast_relay: the top station's record-light beam
  shiver: number; // ms left of the gauge needle shiver (a stall)
  state: ContraptionState;
}

export interface TubesSkinCtx {
  scene: Phaser.Scene;
  props: PrefabProps<CauseTubesConfig>;
  config: CauseTubesConfig;
  colors: TubeColors;
  /** container-local console position */
  consoleLocal: XY;
  /** container-local y of the ground under the console */
  groundLocal: number;
  /** container-local x of the payoff blocker (null when the station has none) */
  blockerLocal: number | null;
  /** the board width actually used (≤ 1100) */
  W: number;
  reducedMotion: boolean;
}

export interface TubesSkin {
  skinId: string;
  /** skin anchor prefix for housings: "box" (box_0…), "station", "canister" */
  anchorPrefix: string;
  /** draws the static parts once into `back` (behind the wires); returns the skin anchors (incl. `gauge`, `payoff`) */
  build(ctx: TubesSkinCtx, back: Phaser.GameObjects.Graphics): Record<string, XY>;
  /** draws one housing into the front layer (called every frame) */
  drawHousing(g: Phaser.GameObjects.Graphics, h: TubeHousing, fx: HousingFx, ctx: TubesSkinCtx): void;
  /** draws the moving skin parts (gauge needle, gate, lift, launcher) every frame */
  drawDynamic(g: Phaser.GameObjects.Graphics, pose: CauseTubesPose, dyn: DynamicFx, ctx: TubesSkinCtx, anchors: Readonly<Record<string, XY>>): void;
  /** the _cables shape for one wire, `ageMs` after it was laid */
  wireShape(w: TubeWire, ageMs: number, reducedMotion: boolean): CableShape;
  /** the wire style: uncharged, or lit by the success carrier */
  wireStyle(ctx: TubesSkinCtx, lit: boolean): Partial<CableStyle>;
  /** relay_line draws arrow ticks along its wires */
  arrows: boolean;
  /** big_board tubes grow from their source at 900 px/s */
  grows: boolean;
  /** the success carrier is drawn as a capsule (else a current dot) */
  capsule: boolean;
}

// ---------------------------------------------------------------- small drawing helpers (skins use them)

/** A lamp: off (dormant grey), ready (amber), lit (cyan), with an optional amber flicker. */
export function drawLamp(g: Phaser.GameObjects.Graphics, at: XY, r: number, lamp: TubeHousing["lamp"], fx: HousingFx, c: TubeColors, now: number): void {
  const flickerOn = fx.flash > 0 && Math.floor(now / 90) % 2 === 0;
  const lit = fx.lit || lamp === "lit";
  const color = flickerOn ? c.flicker : lit ? c.cyan : lamp === "ready" ? c.amber : c.dormant;
  const alpha = (lamp === "off" && !lit && !flickerOn ? 0.75 : 1) * fx.dim;
  if (lit || lamp === "ready" || flickerOn) {
    g.fillStyle(color, 0.28 * fx.dim);
    g.fillCircle(at.x, at.y, r * 2.1);
  }
  g.fillStyle(c.ink, 0.9 * fx.dim);
  g.fillCircle(at.x, at.y, r + 3);
  g.fillStyle(color, alpha);
  g.fillCircle(at.x, at.y, r);
  if (lit) {
    g.fillStyle(c.cyanHi, 0.9 * fx.dim);
    g.fillCircle(at.x - r * 0.3, at.y - r * 0.3, r * 0.35);
  }
}

/** A brief spark star (no particles: every civil skin is sensitiveSafe). `k` = 1 at the start → 0 at the end. */
export function drawSpark(g: Phaser.GameObjects.Graphics, at: XY, k: number, c: TubeColors): void {
  if (k <= 0) return;
  const r = 18 + 22 * (1 - k);
  g.lineStyle(3, c.brassHi, k);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.3;
    g.beginPath();
    g.moveTo(at.x + Math.cos(a) * r * 0.4, at.y + Math.sin(a) * r * 0.4);
    g.lineTo(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r);
    g.strokePath();
  }
  g.fillStyle(0xffffff, 0.7 * k);
  g.fillCircle(at.x, at.y, 6 * k + 2);
}

/** The focus ring the control's keyboard/pointer focus draws around a housing. */
export function drawFocus(g: Phaser.GameObjects.Graphics, at: XY, w: number, h: number, c: TubeColors): void {
  g.lineStyle(4, c.cyanHi, 0.85);
  g.strokeRoundedRect(at.x - w / 2 - 10, at.y - h / 2 - 10, w + 20, h + 20, 14);
}

/** A loaded texture key for a hero/kit part, or null when the art build has not produced it (stand-in art then). */
export function partTexture(scene: Phaser.Scene, props: PrefabProps<unknown>, assetKey: string): string | null {
  try {
    const key = props.tex(assetKey);
    return scene.textures.exists(key) ? key : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- the view

function nodeKeysOfView(view: unknown): string[] {
  const v = view as Partial<ChainView> | null;
  return Array.isArray(v?.nodes) ? v.nodes.map((n) => n?.key).filter((k): k is string => typeof k === "string") : [];
}
function keyOfBeat(b: FailBeat | SuccessBeat): string | null {
  const p = b.params?.key;
  if (typeof p === "string") return p;
  return b.anchor.startsWith("node_") ? b.anchor.slice(5) : null;
}
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

interface WireEntry {
  cable: CableHandle;
  wire: TubeWire;
  born: number;
  length: number;
  lit: boolean;
}

export function createTubesView(scene: Phaser.Scene, props: PrefabProps<CauseTubesConfig>, skin: TubesSkin): PoseView<CauseTubesPose> {
  const config = props.config;
  const anchor = props.station.anchor;
  const W = Math.min(1100, Math.max(600, config.boardWidth));
  const ctx: TubesSkinCtx = {
    scene,
    props,
    config,
    colors: tubeColors(props.palette),
    consoleLocal: { x: props.station.consoleX - anchor.x, y: props.groundY - anchor.y },
    groundLocal: props.groundY - anchor.y,
    blockerLocal: props.station.payoff.blocker ? props.station.payoff.blocker.x - anchor.x : null,
    W,
    reducedMotion: props.reducedMotion,
  };
  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics();
  const wiresLayer = scene.add.container(0, 0);
  const ticks = scene.add.graphics();
  const front = scene.add.graphics();
  const dynamic = scene.add.graphics();
  root.add([back, wiresLayer, ticks, front, dynamic]);

  const skinAnchors = skin.build(ctx, back);
  const keys = nodeKeysOfView(props.view);
  const places = housingPositions(config.layout, keys.length, config.boardWidth);
  const anchors: Record<string, XY> & { console: XY } = { ...skinAnchors, console: ctx.consoleLocal };
  keys.forEach((k, i) => {
    anchors[`node_${k}`] = places[i];
    anchors[`${skin.anchorPrefix}_${i}`] = places[i];
  });
  if (!anchors.gauge) anchors.gauge = anchors.console;
  if (!anchors.payoff) anchors.payoff = anchors.console;

  const wires = new Map<string, WireEntry>();
  const fx = new Map<string, HousingFx>();
  const slack = new Map<string, number>();
  const timers: Phaser.Time.TimerEvent[] = [];
  const dyn: DynamicFx = { now: 0, payoff: null, board: null, rail: null, beam: null, shiver: 0, state: "dormant" };
  let carrier: { order: string[]; start: number; dur: number } | null = null;
  let pose: CauseTubesPose | null = null;
  let destroyed = false;

  const fxOf = (k: string): HousingFx => fx.get(k) ?? NO_FX;
  const setFx = (k: string, patch: Partial<HousingFx>) => fx.set(k, { ...fxOf(k), ...patch });
  const later = (ms: number, fn: () => void) => {
    if (ms <= 0 || ctx.reducedMotion) {
      fn();
      return;
    }
    timers.push(scene.time.delayedCall(ms, () => !destroyed && fn()));
  };
  const wait = (ms: number) => new Promise<void>((resolve) => later(ms, resolve));

  const syncWires = (p: CauseTubesPose) => {
    const seen = new Set<string>();
    for (const w of p.wires) {
      const id = `${w.fromKey}>${w.toKey}`;
      seen.add(id);
      const cur = wires.get(id);
      if (cur) {
        cur.wire = w;
        cur.cable.setEnds(w.a, w.b);
        continue;
      }
      const cable = createCable(scene, wiresLayer, {
        from: w.a,
        to: w.b,
        shape: skin.wireShape(w, 0, ctx.reducedMotion),
        style: skin.wireStyle(ctx, false),
        reducedMotion: ctx.reducedMotion,
      });
      cable.setSeated(true, true);
      wires.set(id, { cable, wire: w, born: dyn.now, length: pathLength(w.points), lit: false });
    }
    for (const [id, e] of wires) {
      if (seen.has(id)) continue;
      e.cable.destroy();
      wires.delete(id);
    }
  };

  const redraw = () => {
    if (!pose) return;
    ticks.clear();
    front.clear();
    dynamic.clear();
    const litKeys = new Set<string>();
    if (carrier) for (const k of carrierAt(carrier.order, (dyn.now - carrier.start) / carrier.dur).reached) litKeys.add(k);
    if (skin.arrows) {
      ticks.fillStyle(ctx.colors.ink, 0.7);
      for (const e of wires.values()) {
        for (const t of arrowTicks(e.cable.points())) {
          const [ca, sa] = [Math.cos(t.angle), Math.sin(t.angle)];
          ticks.fillTriangle(
            t.at.x + ca * 7, t.at.y + sa * 7,
            t.at.x - ca * 5 - sa * 5, t.at.y - sa * 5 + ca * 5,
            t.at.x - ca * 5 + sa * 5, t.at.y - sa * 5 - ca * 5,
          );
        }
      }
    }
    for (const h of pose.housings) {
      const f = fxOf(h.key);
      skin.drawHousing(front, h, litKeys.has(h.key) ? { ...f, lit: true } : f, ctx);
      if (f.spark > 0) drawSpark(front, { x: h.x, y: h.y }, Math.min(1, f.spark / 400), ctx.colors);
    }
    skin.drawDynamic(dynamic, pose, dyn, ctx, anchors);
  };

  const view: PoseView<CauseTubesPose> = {
    root,
    anchors,
    applyPose(p: CauseTubesPose) {
      pose = p;
      syncWires(p);
    },
    setState(state: ContraptionState) {
      dyn.state = state;
      try {
        props.fx.dormancy(root, state === "dormant");
      } catch {
        root.setAlpha(state === "dormant" ? 0.6 : 1);
      }
    },
    async playSucceed(plan: SuccessPlan, p: CauseTubesPose) {
      for (const b of plan.beats) {
        later(b.atMs, () => {
          const k = keyOfBeat(b);
          if (b.action === "light_sequence" || b.action === "ride") {
            const path = typeof b.params?.path === "string" ? b.params.path.split(",").filter(Boolean) : [];
            carrier = { order: path, start: dyn.now, dur: Math.max(300, num(b.params?.ms, 1200)) };
          } else if (b.action === "ignite" && k !== null) setFx(k, { lit: true });
          else if (b.action === "ignite" && b.anchor === "top") dyn.beam = 0;
          else if (b.action === "print") dyn.board = 0;
          else if (b.action === "rise") dyn.rail = 0;
          else if (b.action === "open" || b.action === "cycle") dyn.payoff = 0;
        });
      }
      await wait(plan.durationMs);
      if (destroyed) return;
      carrier = null;
      for (const e of wires.values()) {
        e.cable.setPacket(null);
        e.cable.setStyle(skin.wireStyle(ctx, true));
        e.lit = true;
      }
      dyn.payoff = 1;
      if (dyn.board !== null) dyn.board = 1;
      if (dyn.rail !== null) dyn.rail = 1;
      if (dyn.beam !== null) dyn.beam = 1;
      view.applyPose(p);
    },
    async playFail(plan: FailurePlan, p: CauseTubesPose) {
      for (const b of plan.beats) {
        later(b.atMs, () => {
          const k = keyOfBeat(b);
          if (b.action === "stall" || k === null) {
            dyn.shiver = 600;
            return;
          }
          if (b.action === "spark") setFx(k, { spark: 400 });
          else if (b.action === "flash") setFx(k, { flash: 700 });
          else if (b.action === "eject") setFx(k, { eject: 900 });
          else if (b.action === "dim") setFx(k, { dim: num(b.params?.alpha, 0.55), fog: b.params?.fog ? 1 : fxOf(k).fog });
          else if (b.action === "jam") setFx(k, { spark: 250, fog: 1 });
          else if (b.action === "tip") setFx(k, { droop: (num(b.params?.deg, 20) * Math.PI) / 180 });
          else if (b.action === "sink") slack.set(k, num(b.params?.slack, 50));
        });
      }
      await wait(Math.min(1600, plan.durationMs));
      if (destroyed) return;
      fx.clear();
      slack.clear();
      view.applyPose(pose ?? p); // back to the draft pose
    },
    update(dtMs: number) {
      if (destroyed) return;
      const dt = Math.max(0, dtMs);
      dyn.now += dt;
      for (const [k, f] of fx) {
        if (f.spark > 0 || f.flash > 0 || f.eject > 0) {
          fx.set(k, { ...f, spark: Math.max(0, f.spark - dt), flash: Math.max(0, f.flash - dt), eject: Math.max(0, f.eject - dt) });
        }
      }
      dyn.shiver = Math.max(0, dyn.shiver - dt);
      const step = (v: number | null, ms: number) => (v === null ? null : Math.min(1, v + (ctx.reducedMotion ? 1 : dt / ms)));
      dyn.payoff = step(dyn.payoff, 900);
      dyn.board = step(dyn.board, 800);
      dyn.rail = step(dyn.rail, 700);
      dyn.beam = step(dyn.beam, 600);
      const run = carrier ? carrierAt(carrier.order, (dyn.now - carrier.start) / carrier.dur) : null;
      for (const e of wires.values()) {
        const age = dyn.now - e.born;
        if (age < 1000 || slack.size > 0) e.cable.setShape(skin.wireShape(e.wire, age, ctx.reducedMotion));
        if (skin.grows) e.cable.setGrow(wireGrowU(age, e.length, ctx.reducedMotion));
        e.cable.setSlack(slack.get(e.wire.fromKey) ?? 0);
        let packet: number | null = null;
        if (run && carrier && run.hop >= 0 && carrier.order[run.hop] === e.wire.fromKey && carrier.order[run.hop + 1] === e.wire.toKey) packet = run.u;
        const litNow = (pose?.solved ?? false) || (run !== null && run.reached.includes(e.wire.toKey) && run.reached.includes(e.wire.fromKey));
        if (litNow !== e.lit) {
          e.lit = litNow;
          e.cable.setStyle(skin.wireStyle(ctx, litNow));
        }
        e.cable.setPacket(packet, { capsule: skin.capsule, color: ctx.colors.cyanHi, radius: skin.capsule ? 9 : 7 });
        e.cable.update(dt);
      }
      redraw();
    },
    destroy() {
      destroyed = true;
      for (const t of timers) t.remove(false);
      for (const e of wires.values()) e.cable.destroy();
      wires.clear();
      root.destroy(true);
    },
  };
  return view;
}
