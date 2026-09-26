import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { GameSpec } from "@/contracts/gamespec";
import { validateGameSpec, type ValidationResult } from "@/pipeline/validate/validate-gamespec";
import { expeditionSfxOn } from "@/server/env";
import { getGameSpecById } from "@/server/storage";
import { loadWorldFor } from "@/server/worlds";
import { PlayClient } from "./PlayClient";

/** `fixture-<name>` resolves to `fixtures/<name>.json` when it exists (e.g. mystery/puzzle fixtures
 * authored directly in that genre), else falls back to `fixtures/<name>-dungeon.json` (every sample
 * still ships a dungeon build). So both /play/fixture-civil-rights-mystery and
 * /play/fixture-civil-rights-dungeon work. */
async function resolveFixtureFile(name: string): Promise<string> {
  if (!/^[a-z0-9-]{1,64}$/.test(name)) throw new Error("fixture names may only contain lowercase letters, digits and dashes");
  const direct = path.join(process.cwd(), "fixtures", `${name}.json`);
  try {
    await stat(direct);
    return direct;
  } catch {
    return path.join(process.cwd(), "fixtures", `${name}-dungeon.json`);
  }
}

async function loadAndValidate(id: string): Promise<ValidationResult> {
  if (id.startsWith("fixture-")) {
    try {
      const file = await resolveFixtureFile(id.slice("fixture-".length));
      const raw = await readFile(file, "utf8");
      return validateGameSpec(JSON.parse(raw));
    } catch (err) {
      return { ok: false, issues: [{ path: ["id"], message: `could not read fixture "${id}": ${String(err)}`, owner: "code" }], warnings: [] };
    }
  }
  let spec: GameSpec | null;
  try {
    spec = await getGameSpecById(id);
  } catch (err) {
    return { ok: false, issues: [{ path: ["id"], message: `storage error: ${String(err)}`, owner: "code" }], warnings: [] };
  }
  if (!spec) return { ok: false, issues: [{ path: ["id"], message: `no game with id "${id}"`, owner: "code" }], warnings: [] };
  return validateGameSpec(spec);
}

/**
 * /play/[id]: validates the GameSpec, resolves its Expedition world (side-car by id → by source → spec.world; null: the
 * legacy host, docs/design/20 §1.2), then hands both to the client-only game (Phaser is WebGL-only). `?host=legacy`
 * skips the world entirely, so the legacy path renders exactly as before.
 */
export default async function PlayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const host = (await searchParams).host;
  const legacy = (Array.isArray(host) ? host[0] : host) === "legacy";
  const result = await loadAndValidate(id);

  if (!result.ok) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
        <h1 className="text-3xl font-bold" style={{ fontSize: 30 }}>
          This game can&apos;t be played
        </h1>
        <p className="text-lg" style={{ fontSize: 18 }}>
          {result.issues.length} problem{result.issues.length === 1 ? "" : "s"} found in game &ldquo;{id}&rdquo;.
        </p>
        <ul className="flex flex-col gap-2 rounded-lg border p-4">
          {result.issues.slice(0, 20).map((issue, i) => (
            <li key={i} className="text-base" style={{ fontSize: 16 }}>
              <code className="opacity-70">{issue.path.join(".")}</code>: {issue.message}
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const loaded = legacy ? null : await loadWorldFor(result.spec);
  if (!loaded) return <PlayClient spec={result.spec} />;
  return <PlayClient spec={result.spec} world={loaded.world} worldSource={loaded.source} sfx={expeditionSfxOn()} />;
}
