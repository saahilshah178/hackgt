/**
 * actors/pose-animator.ts (pure, H1) — pose-swap animation over the rig's packed poses (docs/design/20 §2.2, §5.5):
 * idle, walk0-7 at 12 fps, run0-2 at 14 fps, jump, fall, duck, hang, climb0/1 at 8 fps, interact, switch0/1, talk,
 * think, show, hold, cheer0/1, back. NPC atlases pack 12 of them; missing frames fall back to the nearest available.
 */
import type { NpcPose } from "../../../../contracts/world";

export const PROTAGONIST_POSES = [
  "idle", "walk0", "walk1", "walk2", "walk3", "walk4", "walk5", "walk6", "walk7", "run0", "run1", "run2", "jump", "fall",
  "duck", "hang", "climb0", "climb1", "interact", "switch0", "switch1", "talk", "think", "show", "hold", "cheer0", "cheer1", "back",
] as const;
export const NPC_POSES = ["idle", "walk0", "walk2", "walk4", "walk6", "talk", "think", "show", "interact", "cheer0", "duck", "hold"] as const;

export type Motion =
  | "idle" | "walk" | "run" | "jump" | "fall" | "climb" | "interact" | "switch" | "talk" | "think" | "show" | "hold"
  | "cheer" | "back" | "duck" | "hang" | "ride";

const CYCLES: Partial<Record<Motion, { frames: readonly string[]; fps: number }>> = {
  walk: { frames: ["walk0", "walk1", "walk2", "walk3", "walk4", "walk5", "walk6", "walk7"], fps: 12 },
  run: { frames: ["run0", "run1", "run2"], fps: 14 },
  climb: { frames: ["climb0", "climb1"], fps: 8 },
  switch: { frames: ["switch0", "switch1"], fps: 6 },
  cheer: { frames: ["cheer0", "cheer1"], fps: 4 },
};
const SINGLE: Partial<Record<Motion, string>> = {
  idle: "idle", jump: "jump", fall: "fall", interact: "interact", talk: "talk", think: "think", show: "show", hold: "hold",
  back: "back", duck: "duck", hang: "hang", ride: "idle",
};
const FALLBACK: Readonly<Record<string, readonly string[]>> = {
  walk1: ["walk0"], walk3: ["walk2"], walk5: ["walk4"], walk7: ["walk6"],
  run0: ["walk2", "walk0"], run1: ["walk4", "walk0"], run2: ["walk6", "walk0"],
  jump: ["show", "idle"], fall: ["hold", "idle"], hang: ["hold", "idle"], climb0: ["hold", "idle"], climb1: ["hold", "idle"],
  switch0: ["interact", "idle"], switch1: ["interact", "idle"], cheer1: ["cheer0", "show", "idle"], cheer0: ["show", "idle"],
  back: ["idle"], duck: ["idle"], think: ["idle"], talk: ["idle"], show: ["idle"], hold: ["idle"], interact: ["idle"],
};

/** The best available frame name for a wanted pose. */
export function resolveFrame(wanted: string, available: ReadonlySet<string>): string {
  if (available.has(wanted)) return wanted;
  for (const f of FALLBACK[wanted] ?? []) if (available.has(f)) return f;
  return available.has("idle") ? "idle" : ([...available][0] ?? wanted);
}

/** Frame for a motion at time tSec (cycles loop at their fps). */
export function frameFor(motion: Motion, tSec: number, available: ReadonlySet<string>): string {
  const cyc = CYCLES[motion];
  if (cyc) {
    const i = Math.floor(Math.max(0, tSec) * cyc.fps) % cyc.frames.length;
    return resolveFrame(cyc.frames[i], available);
  }
  return resolveFrame(SINGLE[motion] ?? "idle", available);
}

/** NpcState.pose → rig motion (work → interact, wave/cheer → cheer0, sit → duck; §2.2 actors/npc.ts). */
export function npcMotion(pose: NpcPose): Motion {
  switch (pose) {
    case "work":
      return "interact";
    case "wave":
    case "cheer":
      return "cheer";
    case "sit":
      return "duck";
    case "talk":
      return "talk";
    case "think":
      return "think";
    case "ride":
      return "ride";
    case "idle":
    case "hidden":
      return "idle";
  }
}

/** Walk vs run by speed (units/s). */
export function locomotion(speed: number): Motion {
  const s = Math.abs(speed);
  if (s < 12) return "idle";
  return s > 380 ? "run" : "walk";
}
