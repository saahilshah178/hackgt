/**
 * oracle_ticker · skin wire_ticker (civil e3, the Wire Ticker and Prediction Selector; §4.3 slots kiosk, teletype,
 * selector, telegraph_pole, school_barrier, walk_lamp, console). KC3.
 *
 *  - a newsstand kiosk with a teletype on its counter: the paper tape rises and "types" the forecast at 45 chars/s
 *    (the words are the DOM chip at `teletype`; the tape shows ink bars);
 *  - the brass Prediction Selector at the console: a dial with three stops (−40°, 0°, +40°) whose pointer follows the
 *    hovered or committed forecast (orange cap = bound to your input), resting at −75° when nothing is set;
 *  - a telegraph wire from the kiosk roof over two poles to the school's barred doors; it hums while a forecast is set;
 *  - the school barrier (the reason you cannot pass; the host draws no blocker asset here) and `payoffLamps` walk lamps.
 *
 * Success: the ticker prints the reveal, a cyan run climbs the wire, the barrier dissolves into scanlines and the walk
 * lamps light one at a time (a quiet memorial count). Failure: the reveal still prints (predict-then-reveal), the
 * forecast line is stamped, the selector lifts and unlocks. sensitiveSafe: no shake, no bursts. Stand-in art.
 */
import type Phaser from "phaser";
import type { OracleTickerConfig } from "@/world/contraptions/oracle-ticker.config";
import type { OracleTickerPose } from "@/world/contraptions/oracle-ticker.meta";
import { clamp01 } from "@/world/ease";
import type { FailurePlan, SuccessPlan } from "@/world/types";
import type { ContraptionState, PoseView, SkinPrefab, XY } from "../../../types";
import {
  BLEND_ADD,
  beatClock,
  civilColors,
  drawBrassPlate,
  drawConsoleReader,
  drawLampPost,
  drawPaper,
  drawShadow,
  drawStamp,
  fillPoly,
  localGround,
  mix,
  pulse,
  strokePoly,
  type CivilColors,
} from "../civil-kit";
import { KNOB_REST_DEG, knobRad, poleTops, routeTickerFail, routeTickerSuccess, TICKER, tickerLayout, wirePath, type TickerLayout } from "../shared";

type G = Phaser.GameObjects.Graphics;

function drawKiosk(g: G, L: TickerLayout, ground: (x: number) => number, c: CivilColors): void {
  const k = TICKER.kiosk;
  const x0 = k.x - k.w / 2;
  const y = ground(k.x);
  drawShadow(g, k.x, y, k.w + 40, c);
  // lower cabinet (brick) and counter
  g.fillStyle(c.brickShade, 1);
  g.fillRect(x0, y - 110, k.w, 110);
  g.fillStyle(c.brick, 1);
  g.fillRect(x0 + 6, y - 104, k.w - 12, 98);
  g.lineStyle(2, c.brickShade, 0.8);
  for (let r = 1; r < 5; r++) {
    g.beginPath();
    g.moveTo(x0 + 6, y - 104 + r * 20);
    g.lineTo(x0 + k.w - 6, y - 104 + r * 20);
    g.strokePath();
  }
  g.fillStyle(c.stoneShade, 1);
  g.fillRect(x0 - 8, y - 120, k.w + 16, 12);
  g.fillStyle(c.stoneLit, 1);
  g.fillRect(x0 - 8, y - 120, k.w + 16, 4);
  // back wall with newspaper racks (headline bars; words stay DOM)
  g.fillStyle(c.navyDark, 1);
  g.fillRect(x0 + 8, y - k.h + 40, k.w - 16, k.h - 160);
  for (let i = 0; i < 3; i++) drawPaper(g, x0 + 44 + i * 36, y - 196, 30, 44, c, { lines: 3, fill: i === 1 ? c.paperAged : c.paper });
  // posts and awning
  g.fillStyle(c.brassDeep, 1);
  g.fillRect(x0 - 4, y - k.h + 30, 12, k.h - 150);
  g.fillRect(x0 + k.w - 8, y - k.h + 30, 12, k.h - 150);
  const stripes = 7;
  for (let i = 0; i < stripes; i++) {
    const ax = x0 - 22 + ((k.w + 44) * i) / stripes;
    const bx = x0 - 22 + ((k.w + 44) * (i + 1)) / stripes;
    g.fillStyle(i % 2 === 0 ? c.brickLit : c.paper, 1);
    fillPoly(g, [
      { x: ax + 14, y: y - k.h },
      { x: bx + 14, y: y - k.h },
      { x: bx, y: y - k.h + 40 },
      { x: ax, y: y - k.h + 40 },
    ]);
  }
  g.fillStyle(c.brassDeep, 1);
  g.fillRect(x0 - 22, y - k.h + 38, k.w + 44, 6);
  g.fillStyle(c.brass, 1);
  g.fillRect(x0 - 8, y - k.h - 8, k.w + 30, 8);
  // the roof mast and insulator where the wire starts
  g.fillStyle(c.bronze, 1);
  g.fillRect(L.wireStart.x - 4, L.wireStart.y, 8, y - k.h - 8 - L.wireStart.y);
  g.fillStyle(c.cyanHi, 1);
  g.fillCircle(L.wireStart.x, L.wireStart.y, 6);
}

function drawTeletypeBody(g: G, at: XY, c: CivilColors): void {
  g.fillStyle(c.steelShade, 1);
  g.fillRoundedRect(at.x - 58, at.y - 28, 116, 58, 10);
  g.fillStyle(c.steel, 1);
  g.fillRoundedRect(at.x - 52, at.y - 24, 104, 30, 8);
  g.fillStyle(c.ink, 1);
  g.fillRoundedRect(at.x - 34, at.y - 38, 68, 14, 6); // the platen
  g.fillStyle(c.brassHi, 0.8);
  for (let i = 0; i < 6; i++) g.fillCircle(at.x - 40 + i * 16, at.y + 18, 4); // the keys
}

function drawPole(g: G, base: XY, c: CivilColors): void {
  const top = base.y - TICKER.poleH;
  g.fillStyle(mix(c.bronze, c.ink, 0.3), 1);
  g.fillRect(base.x - 8, top, 16, TICKER.poleH);
  g.fillStyle(c.bronze, 1);
  g.fillRect(base.x - 8, top, 6, TICKER.poleH);
  g.fillStyle(mix(c.bronze, c.ink, 0.2), 1);
  g.fillRect(base.x - 44, top + 20, 88, 10);
  for (const dx of [-36, 36]) {
    g.fillStyle(c.cyanHi, 0.95);
    g.fillCircle(base.x + dx, top + 16, 6);
  }
  g.fillStyle(c.cyanHi, 0.95);
  g.fillCircle(base.x, top + 26, 6);
}

function drawGateposts(g: G, at: XY, c: CivilColors): void {
  const { w, h } = TICKER.barrier;
  for (const dx of [-(w / 2 + 24), w / 2 + 24]) {
    g.fillStyle(c.brickShade, 1);
    g.fillRect(at.x + dx - 22, at.y - h - 36, 44, h + 36);
    g.fillStyle(c.brick, 1);
    g.fillRect(at.x + dx - 18, at.y - h - 32, 30, h + 28);
    g.fillStyle(c.stone, 1);
    g.fillRect(at.x + dx - 28, at.y - h - 48, 56, 14);
    g.fillStyle(c.stoneLit, 1);
    g.fillRect(at.x + dx - 28, at.y - h - 48, 56, 4);
  }
}

/** The barred doors; `dissolve` 0…1 breaks them into horizontal scanlines that fade upward. */
function drawBarrier(g: G, glow: G, at: XY, dissolve: number, c: CivilColors, tMs: number): void {
  const { w, h } = TICKER.barrier;
  if (dissolve >= 0.999) return;
  const x0 = at.x - w / 2;
  const top = at.y - h;
  const band = 10;
  for (let y = top; y < at.y; y += band) {
    const row = (y - top) / h; // 0 top … 1 bottom
    const local = clamp01(dissolve * 1.6 - (1 - row) * 0.6); // bottom rows go first, sweeping up
    const a = 1 - local;
    if (a <= 0.02) continue;
    const skip = local > 0 && Math.floor((y - top) / band + tMs / 60) % 3 === 0;
    if (skip) continue;
    g.fillStyle(c.navyDark, a);
    for (let i = 0; i <= 10; i++) g.fillRect(x0 + (w * i) / 10 - 3, y, 6, band);
    if (local > 0) {
      glow.fillStyle(c.cyan, 0.5 * a * local);
      glow.fillRect(x0, y + band / 2 - 1, w, 2);
    }
  }
  const a = 1 - dissolve;
  g.fillStyle(c.navyDark, a);
  g.fillRect(x0 - 4, top, w + 8, 10);
  g.fillRect(x0 - 4, at.y - 60, w + 8, 10);
  g.fillStyle(c.brass, a);
  for (let i = 0; i <= 10; i += 2) {
    const fx = x0 + (w * i) / 10;
    fillPoly(g, [
      { x: fx - 6, y: top },
      { x: fx, y: top - 16 },
      { x: fx + 6, y: top },
    ]);
  }
}

function drawSelector(g: G, glow: G, L: TickerLayout, pose: OracleTickerPose, unseat: number, c: CivilColors, active: boolean, tMs: number, reduced: boolean): void {
  const { dial } = L;
  const R = TICKER.dialR;
  // pedestal
  g.fillStyle(c.brassDeep, 1);
  g.fillRoundedRect(L.console.x - 36, L.console.y - 12, 72, 12, 4);
  g.fillStyle(mix(c.bronze, c.ink, 0.2), 1);
  g.fillRect(L.console.x - 13, dial.y + R - 6, 26, L.console.y - 12 - (dial.y + R - 6));
  g.fillStyle(c.bronze, 1);
  g.fillRect(L.console.x - 13, dial.y + R - 6, 9, L.console.y - 12 - (dial.y + R - 6));
  // dial face
  if (active) {
    glow.fillStyle(c.cyan, 0.22 * (0.7 + 0.3 * pulse(tMs, 0.5, reduced)));
    glow.fillCircle(dial.x, dial.y, R + 22);
  }
  g.fillStyle(c.brassDeep, 1);
  g.fillCircle(dial.x, dial.y, R + 8);
  g.fillStyle(c.brass, 1);
  g.fillCircle(dial.x, dial.y, R + 4);
  g.fillStyle(c.paper, 1);
  g.fillCircle(dial.x, dial.y, R);
  // engraved stops (−40°, 0°, +40°) and the OFF rest dot; the stop the pointer rests on is marked
  for (const deg of [-40, 0, 40]) {
    const a = (deg * Math.PI) / 180;
    const on = pose.position !== null && Math.abs(pose.knobDeg - deg) < 6;
    g.lineStyle(on ? 6 : 4, on ? c.accent : c.ink, 1);
    g.beginPath();
    g.moveTo(dial.x + Math.sin(a) * (R - 16), dial.y - Math.cos(a) * (R - 16));
    g.lineTo(dial.x + Math.sin(a) * (R - 3), dial.y - Math.cos(a) * (R - 3));
    g.strokePath();
  }
  const rest = (KNOB_REST_DEG * Math.PI) / 180;
  g.fillStyle(c.dormant, 1);
  g.fillCircle(dial.x + Math.sin(rest) * (R - 9), dial.y - Math.cos(rest) * (R - 9), 4);
  // the pointer (wobbles while the selector "unlocks" after a miss)
  const wobble = unseat > 0 ? ((12 * Math.PI) / 180) * Math.sin(2 * Math.PI * 2 * (1 - unseat)) * unseat : 0;
  const a = knobRad(pose.knobDeg) + wobble;
  const lift = unseat > 0 ? 5 * Math.sin(Math.PI * (1 - unseat)) : 0;
  const tip = { x: dial.x + Math.sin(a) * (R - 8), y: dial.y - lift - Math.cos(a) * (R - 8) };
  const px = Math.cos(a) * 7;
  const py = Math.sin(a) * 7;
  g.fillStyle(c.ink, 1);
  fillPoly(g, [
    { x: dial.x + px, y: dial.y - lift + py },
    tip,
    { x: dial.x - px, y: dial.y - lift - py },
  ]);
  g.fillStyle(pose.committed ? c.accent : c.brassDeep, 1);
  g.fillCircle(dial.x, dial.y - lift, 11);
  if (pose.previewing) {
    g.lineStyle(3, c.accent, 0.9);
    g.strokeCircle(dial.x, dial.y - lift, 16);
  }
  g.fillStyle(c.brassHi, 1);
  g.fillCircle(dial.x - 3, dial.y - lift - 3, 3);
}

function drawTape(g: G, L: TickerLayout, pose: OracleTickerPose, printU: number, printAlpha: number, stamp: number, c: CivilColors): void {
  const base = { x: TICKER.teletype.x, y: L.teletype.y - TICKER.tapeTop + TICKER.teletype.y - 38 }; // the platen
  const top = L.teletype.y;
  // the forecast tape: a narrow strip rising from the platen; its ink bars follow the typed characters
  const len = pose.tapeText.length;
  const typed = len > 0 ? pose.tapeChars / len : 0;
  const tapeH = base.y - top;
  if (len > 0 || pose.printed) {
    g.fillStyle(c.paper, 1);
    g.fillRect(base.x - 17, top, 34, tapeH);
    g.lineStyle(2, c.ink, 0.25);
    g.strokeRect(base.x - 17, top, 34, tapeH);
    const lines = 7;
    g.lineStyle(4, c.ink, 0.75);
    for (let i = 0; i < lines; i++) {
      const shown = clamp01(typed * lines - i);
      if (shown <= 0) continue;
      const y = base.y - 14 - i * (tapeH / (lines + 1));
      g.beginPath();
      g.moveTo(base.x - 11, y);
      g.lineTo(base.x - 11 + 22 * shown, y);
      g.strokePath();
    }
  }
  // the printed reveal: a wider sheet feeding up behind the tape
  if (printU > 0 && printAlpha > 0.01) {
    const h = 170 * clamp01(printU);
    drawPaper(g, base.x + 46, base.y - 8 - h / 2, 84, h, c, { lines: Math.max(1, Math.round(6 * printU)), alpha: printAlpha, fill: c.paper });
    g.fillStyle(c.ink, 0.8 * printAlpha); // the date slug
    if (printU > 0.8) g.fillRect(base.x + 14, base.y - 8 - h + 10, 40, 8);
  }
  if (stamp > 0.01) drawStamp(g, base.x, top + 46, 78, 30, -8, c.salmon, stamp);
}

function wireFixed(L: TickerLayout): XY[] {
  return [L.wireStart, ...poleTops(L.poles), L.wireEnd];
}

function drawWire(g: G, glow: G, L: TickerLayout, pose: OracleTickerPose, run: number | null, lit: number, c: CivilColors): void {
  const pts = wirePath(wireFixed(L), pose.wireAmp, pose.wirePhase);
  strokePoly(g.lineStyle(3, c.ink, 0.95), pts);
  const glowK = Math.max(pose.wireGlow, lit);
  if (glowK > 0.01) {
    glow.lineStyle(10, c.cyan, 0.35 * glowK);
    strokePoly(glow, pts);
    glow.lineStyle(3, c.cyanHi, 0.8 * glowK);
    strokePoly(glow, pts);
  }
  if (run !== null && run > 0 && run < 1) {
    const i = Math.min(pts.length - 1, Math.floor(run * (pts.length - 1)));
    const p = pts[i]!;
    glow.fillStyle(c.cyan, 0.45);
    glow.fillCircle(p.x, p.y, 26);
    glow.fillStyle(c.cyanHi, 0.9);
    glow.fillCircle(p.x, p.y, 9);
    // the charged part behind the run
    glow.lineStyle(6, c.cyan, 0.6);
    strokePoly(glow, pts.slice(0, i + 1));
  }
}

export function createWireTickerView(scene: Phaser.Scene, props: Parameters<SkinPrefab<OracleTickerConfig, OracleTickerPose>["create"]>[2]): PoseView<OracleTickerPose> {
  const c = civilColors(props.palette);
  const anchor = props.station.anchor;
  const ground = localGround(scene, props);
  const blockerX = props.station.payoff.blocker ? props.station.payoff.blocker.x - anchor.x : null;
  const lampCount = Math.max(props.config.payoffLamps, 0);
  const L = tickerLayout(props.station.consoleX - anchor.x, blockerX, lampCount, (x) => ground(x));
  const reduced = props.reducedMotion;

  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics();
  const wireG = scene.add.graphics();
  const dyn = scene.add.graphics();
  const glow = scene.add.graphics();
  glow.setBlendMode(BLEND_ADD);
  root.add([back, wireG, dyn, glow]);

  // static parts
  L.poles.forEach((p) => drawPole(back, p, c));
  drawKiosk(back, L, (x) => ground(x), c);
  drawTeletypeBody(back, { x: TICKER.teletype.x, y: ground(TICKER.teletype.x) + TICKER.teletype.y }, c);
  drawGateposts(back, L.barrier, c);
  const hasConsoleAsset = props.station.consoleAsset !== null;
  drawBrassPlate(back, L.barrier.x - 36, L.barrier.y - TICKER.barrier.h - 90, 72, 26, c, 6); // the school's name plate

  const lampGlobes = L.lamps.map((b) => ({ x: b.x, y: b.y - TICKER.lampH - 10 }));
  const mid = lampGlobes[Math.floor(lampGlobes.length / 2)] ?? { x: L.barrier.x - 120, y: L.barrier.y - 120 };
  const anchors: Record<string, XY> & { console: XY } = {
    console: L.console,
    teletype: L.teletype,
    knob: L.dial,
    wire_start: L.wireStart,
    wire_end: L.wireEnd,
    lamps: mid,
    barrier: { x: L.barrier.x, y: L.barrier.y - TICKER.barrier.h / 2 },
    payoff: { x: L.barrier.x, y: L.barrier.y - TICKER.barrier.h / 2 },
  };
  lampGlobes.forEach((p, i) => (anchors[`lamp_${i}`] = p));

  let pose: OracleTickerPose | null = null;
  let state: ContraptionState = "dormant";
  let destroyed = false;
  let now = 0;
  const fx = {
    print: 0, // 0…1 feed of the reveal
    printing: false,
    printAlpha: 0,
    printHoldMs: 0, // after a miss the reveal stays readable, then fades
    stamp: 0,
    unseat: 0, // 1 → 0
    run: null as number | null,
    wireLit: 0,
    dissolve: 0,
    dissolving: false,
    lampLit: new Set<number>(),
  };
  const clock = beatClock(scene, reduced, () => !destroyed);

  const redraw = () => {
    if (!pose) return;
    wireG.clear();
    dyn.clear();
    glow.clear();
    drawWire(wireG, glow, L, pose, fx.run, fx.wireLit, c);
    drawTape(dyn, L, pose, pose.printed ? 1 : fx.print, pose.printed ? 1 : fx.printAlpha, fx.stamp, c);
    drawSelector(dyn, glow, L, pose, fx.unseat, c, state === "active", now, reduced);
    drawBarrier(dyn, glow, L.barrier, pose.barrier <= 0.001 ? 1 : Math.max(fx.dissolve, 1 - pose.barrier), c, now);
    L.lamps.forEach((b, i) => {
      const on = i < pose!.lamps || fx.lampLit.has(i) ? 1 : 0;
      drawLampPost(dyn, b, TICKER.lampH, on, c);
    });
    if (hasConsoleAsset) drawConsoleReader(dyn, { x: L.console.x - 110, y: ground(L.console.x - 110) }, c, state === "active" ? 1 : state === "awake" ? 0.4 : 0);
  };

  const view: PoseView<OracleTickerPose> = {
    root,
    anchors,
    applyPose(p: OracleTickerPose) {
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
    async playSucceed(plan: SuccessPlan, p: OracleTickerPose) {
      const r = routeTickerSuccess(plan);
      if (r.printAt !== null)
        clock.later(r.printAt, () => {
          fx.printing = true;
          fx.print = 0;
          fx.printAlpha = 1;
          fx.printHoldMs = Number.POSITIVE_INFINITY;
          fx.stamp = 0;
        });
      if (r.wireAt !== null) clock.later(r.wireAt, () => (fx.run = 0));
      if (r.dissolveAt !== null) clock.later(r.dissolveAt, () => (fx.dissolving = true));
      for (const l of r.lamps) clock.later(l.atMs, () => fx.lampLit.add(l.index));
      await clock.wait(plan.durationMs);
      if (destroyed) return;
      fx.run = null;
      fx.wireLit = 1;
      fx.dissolve = 1;
      view.applyPose(p);
    },
    async playFail(plan: FailurePlan, p: OracleTickerPose) {
      const r = routeTickerFail(plan);
      if (r.printAt !== null)
        clock.later(r.printAt, () => {
          fx.printing = true;
          fx.print = 0;
          fx.printAlpha = 1;
          fx.printHoldMs = 2600;
        });
      if (r.stampAt !== null) clock.later(r.stampAt, () => (fx.stamp = 1));
      if (r.unseatAt !== null) clock.later(r.unseatAt, () => (fx.unseat = 1));
      await clock.wait(Math.min(1600, plan.durationMs));
      if (destroyed) return;
      view.applyPose(pose ?? p); // the draft pose: the knob stays on the forecast so the player can re-aim
    },
    update(dtMs: number) {
      if (destroyed) return;
      const dt = Math.max(0, dtMs);
      now += dt;
      const k = reduced ? 1 : dt;
      if (fx.printing) fx.print = Math.min(1, fx.print + k / 700);
      if (fx.printHoldMs !== Number.POSITIVE_INFINITY && fx.printAlpha > 0) {
        fx.printHoldMs -= dt;
        if (fx.printHoldMs <= 0) {
          fx.printAlpha = Math.max(0, fx.printAlpha - k / 500);
          fx.stamp = Math.max(0, fx.stamp - k / 500);
          if (fx.printAlpha <= 0) fx.printing = false;
        }
      }
      if (fx.unseat > 0) fx.unseat = Math.max(0, fx.unseat - k / 700);
      if (fx.run !== null) fx.run = Math.min(1, fx.run + k / 500);
      if (fx.run === 1) fx.wireLit = 1;
      if (fx.dissolving) fx.dissolve = Math.min(1, fx.dissolve + k / 700);
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

export const skin: SkinPrefab<OracleTickerConfig, OracleTickerPose> = {
  skinId: "wire_ticker",
  create(scene, _phaser, props) {
    return createWireTickerView(scene, props);
  },
};
export default skin;
