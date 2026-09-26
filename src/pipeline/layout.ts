import type { Genre } from "../contracts/common";
import type { GameSpec } from "../contracts/gamespec";
import { CHUNKS } from "../library/genres";

/**
 * Layout is computed, not generated: start chunk, then one prefab per encounter whose socket matches,
 * rotating through variants, with a connector every other room. Instant, free, and solvable by construction.
 * (An LLM "level designer" that picks among variants is an optional upgrade, not a requirement.)
 */
export function layoutFromEncounters(
  genre: Genre,
  encounters: readonly { id: string; socket: string; role: string }[],
): GameSpec["layout"] {
  const catalog = CHUNKS[genre];
  const start = catalog.find((c) => c.kind === "start");
  const connector = catalog.find((c) => c.kind === "connector");
  if (!start) throw new Error(`genre ${genre} has no start chunk`);

  const chunks: GameSpec["layout"]["chunks"] = [{ chunkId: start.id, encounterId: null }];
  const used = new Map<string, number>();
  encounters.forEach((e, i) => {
    const kind = e.role === "boss" ? "boss" : "room";
    const options = catalog.filter((c) => c.socket === e.socket && c.kind === kind);
    if (options.length === 0) throw new Error(`no ${kind} chunk provides socket "${e.socket}" in ${genre}`);
    const n = used.get(e.socket) ?? 0;
    used.set(e.socket, n + 1);
    if (connector && i > 0 && i % 2 === 0) chunks.push({ chunkId: connector.id, encounterId: null });
    chunks.push({ chunkId: options[n % options.length].id, encounterId: e.id });
  });
  return { chunks };
}
