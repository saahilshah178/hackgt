/**
 * step_bridge · skin timeline_bridge (civil e9, the Timeline Bridge at Selma; §4.3 slots arch_bridge, deck_section,
 * bay_lamp, lectern, streetcar, console). KC3. Self-contained: it reads only the step_bridge meta and the civil kit.
 *
 * A steel through-arch whose top chord IS the record_lens rail (the station's accessory rail, so the carriage climbs
 * and descends the arch), hangers down to a deck with four missing bays over the river. A placed plank slides a deck
 * section up into its bay; every section has the SAME length, the decoy's included (the printed date is the DOM chip
 * on its face). Each bay has a lamp hung from the arch: the WORLD sweep lights them only from aid tier 1 (the meta's
 * `bayLamps` are all 0 at tier 0, amendment 26), so this skin just draws what the pose says.
 *
 * Success: the sections lock left to right (steel seams glint), the bay lamps and then every arch lamp light in a
 * sweep. Failure: the correct prefix locks; the first misplaced section tips out and slides back under its bay; a decoy
 * section visibly SHORTENS (another story's plank), fails to reach both bay edges and slides into the river. No
 * figures, no reenactment. sensitiveSafe: no shake, no bursts.
 */
import type Phaser from "phaser";
import type { StepBridgeConfig } from "@/world/contraptions/step-bridge.config";
import { bayPos, type StepBridgePose } from "@/world/contraptions/step-bridge.meta";
import { clamp01 } from "@/world/ease";
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import { recordLensOf, withRecordLens } from "../../../accessories/record-lens";
import type { ContraptionState, PoseView, PrefabProps, SkinPrefab, XY } from "../../../types";
import {
  BLEND_ADD,
  beatClock,
  civilColors,
  drawConsoleReader,
  drawLampGlobe,
  drawRivets,
  fillPoly,
  localGround,
  mix,
  offsetPolyline,
  pulse,
  rotRect,
  routeDeckFail,
  routeDeckSuccess,
  strokePoly,
  tipCurve,
  type CivilColors,
} from "../../oracle_ticker/civil-kit";

type G = Phaser.GameObjects.Graphics;
type Props = PrefabProps<StepBridgeConfig>;

const DECK = { w: 200, h: 44, rise: 110 } as const;
const CHORD = 58; // arch depth between the top and bottom chords

/** The arch's top chord: the record_lens rail (local), else a parabola spanning 3000 with a 620 rise. */
function archChord(props: Props): XY[] {
  const lens = recordLensOf(props.station);
  const a = props.station.anchor;
  if (lens && lens.rail.length >= 3) return lens.rail.map(([x, y]) => ({ x: x - a.x, y: y - a.y }));
  return Array.from({ length: 13 }, (_, i) => {
    const x = -1500 + (3000 * i) / 12;
    return { x, y: -620 * (1 - (x / 1500) ** 2) };
  });
}
/** y of a polyline at x (linear), or null outside it. */
function yAt(pts: readonly XY[], x: number): number | null {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if ((x >= a.x && x <= b.x) || (x <= a.x && x >= b.x)) return b.x === a.x ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return null;
}

function drawArch(g: G, top: readonly XY[], bottom: readonly XY[], c: CivilColors): void {
  // lattice between the chords
  g.lineStyle(5, c.steelShade, 1);
  for (let i = 1; i < top.length; i++) {
    const segs = 4;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs;
      const t1 = (s + 1) / segs;
      const p = (arr: readonly XY[], t: number) => ({ x: arr[i - 1]!.x + (arr[i]!.x - arr[i - 1]!.x) * t, y: arr[i - 1]!.y + (arr[i]!.y - arr[i - 1]!.y) * t });
      const a = s % 2 === 0 ? p(top, t0) : p(bottom, t0);
      const b = s % 2 === 0 ? p(bottom, t1) : p(top, t1);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.strokePath();
    }
  }
  g.lineStyle(16, c.steelShade, 1);
  strokePoly(g, bottom);
  g.lineStyle(10, c.steel, 1);
  strokePoly(g, bottom);
  g.lineStyle(20, c.steelShade, 1);
  strokePoly(g, top);
  g.lineStyle(12, c.steel, 1);
  strokePoly(g, top);
  g.lineStyle(3, mix(c.steel, 0xffffff, 0.5), 1);
  strokePoly(g, top.map((p) => ({ x: p.x, y: p.y - 4 })));
  for (let i = 1; i < bottom.length; i++) drawRivets(g, bottom[i - 1]!, bottom[i]!, 46, 2.5, c.steelShade, 1);
}

function drawDeckSection(g: G, x: number, y: number, w: number, alpha: number, rot: number, c: CivilColors, seam: number): void {
  if (alpha <= 0.01) return;
  g.fillStyle(c.ink, 0.35 * alpha);
  fillPoly(g, rotRect(x + 4, y + DECK.h / 2 + 5, w, DECK.h, rot));
  g.fillStyle(c.steelShade, alpha);
  fillPoly(g, rotRect(x, y + DECK.h / 2, w, DECK.h, rot));
  g.fillStyle(c.steel, alpha);
  fillPoly(g, rotRect(x, y + DECK.h / 2 + 4, w - 8, DECK.h - 20, rot));
  g.fillStyle(mix(c.concrete, 0xffffff, 0.25), alpha);
  fillPoly(g, rotRect(x, y + 5, w - 4, 10, rot));
  g.fillStyle(c.steelShade, alpha);
  for (let k = -2; k <= 2; k++) fillPoly(g, rotRect(x + (k * w) / 5, y + DECK.h / 2 + 4, 4, DECK.h - 20, rot));
  if (seam > 0.01) {
    g.fillStyle(c.brassHi, seam * alpha);
    fillPoly(g, rotRect(x - w / 2 + 2, y + DECK.h / 2, 5, DECK.h - 4, rot));
    fillPoly(g, rotRect(x + w / 2 - 2, y + DECK.h / 2, 5, DECK.h - 4, rot));
  }
}

function drawRiver(g: G, x0: number, x1: number, top: number, bottom: number, tMs: number, c: CivilColors, reduced: boolean): void {
  if (x1 <= x0) return;
  g.fillStyle(mix(c.waterDeep, c.navyDark, 0.6), 1);
  g.fillRect(x0, top, x1 - x0, bottom - top);
  g.lineStyle(3, mix(c.water, c.navy, 0.3), 0.8);
  for (let r = 0; r < 3; r++) {
    g.beginPath();
    for (let x = x0; x <= x1; x += 20) {
      const y = top + 12 + r * 30 + (reduced ? 0 : 4 * Math.sin(x / 60 + tMs / (600 + r * 200) + r));
      if (x === x0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
  }
}

export function createTimelineBridgeView(scene: Phaser.Scene, props: Props): PoseView<StepBridgePose> {
  const c = civilColors(props.palette);
  const anchor = props.station.anchor;
  const ground = localGround(scene, props);
  const reduced = props.reducedMotion;
  const bays = props.config.bays;
  const slotsN = Number((props.view as { slots?: unknown } | null)?.slots);
  const n0 = Number.isInteger(slotsN) && slotsN > 0 ? slotsN : 4;
  const consoleLocal = { x: props.station.consoleX - anchor.x, y: ground(props.station.consoleX - anchor.x, props.station.consoleSurface) };
  const terrain = (props.station.payoff.terrain[0]?.points ?? []).map(([x, y]) => ({ x: x - anchor.x, y: y - anchor.y }));
  const bank0 = terrain[0]?.x ?? -600;
  const bank1 = terrain[terrain.length - 1]?.x ?? 600;
  const deckY = terrain[0]?.y ?? 0;
  const top = archChord(props);
  const bottom = offsetPolyline(top, CHORD);
  const bayAt = (j: number, n: number): XY => ({ x: bayPos(bays, n, j).x, y: deckY });
  const bayEdge0 = bayAt(0, n0).x - DECK.w / 2;
  const bayEdge1 = bayAt(n0 - 1, n0).x + DECK.w / 2;
  const lampY = deckY - 150;
  // lamps along the arch that light after the bay lamps on success (every ~210 units of chord)
  const archLamps: XY[] = [];
  for (let x = Math.ceil((top[0]?.x ?? -1500) / 210) * 210; x <= (top[top.length - 1]?.x ?? 1500); x += 210) {
    const y = yAt(top, x);
    if (y !== null && y < deckY - 60) archLamps.push({ x, y: y - 22 });
  }

  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics();
  const river = scene.add.graphics();
  const dyn = scene.add.graphics();
  const glow = scene.add.graphics();
  glow.setBlendMode(BLEND_ADD);
  root.add([river, back, dyn, glow]);

  // static: the arch, hangers, the fixed approach decks and their handrails
  drawArch(back, top, bottom, c);
  back.lineStyle(4, c.steelShade, 1);
  for (let x = bank0 + 50; x <= bank1 - 50; x += 100) {
    const y = yAt(bottom, x);
    if (y === null || y > deckY - 40) continue;
    back.beginPath();
    back.moveTo(x, y);
    back.lineTo(x, deckY);
    back.strokePath();
  }
  for (const [x0, x1] of [
    [bank0, bayEdge0],
    [bayEdge1, bank1],
  ] as const) {
    if (x1 - x0 < 4) continue;
    drawDeckSection(back, (x0 + x1) / 2, deckY, x1 - x0, 1, 0, c, 0);
  }
  back.lineStyle(4, c.steel, 1);
  back.beginPath();
  back.moveTo(bank0, deckY - 46);
  back.lineTo(bank1, deckY - 46);
  back.strokePath();

  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    crown: top.reduce((m, p) => (p.y < m.y ? p : m), top[0] ?? { x: 0, y: -620 }),
    arch_rail: top[Math.floor(top.length / 4)] ?? { x: -800, y: -480 },
    payoff: { x: (bank0 + bank1) / 2, y: deckY },
  };
  for (let j = 0; j < Math.max(n0, 4); j++) {
    const b = bayAt(j, n0);
    anchors[`bay_${j}`] = { x: b.x, y: b.y + DECK.h / 2 };
    anchors[`bay_lamp_${j}`] = { x: b.x, y: lampY };
  }

  let pose: StepBridgePose | null = null;
  let state: ContraptionState = "dormant";
  let destroyed = false;
  let now = 0;
  const fx = {
    seam: new Map<number, number>(),
    tip: null as { bay: number; start: number; deg: number } | null,
    sink: null as { bay: number; start: number } | null,
    shorten: null as { bay: number; start: number } | null,
    dims: new Set<number>(),
    wobble: null as { bay: number; start: number } | null,
    sweep: null as number | null, // the success sweep: bay lamps then the arch lamps, 0…1
  };
  const clock = beatClock(scene, reduced, () => !destroyed);

  const redraw = () => {
    if (!pose) return;
    river.clear();
    dyn.clear();
    glow.clear();
    drawRiver(river, bank0, bank1, deckY + 40, Math.max(deckY + 120, ground((bank0 + bank1) / 2)), now, c, reduced);
    const n = Math.max(1, pose.n || n0);
    const pk = pulse(now, 0.5, reduced);
    for (let j = 0; j < n; j++) {
      const b = bayAt(j, n);
      const fill = clamp01(pose.bayFill[j] ?? 0);
      let dy = (1 - fill) * DECK.rise;
      let rot = 0;
      let alpha = fill;
      let w = DECK.w;
      let dx = 0;
      if (fx.tip && fx.tip.bay === j) {
        const t = tipCurve((now - fx.tip.start) / 1000, fx.tip.deg);
        rot = t.rot;
        dy += t.dy;
        alpha *= t.alpha;
      }
      if (fx.shorten && fx.shorten.bay === j) {
        // another story's plank: it shortens, fails to reach both bay edges and slides into the river, then returns
        const u = clamp01((now - fx.shorten.start) / 1200);
        const k = u < 0.3 ? u / 0.3 : 1;
        w = DECK.w * (1 - 0.3 * k);
        const drop = u < 0.3 ? 0 : u < 0.8 ? ((u - 0.3) / 0.5) ** 2 : 1 - (u - 0.8) / 0.2;
        dy += 120 * drop;
        dx = 18 * drop;
        rot = 0.25 * drop;
        alpha *= 1 - 0.6 * drop;
      }
      if (fx.wobble && fx.wobble.bay === j) rot = 0.05 * Math.sin((now - fx.wobble.start) / 40) * Math.max(0, 1 - (now - fx.wobble.start) / 600);
      if (fx.dims.has(j)) alpha *= 0.5;
      if (fill < 0.02) {
        dyn.lineStyle(3, c.cyanHi, 0.2 + 0.3 * pk);
        dyn.strokeRect(b.x - DECK.w / 2, b.y, DECK.w, DECK.h);
      }
      drawDeckSection(dyn, b.x + dx, b.y + dy, w, alpha, rot, c, fx.seam.get(j) ?? (pose.solved ? 1 : 0));
      // the bay lamp hangs from the arch over its bay; it is lit only by what the pose says (tier-gated sweep)
      const sweepLit = fx.sweep !== null ? clamp01(fx.sweep * (n + 2) - j) : 0;
      const on = Math.max(pose.bayLamps[j] ?? 0, sweepLit);
      const hang = yAt(bottom, b.x) ?? lampY - 200;
      dyn.lineStyle(3, c.steelShade, 1);
      dyn.beginPath();
      dyn.moveTo(b.x + 40, hang);
      dyn.lineTo(b.x + 40, lampY - 14);
      dyn.strokePath();
      drawLampGlobe(dyn, b.x + 40, lampY, 11, on, c);
    }
    // arch lamps: lit after the bay lamps in the success sweep and in the solved state
    archLamps.forEach((p, i) => {
      const k = pose!.solved ? 1 : fx.sweep !== null ? clamp01(fx.sweep * (archLamps.length + n) - n - i * 0.6) : 0;
      if (k > 0.01) drawLampGlobe(dyn, p.x, p.y, 8, k, c);
      else {
        dyn.fillStyle(c.lensDormant, 1);
        dyn.fillCircle(p.x, p.y, 6);
      }
    });
    drawConsoleReader(dyn, consoleLocal, c, state === "active" ? 1 : state === "awake" ? 0.4 : pose.solved ? 0.6 : 0);
    if (state === "active") {
      glow.fillStyle(c.cyan, 0.08);
      glow.fillRect(bayEdge0 - 10, deckY - 10, bayEdge1 - bayEdge0 + 20, DECK.h + 20);
    }
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
      clock.later(r.arch ?? Math.max(0, plan.durationMs - 900), () => (fx.sweep = 0));
      await clock.wait(plan.durationMs);
      if (destroyed) return;
      fx.seam.clear();
      fx.sweep = null;
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
        clock.later(s.atMs, () => (fx.shorten = { bay: s.bay, start: now }));
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
      fx.shorten = null;
      fx.dims.clear();
      fx.wobble = null;
      view.applyPose(pose ?? p);
    },
    update(dtMs: number) {
      if (destroyed) return;
      const dt = Math.max(0, dtMs);
      now += dt;
      const k = reduced ? 1e9 : dt;
      for (const [j, v] of fx.seam) fx.seam.set(j, Math.min(1, v + k / 200));
      if (fx.sweep !== null) fx.sweep = Math.min(1, fx.sweep + k / 900);
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
  skinId: "timeline_bridge",
  create(scene, _phaser, props) {
    // the record_lens carriage rides the arch's top chord (the station's accessory rail)
    return withRecordLens(createTimelineBridgeView(scene, props), scene, props, (p) => p.probeU);
  },
};
export default skin;
