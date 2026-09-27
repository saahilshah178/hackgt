/**
 * oracle_ticker prefab shared helpers (docs/design/20 §2.5.5, §4 row 5; civil §5.3). Owned by KC (L8) with the prefab
 * core; skin files import it read-only. The pure half (layout, the telegraph wire's sag and hum, beat routing) is
 * unit-tested in shared.test.ts; the civil drawing kit is ./civil-kit.ts.
 */
import { KNOB_REST_DEG, WIRE_AMP_PX } from "@/world/contraptions/oracle-ticker.meta";
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import type { XY } from "../../types";
import { anchorIndex, numParam, strParam } from "./civil-kit";

/** W0 seam (tests/world-contract.test.ts checks every prefab shared.ts keeps it); the wire_ticker no longer uses it. */
export { stubBox, type StubBoxOptions } from "../_stub";

export const ARCHETYPE_ID = "oracle_ticker";
/** Placeholder tint for the W0 labelled box (kept for the seam). */
export const STUB_COLOR = 0x6b4f3a;

// ================================================================ layout (container-local; the root sits at station.anchor)

export const TICKER = {
  kiosk: { x: -90, w: 250, h: 290 },
  teletype: { x: -90, y: -150 }, // machine on the counter
  tapeTop: -300, // where the tape (and its DOM chip) reaches
  dialR: 46,
  pedestalH: 104,
  poleH: 360,
  barrier: { w: 190, h: 230 },
  lampH: 112,
  lampSpacing: 58,
} as const;

export interface TickerLayout {
  console: XY;
  dial: XY;
  teletype: XY; // the anchor: top of the tape
  wireStart: XY;
  poles: XY[]; // pole bases
  wireEnd: XY;
  barrier: XY; // barrier base centre
  lamps: XY[]; // lamp bases
}

/**
 * Where everything stands: the kiosk at the anchor, the selector at the console, the barrier at the payoff blocker
 * (or 990 right of the anchor), two telegraph poles between, and `lampCount` walk lamps lining the walk up to the
 * barrier. `ground(x)` is the container-local ground y at container-local x.
 */
export function tickerLayout(consoleX: number, blockerX: number | null, lampCount: number, ground: (x: number) => number): TickerLayout {
  const bx = blockerX ?? 990;
  const g = (x: number) => ground(x);
  const dialY = g(consoleX) - TICKER.pedestalH - TICKER.dialR + 6;
  const wireStart = { x: TICKER.kiosk.x + 80, y: g(TICKER.kiosk.x) - TICKER.kiosk.h - 44 };
  const span = bx - wireStart.x;
  const poleXs = [wireStart.x + span * 0.36, wireStart.x + span * 0.7];
  const poles = poleXs.map((x) => ({ x, y: g(x) }));
  const barrier = { x: bx, y: g(bx) };
  const wireEnd = { x: bx - TICKER.barrier.w / 2 - 22, y: barrier.y - TICKER.barrier.h - 44 };
  const n = Math.max(0, lampCount);
  const lastX = bx - TICKER.barrier.w / 2 - 50;
  const lamps = Array.from({ length: n }, (_, i) => {
    const x = lastX - (n - 1 - i) * TICKER.lampSpacing;
    return { x, y: g(x) };
  });
  return {
    console: { x: consoleX, y: g(consoleX) },
    dial: { x: consoleX, y: dialY },
    teletype: { x: TICKER.teletype.x, y: g(TICKER.teletype.x) + TICKER.tapeTop },
    wireStart,
    poles,
    wireEnd,
    barrier,
    lamps,
  };
}

/** The pole-top insulators the wire hangs from. */
export function poleTops(poles: readonly XY[]): XY[] {
  return poles.map((p) => ({ x: p.x, y: p.y - TICKER.poleH + 26 }));
}

/**
 * The telegraph wire as a sampled polyline through its fixed points: each span sags as a parabola (sag ∝ span length),
 * and while a forecast is set it hums: y += amp · sin(2π(3·phase − s/120)), s = arc distance from the kiosk
 * (civil §5.3). Endpoints and insulators stay put (the hum is windowed per span).
 */
export function wirePath(fixed: readonly XY[], amp: number, phase: number, samplesPerSpan = 18): XY[] {
  const out: XY[] = [];
  let s0 = 0;
  for (let i = 1; i < fixed.length; i++) {
    const a = fixed[i - 1]!;
    const b = fixed[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const sag = Math.min(60, 0.07 * len);
    for (let k = i === 1 ? 0 : 1; k <= samplesPerSpan; k++) {
      const t = k / samplesPerSpan;
      const s = s0 + t * len;
      const window = Math.sin(Math.PI * t); // 0 at insulators
      const hum = amp * window * Math.sin(2 * Math.PI * (3 * phase - s / 120));
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + 4 * sag * t * (1 - t) + hum });
    }
    s0 += len;
  }
  return out;
}

/** The knob pointer angle in radians from straight up (pose knobDeg: −40/0/+40 per stop, KNOB_REST_DEG at rest). */
export function knobRad(knobDeg: number): number {
  return (knobDeg * Math.PI) / 180;
}
export { KNOB_REST_DEG, WIRE_AMP_PX };

// ================================================================ beat routing

export interface TickerFailRoute {
  printAt: number | null; // the reveal feeds out (the grade feedback, predict-then-reveal)
  stampAt: number | null; // NOT WHAT HAPPENED on the forecast line
  unseatAt: number | null; // the selector unlocks (the knob lifts and wobbles)
}
export function routeTickerFail(plan: Pick<FailurePlan, "beats">): TickerFailRoute {
  const out: TickerFailRoute = { printAt: null, stampAt: null, unseatAt: null };
  for (const b of plan.beats as readonly FailBeat[]) {
    if (b.anchor === "teletype" && b.action === "flash") out.printAt ??= b.atMs;
    else if (b.anchor === "teletype" && b.action === "hold_bright" && strParam(b, "stamp")) out.stampAt ??= b.atMs;
    else if (b.anchor === "knob" && b.action === "unseat") out.unseatAt ??= b.atMs;
  }
  return out;
}

export interface TickerSuccessRoute {
  printAt: number | null;
  wireAt: number | null; // the cyan run along the wire
  dissolveAt: number | null; // the barrier dissolves into scanlines
  lamps: { index: number; atMs: number }[]; // walk lamps, one at a time
}
export function routeTickerSuccess(plan: Pick<SuccessPlan, "beats">): TickerSuccessRoute {
  const out: TickerSuccessRoute = { printAt: null, wireAt: null, dissolveAt: null, lamps: [] };
  for (const b of plan.beats as readonly SuccessBeat[]) {
    if (b.anchor === "teletype" && b.action === "print") out.printAt ??= b.atMs;
    else if (b.action === "light_sequence" && b.anchor === "wire_start") out.wireAt ??= b.atMs;
    else if (b.action === "dissolve") out.dissolveAt ??= b.atMs;
    else if (b.action === "ignite" && (b.anchor === "lamps" || anchorIndex(b.anchor, "lamp_") !== null)) {
      out.lamps.push({ index: numParam(b, "index", anchorIndex(b.anchor, "lamp_") ?? out.lamps.length), atMs: b.atMs });
    }
  }
  return out;
}
