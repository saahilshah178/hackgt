/**
 * art/stub-rig.ts (pure, H1) — the stand-in for a `shared.char.<id>` atlas (docs/design/20 §5.5) until A1's rig
 * build ships PNG atlases: the 28 protagonist poses (12 for NPCs) drawn as a simple figure, with the 7 rig anchors
 * computed per pose from the same stick skeleton the painter draws. Display size 168 × 224, pivot [0.5, 1].
 */
import type { RigAnchor } from "../../../../contracts/world";
import type { FrameAnchors, RigPoint } from "../actors/costume";
import { RIG_DISPLAY_H, RIG_DISPLAY_W } from "../actors/costume";
import { NPC_POSES, PROTAGONIST_POSES } from "../actors/pose-animator";

export interface StubSkeleton {
  pose: string;
  facing: "front" | "back";
  lean: number; // degrees, torso lean
  head: { x: number; y: number; r: number };
  hip: { x: number; y: number };
  shoulder: { x: number; y: number };
  handR: { x: number; y: number };
  handL: { x: number; y: number };
  footR: { x: number; y: number };
  footL: { x: number; y: number };
  mouthOpen: boolean;
}

const W = RIG_DISPLAY_W;
const H = RIG_DISPLAY_H;

export function posesFor(kind: "protagonist" | "npc"): readonly string[] {
  return kind === "protagonist" ? PROTAGONIST_POSES : NPC_POSES;
}

/** The stick skeleton of a pose (display units, origin top-left, feet at y 222). */
export function stubSkeleton(pose: string): StubSkeleton {
  const cx = W / 2;
  const base: StubSkeleton = {
    pose,
    facing: pose === "back" ? "back" : "front",
    lean: 0,
    head: { x: cx + 4, y: 58, r: 30 },
    shoulder: { x: cx, y: 102 },
    hip: { x: cx, y: 158 },
    handR: { x: cx + 26, y: 158 },
    handL: { x: cx - 26, y: 158 },
    footR: { x: cx + 12, y: 222 },
    footL: { x: cx - 12, y: 222 },
    mouthOpen: false,
  };
  const walk = /^walk(\d)$/.exec(pose);
  const run = /^run(\d)$/.exec(pose);
  if (walk || run) {
    const i = Number((walk ?? run)?.[1] ?? 0);
    const n = walk ? 8 : 3;
    const a = (i / n) * Math.PI * 2;
    const stride = run ? 34 : 24;
    base.lean = run ? 10 : 4;
    base.footR = { x: cx + Math.sin(a) * stride, y: 222 - Math.max(0, Math.cos(a)) * 10 };
    base.footL = { x: cx - Math.sin(a) * stride, y: 222 - Math.max(0, -Math.cos(a)) * 10 };
    base.handR = { x: cx - Math.sin(a) * 18 + 6, y: 156 };
    base.handL = { x: cx + Math.sin(a) * 18 - 6, y: 156 };
    base.head.y += Math.abs(Math.sin(a)) * 3;
  }
  switch (pose) {
    case "jump":
      base.handR = { x: cx + 34, y: 92 };
      base.handL = { x: cx - 34, y: 92 };
      base.footR = { x: cx + 18, y: 204 };
      base.footL = { x: cx - 14, y: 212 };
      break;
    case "fall":
      base.handR = { x: cx + 40, y: 110 };
      base.handL = { x: cx - 40, y: 110 };
      base.footL = { x: cx - 20, y: 214 };
      break;
    case "duck":
      base.head.y = 104;
      base.shoulder.y = 142;
      base.hip.y = 182;
      base.handR = { x: cx + 30, y: 190 };
      base.handL = { x: cx - 30, y: 190 };
      break;
    case "hang":
    case "climb0":
    case "climb1": {
      const up = pose === "climb1" ? 1 : 0;
      base.handR = { x: cx + 18, y: 40 + up * 18 };
      base.handL = { x: cx - 18, y: 58 - up * 18 };
      base.footR = { x: cx + 10, y: 222 - up * 16 };
      base.footL = { x: cx - 10, y: 206 + up * 16 };
      base.facing = pose === "hang" ? "front" : "back";
      break;
    }
    case "interact":
    case "switch0":
    case "switch1":
      base.handR = { x: cx + 52, y: pose === "switch1" ? 150 : 124 };
      base.lean = 6;
      break;
    case "talk":
      base.mouthOpen = true;
      base.handR = { x: cx + 38, y: 132 };
      break;
    case "think":
      base.handR = { x: cx + 14, y: 84 };
      break;
    case "show":
      base.handR = { x: cx + 56, y: 96 };
      base.handL = { x: cx - 30, y: 150 };
      break;
    case "hold":
      base.handR = { x: cx + 22, y: 130 };
      base.handL = { x: cx - 22, y: 130 };
      break;
    case "cheer0":
    case "cheer1":
      base.handR = { x: cx + 36, y: pose === "cheer1" ? 20 : 34 };
      base.handL = { x: cx - 36, y: pose === "cheer1" ? 34 : 20 };
      base.mouthOpen = true;
      break;
  }
  return base;
}

/** The 7 rig anchors of a stub pose (§5.5 table: face = head + (0, −20)·R, back = torso + (0, −18)·R, feet = contact). */
export function stubAnchors(pose: string): FrameAnchors {
  const s = stubSkeleton(pose);
  const pt = (name: RigAnchor, x: number, y: number, rot = 0): RigPoint => ({ name, x, y, rot });
  return {
    pose,
    facing: s.facing,
    points: [
      pt("head", s.head.x, s.head.y + s.head.r, s.lean),
      pt("face", s.head.x, s.head.y + s.head.r - 20, s.lean),
      pt("torso", s.hip.x, s.hip.y, s.lean),
      pt("back", s.shoulder.x - 4, s.shoulder.y + 8, s.lean),
      pt("hand_r", s.handR.x, s.handR.y),
      pt("hand_l", s.handL.x, s.handL.y, 180),
      pt("feet", s.hip.x, H - 2),
    ],
  };
}
