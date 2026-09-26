/**
 * prefabs/cause_tubes/motion.ts — the pure, cosmetic motion the cause_tubes skins share (KC2). No Phaser: Vitest tests
 * it. What is linked comes from the meta's pose; this only decides how a new wire or tube appears and where the
 * success carrier is along the chain.
 *
 *   wireGrowU     a new tube grows from its source at TUBE_GROW_PX_S (900 px/s); wires appear at once
 *   sagSpring     a freshly strung wire overshoots its sag by 15 % and springs back (≈ 0.5 s)
 *   carrierAt     the carrier (current pulse or capsule) at run fraction u along the chain order
 *   arrowTicks    small arrow ticks every ARROW_TICK_PX along a polyline, pointing from → to
 */
import { ARROW_TICK_PX, TUBE_GROW_PX_S, WIRE_SETTLE_OVERSHOOT, type XY } from "@/world/contraptions/cause-tubes.meta";

/** Growth fraction of a tube `ageMs` after it was laid (length in zone units); reduced motion shows it whole. */
export function wireGrowU(ageMs: number, length: number, reducedMotion = false): number {
  if (reducedMotion || !(length > 0)) return 1;
  return Math.min(1, Math.max(0, (Math.max(0, ageMs) / 1000) * TUBE_GROW_PX_S) / length);
}

/** Sag multiplier of a wire `ageMs` after it was strung: 1.15 at 0, a damped spring back to 1 (≤ 1 % after 600 ms). */
export function sagSpring(ageMs: number, reducedMotion = false): number {
  if (reducedMotion || ageMs >= 900) return 1;
  const a = Math.max(0, ageMs);
  return 1 + WIRE_SETTLE_OVERSHOOT * Math.exp(-a / 130) * Math.cos((2 * Math.PI * a) / 520);
}

export interface CarrierPos {
  /** index of the hop (order[hop] → order[hop + 1]) the carrier is on, or −1 before it starts / with < 2 nodes */
  hop: number;
  /** fraction along that hop */
  u: number;
  /** node keys the carrier has reached (their lamps light cyan as it arrives) */
  reached: string[];
}
/** The carrier at run fraction `u` ∈ [0, 1] along `order` (the chain in causal order). */
export function carrierAt(order: readonly string[], u: number): CarrierPos {
  const hops = order.length - 1;
  if (hops < 1) return { hop: -1, u: 0, reached: order.slice(0, Math.max(0, Math.min(1, order.length))) };
  const v = Math.min(1, Math.max(0, Number.isFinite(u) ? u : 0)) * hops;
  const hop = Math.min(hops - 1, Math.floor(v));
  const local = v - hop;
  const reachedCount = v >= hops ? order.length : Math.floor(v) + 1;
  return { hop, u: local, reached: order.slice(0, reachedCount) };
}

export interface ArrowTick {
  at: XY;
  angle: number; // radians, pointing along the wire toward its `to` end
}
/** Arrow ticks every `spacing` units along a polyline (first tick half a spacing in), pointing along the path. */
export function arrowTicks(points: readonly XY[], spacing = ARROW_TICK_PX): ArrowTick[] {
  const out: ArrowTick[] = [];
  if (points.length < 2 || !(spacing > 0)) return out;
  let next = spacing / 2;
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l < 1e-9) continue;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    while (next <= walked + l) {
      const f = (next - walked) / l;
      out.push({ at: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, angle });
      next += spacing;
    }
    walked += l;
  }
  return out;
}
