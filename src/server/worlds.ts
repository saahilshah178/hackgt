/**
 * src/server/worlds.ts (V1) — `loadWorldFor(spec)`: reads fixtures/worlds/*.world.json, picks by the resolution order,
 * validates (docs/design/20 §1.2, amendment 40).
 *
 * `fixtures/worlds/` is the ONLY overlay location. A side-car that fails to parse or to validate against the spec is
 * skipped with a server-side console.warn (never a client console.error: e2e asserts zero console errors) and the
 * next source in the order is tried. Warnings of the chosen world are summarized server-side once per file content.
 * The play page passes `{ world, source }` (plain JSON) to the client, which rebuilds metas with resolveWorld.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { Issue } from "../contracts/common";
import type { GameSpec } from "../contracts/gamespec";
import { WorldFile, type WorldOverlay } from "../contracts/world";
import { CUE_MAP } from "../game/expedition/audio/cues";
import { selectWorld, type NamedWorldFile } from "../world/resolve-world";
import type { WorldSource } from "../world/types";
import { validateWorld } from "../world/validate-world";

export const WORLDS_DIR = path.join(process.cwd(), "fixtures", "worlds");

export interface LoadedWorld {
  world: WorldOverlay;
  source: WorldSource;
  file: string | null;
  warnings: Issue[];
}
export interface LoadWorldOptions {
  dir?: string;
  /** autoWorld(spec) behind EXPEDITION_AUTO=on (TODO(w1): wire once W8 lands autoWorld) */
  auto?: ((spec: GameSpec) => WorldOverlay | null) | null;
  /** the §2.12 CUE_MAP ids for R16 (default: CUE_MAP from src/game/expedition/audio/cues.ts; null = Id-legality only) */
  cueIds?: ReadonlySet<string> | null;
  /** where skip/warning notices go (default console.warn) */
  warn?: (message: string) => void;
}

const logged = new Set<string>();
const CUE_IDS: ReadonlySet<string> = new Set(Object.keys(CUE_MAP));

/** Every parseable side-car in the directory, sorted by file name. Unparseable files are skipped with a warning. */
export async function readWorldFiles(dir = WORLDS_DIR, warn: (m: string) => void = console.warn): Promise<NamedWorldFile[]> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((f) => f.endsWith(".world.json")).sort();
  } catch {
    return [];
  }
  const out: NamedWorldFile[] = [];
  for (const name of names) {
    try {
      const parsed = WorldFile.safeParse(JSON.parse(await readFile(path.join(dir, name), "utf8")));
      if (parsed.success) out.push({ name, file: parsed.data });
      else warn(`[worlds] ${name} skipped: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    } catch (err) {
      warn(`[worlds] ${name} skipped: ${(err as Error).message}`);
    }
  }
  return out;
}

function summarize(warnings: readonly Issue[]): string {
  const byRule = new Map<string, number>();
  for (const w of warnings) {
    const rule = /^([RW]\d+):/.exec(w.message)?.[1] ?? "?";
    byRule.set(rule, (byRule.get(rule) ?? 0) + 1);
  }
  return [...byRule].map(([r, n]) => `${r}×${n}`).join(", ");
}

/** The world a spec plays in, or null (legacy host). Never throws. */
export async function loadWorldFor(spec: GameSpec, opts: LoadWorldOptions = {}): Promise<LoadedWorld | null> {
  const warn = opts.warn ?? console.warn;
  try {
    const files = await readWorldFiles(opts.dir ?? WORLDS_DIR, warn);
    const picked = selectWorld(spec, files, {
      validate: (s, world, sidecar) => validateWorld(s, world, { sidecar, cueIds: opts.cueIds === undefined ? CUE_IDS : opts.cueIds }),
      auto: opts.auto ?? null,
      onSkip: (reason) => warn(`[worlds] skipped: ${reason}`),
    });
    if (!picked) return null;
    if (picked.warnings.length > 0) {
      const key = `${spec.id}:${picked.file ?? picked.source}:${picked.warnings.length}`;
      if (!logged.has(key)) {
        logged.add(key);
        warn(`[worlds] ${picked.file ?? picked.source} → ${spec.id}: ${picked.warnings.length} warnings (${summarize(picked.warnings)})`);
      }
    }
    return { world: picked.world, source: picked.source, file: picked.file, warnings: picked.warnings };
  } catch (err) {
    warn(`[worlds] loadWorldFor(${spec.id}) failed: ${(err as Error).message}`);
    return null;
  }
}
