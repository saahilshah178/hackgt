import type { Encounter, GameSpec } from "../../contracts/gamespec";
import type { Moment, World3D, World3DSocket } from "../../contracts/world3d";
import { INTERACT_MARGIN, NPC_REACH, WILDLIFE } from "../../world3d/core/catalog";
import type { ComposedWorld } from "../../world3d/core/compose";
import type { Pose, Target } from "./store";

/*
 * The game-side model of a world3d spec: each encounter's moment resolved to a place in the composed world, the words
 * the HUD uses for it, and the rules for what the player can press E on. Pure, so it is unit-tested without WebGL.
 */

export interface MomentInfo {
  encounterId: string;
  encounter: Encounter;
  moment: Moment;
  socket: World3DSocket;
  anchor: { kind: "npc"; id: string } | { kind: "landmark"; id: string };
  /** where the anchor stands (npcs may wander; this is their home) */
  x: number;
  y: number;
  z: number;
  /** how close the player must be (metres from the centre) */
  reach: number;
  /** footprint radius of a landmark anchor (0 for npcs) */
  radius: number;
  actIndex: number;
  /** "Talk to Nebet", "Read the South Obelisk" */
  label: string;
  /** a short name for markers and the quest log ("Nebet", "South Obelisk") */
  place: string;
}

const VERBS: Record<World3DSocket, string> = {
  conversation: "Talk to",
  inscription: "Read",
  artifact: "Examine",
  device: "Operate",
  vista: "Survey from",
  seal: "Open",
  finale: "Approach",
};

/** "The Great Pyramid" stays as is; "South Obelisk" becomes "the South Obelisk". */
export function withArticle(name: string): string {
  return /^(the|a|an)\s/i.test(name) ? name.replace(/^The\s/, "the ") : `the ${name}`;
}

export function stripArticle(name: string): string {
  return name.replace(/^(the|a|an)\s+/i, "");
}

export function momentLabel(socket: World3DSocket, anchor: { kind: "npc" | "landmark"; name: string }): string {
  if (anchor.kind === "npc") return `Talk to ${anchor.name}`;
  return `${VERBS[socket]} ${withArticle(anchor.name)}`;
}

export function buildMoments(spec: GameSpec, composed: ComposedWorld): Map<string, MomentInfo> {
  const world = composed.world;
  const out = new Map<string, MomentInfo>();
  const actOf = new Map<string, number>();
  world.quest.acts.forEach((a, i) => a.encounterIds.forEach((id) => actOf.set(id, i)));
  for (const moment of world.moments) {
    const encounter = spec.encounters.find((e) => e.id === moment.encounterId);
    if (!encounter) continue;
    const socket = (encounter.socket as World3DSocket) ?? "conversation";
    if (moment.anchor.npcId) {
      const npc = world.npcs.find((n) => n.id === moment.anchor.npcId);
      const at = composed.npcs.find((n) => n.id === moment.anchor.npcId);
      if (!npc || !at) continue;
      out.set(encounter.id, {
        encounterId: encounter.id,
        encounter,
        moment,
        socket,
        anchor: { kind: "npc", id: npc.id },
        x: at.x,
        y: at.y,
        z: at.z,
        reach: NPC_REACH,
        radius: 0,
        actIndex: actOf.get(encounter.id) ?? 0,
        label: momentLabel(socket, { kind: "npc", name: npc.name }),
        place: npc.name,
      });
    } else if (moment.anchor.landmarkId) {
      const l = composed.landmarks.find((p) => p.id === moment.anchor.landmarkId);
      if (!l) continue;
      const name = l.name ?? l.id;
      out.set(encounter.id, {
        encounterId: encounter.id,
        encounter,
        moment,
        socket,
        anchor: { kind: "landmark", id: l.id },
        x: l.x,
        y: l.y,
        z: l.z,
        reach: l.radius + INTERACT_MARGIN,
        radius: l.radius,
        actIndex: actOf.get(encounter.id) ?? 0,
        label: momentLabel(socket, { kind: "landmark", name }),
        place: stripArticle(name),
      });
    }
  }
  return out;
}

/** The act the story is in: the first act with an unsolved encounter (the last act once everything is solved). */
export function currentAct(world: World3D, solved: ReadonlySet<string>): number {
  const i = world.quest.acts.findIndex((a) => a.encounterIds.some((id) => !solved.has(id)));
  return i === -1 ? world.quest.acts.length - 1 : i;
}

/** Leads: the moments the player can do right now, current act first, then by distance from the player. */
export function leads(moments: ReadonlyMap<string, MomentInfo>, available: readonly string[], player: Pick<Pose, "x" | "z">, act: number): MomentInfo[] {
  return available
    .map((id) => moments.get(id))
    .filter((m): m is MomentInfo => !!m)
    .sort((a, b) => {
      const actA = a.actIndex === act ? 0 : 1;
      const actB = b.actIndex === act ? 0 : 1;
      if (actA !== actB) return actA - actB;
      return Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z);
    });
}

export interface TargetContext {
  world: World3D;
  composed: ComposedWorld;
  moments: ReadonlyMap<string, MomentInfo>;
  npcPoses: Record<string, Pose>;
  collected: ReadonlySet<string>;
  animals: readonly { id: string; kind: string; x: number; y: number; z: number }[];
}

/** Every E-able thing in the world right now, before distance filtering. */
export function targetCandidates(ctx: TargetContext): (Target & { reach: number; radius: number })[] {
  const out: (Target & { reach: number; radius: number })[] = [];
  for (const n of ctx.world.npcs) {
    const p = ctx.npcPoses[n.id] ?? ctx.composed.npcs.find((a) => a.id === n.id);
    if (p) out.push({ kind: "npc", id: n.id, label: `Talk to ${n.name}`, x: p.x, y: p.y, z: p.z, reach: NPC_REACH, radius: 0 });
  }
  for (const m of ctx.moments.values()) {
    if (m.anchor.kind !== "landmark") continue;
    out.push({ kind: "moment", id: m.encounterId, label: m.label, x: m.x, y: m.y, z: m.z, reach: m.reach, radius: m.radius });
  }
  const goal = ctx.composed.goal;
  if (goal && ![...ctx.moments.values()].some((m) => m.anchor.kind === "landmark" && m.anchor.id === goal.id)) {
    out.push({ kind: "goal", id: goal.id, label: `Approach ${withArticle(goal.name ?? goal.id)}`, x: goal.x, y: goal.y, z: goal.z, reach: goal.radius + INTERACT_MARGIN, radius: goal.radius });
  }
  for (const c of ctx.composed.collectibles) {
    if (ctx.collected.has(c.id)) continue;
    const item = ctx.world.collectibles.items.find((i) => i.id === c.id);
    out.push({ kind: "collectible", id: c.id, label: `Pick up ${item ? withArticle(item.title) : "the relic"}`, x: c.x, y: c.y, z: c.z, reach: 2.4, radius: 0 });
  }
  for (const a of ctx.animals) {
    const info = WILDLIFE[a.kind as keyof typeof WILDLIFE];
    if (!info?.interactive) continue;
    out.push({ kind: "animal", id: a.id, label: `${a.kind === "cat" || a.kind === "dog" ? "Pet" : "Greet"} the ${a.kind}`, x: a.x, y: a.y, z: a.z, reach: 2.2 + info.size, radius: 0 });
  }
  return out;
}

/**
 * The target E would act on: within reach, closest by the gap to its footprint, with a nudge toward what the player
 * faces so turning to look at something selects it.
 */
export function nearestTarget(player: Pose, candidates: readonly (Target & { reach: number; radius: number })[]): Target | null {
  let best: Target | null = null;
  let bestScore = Infinity;
  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);
  for (const c of candidates) {
    const dx = c.x - player.x;
    const dz = c.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > c.reach) continue;
    const gap = Math.max(0, d - c.radius);
    const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    // people and relics beat buildings at equal distance: you walked up to them on purpose
    const kindBias = c.kind === "npc" || c.kind === "collectible" ? -0.6 : c.kind === "animal" ? 0.3 : 0;
    const score = gap + (1 - facing) * 1.2 + kindBias;
    if (score < bestScore) {
      bestScore = score;
      const { reach: _r, radius: _rad, ...t } = c;
      void _r;
      void _rad;
      best = t;
    }
  }
  return best;
}

/** The moment an npc hosts (the first one in act order that is not solved yet, else its last solved one), if any. */
export function momentForNpc(moments: ReadonlyMap<string, MomentInfo>, npcId: string, solved: ReadonlySet<string>): MomentInfo | null {
  const mine = [...moments.values()].filter((m) => m.anchor.kind === "npc" && m.anchor.id === npcId).sort((a, b) => a.actIndex - b.actIndex);
  return mine.find((m) => !solved.has(m.encounterId)) ?? mine[mine.length - 1] ?? null;
}

/** Bearing (radians, 0 = north/-z, clockwise) from one point to another, for the compass. */
export function bearing(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.atan2(to.x - from.x, -(to.z - from.z));
}
