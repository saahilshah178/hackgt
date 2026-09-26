/**
 * actors/flight.ts (pure, H1) — the companion's hint flights (docs/design/20 §2.2 actors/companion.ts, amendment 10).
 * A plan visits each HintTarget in turn: fly (at FLY_SPEED) to it, then act for holdMs: circle (radius 60, 1 rev/s),
 * land (perch on the anchor), hover (40 above, bobbing) or ride (stay on the anchor). The puppet plays `cue` throughout.
 */
export const FLY_SPEED = 900; // units / s
export const CIRCLE_RADIUS = 60;
export const HOVER_LIFT = 40;

export interface FlightTarget {
  x: number;
  y: number;
  action: "circle" | "land" | "hover" | "ride";
  holdMs: number;
}
export interface FlightLeg {
  from: { x: number; y: number };
  target: FlightTarget;
  flyMs: number;
  startMs: number;
}
export interface FlightPlan {
  legs: readonly FlightLeg[];
  totalMs: number;
}

export function flightPlan(start: { x: number; y: number }, targets: readonly FlightTarget[], speed = FLY_SPEED): FlightPlan {
  const legs: FlightLeg[] = [];
  let t = 0;
  let from = start;
  for (const target of targets) {
    const arrive = target.action === "circle" ? { x: target.x + CIRCLE_RADIUS, y: target.y } : target.action === "hover" ? { x: target.x, y: target.y - HOVER_LIFT } : { x: target.x, y: target.y };
    const flyMs = Math.max(250, (Math.hypot(arrive.x - from.x, arrive.y - from.y) / speed) * 1000);
    legs.push({ from, target, flyMs, startMs: t });
    t += flyMs + target.holdMs;
    from = arrive;
  }
  return { legs, totalMs: t };
}

const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

/** Where the companion is tMs into a plan. */
export function flightAt(plan: FlightPlan, tMs: number): { x: number; y: number; done: boolean; leg: number } {
  if (plan.legs.length === 0) return { x: 0, y: 0, done: true, leg: -1 };
  for (let i = 0; i < plan.legs.length; i++) {
    const leg = plan.legs[i];
    const local = tMs - leg.startMs;
    const end = leg.flyMs + leg.target.holdMs;
    if (local > end && i < plan.legs.length - 1) continue;
    const tg = leg.target;
    if (local <= leg.flyMs) {
      const u = easeInOut(Math.max(0, local) / leg.flyMs);
      const arrive = tg.action === "circle" ? { x: tg.x + CIRCLE_RADIUS, y: tg.y } : tg.action === "hover" ? { x: tg.x, y: tg.y - HOVER_LIFT } : { x: tg.x, y: tg.y };
      return { x: leg.from.x + (arrive.x - leg.from.x) * u, y: leg.from.y + (arrive.y - leg.from.y) * u - Math.sin(Math.PI * u) * 40, done: false, leg: i };
    }
    const h = Math.min(local, end) - leg.flyMs;
    const done = i === plan.legs.length - 1 && local >= end;
    switch (tg.action) {
      case "circle": {
        const a = (h / 1000) * Math.PI * 2;
        return { x: tg.x + Math.cos(a) * CIRCLE_RADIUS, y: tg.y - Math.sin(a) * CIRCLE_RADIUS, done, leg: i };
      }
      case "hover":
        return { x: tg.x, y: tg.y - HOVER_LIFT + Math.sin((h / 1000) * Math.PI * 2 * 1.5) * 6, done, leg: i };
      case "land":
      case "ride":
        return { x: tg.x, y: tg.y, done, leg: i };
    }
  }
  const last = plan.legs[plan.legs.length - 1];
  return { x: last.target.x, y: last.target.y, done: true, leg: plan.legs.length - 1 };
}
