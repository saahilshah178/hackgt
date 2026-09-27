/**
 * router_lanes · skin filing_cabinets (civil e8, the Filing Cabinets in the Capitol Filing Hall; §4.3 slots cabinet,
 * meter, shutter, slip, pneumatic_drop, stairwell (new), console). KC3.
 *
 * This file also holds the CIVIL DRAWERS VIEW both civil router skins share (provenance_drawers imports it): the cell
 * core's createRouterView draws molecules, so the civil skins keep their own view and read only the router_lanes meta.
 *
 *  - items (slips here, documents in provenance_drawers) rest on the sorting table in display order; filing one sends it
 *    on a quadratic Bézier (apex 180 above, 450 ms, one full turn) into its lane's open drawer, where it peeks out;
 *  - per lane a VU meter's needle = −50° + 100°·count / items (completion, never correctness) and a brass feature
 *    shutter (open from aid tier 1, or for the DISCLOSED bin after a miss); lane chips carry counts only (DOM);
 *  - failure: only `wrongKeys[0]`'s item bounces back to the table and only the disclosed drawer's shutter opens;
 *  - success: every item slides home, the drawers slam, both shutters open, then the skin's payoff plays (here the
 *    cabinets roll apart on their floor rails and reveal the stairwell down).
 * sensitiveSafe: no shake, no bursts. Stand-in art until KC4's hero parts land.
 */
import type Phaser from "phaser";
import type { RouterLanesConfig } from "@/world/contraptions/router-lanes.config";
import { itemAnchor, laneAnchor, type RouterItemPose, type RouterLanesPose } from "@/world/contraptions/router-lanes.meta";
import { clamp01, ease } from "@/world/ease";
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import { lensUFor, withRecordLens } from "../../../accessories/record-lens";
import type { ContraptionState, PoseView, PrefabProps, SkinPrefab, XY } from "../../../types";
import {
  BLEND_ADD,
  beatClock,
  bounceHop,
  civilColors,
  drawBrassPlate,
  drawConsoleReader,
  drawPaper,
  drawShadow,
  drawStamp,
  drawWoodBody,
  localGround,
  mix,
  routeDrawersFail,
  routeDrawersSuccess,
  slipFlight,
  type CivilColors,
} from "../../oracle_ticker/civil-kit";

type G = Phaser.GameObjects.Graphics;
export type DrawersProps = PrefabProps<RouterLanesConfig>;

// ================================================================ the shared civil drawers view

export interface DrawerSlot {
  /** the open drawer's mouth (anchors drawer_i and lane_i) */
  mouth: XY;
  /** drawer width */
  w: number;
}
export interface DrawersLayout {
  table: XY;
  /** resting positions of unfiled items, by display index of `count` items */
  rest(display: number, count: number): XY & { rot: number };
  drawers: DrawerSlot[];
  meters: XY[];
  shutters: XY[];
  payoff: XY;
  stairwell: XY | null;
}
export interface DrawersCtx {
  scene: Phaser.Scene;
  props: DrawersProps;
  c: CivilColors;
  ground: (x: number) => number;
  consoleLocal: XY;
  reducedMotion: boolean;
}
export interface DrawersDyn {
  now: number;
  state: ContraptionState;
  /** per lane: 0 open … 1 slammed shut (success) */
  slam: number[];
  /** per lane: extra shutter opening from a failure or the success beat (0…1) */
  shutter: number[];
  /** the payoff animation 0…1 (null = not started) */
  payoff: number | null;
}
export interface DrawersSkin {
  skinId: string;
  itemW: number;
  itemH: number;
  /** static parts; returns the layout */
  build(ctx: DrawersCtx, back: G): DrawersLayout;
  /** the moving parts BEHIND the items (cabinet bodies, rails, shelving, the stairwell) */
  drawBack(g: G, glow: G, pose: RouterLanesPose, dyn: DrawersDyn, ctx: DrawersCtx, L: DrawersLayout): void;
  /** the parts IN FRONT of filed items (drawer fronts, meters, shutters) */
  drawFront(g: G, glow: G, pose: RouterLanesPose, dyn: DrawersDyn, ctx: DrawersCtx, L: DrawersLayout): void;
  /** one item: a slip or a document icon, centred on `at` */
  drawItem(g: G, item: RouterItemPose, at: XY, rot: number, alpha: number, scale: number, ctx: DrawersCtx): void;
  /** where the lane shift moves drawer i during the payoff (cabinets rolling apart); default none */
  laneShift?(lane: number, payoff: number): number;
}

interface ItemView {
  pos: XY;
  rot: number;
  flight: { from: XY; to: XY; start: number; dur: number; kind: "file" | "bounce" } | null;
  home: "table" | number; // where it last settled
  slide: number | null; // success: sliding down into its drawer 0…1
}

const FLIGHT_MS = 450;
const BOUNCE_MS = 900;

/** Where a filed item peeks out of lane `lane`'s drawer: a staggered row inside the mouth. */
export function filedSpot(L: DrawersLayout, lane: number, q: number, n: number, shift: number): XY {
  const d = L.drawers[lane] ?? L.drawers[0]!;
  const span = Math.max(0, d.w - 50);
  const x = d.mouth.x + shift - span / 2 + (n <= 1 ? span / 2 : (span * q) / (n - 1));
  return { x, y: d.mouth.y - 14 - (q % 2) * 6 };
}

export function createCivilDrawersView(scene: Phaser.Scene, props: DrawersProps, skin: DrawersSkin): PoseView<RouterLanesPose> {
  const c = civilColors(props.palette);
  const anchor = props.station.anchor;
  const groundFn = localGround(scene, props);
  const ctx: DrawersCtx = {
    scene,
    props,
    c,
    ground: (x) => groundFn(x),
    consoleLocal: { x: props.station.consoleX - anchor.x, y: groundFn(props.station.consoleX - anchor.x, props.station.consoleSurface) },
    reducedMotion: props.reducedMotion,
  };
  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics();
  const mid = scene.add.graphics();
  const items = scene.add.graphics();
  const front = scene.add.graphics();
  const top = scene.add.graphics();
  const glow = scene.add.graphics();
  glow.setBlendMode(BLEND_ADD);
  root.add([back, mid, items, front, top, glow]);
  const L = skin.build(ctx, back);
  const laneCount = Math.max(L.drawers.length, props.config.lanes.length);

  const anchors: Record<string, XY> & { console: XY } = {
    console: ctx.consoleLocal,
    table: { ...L.table },
    payoff: { ...L.payoff },
  };
  if (L.stairwell) anchors.stairwell = { ...L.stairwell };
  L.drawers.forEach((d, i) => {
    anchors[`drawer_${i}`] = { ...d.mouth };
    anchors[laneAnchor(i)] = { x: d.mouth.x, y: d.mouth.y + 34 };
  });
  L.meters.forEach((m, i) => (anchors[`meter_${i}`] = { ...m }));
  L.shutters.forEach((s, i) => (anchors[`shutter_${i}`] = { ...s }));

  const views = new Map<string, ItemView>();
  const dyn: DrawersDyn = {
    now: 0,
    state: "dormant",
    slam: Array.from({ length: laneCount }, () => 0),
    shutter: Array.from({ length: laneCount }, () => 0),
    payoff: null,
  };
  const shutterHold = Array.from({ length: laneCount }, () => 0);
  let pose: RouterLanesPose | null = null;
  let destroyed = false;
  let consoleFlash = 0;
  const clock = beatClock(scene, props.reducedMotion, () => !destroyed);

  const shiftOf = (lane: number) => (skin.laneShift && dyn.payoff !== null ? skin.laneShift(lane, ease("in_out_cubic", dyn.payoff)) : 0);
  const targetOf = (it: RouterItemPose, p: RouterLanesPose): { at: XY; rot: number; home: "table" | number } => {
    if (it.lane !== null) {
      const lane = p.lanes[it.lane];
      return { at: filedSpot(L, it.lane, it.q, Math.max(1, lane?.count ?? it.n), shiftOf(it.lane)), rot: 0, home: it.lane };
    }
    const r = L.rest(it.display, p.items.length);
    return { at: { x: r.x, y: r.y - (it.focus ? 26 : 0) }, rot: r.rot, home: "table" };
  };

  const sync = (p: RouterLanesPose) => {
    for (const it of p.items) {
      const t = targetOf(it, p);
      let v = views.get(it.key);
      if (!v) {
        v = { pos: { ...t.at }, rot: t.rot, flight: null, home: t.home, slide: null };
        views.set(it.key, v);
        continue;
      }
      if (v.home !== t.home && !(v.flight && v.flight.kind === "bounce")) {
        v.flight = { from: { ...v.pos }, to: t.at, start: dyn.now, dur: props.reducedMotion ? 0 : FLIGHT_MS, kind: "file" };
        v.home = t.home;
      }
    }
  };

  const redraw = () => {
    if (!pose) return;
    mid.clear();
    items.clear();
    front.clear();
    top.clear();
    glow.clear();
    skin.drawBack(mid, glow, pose, dyn, ctx, L);
    for (const it of pose.items) {
      const v = views.get(it.key);
      if (!v || !it.visible) continue;
      const t = targetOf(it, pose);
      let at = v.pos;
      let rot = v.rot;
      let alpha = 1 - clamp01(it.passed);
      let scale = it.lane !== null ? 0.62 : 1;
      if (v.flight) {
        const u = v.flight.dur <= 0 ? 1 : (dyn.now - v.flight.start) / v.flight.dur;
        if (u >= 1) {
          v.flight = null;
        } else if (v.flight.kind === "file") {
          const f = slipFlight(v.flight.from, t.at, u);
          at = { x: f.x, y: f.y };
          rot = f.rot;
          scale = 1 - 0.38 * (it.lane !== null ? u : 1 - u);
        } else {
          at = bounceHop(v.flight.from, v.flight.to, u);
          rot = 1.2 * Math.sin(Math.PI * u);
          scale = 0.62 + 0.38 * Math.sin(Math.PI * Math.min(1, u * 1.2));
        }
      }
      if (!v.flight) {
        at = t.at;
        rot = t.rot;
      }
      if (v.slide !== null) {
        at = { x: at.x, y: at.y + 40 * v.slide };
        alpha *= 1 - v.slide;
      }
      v.pos = { ...at };
      v.rot = rot;
      anchors[itemAnchor(it.key)] = { ...at };
      if (alpha <= 0.01) continue;
      // filed items sit inside the drawer: draw them before the fronts; flying/table ones on top
      const layer = it.lane !== null && !v.flight ? items : top;
      skin.drawItem(layer, it, at, rot, alpha, scale, ctx);
      if (it.focus && !pose.solved) {
        layer.lineStyle(4, 0xffffff, 0.9);
        layer.strokeRoundedRect(at.x - (skin.itemW * scale) / 2 - 8, at.y - (skin.itemH * scale) / 2 - 8, skin.itemW * scale + 16, skin.itemH * scale + 16, 8);
      }
      if (it.stampYear !== null && it.lane !== null) drawStamp(layer, at.x + 12 * scale, at.y - 8 * scale, 34 * scale, 18 * scale, -10, c.salmon, 0.9 * alpha);
    }
    skin.drawFront(front, glow, pose, dyn, ctx, L);
    L.drawers.forEach((d, i) => {
      anchors[`drawer_${i}`] = { x: d.mouth.x + shiftOf(i), y: d.mouth.y };
      anchors[laneAnchor(i)] = { x: d.mouth.x + shiftOf(i), y: d.mouth.y + 34 };
    });
    drawConsoleReader(front, ctx.consoleLocal, c, dyn.state === "active" ? 1 : dyn.state === "awake" ? 0.4 : pose.solved ? 0.6 : 0);
    if (consoleFlash > 0) {
      front.lineStyle(5, c.lamp, Math.min(1, consoleFlash / 300));
      front.strokeRoundedRect(ctx.consoleLocal.x - 66, ctx.consoleLocal.y - 150, 132, 150, 10);
    }
  };

  const view: PoseView<RouterLanesPose> = {
    root,
    anchors,
    applyPose(p: RouterLanesPose) {
      pose = p;
      sync(p);
    },
    setState(s: ContraptionState) {
      dyn.state = s;
      try {
        props.fx.dormancy(root, s === "dormant");
      } catch {
        root.setAlpha(s === "dormant" ? 0.7 : 1);
      }
    },
    async playSucceed(plan: SuccessPlan, p: RouterLanesPose) {
      const r = routeDrawersSuccess(plan.beats as readonly SuccessBeat[]);
      for (const f of r.files) {
        clock.later(f.atMs, () => {
          const v = views.get(f.key);
          if (v) v.slide = 0;
        });
      }
      for (const s of r.slams) clock.later(s.atMs, () => (dyn.slam[s.lane] = 0.001));
      for (const s of r.shutters) clock.later(s.atMs, () => (dyn.shutter[s.lane] = Math.max(dyn.shutter[s.lane] ?? 0, 0.001)));
      clock.later(r.payoff ?? Math.max(0, plan.durationMs - 700), () => (dyn.payoff = 0));
      await clock.wait(plan.durationMs);
      if (destroyed) return;
      for (const v of views.values()) v.slide = null;
      dyn.payoff = 1;
      view.applyPose(p);
    },
    async playFail(plan: FailurePlan, p: RouterLanesPose) {
      const r = routeDrawersFail(plan.beats as readonly FailBeat[]);
      if (r.bounce) {
        const b = r.bounce;
        clock.later(b.atMs, () => {
          const v = views.get(b.key);
          const it = pose?.items.find((i) => i.key === b.key);
          if (!v || !it || !pose) return;
          const rest = L.rest(it.display, pose.items.length);
          v.flight = { from: { ...v.pos }, to: { x: rest.x, y: rest.y }, start: dyn.now, dur: props.reducedMotion ? 0 : BOUNCE_MS, kind: "bounce" };
          v.home = "table";
        });
      }
      if (r.shutter) {
        const s = r.shutter;
        clock.later(s.atMs, () => {
          dyn.shutter[s.lane] = Math.max(dyn.shutter[s.lane] ?? 0, 0.001);
          shutterHold[s.lane] = 2600; // the feature text stays readable while Ida speaks
        });
      }
      if (r.console !== null) clock.later(r.console, () => (consoleFlash = 700));
      await clock.wait(Math.min(1600, plan.durationMs));
      if (destroyed) return;
      view.applyPose(pose ?? p); // the draft still files it: it flies back into its drawer
    },
    update(dtMs: number) {
      if (destroyed) return;
      const dt = Math.max(0, dtMs);
      dyn.now += dt;
      const k = props.reducedMotion ? 1e9 : dt;
      for (let i = 0; i < laneCount; i++) {
        if (dyn.slam[i]! > 0) dyn.slam[i] = Math.min(1, dyn.slam[i]! + k / 160);
        if (shutterHold[i]! > 0) {
          shutterHold[i] = Math.max(0, shutterHold[i]! - dt);
          dyn.shutter[i] = Math.min(1, dyn.shutter[i]! + k / 300);
          if (shutterHold[i] === 0) dyn.shutter[i] = 0;
        } else if (dyn.shutter[i]! > 0 && dyn.shutter[i]! < 1) dyn.shutter[i] = Math.min(1, dyn.shutter[i]! + k / 300);
      }
      for (const v of views.values()) if (v.slide !== null) v.slide = Math.min(1, v.slide + k / 400);
      if (dyn.payoff !== null && dyn.payoff < 1) dyn.payoff = Math.min(1, dyn.payoff + k / 700);
      consoleFlash = Math.max(0, consoleFlash - dt);
      redraw();
    },
    destroy() {
      destroyed = true;
      clock.clear();
      root.destroy(true);
    },
  };
  return withRecordLens(view, scene, props, (pp) => lensUFor(props.station.probe, pp.probe), { ease: true });
}

// ================================================================ shared drawing for the civil drawers

/** A VU meter (kit `gauge` arc_meter): needle degrees from straight up (−50 … +50). */
export function drawMeter(g: G, at: XY, deg: number, c: CivilColors, lit: boolean): void {
  g.fillStyle(c.brassDeep, 1);
  g.fillRoundedRect(at.x - 50, at.y - 32, 100, 58, 8);
  g.fillStyle(c.paper, 1);
  g.fillRoundedRect(at.x - 42, at.y - 25, 84, 44, 6);
  g.lineStyle(3, c.ink, 0.5);
  g.beginPath();
  g.arc(at.x, at.y + 14, 30, (-140 * Math.PI) / 180, (-40 * Math.PI) / 180);
  g.strokePath();
  for (let i = 0; i <= 4; i++) {
    const a = ((-50 + i * 25) * Math.PI) / 180;
    g.lineStyle(2, c.ink, 0.7);
    g.beginPath();
    g.moveTo(at.x + Math.sin(a) * 26, at.y + 14 - Math.cos(a) * 26);
    g.lineTo(at.x + Math.sin(a) * 33, at.y + 14 - Math.cos(a) * 33);
    g.strokePath();
  }
  const a = (deg * Math.PI) / 180;
  g.lineStyle(3, lit ? c.salmon : c.ink, 1);
  g.beginPath();
  g.moveTo(at.x, at.y + 14);
  g.lineTo(at.x + Math.sin(a) * 34, at.y + 14 - Math.cos(a) * 34);
  g.strokePath();
  g.fillStyle(c.brassDeep, 1);
  g.fillCircle(at.x, at.y + 14, 5);
}

/** A brass feature shutter over its feature plate: `open` 0 closed … 1 raised (the plate's words are DOM/panel). */
export function drawShutter(g: G, glow: G, at: XY, w: number, h: number, open: number, c: CivilColors): void {
  const k = clamp01(open);
  g.fillStyle(mix(c.bronze, c.ink, 0.5), 1);
  g.fillRect(at.x - w / 2 - 6, at.y - h / 2 - 6, w + 12, h + 12);
  drawPaper(g, at.x, at.y, w - 12, h - 12, c, { lines: 3, fill: c.paper });
  if (k > 0.02) {
    glow.fillStyle(c.lamp, 0.14 * k);
    glow.fillRect(at.x - w / 2, at.y - h / 2, w, h);
  }
  const sh = h * (1 - k);
  if (sh > 1) {
    g.fillStyle(c.brassDeep, 1);
    g.fillRect(at.x - w / 2, at.y - h / 2, w, sh);
    g.fillStyle(c.brass, 1);
    for (let y = at.y - h / 2 + 4; y < at.y - h / 2 + sh - 4; y += 12) g.fillRect(at.x - w / 2 + 4, y, w - 8, 6);
  }
  g.fillStyle(c.brassHi, 1);
  g.fillRect(at.x - w / 2, at.y - h / 2 + sh - 3, w, 4);
}

// ================================================================ the filing_cabinets skin

const CAB = { w: 220, h: 310, drawerH: 64 } as const;
const TABLE = { x: -770, w: 230, top: -92 } as const;
/** How far the cabinets roll aside on their floor rail when the stairwell opens (civil §5.8). */
const ROLL = 230;

/** Cabinet i of `lanes` (the right one stands over the stairwell head, the payoff's blocker). */
function cabinetX(i: number, lanes: number): number {
  return lanes <= 1 ? -95 : -330 + (235 * i) / Math.max(1, lanes - 1);
}
/**
 * The payoff: the cabinets roll aside together along their floor rail (the floor beyond the blocker becomes the
 * stairwell down, so neither may end up over it) and bare the stairwell head.
 */
function filingShift(_lane: number, payoff: number): number {
  return -ROLL * payoff;
}

const filingSkin: DrawersSkin = {
  skinId: "filing_cabinets",
  itemW: 62,
  itemH: 42,
  build(ctx, g) {
    const { c } = ctx;
    const lanes = Math.max(2, ctx.props.config.lanes.length);
    const gy = ctx.ground(TABLE.x);
    // the sorting table
    drawShadow(g, TABLE.x, gy, TABLE.w + 20, c);
    g.fillStyle(mix(c.bronze, c.ink, 0.3), 1);
    for (const dx of [-TABLE.w / 2 + 14, TABLE.w / 2 - 24]) g.fillRect(TABLE.x + dx, gy + TABLE.top + 14, 10, -TABLE.top - 14);
    drawWoodBody(g, TABLE.x - TABLE.w / 2, gy + TABLE.top, TABLE.w, 18, c);
    // the pneumatic drop: a brass tube from the ceiling to a bell mouth over the table
    const tubeTop = gy - 820;
    g.fillStyle(c.brassDeep, 1);
    g.fillRect(TABLE.x - 16, tubeTop, 32, 520);
    g.fillStyle(c.brass, 1);
    g.fillRect(TABLE.x - 10, tubeTop, 10, 520);
    g.fillStyle(c.cyanHi, 0.25);
    g.fillRect(TABLE.x - 8, tubeTop + 120, 16, 200); // the tube window
    g.fillStyle(c.brassDeep, 1);
    g.fillTriangle(TABLE.x - 16, tubeTop + 520, TABLE.x + 16, tubeTop + 520, TABLE.x + 40, tubeTop + 560);
    g.fillTriangle(TABLE.x - 16, tubeTop + 520, TABLE.x - 40, tubeTop + 560, TABLE.x + 40, tubeTop + 560);
    // floor rails the cabinets roll on
    g.lineStyle(4, c.steelShade, 1);
    g.beginPath();
    g.moveTo(-620, ctx.ground(0) - 4);
    g.lineTo(-40, ctx.ground(0) - 4);
    g.strokePath();
    const drawers: DrawerSlot[] = [];
    const meters: XY[] = [];
    const shutters: XY[] = [];
    for (let i = 0; i < lanes; i++) {
      const cx = cabinetX(i, lanes);
      const base = ctx.ground(0); // the hall floor (the cabinets stand on one rail)
      drawers.push({ mouth: { x: cx, y: base - CAB.h + 18 }, w: CAB.w - 40 });
      meters.push({ x: cx, y: base - CAB.h - 44 });
      shutters.push({ x: cx, y: base - 166 });
    }
    return {
      table: { x: TABLE.x, y: gy + TABLE.top - 30 },
      rest(display, count) {
        const col = display % 3;
        const row = Math.floor(display / 3);
        const cols = Math.min(3, Math.max(1, count));
        return { x: TABLE.x - ((cols - 1) * 70) / 2 + col * 70, y: gy + TABLE.top - 26 - row * 46, rot: ((display * 37) % 11 - 5) * 0.02 };
      },
      drawers,
      meters,
      shutters,
      payoff: { x: 100, y: ctx.ground(0) },
      stairwell: { x: 100, y: ctx.ground(0) + 30 },
    };
  },
  laneShift: filingShift,
  drawBack(g, glow, pose, dyn, ctx, L) {
    const { c } = ctx;
    // the stairwell head glows open as the cabinets roll aside; once solved the host's merged stair terrain takes over
    // (nothing is drawn over the walkable stairs, which would hide the player)
    const p = pose.solved ? 0 : (dyn.payoff ?? 0);
    const open = Math.min(1, 4 * p * (1 - p) + (p > 0 ? 0.3 : 0)) * (p < 1 ? 1 : 0);
    if (L.stairwell && open > 0.01) {
      const x0 = -50;
      const y0 = ctx.ground(0);
      g.fillStyle(c.navyDark, open);
      g.fillRect(x0, y0 - 2, 300, 60);
      for (let s = 0; s < 5; s++) {
        g.fillStyle(mix(c.stoneShade, c.navyDark, s / 6), open);
        g.fillRect(x0 + s * 56, y0 + 6 + s * 12, 300 - s * 56, 10);
      }
      glow.fillStyle(c.cyan, 0.12 * open);
      glow.fillRect(x0, y0 - 2, 300, 60);
    }
    L.drawers.forEach((d, i) => {
      const cx = d.mouth.x + filingShift(i, ease("in_out_cubic", pose.solved ? 1 : (dyn.payoff ?? 0)));
      const base = ctx.ground(0);
      drawShadow(g, cx, base, CAB.w + 20, c);
      drawWoodBody(g, cx - CAB.w / 2, base - CAB.h, CAB.w, CAB.h, c);
      // the closed bottom drawer (the feature shutter sits between it and the open top drawer)
      g.fillStyle(mix(c.bronze, c.ink, 0.15), 1);
      g.fillRect(cx - CAB.w / 2 + 14, base - 98, CAB.w - 28, 58);
      g.fillStyle(c.brass, 1);
      g.fillRoundedRect(cx - 22, base - 76, 44, 10, 4);
      // castors on the floor rail
      g.fillStyle(c.steelShade, 1);
      g.fillCircle(cx - CAB.w / 2 + 26, base - 8, 8);
      g.fillCircle(cx + CAB.w / 2 - 26, base - 8, 8);
      // the open top drawer's dark interior (filed slips peek out of it)
      const slam = pose.solved ? 1 : (dyn.slam[i] ?? 0);
      g.fillStyle(c.navyDark, 1 - slam);
      g.fillRect(cx - CAB.w / 2 + 16, d.mouth.y - 12, CAB.w - 32, 26);
    });
  },
  drawFront(g, glow, pose, dyn, ctx, L) {
    const { c } = ctx;
    L.drawers.forEach((d, i) => {
      const shift = filingShift(i, ease("in_out_cubic", pose.solved ? 1 : (dyn.payoff ?? 0)));
      const cx = d.mouth.x + shift;
      const lane = pose.lanes[i];
      const slam = pose.solved ? 1 : (dyn.slam[i] ?? 0);
      // the drawer front: pulled out while open, pushed flush when slammed
      const out = 16 * (1 - slam);
      drawBrassPlate(g, cx - CAB.w / 2 + 10 - out * 0.2, d.mouth.y + 12 + out * 0.3, CAB.w - 20, CAB.drawerH - 18, c, 6);
      g.fillStyle(c.paper, 1);
      g.fillRect(cx - 34, d.mouth.y + 20 + out * 0.3, 68, 16); // the label card (the bin label is DOM)
      if (lane && lane.open > 0.05) {
        glow.fillStyle(c.cyan, 0.2 * lane.open);
        glow.fillRect(cx - CAB.w / 2, d.mouth.y - 20, CAB.w, CAB.drawerH + 10);
      }
      const m = L.meters[i];
      if (m) drawMeter(g, { x: m.x + shift, y: m.y }, lane?.meter ?? -50, c, (lane?.count ?? 0) > 0);
      const s = L.shutters[i];
      if (s) drawShutter(g, glow, { x: s.x + shift, y: s.y }, 150, 92, Math.max(lane?.shutter ?? 0, dyn.shutter[i] ?? 0), c);
    });
  },
  drawItem(g, item, at, rot, alpha, scale, ctx) {
    const { c } = ctx;
    drawPaper(g, at.x, at.y, 62 * scale, 42 * scale, c, { rot, lines: 3, alpha, fill: item.display % 2 ? c.paperAged : c.paper });
  },
};

export const skin: SkinPrefab<RouterLanesConfig, RouterLanesPose> = {
  skinId: "filing_cabinets",
  create(scene, _phaser, props) {
    return createCivilDrawersView(scene, props, filingSkin);
  },
};
export default skin;
