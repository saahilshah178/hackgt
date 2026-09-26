import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { AppShell } from "@/components/app-shell";
import { DebriefView } from "@/components/flow/debrief-view";
import type { GameSpec } from "@/contracts/gamespec";
import type { TelemetryEvent } from "@/contracts/telemetry";
import { getCard } from "@/library";
import { validateGameSpec } from "@/pipeline/validate/validate-gamespec";
import { getGameSpecById, getStorage } from "@/server/storage";

const FIXTURES_DIR = path.join(process.cwd(), "fixtures");

async function readFixtureSpec(file: string): Promise<GameSpec | null> {
  try {
    const raw = await readFile(path.join(FIXTURES_DIR, file), "utf8");
    const r = validateGameSpec(JSON.parse(raw));
    return r.ok ? r.spec : null;
  } catch {
    return null;
  }
}

/**
 * The `/play/fixture-<name>` route resolves a fixture file, but the GameSpec's own `id` (e.g.
 * `trig_demo_001`) is what the runner's end screen links to for the debrief (`/debrief/<spec.id>`),
 * since it doesn't know which route loaded it. So a plain id that isn't in storage may still be a
 * fixture: scan `fixtures/*.json` for a spec whose `id` matches before giving up.
 */
async function findFixtureSpecById(id: string): Promise<GameSpec | null> {
  let files: string[];
  try {
    files = await readdir(FIXTURES_DIR);
  } catch {
    return null;
  }
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const spec = await readFixtureSpec(file);
    if (spec?.id === id) return spec;
  }
  return null;
}

async function loadSpec(id: string): Promise<{ spec: GameSpec; isFixture: boolean } | null> {
  if (id.startsWith("fixture-")) {
    const name = id.slice("fixture-".length);
    if (!/^[a-z0-9-]{1,64}$/.test(name)) return null;
    for (const file of [`${name}.json`, `${name}-dungeon.json`]) {
      const spec = await readFixtureSpec(file);
      if (spec) return { spec, isFixture: true };
    }
    const fixture = await findFixtureSpecById(id);
    return fixture ? { spec: fixture, isFixture: true } : null;
  }
  const stored = await getGameSpecById(id);
  if (stored) return { spec: stored, isFixture: false };
  const fixture = await findFixtureSpecById(id);
  return fixture ? { spec: fixture, isFixture: true } : null;
}

async function loadTelemetry(id: string): Promise<TelemetryEvent[]> {
  try {
    return await getStorage().getTelemetry(id);
  } catch {
    return [];
  }
}

/** /debrief/[gameId]: post-check → pre→post score, per-concept mastery, "what you just did" cards, next actions. */
export default async function DebriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadSpec(id);
  if (!loaded) {
    return (
      <AppShell>
        <h1 className="text-3xl font-bold">Game not found</h1>
        <p className="mt-2 text-lg text-muted-foreground">No game with id {id}.</p>
      </AppShell>
    );
  }
  const { spec, isFixture } = loaded;
  const telemetry = await loadTelemetry(id);
  const insights = Object.fromEntries(
    spec.encounters.map((e) => {
      const card = getCard(e.teachingMechanicId);
      return [e.id, { cardName: card?.name ?? e.teachingMechanicId, learningInsight: card?.learningInsight ?? "" }];
    }),
  );
  return (
    <AppShell>
      {/* Fixtures (including the showcase games) have no server-side GameRecord, so the postcheck POST
          would 404; DebriefView already scores pre/post client-side, so it just skips that call. */}
      <DebriefView spec={spec} serverTelemetry={telemetry} insights={insights} skipServerPostcheck={isFixture} />
    </AppShell>
  );
}
