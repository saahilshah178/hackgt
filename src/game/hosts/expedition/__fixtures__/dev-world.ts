/**
 * __fixtures__/dev-world.ts (H1) — the dev world as a playable (spec, resolved world) pair: a synthetic GameSpec whose
 * encounters are real fixture encounters (trig, cell, civil, wave 2 — one per control kind), dressed by the overlay in
 * ./dev-world-data.ts and resolved with V1's resolveWorld. Used by /dev/expedition, the H2 client tests and E1's
 * keyboard spec. Imports fixture JSON, so keep it out of node-only library code.
 */
import type { GameSpec } from "../../../../contracts/gamespec";
import { WorldOverlay } from "../../../../contracts/world";
import { resolveWorld } from "../../../../world/resolve-world";
import type { ResolvedWorld } from "../../../../world/types";
import cellJson from "../../../../../fixtures/cell-transport-dungeon.json";
import civilJson from "../../../../../fixtures/civil-rights-dungeon.json";
import trigJson from "../../../../../fixtures/trig-dungeon.json";
import wave2Json from "../../../../../fixtures/wave2-dungeon.json";
import { DEV_ENCOUNTERS, DEV_SPEC_ID, DEV_WORLD_INPUT } from "./dev-world-data";

export { DEV_ENCOUNTERS, DEV_SPEC_ID, DEV_WORLD_INPUT } from "./dev-world-data";

const SOURCES: Readonly<Record<(typeof DEV_ENCOUNTERS)[number]["from"], GameSpec>> = {
  trig: trigJson as unknown as GameSpec,
  cell: cellJson as unknown as GameSpec,
  civil: civilJson as unknown as GameSpec,
  wave2: wave2Json as unknown as GameSpec,
};

function uniqueBy<T>(items: readonly T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((t) => (seen.has(key(t)) ? false : (seen.add(key(t)), true)));
}

/** The dev spec: trig's frame (seed, source, narrative) with one fixture encounter per dev station. */
export function devSpec(): GameSpec {
  const base = SOURCES.trig;
  const encounters = DEV_ENCOUNTERS.map(({ id, from }) => {
    const e = SOURCES[from].encounters.find((x) => x.id === id);
    if (!e) throw new Error(`dev world: fixture ${from} has no encounter ${id}`);
    return e;
  });
  const all = Object.values(SOURCES);
  return {
    ...base,
    id: DEV_SPEC_ID,
    title: "The Dev Expedition",
    encounters,
    concepts: uniqueBy(all.flatMap((s) => s.concepts), (c) => c.id),
    characters: uniqueBy(all.flatMap((s) => s.characters), (c) => c.id),
    layout: { ...base.layout, chunks: [] },
  };
}

export function devWorld(): { spec: GameSpec; world: ResolvedWorld } {
  const spec = devSpec();
  const overlay = WorldOverlay.parse(DEV_WORLD_INPUT);
  return { spec, world: resolveWorld(spec, overlay, "spec") };
}
