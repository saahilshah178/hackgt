import type { Issue } from "../../contracts/common";
import type { GameSpec } from "../../contracts/gamespec";
import type { World3D } from "../../contracts/world3d";

/*
 * Referential and structural rules for spec.world3d that zod alone can't express (docs/design/60-world3d.md §4).
 * Pure: no three.js, no DOM, so validateGameSpec (server), the pipeline's repair loop and the client all share it.
 * Spatial rules (reachability, water, slopes, spacing) need the heightfield and live in ./spatial-checks.ts.
 *
 * Every issue is owned by the World Architect: a failure becomes a repair note for it, never a crash.
 */

/** How far from the goal landmark's centre (× its scale when above 1) an npc may stand and still host the finale. */
export const GOAL_NPC_RADIUS = 90;

export interface World3DValidation {
  issues: Issue[];
  warnings: Issue[];
}

export function validateWorld3D(spec: Pick<GameSpec, "genre" | "encounters" | "concepts" | "characters">, world: World3D): World3DValidation {
  const issues: Issue[] = [];
  const warnings: Issue[] = [];
  const add = (path: (string | number)[], message: string, encounterId?: string) =>
    issues.push({ path: ["world3d", ...path], message, owner: "world_architect", ...(encounterId ? { encounterId } : {}) });
  const warn = (path: (string | number)[], message: string) => warnings.push({ path: ["world3d", ...path], message, owner: "world_architect" });

  if (spec.genre !== "world3d") add([], `only world3d games carry a 3D world (this game is "${spec.genre}")`);

  const half = world.terrain.size / 2;
  const inside = (p: { x: number; z: number }) => Math.abs(p.x) <= half && Math.abs(p.z) <= half;

  // ---- unique ids across landmarks, clusters, npcs and collectibles (they share the minimap and the compass)
  const seen = new Map<string, string>();
  const claim = (id: string, what: string, path: (string | number)[]) => {
    const prior = seen.get(id);
    if (prior) add(path, `id "${id}" is used by both a ${prior} and a ${what}; ids must be unique`);
    else seen.set(id, what);
  };
  world.landmarks.forEach((l, i) => claim(l.id, "landmark", ["landmarks", i, "id"]));
  world.clusters.forEach((c, i) => claim(c.id, "cluster", ["clusters", i, "id"]));
  world.npcs.forEach((n, i) => claim(n.id, "npc", ["npcs", i, "id"]));
  world.collectibles.items.forEach((c, i) => claim(c.id, "collectible", ["collectibles", "items", i, "id"]));
  if (seen.has("narrator") || seen.has("you") || seen.has("spawn")) add([], `"narrator", "you" and "spawn" are reserved and cannot be ids`);

  const landmarkIds = new Set(world.landmarks.map((l) => l.id));
  const npcIds = new Set(world.npcs.map((n) => n.id));
  const conceptIds = new Set(spec.concepts.map((c) => c.id));
  const characterIds = new Set(spec.characters.map((c) => c.id));

  // ---- bounds
  world.landmarks.forEach((l, i) => inside(l.at) || add(["landmarks", i, "at"], `landmark "${l.id}" is outside the ${world.terrain.size} m map`));
  world.clusters.forEach((c, i) => inside(c.at) || add(["clusters", i, "at"], `cluster "${c.id}" is outside the map`));
  world.npcs.forEach((n, i) => inside(n.at) || add(["npcs", i, "at"], `npc "${n.id}" is outside the map`));
  world.collectibles.items.forEach((c, i) => inside(c.at) || add(["collectibles", "items", i, "at"], `collectible "${c.id}" is outside the map`));
  world.terrain.features.forEach((f, i) => inside(f.at) || add(["terrain", "features", i, "at"], `terrain feature ${i} is outside the map`));
  if (!inside(world.spawn.at)) add(["spawn", "at"], "the spawn point is outside the map");

  // ---- water
  const w = world.terrain.water;
  if (w.kind === "river" && w.course.length < 2) add(["terrain", "water", "course"], "a river needs a course of at least 2 points");
  if (w.kind !== "river" && w.course.length > 0) warn(["terrain", "water", "course"], `course is ignored for water kind "${w.kind}"`);
  if (w.kind === "ocean" && w.coast === null) add(["terrain", "water", "coast"], "an ocean needs a coast side");

  // ---- goal and roles
  const goals = world.landmarks.filter((l) => l.role === "goal");
  if (goals.length !== 1) add(["landmarks"], `exactly one landmark must have role "goal" (found ${goals.length})`);
  if (!landmarkIds.has(world.quest.goal.landmarkId)) add(["quest", "goal", "landmarkId"], `goal landmark "${world.quest.goal.landmarkId}" does not exist`);
  else if (goals[0] && goals[0].id !== world.quest.goal.landmarkId)
    add(["quest", "goal", "landmarkId"], `the quest goal "${world.quest.goal.landmarkId}" must be the landmark with role "goal" ("${goals[0].id}")`);

  // ---- scatter / wildlife / paths reference real landmarks
  world.scatter.forEach((s, i) => {
    if (s.zone === "around_landmark" && (!s.landmarkId || !landmarkIds.has(s.landmarkId)))
      add(["scatter", i, "landmarkId"], `scatter "${s.kind}" around_landmark needs an existing landmarkId`);
  });
  world.wildlife.forEach((s, i) => {
    if (s.zone === "around_landmark" && (!s.landmarkId || !landmarkIds.has(s.landmarkId)))
      add(["wildlife", i, "landmarkId"], `wildlife "${s.kind}" around_landmark needs an existing landmarkId`);
  });
  world.paths.forEach((p, i) => {
    if (p.from !== "spawn" && !landmarkIds.has(p.from)) add(["paths", i, "from"], `path starts at unknown landmark "${p.from}"`);
    if (!landmarkIds.has(p.to)) add(["paths", i, "to"], `path ends at unknown landmark "${p.to}"`);
  });

  // ---- npcs
  world.npcs.forEach((n, i) => {
    if (n.characterId !== null && !characterIds.has(n.characterId)) add(["npcs", i, "characterId"], `npc "${n.id}" embodies unknown character "${n.characterId}"`);
    n.topics.forEach((t, j) => conceptIds.has(t) || add(["npcs", i, "topics", j], `npc "${n.id}" topic "${t}" is not a concept in this game`));
  });
  const embodied = new Set(world.npcs.map((n) => n.characterId).filter((c): c is string => c !== null));
  spec.characters.forEach((c) => embodied.has(c.id) || warn(["npcs"], `character "${c.id}" (${c.name}) has no npc in the world`));

  // ---- moments: exactly one per encounter, anchored to exactly one existing npc or landmark
  const encounterIds = spec.encounters.map((e) => e.id);
  const byEncounter = new Map<string, number>();
  world.moments.forEach((m, i) => {
    if (byEncounter.has(m.encounterId)) add(["moments", i, "encounterId"], `encounter "${m.encounterId}" has more than one moment`, m.encounterId);
    byEncounter.set(m.encounterId, i);
    if (!encounterIds.includes(m.encounterId)) add(["moments", i, "encounterId"], `moment for unknown encounter "${m.encounterId}"`);
    const { npcId, landmarkId } = m.anchor;
    if ((npcId === null) === (landmarkId === null)) add(["moments", i, "anchor"], "set exactly one of anchor.npcId and anchor.landmarkId", m.encounterId);
    if (npcId !== null && !npcIds.has(npcId)) add(["moments", i, "anchor", "npcId"], `unknown npc "${npcId}"`, m.encounterId);
    if (landmarkId !== null && !landmarkIds.has(landmarkId)) add(["moments", i, "anchor", "landmarkId"], `unknown landmark "${landmarkId}"`, m.encounterId);
    if (m.opens !== null && !landmarkIds.has(m.opens)) add(["moments", i, "opens"], `opens unknown landmark "${m.opens}"`, m.encounterId);
    [...m.approach, ...m.success].forEach((line, j) => {
      if (line.speaker !== "narrator" && line.speaker !== "you" && !npcIds.has(line.speaker))
        add(["moments", i, j < m.approach.length ? "approach" : "success"], `line spoken by unknown npc "${line.speaker}"`, m.encounterId);
    });
  });
  for (const id of encounterIds) if (!byEncounter.has(id)) add(["moments"], `encounter "${id}" has no moment in the world`, id);

  // the finale (boss) happens at the goal, so the goal is where the story ends
  const boss = spec.encounters.find((e) => e.role === "boss");
  const bossMoment = boss ? world.moments.find((m) => m.encounterId === boss.id) : undefined;
  const goalLandmark = world.landmarks.find((l) => l.id === world.quest.goal.landmarkId);
  if (boss && bossMoment && goalLandmark) {
    const npc = bossMoment.anchor.npcId !== null ? world.npcs.find((n) => n.id === bossMoment.anchor.npcId) : undefined;
    // an npc hosts the finale only while standing at the goal (within the goal's footprint plus a short walk)
    const npcAtGoal = npc !== undefined && Math.hypot(npc.at.x - goalLandmark.at.x, npc.at.z - goalLandmark.at.z) <= GOAL_NPC_RADIUS * Math.max(1, goalLandmark.scale);
    if (bossMoment.anchor.landmarkId !== goalLandmark.id && !npcAtGoal)
      add(
        ["moments", byEncounter.get(boss.id)!, "anchor"],
        `the finale ("${boss.id}") must happen at the goal "${goalLandmark.id}": anchor it to that landmark, or to an npc standing within ${GOAL_NPC_RADIUS} m of it`,
        boss.id,
      );
  }

  // ---- acts cover every encounter exactly once
  const inActs = new Map<string, string>();
  world.quest.acts.forEach((a, i) =>
    a.encounterIds.forEach((id, j) => {
      if (!encounterIds.includes(id)) add(["quest", "acts", i, "encounterIds", j], `act "${a.id}" lists unknown encounter "${id}"`);
      else if (inActs.has(id)) add(["quest", "acts", i, "encounterIds", j], `encounter "${id}" is in two acts ("${inActs.get(id)}" and "${a.id}")`);
      else inActs.set(id, a.id);
    }),
  );
  for (const id of encounterIds) if (!inActs.has(id)) add(["quest", "acts"], `encounter "${id}" is in no act`, id);
  if (boss) {
    const lastAct = world.quest.acts[world.quest.acts.length - 1];
    if (lastAct && !lastAct.encounterIds.includes(boss.id)) add(["quest", "acts"], `the finale ("${boss.id}") belongs in the last act`);
  }

  // ---- collectibles and the opening
  world.collectibles.items.forEach((c, i) => {
    if (c.conceptId !== null && !conceptIds.has(c.conceptId)) add(["collectibles", "items", i, "conceptId"], `unknown concept "${c.conceptId}"`);
  });
  world.opening.flyover.forEach((id, i) => landmarkIds.has(id) || add(["opening", "flyover", i], `flyover visits unknown landmark "${id}"`));
  if (world.opening.flyover[world.opening.flyover.length - 1] !== world.quest.goal.landmarkId)
    warn(["opening", "flyover"], "the opening flyover should end on the goal so the player sees where they are headed");

  return { issues, warnings };
}
