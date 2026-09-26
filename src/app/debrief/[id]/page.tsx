import { readFile } from "node:fs/promises";
import path from "node:path";
import { AppShell } from "@/components/app-shell";
import { DebriefView } from "@/components/flow/debrief-view";
import type { GameSpec } from "@/contracts/gamespec";
import type { TelemetryEvent } from "@/contracts/telemetry";
import { getCard } from "@/library";
import { validateGameSpec } from "@/pipeline/validate/validate-gamespec";
import { getGameSpecById, getStorage } from "@/server/storage";

async function loadSpec(id: string): Promise<GameSpec | null> {
  if (id.startsWith("fixture-")) {
    const name = id.slice("fixture-".length);
    for (const file of [`${name}.json`, `${name}-dungeon.json`]) {
      try {
        const raw = await readFile(path.join(process.cwd(), "fixtures", file), "utf8");
        const r = validateGameSpec(JSON.parse(raw));
        return r.ok ? r.spec : null;
      } catch {
        // try the next name
      }
    }
    return null;
  }
  return getGameSpecById(id);
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
  const spec = await loadSpec(id);
  if (!spec) {
    return (
      <AppShell>
        <h1 className="text-3xl font-bold">Game not found</h1>
        <p className="mt-2 text-lg text-muted-foreground">No game with id {id}.</p>
      </AppShell>
    );
  }
  const telemetry = await loadTelemetry(id);
  const insights = Object.fromEntries(
    spec.encounters.map((e) => {
      const card = getCard(e.teachingMechanicId);
      return [e.id, { cardName: card?.name ?? e.teachingMechanicId, learningInsight: card?.learningInsight ?? "" }];
    }),
  );
  return (
    <AppShell>
      <DebriefView spec={spec} serverTelemetry={telemetry} insights={insights} />
    </AppShell>
  );
}
