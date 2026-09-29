import { egyptWorld3D } from "../../../fixtures/ancient-egypt.world3d";
import type { World3D } from "../../contracts/world3d";

/*
 * A worked example for the World Architect's prompt: an excerpt of the hand-authored Giza world (the demo, docs/design/60
 * §3), trimmed to the parts that show the craft we want — a goal visible across open ground from the spawn, a hub near
 * the spawn, a landmark moment voiced by the character who stands by it, a conversation moment, a seal that opens the
 * way, personas grounded in the student's facts, specific objectives, and collectibles that are true facts. It is
 * labelled as a different game so the model imitates its quality, not its content.
 */

function pick<T extends { id: string }>(items: readonly T[], ids: readonly string[]): T[] {
  return ids.map((id) => items.find((x) => x.id === id)).filter((x): x is T => !!x);
}

export function architectExemplar(world: World3D = egyptWorld3D): string {
  const moments = ["e1_flood", "e4_builders", "e9_review"].map((id) => world.moments.find((m) => m.encounterId === id)).filter(Boolean);
  const excerpt = {
    biome: world.biome,
    setting: world.setting,
    terrain: { relief: world.terrain.relief, features: world.terrain.features.slice(0, 2), water: world.terrain.water },
    atmosphere: world.atmosphere,
    landmarks: pick(world.landmarks, ["great_pyramid", "valley_temple", "nilometer", "causeway_gate", "embalmers"]),
    npcs: pick(world.npcs, ["ipi", "khenu"]),
    quest: world.quest,
    moments,
    collectibles: { label: world.collectibles.label, items: world.collectibles.items.slice(0, 2) },
    spawn: world.spawn,
    opening: world.opening,
    ui: world.ui,
  };
  return [
    "# An excellent world for a DIFFERENT game (an excerpt; its size was 560 m)",
    "Match its craft, not its content: the goal is a huge landmark across open ground from the spawn; the hub stands near the spawn; each objective names a person or place and an action; approach lines set the scene and give a reason to act without revealing answers; a character who stands by a landmark voices its moment; the seal's moment `opens` the gate; personas are specific and grounded in the source's facts; collectibles are true facts from the source.",
    JSON.stringify(excerpt),
  ].join("\n");
}
