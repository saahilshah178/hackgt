import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import type { GameSpec } from "@/contracts/gamespec";
import type { World3D } from "@/contracts/world3d";
import { layoutFromEncounters } from "@/pipeline/layout";
import { validateGameSpec } from "@/pipeline/validate/validate-gamespec";
import { BOSS_SOCKET } from "@/library/genres";
import { socketsFor } from "@/mechanics/registry";
import { SAMPLE_WORLDS } from "@/world3d/core/samples";
import { composeFallbackWorld } from "@/pipeline/world3d/fallback";
import { PlayClient } from "../../play/[id]/PlayClient";

export const metadata = { title: "World3D host (dev)" };

/**
 * /dev/world3d?base=civil-rights-story&world=nile — the world3d host on any shipped fixture: the fixture's encounters
 * re-socketed for world3d and anchored round-robin to a sample world's npcs and landmarks (the finale at its goal).
 * `mode=composer` instead plays it in the world the pipeline's fallback composer builds for it (what mock mode ships),
 * for visual QA of composed worlds. A development harness, not a shipped route.
 */
export default async function DevWorld3DPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const base = one(sp.base) ?? "civil-rights-story";
  if (!/^[a-z0-9-]{1,64}$/.test(base)) notFound();
  const raw = JSON.parse(await readFile(path.join(process.cwd(), "fixtures", `${base}.json`), "utf8")) as GameSpec;
  const sample = SAMPLE_WORLDS[one(sp.world) ?? "nile"] ?? SAMPLE_WORLDS.nile;
  const encounters = raw.encounters.map((e) => ({
    ...e,
    socket: e.role === "boss" ? BOSS_SOCKET.world3d : (socketsFor(e.familyId, "world3d", BOSS_SOCKET.world3d).find((s) => s !== BOSS_SOCKET.world3d) ?? "conversation"),
  }));
  const goal = sample.landmarks.find((l) => l.role === "goal")!;
  const places = sample.landmarks.filter((l) => l.role !== "goal" && l.role !== "decor");
  const npcs = sample.npcs.map((n, i) => ({ ...n, characterId: raw.characters[i]?.id ?? null, topics: raw.concepts.slice(i, i + 2).map((c) => c.id) }));
  let p = 0;
  let q = 0;
  const moments: World3D["moments"] = encounters.map((e) => {
    const anchor =
      e.role === "boss"
        ? { npcId: null, landmarkId: goal.id }
        : e.socket === "conversation"
          ? { npcId: npcs[q++ % npcs.length].id, landmarkId: null }
          : { npcId: null, landmarkId: places[p++ % places.length].id };
    return {
      encounterId: e.id,
      anchor,
      objective: e.prompt.length > 80 ? `${e.prompt.slice(0, 77)}…` : e.prompt,
      approach: [{ speaker: "narrator", text: e.prompt.slice(0, 200) }],
      success: [{ speaker: "narrator", text: e.debriefLine.slice(0, 200) }],
      reward: { kind: "insight", name: "Understanding", description: e.debriefLine.slice(0, 150) },
      opens: null,
    };
  });
  if (one(sp.mode) === "composer") {
    const base3d = { ...raw, genre: "world3d" as const, encounters, layout: layoutFromEncounters("world3d", encounters) };
    const composed = validateGameSpec({ ...base3d, world3d: composeFallbackWorld(base3d) });
    if (!composed.ok) return <pre style={{ padding: 24, whiteSpace: "pre-wrap" }}>{composed.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}</pre>;
    return <PlayClient spec={composed.spec} />;
  }
  const bossId = encounters.find((e) => e.role === "boss")?.id;
  const rest = encounters.filter((e) => e.id !== bossId).map((e) => e.id);
  const half = Math.ceil(rest.length / 2);
  const world: World3D = {
    ...sample,
    npcs,
    moments,
    quest: {
      goal: sample.quest.goal,
      acts: [
        { id: "act_1", title: "Arrival", summary: "Find your footing.", encounterIds: rest.slice(0, half) },
        { id: "act_2", title: "The road to the goal", summary: "Put it all together.", encounterIds: [...rest.slice(half), ...(bossId ? [bossId] : [])] },
      ],
    },
  };
  const result = validateGameSpec({ ...raw, genre: "world3d", encounters, layout: layoutFromEncounters("world3d", encounters), world3d: world });
  if (!result.ok) {
    return (
      <pre style={{ padding: 24, whiteSpace: "pre-wrap" }}>
        {result.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}
      </pre>
    );
  }
  return <PlayClient spec={result.spec} />;
}
