/**
 * step_bridge · skin walking_road (civil e2, the Walking Road; §4.3 slots slab, city_bus, bus_stop, day_counter,
 * flood_band, console). KC3. Self-contained: it reads only the step_bridge meta (Pose, bayPos) and the civil kit.
 *
 * A flooded street gap with four slab bays. Each placed plank materialises a concrete slab from the water (the eased
 * `bayFill`); every placed slab looks IDENTICAL, the decoy's included (the plank's words are DOM chips); empty bays
 * pulse as wireframes at 0.5 Hz. The bus-stop shelter carries the flip-number DAY counter bound to the year probe (the
 * digits are the DOM chip "DAY n"); its ROUTE sign lights one lamp per placed slab (neutral completion). The empty 1950s
 * bus waits on the far bank, lights off.
 *
 * Success: the slabs lock left to right (gold seams), footprint decals stream across them while the DAY counter rolls,
 * the route sign lights and the empty bus's interior lights come on (no figures). Failure: the correct prefix locks;
 * the first wrong slab tips 12° and sinks back under the water; a decoy dissolves into scraps. sensitiveSafe.
 */
import type Phaser from "phaser";
import type { StepBridgeConfig } from "@/world/contraptions/step-bridge.config";
import { bayPos, type StepBridgePose } from "@/world/contraptions/step-bridge.meta";
import { clamp01 } from "@/world/ease";
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import { withRecordLens } from "../../../accessories/record-lens";
import type { ContraptionState, PoseView, PrefabProps, SkinPrefab, XY } from "../../../types";
import {
  BLEND_ADD,
  beatClock,
  civilColors,
  dissolveCurve,
  drawConsoleReader,
  drawLampGlobe,
  drawShadow,
  fillPoly,
  localGround,
  mix,
  pulse,
  rotRect,
  routeDeckFail,
  routeDeckSuccess,
  tipCurve,
  type CivilColors,
} from "../../oracle_ticker/civil-kit";

type G = Phaser.GameObjects.Graphics;
type Props = PrefabProps<StepBridgeConfig>;

const SLAB = { w: 250, h: 58, rise: 60 } as const;
const SHELTER = { dx: -300, w: 230, h: 250 } as const; // relative to the blocker (or the left bank)
const BUS = { w: 400, h: 190 } as const;

function drawWater(g: G, glow: G, x0: number, x1: number, top: number, bottom: number, tMs: number, c: CivilColors, reduced: boolean): void {
  if (x1 <= x0) return;
  g.fillStyle(mix(c.waterDeep, c.navyDark, 0.45), 1);
  g.fillRect(x0, top, x1 - x0, bottom - top);
  g.fillStyle(mix(c.waterDeep, c.navy, 0.2), 1);
  g.fillRect(x0, top, x1 - x0, 18);
  g.lineStyle(3, c.water, 0.8);
  g.beginPath();
  for (let x = x0; x <= x1; x += 16) {
    const y = top + 4 + (reduced ? 0 : 3 * Math.sin(x / 40 + tMs / 450));
    if (x === x0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.strokePath();
  // rain rings on the flood
  if (!reduced) {
    for (let i = 0; i < 9; i++) {
      const phase = ((tMs / 900 + i * 0.37) % 1 + 1) % 1;
      const x = x0 + ((i * 131 + Math.floor(tMs / 900 + i * 0.37) * 57) % Math.max(1, x1 - x0));
      glow.lineStyle(2, c.water, 0.35 * (1 - phase));
      glow.strokeEllipse(x, top + 10, 8 + 26 * phase, 3 + 6 * phase);
    }
  }
}

function drawSlab(g: G, x: number, y: number, alpha: number, rot: number, c: CivilColors, seam: number): void {
  if (alpha <= 0.01) return;
  const pts = rotRect(x, y + SLAB.h / 2, SLAB.w, SLAB.h, rot);
  g.fillStyle(c.ink, 0.35 * alpha);
  fillPoly(g, rotRect(x + 4, y + SLAB.h / 2 + 6, SLAB.w, SLAB.h, rot));
  g.fillStyle(c.curb, alpha);
  fillPoly(g, pts);
  g.fillStyle(c.concrete, alpha);
  fillPoly(g, rotRect(x, y + SLAB.h / 2 - 4, SLAB.w - 8, SLAB.h - 16, rot));
  g.fillStyle(mix(c.concrete, 0xffffff, 0.4), alpha);
  fillPoly(g, rotRect(x, y + 4, SLAB.w - 10, 6, rot));
  if (seam > 0.01) {
    g.fillStyle(c.brassHi, seam * alpha);
    fillPoly(g, rotRect(x - SLAB.w / 2 + 2, y + SLAB.h / 2, 5, SLAB.h - 6, rot));
    fillPoly(g, rotRect(x + SLAB.w / 2 - 2, y + SLAB.h / 2, 5, SLAB.h - 6, rot));
  }
}

function drawEmptyBay(g: G, x: number, y: number, k: number, c: CivilColors): void {
  g.lineStyle(3, c.cyanHi, 0.2 + 0.35 * k);
  g.strokeRect(x - SLAB.w / 2, y, SLAB.w, SLAB.h);
  g.lineStyle(1, c.cyanHi, 0.15 + 0.2 * k);
  g.strokeRect(x - SLAB.w / 2 + 8, y + 8, SLAB.w - 16, SLAB.h - 16);
}

function drawShelter(g: G, glow: G, at: XY, digits: readonly number[], flipK: number, lit: number, c: CivilColors): XY {
  const x0 = at.x - SHELTER.w / 2;
  drawShadow(g, at.x, at.y, SHELTER.w + 30, c);
  // back glass and bench
  g.fillStyle(mix(c.cyanShade, c.navyDark, 0.6), 0.85);
  g.fillRect(x0 + 10, at.y - SHELTER.h + 40, SHELTER.w - 20, SHELTER.h - 90);
  g.fillStyle(c.cyanHi, 0.18);
  g.fillRect(x0 + 18, at.y - SHELTER.h + 48, 30, SHELTER.h - 106);
  g.fillStyle(c.bronze, 1);
  g.fillRect(x0 + 30, at.y - 60, SHELTER.w - 60, 12);
  g.fillRect(x0 + 40, at.y - 48, 8, 48);
  g.fillRect(x0 + SHELTER.w - 48, at.y - 48, 8, 48);
  // posts and roof
  g.fillStyle(c.navyDark, 1);
  g.fillRect(x0, at.y - SHELTER.h + 30, 10, SHELTER.h - 30);
  g.fillRect(x0 + SHELTER.w - 10, at.y - SHELTER.h + 30, 10, SHELTER.h - 30);
  g.fillStyle(c.brassDeep, 1);
  g.fillRoundedRect(x0 - 16, at.y - SHELTER.h + 12, SHELTER.w + 32, 22, 6);
  g.fillStyle(c.brass, 1);
  g.fillRect(x0 - 12, at.y - SHELTER.h + 14, SHELTER.w + 24, 5);
  // the DAY counter box on the roof: three flip cards (the digits are DOM)
  const box = { x: at.x, y: at.y - SHELTER.h - 30 };
  g.fillStyle(c.brassDeep, 1);
  g.fillRoundedRect(box.x - 86, box.y - 32, 172, 64, 8);
  g.fillStyle(c.navyDark, 1);
  g.fillRoundedRect(box.x - 80, box.y - 26, 160, 52, 6);
  for (let i = 0; i < 3; i++) {
    const cx = box.x - 44 + i * 44;
    const turning = digits[i] !== undefined && flipK > 0 && flipK < 1;
    const h = turning ? 40 * Math.abs(Math.cos(Math.PI * flipK)) : 40;
    g.fillStyle(c.paper, 1);
    g.fillRect(cx - 17, box.y - h / 2, 34, h);
    g.lineStyle(2, c.ink, 0.6);
    g.beginPath();
    g.moveTo(cx - 17, box.y);
    g.lineTo(cx + 17, box.y);
    g.strokePath();
  }
  if (lit > 0.01) {
    glow.fillStyle(c.lamp, 0.2 * lit);
    glow.fillRoundedRect(box.x - 96, box.y - 42, 192, 84, 12);
  }
  return box;
}

function drawRouteSign(g: G, glow: G, base: XY, lamps: number, total: number, lit: number, c: CivilColors): XY {
  g.fillStyle(c.navyDark, 1);
  g.fillRect(base.x - 5, base.y - 230, 10, 230);
  const board = { x: base.x, y: base.y - 250 };
  g.fillStyle(c.brassDeep, 1);
  g.fillRoundedRect(board.x - 70, board.y - 34, 140, 68, 8);
  g.fillStyle(mix(c.navy, c.lamp, 0.35 * lit), 1);
  g.fillRoundedRect(board.x - 64, board.y - 28, 128, 56, 6);
  const n = Math.max(1, total);
  for (let i = 0; i < n; i++) drawLampGlobe(g, board.x - 45 + (90 * i) / Math.max(1, n - 1), board.y + 8, 8, i < lamps ? 1 : lit, c);
  g.fillStyle(c.paper, 0.85);
  g.fillRect(board.x - 44, board.y - 20, 88, 8); // ROUTE (the word itself is not world text; a bar)
  if (lit > 0.01) {
    glow.fillStyle(c.lamp, 0.25 * lit);
    glow.fillRoundedRect(board.x - 80, board.y - 44, 160, 88, 14);
  }
  return board;
}

function drawBus(g: G, glow: G, at: XY, lit: number, c: CivilColors): void {
  const x0 = at.x - BUS.w / 2;
  const y0 = at.y - BUS.h - 26;
  drawShadow(g, at.x, at.y, BUS.w + 40, c, 0.32);
  g.fillStyle(c.navy, 1);
  g.fillRoundedRect(x0, y0 + BUS.h * 0.52, BUS.w, BUS.h * 0.48, { tl: 0, tr: 0, bl: 18, br: 30 });
  g.fillStyle(c.stoneLit, 1);
  g.fillRoundedRect(x0, y0, BUS.w, BUS.h * 0.56, { tl: 40, tr: 60, bl: 0, br: 0 });
  g.fillStyle(c.brass, 1);
  g.fillRect(x0, y0 + BUS.h * 0.52, BUS.w, 8);
  // windows (interior lights: warm when lit; always EMPTY)
  const win = mix(mix(c.navyDark, c.ink, 0.3), c.lamp, lit);
  for (let i = 0; i < 6; i++) {
    g.fillStyle(win, 1);
    g.fillRoundedRect(x0 + 22 + i * 58, y0 + 20, 46, 52, 8);
  }
  if (lit > 0.01) {
    glow.fillStyle(c.lamp, 0.22 * lit);
    glow.fillRect(x0 + 16, y0 + 14, 6 * 58, 64);
  }
  // door, headlamp, wheels
  g.fillStyle(mix(c.navyDark, c.ink, 0.2), 1);
  g.fillRect(x0 + BUS.w - 56, y0 + 20, 36, BUS.h - 30);
  drawLampGlobe(g, x0 + BUS.w - 10, y0 + BUS.h * 0.78, 9, lit, c);
  for (const dx of [70, BUS.w - 90]) {
    g.fillStyle(c.ink, 1);
    g.fillCircle(x0 + dx, at.y - 26, 28);
    g.fillStyle(c.steel, 1);
    g.fillCircle(x0 + dx, at.y - 26, 12);
  }
}

function drawSawhorse(g: G, at: XY, alpha: number, c: CivilColors): void {
  if (alpha <= 0.01) return;
  g.fillStyle(c.navyDark, alpha);
  for (const dx of [-48, 48]) {
    fillPoly(g, [
      { x: at.x + dx - 22, y: at.y },
      { x: at.x + dx - 12, y: at.y },
      { x: at.x + dx + 4, y: at.y - 74 },
      { x: at.x + dx - 6, y: at.y - 74 },
    ]);
  }
  for (let i = 0; i < 6; i++) {
    g.fillStyle(i % 2 === 0 ? c.paper : c.salmon, alpha);
    g.fillRect(at.x - 70 + i * 23, at.y - 86, 23, 18);
  }
}

// ---------------------------------------------------------------- the view

export function createWalkingRoadView(scene: Phaser.Scene, props: Props): PoseView<StepBridgePose> {
  const c = civilColors(props.palette);
  const anchor = props.station.anchor;
  const ground = localGround(scene, props);
  const reduced = props.reducedMotion;
  const bays = props.config.bays;
  const slotsN = Number((props.view as { slots?: unknown } | null)?.slots);
  const n0 = Number.isInteger(slotsN) && slotsN > 0 ? slotsN : 4;
  const consoleLocal = { x: props.station.consoleX - anchor.x, y: ground(props.station.consoleX - anchor.x, props.station.consoleSurface) };
  const blocker = props.station.payoff.blocker;
  const blockerLocal = blocker ? blocker.x - anchor.x : -510;
  const terrain = (props.station.payoff.terrain[0]?.points ?? []).map(([x, y]) => ({ x: x - anchor.x, y: y - anchor.y }));
  const gapX0 = terrain[0]?.x ?? -500;
  const gapX1 = terrain[terrain.length - 1]?.x ?? 500;
  const roadY = terrain[0]?.y ?? 0;
  const bayAt = (j: number, n: number): XY => {
    const p = bayPos(bays, n, j);
    return { x: p.x, y: roadY + p.y };
  };

  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics();
  const water = scene.add.graphics();
  const dyn = scene.add.graphics();
  const glow = scene.add.graphics();
  glow.setBlendMode(BLEND_ADD);
  root.add([back, water, dyn, glow]);

  const shelterAt = { x: Math.max(consoleLocal.x + 190, blockerLocal + SHELTER.dx), y: ground(blockerLocal + SHELTER.dx) };
  const signAt = { x: shelterAt.x + SHELTER.w / 2 + 50, y: ground(shelterAt.x + SHELTER.w / 2 + 50) };
  const busAt = { x: gapX1 + 40 + BUS.w / 2, y: ground(gapX1 + 40 + BUS.w / 2) };

  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    day_counter: { x: shelterAt.x, y: shelterAt.y - SHELTER.h - 30 },
    route_sign: { x: signAt.x, y: signAt.y - 250 },
    bus: { x: busAt.x, y: busAt.y - BUS.h / 2 },
    payoff: { x: (gapX0 + gapX1) / 2, y: roadY },
  };
  for (let j = 0; j < Math.max(n0, 4); j++) {
    const b = bayAt(j, n0);
    anchors[`bay_${j}`] = { x: b.x, y: b.y + SLAB.h / 2 };
  }

  let pose: StepBridgePose | null = null;
  let state: ContraptionState = "dormant";
  let destroyed = false;
  let now = 0;
  let lastDay: number | null = null;
  let flip = 1;
  const fx = {
    seam: new Map<number, number>(), // bay → 0…1 gold seam
    tip: null as { bay: number; start: number; deg: number } | null,
    scatter: null as { bay: number; start: number } | null,
    dims: new Set<number>(),
    wobble: null as { bay: number; start: number } | null,
    roll: null as { start: number; ms: number } | null, // the DAY counter rolling on success
    steps: null as number | null, // footprint decals 0…1
    sign: 0,
    bus: 0,
    sawhorse: 1,
  };
  const clock = beatClock(scene, reduced, () => !destroyed);

  const redraw = () => {
    if (!pose) return;
    water.clear();
    dyn.clear();
    glow.clear();
    back.clear();
    drawWater(water, glow, gapX0, gapX1, roadY + 24, Math.max(roadY + 60, ground((gapX0 + gapX1) / 2)), now, c, reduced);
    const n = Math.max(1, pose.n || n0);
    const pk = pulse(now, 0.5, reduced);
    for (let j = 0; j < n; j++) {
      const b = bayAt(j, n);
      const fill = clamp01(pose.bayFill[j] ?? 0);
      let dy = (1 - fill) * SLAB.rise;
      let rot = 0;
      let alpha = 0.85 * fill + (pose.solved ? 0.15 : 0);
      if (fx.tip && fx.tip.bay === j) {
        const t = tipCurve((now - fx.tip.start) / 1000, fx.tip.deg);
        rot = t.rot;
        dy += t.dy;
        alpha *= t.alpha;
      }
      if (fx.wobble && fx.wobble.bay === j) rot = 0.05 * Math.sin((now - fx.wobble.start) / 40) * Math.max(0, 1 - (now - fx.wobble.start) / 600);
      if (fx.dims.has(j)) alpha *= 0.5;
      if (fx.scatter && fx.scatter.bay === j) {
        const d = dissolveCurve((now - fx.scatter.start) / 1300);
        alpha *= d.alpha;
        for (let k = 0; k < 8; k++) {
          const sx = b.x - SLAB.w / 2 + 20 + k * 30 + 14 * Math.sin(k * 2.3 + now / 300) * d.scatter;
          const sy = b.y - 10 - 90 * d.scatter * (0.5 + (k % 3) * 0.25);
          dyn.fillStyle(k % 2 ? c.paper : c.concrete, (1 - d.alpha) * 0.9);
          dyn.fillRect(sx, sy, 18, 12);
        }
      }
      if (fill < 0.02) drawEmptyBay(dyn, b.x, b.y, pk, c);
      drawSlab(dyn, b.x, b.y + dy, alpha, rot, c, fx.seam.get(j) ?? (pose.solved ? 1 : 0));
    }
    // footprint decals streaming across the road (success): small paired marks, no figures
    if (fx.steps !== null && fx.steps < 1) {
      for (let k = 0; k < 7; k++) {
        const u = (fx.steps * 1.4 - k * 0.08) % 1;
        if (u < 0 || u > 1) continue;
        const x = gapX0 + (gapX1 - gapX0) * u;
        dyn.fillStyle(c.ink, 0.35);
        dyn.fillEllipse(x, roadY + 6, 14, 6);
        dyn.fillEllipse(x + 18, roadY + 10, 14, 6);
      }
    }
    // DAY counter: its cards flip when the day changes (and roll through the boycott on success)
    let digits: number[] = [];
    if (pose.day !== null) {
      if (pose.day !== lastDay) {
        lastDay = pose.day;
        flip = 0;
      }
      digits = String(pose.day).padStart(3, "0").split("").map(Number);
    }
    const rolling = fx.roll !== null && now - fx.roll.start < fx.roll.ms;
    const flipK = rolling ? ((now - fx.roll!.start) / 120) % 1 : flip;
    drawShelter(back, glow, shelterAt, digits, flipK, Math.max(fx.sign, pose.solved ? 1 : 0), c);
    drawRouteSign(back, glow, signAt, pose.routeLamps, n, Math.max(fx.sign, pose.solved ? 1 : 0), c);
    drawBus(back, glow, busAt, Math.max(fx.bus, pose.solved ? 1 : 0), c);
    drawSawhorse(dyn, { x: blockerLocal, y: ground(blockerLocal) }, pose.solved ? 0 : fx.sawhorse, c);
    drawConsoleReader(dyn, consoleLocal, c, state === "active" ? 1 : state === "awake" ? 0.4 : pose.solved ? 0.6 : 0);
  };

  const view: PoseView<StepBridgePose> = {
    root,
    anchors,
    applyPose(p: StepBridgePose) {
      pose = p;
    },
    setState(s: ContraptionState) {
      state = s;
      try {
        props.fx.dormancy(root, s === "dormant");
      } catch {
        root.setAlpha(s === "dormant" ? 0.7 : 1);
      }
    },
    async playSucceed(plan: SuccessPlan, p: StepBridgePose) {
      const r = routeDeckSuccess(plan.beats as readonly SuccessBeat[]);
      for (const l of r.locks) clock.later(l.atMs, () => fx.seam.set(l.bay, 0.01));
      if (r.day) {
        const d = r.day;
        clock.later(d.atMs, () => {
          fx.roll = { start: now, ms: d.ms };
          fx.steps = 0;
        });
      } else clock.later(0, () => (fx.steps = 0));
      if (r.sign !== null) clock.later(r.sign, () => (fx.sign = 0.01));
      if (r.payoff !== null) clock.later(r.payoff, () => (fx.bus = 0.01));
      await clock.wait(plan.durationMs);
      if (destroyed) return;
      fx.seam.clear();
      fx.roll = null;
      fx.steps = null;
      view.applyPose(p);
    },
    async playFail(plan: FailurePlan, p: StepBridgePose) {
      const r = routeDeckFail(plan.beats as readonly FailBeat[]);
      for (const l of r.locks) clock.later(l.atMs, () => fx.seam.set(l.bay, 0.01));
      if (r.tip) {
        const t = r.tip;
        clock.later(t.atMs, () => (fx.tip = { bay: t.bay, start: now, deg: t.deg }));
      }
      if (r.scatter) {
        const s = r.scatter;
        clock.later(s.atMs, () => (fx.scatter = { bay: s.bay, start: now }));
      }
      for (const d of r.dims) clock.later(d.atMs, () => fx.dims.add(d.bay));
      if (r.wobble) {
        const w = r.wobble;
        clock.later(w.atMs, () => (fx.wobble = { bay: w.bay, start: now }));
      }
      await clock.wait(Math.min(1600, plan.durationMs));
      if (destroyed) return;
      fx.seam.clear();
      fx.tip = null;
      fx.scatter = null;
      fx.dims.clear();
      fx.wobble = null;
      view.applyPose(pose ?? p); // the draft still holds every plank
    },
    update(dtMs: number) {
      if (destroyed) return;
      const dt = Math.max(0, dtMs);
      now += dt;
      const k = reduced ? 1e9 : dt;
      for (const [j, v] of fx.seam) fx.seam.set(j, Math.min(1, v + k / 200));
      flip = Math.min(1, flip + k / 150);
      if (fx.steps !== null) fx.steps = Math.min(1, fx.steps + k / 2200);
      if (fx.sign > 0) fx.sign = Math.min(1, fx.sign + k / 300);
      if (fx.bus > 0) fx.bus = Math.min(1, fx.bus + k / 600);
      redraw();
    },
    destroy() {
      destroyed = true;
      clock.clear();
      root.destroy(true);
    },
  };
  return view;
}

export const skin: SkinPrefab<StepBridgeConfig, StepBridgePose> = {
  skinId: "walking_road",
  create(scene, _phaser, props) {
    return withRecordLens(createWalkingRoadView(scene, props), scene, props, (p) => p.probeU);
  },
};
export default skin;
