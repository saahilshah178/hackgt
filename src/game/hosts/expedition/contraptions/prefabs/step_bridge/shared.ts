/**
 * step_bridge prefab shared helpers (docs/design/20 §2.5.5, §7). Owned by KA (L6) with the prefab core; skin files
 * import it read-only (KC's walking_road / timeline_bridge and KB's endocytosis_lift may reuse the flight tracker and
 * the plan readers; the planks' flights are the same idea on every skin).
 *
 * PURE helpers (node-testable): the plank flight tracker (a placed plank flies on a bezier arc to its bay, and back to
 * its cradle when removed), the plan readers (prefix locks, the tipped slot, the decoy), the chasm extents from the
 * payoff terrain, and the relief-band mapping. Drawing primitives are the lane's common kit (emitter_rail/shared.ts).
 *
 * Live-reveal rule (§2.5.6): every placed plank looks the same (the decoy included); the world shows what a placement
 * does (the stone flies and seats), never whether it is right.
 */
import type { StepBridgeConfig } from "@/world/contraptions/step-bridge.config";
import { RELIEF_BAND } from "@/world/contraptions/step-bridge.meta";
import type { FailurePlan, ResolvedStation } from "@/world/types";
import type { XY } from "../../types";

/** W0 seam (tests/world-contract.test.ts checks every prefab shared.ts keeps it); other lanes' stub skins still use it. */
export { stubBox, type StubBoxOptions } from "../_stub";
export {
  Anims,
  chevron,
  dashedLine,
  drawLectern,
  easeInOutSine,
  easeOutCubic,
  fillPoly,
  linear,
  mix,
  orreryColors,
  setAnchor,
  softStroke,
  waitMs,
  type OrreryColors,
} from "../emitter_rail/shared";

export const ARCHETYPE_ID = "step_bridge";
/** Placeholder tint for the W0 labelled box (other lanes' skins until they land). */
export const STUB_COLOR = 0x4a6a3a;

// ================================================================ pure: plank flights

/** A point on the quadratic bezier from `a` to `b` whose control point sits `lift` above their midpoint. */
export function arcPoint(a: XY, b: XY, lift: number, u: number): XY {
  const k = Math.max(0, Math.min(1, u));
  const cx = (a.x + b.x) / 2;
  const cy = Math.min(a.y, b.y) - lift;
  const m = 1 - k;
  return { x: m * m * a.x + 2 * m * k * cx + k * k * b.x, y: m * m * a.y + 2 * m * k * cy + k * k * b.y };
}

interface Flight {
  from: XY;
  to: XY;
  t: number; // ms elapsed
  target: string; // "bay:j" | "cradle:i"
}
/**
 * Tracks where each plank is drawn: when its target changes it flies from where it is now to the new target on an arc
 * (`ms` long, `lift` high); otherwise it rests on its target. Reduced motion snaps.
 */
export class FlightTracker {
  private flights = new Map<string, Flight>();
  private at = new Map<string, XY>();
  constructor(
    private readonly ms = 450,
    private readonly lift = 120,
    private readonly reducedMotion = false,
  ) {}
  /** Sets each plank's target (key → [target id, position]); starts flights for the ones that changed. */
  aim(targets: ReadonlyMap<string, { id: string; pos: XY }>): void {
    for (const [key, { id, pos }] of targets) {
      const cur = this.at.get(key);
      const f = this.flights.get(key);
      if (!cur) {
        this.at.set(key, { ...pos });
        this.flights.set(key, { from: pos, to: pos, t: this.ms, target: id });
        continue;
      }
      if (f && f.target === id) {
        f.to = pos; // the target moved (a bobbing socket): keep flying toward it
        continue;
      }
      this.flights.set(key, { from: { ...cur }, to: pos, t: this.reducedMotion ? this.ms : 0, target: id });
    }
  }
  step(dtMs: number): void {
    for (const [key, f] of this.flights) {
      f.t = Math.min(this.ms, f.t + Math.max(0, dtMs));
      const u = f.t / this.ms;
      const e = 1 - Math.pow(1 - u, 3);
      this.at.set(key, f.from.x === f.to.x && f.from.y === f.to.y ? { ...f.to } : arcPoint(f.from, f.to, this.lift, e));
    }
  }
  /** Where the plank is drawn now. */
  pos(key: string): XY | null {
    return this.at.get(key) ?? null;
  }
  /** True while the plank is in the air. */
  flying(key: string): boolean {
    const f = this.flights.get(key);
    return !!f && f.t < this.ms && (f.from.x !== f.to.x || f.from.y !== f.to.y);
  }
  get busy(): boolean {
    for (const k of this.flights.keys()) if (this.flying(k)) return true;
    return false;
  }
}

// ================================================================ pure: plan readers

function slotOfAnchor(anchor: string): number | null {
  const m = /_(\d+)$/.exec(anchor);
  return m ? Number(m[1]) : null;
}
/** Slots whose planks lock in the failure plan (the correct prefix: `hold_bright` with `lock`). */
export function prefixSlots(plan: FailurePlan): number[] {
  return plan.beats.filter((b) => b.action === "hold_bright").map((b) => slotOfAnchor(b.anchor)).filter((j): j is number => j !== null);
}
/** The slot that tips, grinds and sinks (`order`), or null. */
export function tippedSlot(plan: FailurePlan): number | null {
  const b = plan.beats.find((x) => x.action === "tip");
  return b ? slotOfAnchor(b.anchor) : null;
}
/** The slot whose decoy crumbles (`scatter`), or null. */
export function crumbledSlot(plan: FailurePlan): number | null {
  const b = plan.beats.find((x) => x.action === "scatter" || (x.action === "sink" && x.params?.mode === "shorten"));
  return b ? slotOfAnchor(b.anchor) : null;
}

// ================================================================ pure: geometry from the station

/** The chasm's near and far lips (container-local x) from the payoff terrain's first and last points (±450 default). */
export function chasmOf(station: Pick<ResolvedStation, "payoff" | "anchor">): { left: number; right: number } {
  const pts = station.payoff.terrain?.[0]?.points;
  if (pts && pts.length >= 2) {
    const xs = pts.map((p) => p[0] - station.anchor.x);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    if (right - left > 200) return { left, right };
  }
  return { left: -450, right: 450 };
}
/** The relief band's local point for a claim x on [0, 2π] and a relief value y (relative to the `lip_relief` anchor). */
export function reliefLocal(x: number, y: number, band: { width: number; unitsPerY: number } = RELIEF_BAND): XY {
  return { x: (x * band.width) / (2 * Math.PI) - band.width / 2, y: -band.unitsPerY * y };
}
/** The glyph icon family a stone carries (what the step SAYS; the skin draws it). */
export type StoneGlyph = "balance_div2" | "angle_wedge" | "upper_half_circle" | "twin_beacons" | "arcsin_arrow" | "rune";
export function stoneGlyphOf(config: Pick<StepBridgeConfig, "items">, key: string): StoneGlyph {
  const g = config.items.find((i) => i.key === key)?.meta.glyph ?? null;
  return g === "balance_div2" || g === "angle_wedge" || g === "upper_half_circle" || g === "twin_beacons" || g === "arcsin_arrow" ? g : "rune";
}
