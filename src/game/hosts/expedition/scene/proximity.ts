/**
 * scene/proximity.ts (pure, H1) — which interact target E would use (docs/design/20 §2.4.3). Hysteresis: a target is
 * acquired within ENTER units and kept until the player is LEAVE units away, so the glyph does not flicker at the edge.
 */
import type { InteractTarget } from "../../types";

export const ENTER_RADIUS = 90;
export const LEAVE_RADIUS = 130;

export interface Interactable {
  key: string; // targetKey(target)
  target: InteractTarget;
  x: number;
  y: number; // glyph anchor (world units)
  surface: string | null; // null: reachable from any surface
  label: string; // "E · Use the Tidewheel Gate console"
}

export function targetKey(t: InteractTarget): string {
  switch (t.kind) {
    case "station":
    case "vehicle":
      return `${t.kind}:${t.encounterId}`;
    case "sandbox":
      return `sandbox:${t.sandboxId}`;
    case "npc":
      return `npc:${t.npcId}`;
    case "plaque":
      return `plaque:${t.plaqueId}`;
    case "collectible":
      return `collectible:${t.collectibleId}`;
    case "touch":
      return `touch:${t.propId}`;
    case "link":
      return `link:${t.linkId}`;
    case "exit":
      return `exit:${t.exitId}`;
  }
}

/** The target E would use from `pos`, keeping `prevKey` while it is within `leave`. */
export function nearest(
  items: readonly Interactable[],
  pos: { x: number; surface: string },
  prevKey: string | null,
  enter = ENTER_RADIUS,
  leave = LEAVE_RADIUS,
): Interactable | null {
  const reachable = items.filter((i) => i.surface === null || i.surface === pos.surface);
  if (prevKey) {
    const prev = reachable.find((i) => i.key === prevKey);
    if (prev && Math.abs(prev.x - pos.x) <= leave) {
      // a strictly nearer target inside the enter radius wins over the held one
      const better = reachable.find((i) => i.key !== prevKey && Math.abs(i.x - pos.x) <= enter && Math.abs(i.x - pos.x) < Math.abs(prev.x - pos.x) - 20);
      return better ?? prev;
    }
  }
  let best: Interactable | null = null;
  for (const i of reachable) {
    const d = Math.abs(i.x - pos.x);
    if (d <= enter && (!best || d < Math.abs(best.x - pos.x))) best = i;
  }
  return best;
}

/** Glyph text per kind (§2.4.3). */
export function interactLabel(kind: InteractTarget["kind"], noun: string): string {
  switch (kind) {
    case "station":
      return `E · Use the ${noun} console`;
    case "sandbox":
      return `E · Open the ${noun}`;
    case "npc":
      return `E · Talk to ${noun}`;
    case "plaque":
      return "E · Read";
    case "collectible":
      return `E · Pick up ${noun}`;
    case "touch":
      return `E · ${noun}`;
    case "vehicle":
      return `E · Board the ${noun}`;
    case "link":
      return noun;
    case "exit":
      return `→ ${noun}`;
  }
}
