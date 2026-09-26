import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { GameSpec } from "@/contracts/gamespec";
import { validateGameSpec, type ValidationResult } from "@/pipeline/validate/validate-gamespec";
import { getGameSpecById } from "@/server/storage";
import { PlayClient } from "./PlayClient";

/** `fixture-<name>` resolves to `fixtures/<name>.json` when it exists (e.g. mystery/puzzle fixtures
 * authored directly in that genre), else falls back to `fixtures/<name>-dungeon.json` (every sample
 * still ships a dungeon build). So both /play/fixture-civil-rights-mystery and
 * /play/fixture-civil-rights-dungeon work. */
async function resolveFixtureFile(name: string): Promise<string> {
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

/** /play/[id]: validates the GameSpec, then hands it to the client-only game (Phaser is WebGL-only). */
export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  return <PlayClient spec={result.spec} />;
}
