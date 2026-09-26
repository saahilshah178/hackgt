/**
 * actors/costume.ts (pure, H1) — costume overlays on the rig's per-frame anchors (docs/design/20 §5.5):
 * pos = anchor + R(rot)·(dx, dy), angle = rot; flipX mirrors both (x → W − x, rot → −rot); a back-facing frame swaps
 * front and behind; hideOn hides. Anchors are display units from the frame's top-left (168 × 224 for the rig).
 */
import type { CharacterLook, RigAnchor } from "../../../../contracts/world";

export const RIG_DISPLAY_W = 168;
export const RIG_DISPLAY_H = 224;

export interface RigPoint {
  name: RigAnchor;
  x: number;
  y: number;
  rot: number; // degrees
}
export interface FrameAnchors {
  pose: string;
  facing: "front" | "back";
  points: readonly RigPoint[];
}
export type CostumeItem = CharacterLook["costume"][number];
export interface CostumePlacement {
  /** offset from the sprite origin (feet, pivot [0.5, 1]) in display units, before the look's scale */
  x: number;
  y: number;
  angle: number; // degrees
  visible: boolean;
  front: boolean; // drawn in front of the body
}

export function placeCostume(item: CostumeItem, frame: FrameAnchors | null, flipX: boolean, w = RIG_DISPLAY_W, h = RIG_DISPLAY_H): CostumePlacement {
  const p = frame?.points.find((q) => q.name === item.anchor);
  if (!frame || !p || item.hideOn.includes(frame.pose)) return { x: 0, y: 0, angle: 0, visible: false, front: item.layer === "front" };
  const r = (p.rot * Math.PI) / 180;
  let x = p.x + Math.cos(r) * item.dx - Math.sin(r) * item.dy;
  const y = p.y + Math.sin(r) * item.dx + Math.cos(r) * item.dy;
  let angle = p.rot;
  if (flipX) {
    x = w - x;
    angle = -angle;
  }
  const front = frame.facing === "back" ? item.layer !== "front" : item.layer === "front";
  return { x: x - w / 2, y: y - h, angle, visible: true, front };
}

/** One step of a damped spring (scarf tails): returns the new position and velocity. */
export function springStep(pos: { x: number; y: number }, vel: { x: number; y: number }, target: { x: number; y: number }, dtSec: number, k = 60, damping = 10): { pos: { x: number; y: number }; vel: { x: number; y: number } } {
  const dt = Math.min(0.05, Math.max(0, dtSec));
  const ax = k * (target.x - pos.x) - damping * vel.x;
  const ay = k * (target.y - pos.y) - damping * vel.y;
  const v = { x: vel.x + ax * dt, y: vel.y + ay * dt };
  return { pos: { x: pos.x + v.x * dt, y: pos.y + v.y * dt }, vel: v };
}
