/**
 * scene/views.ts (H1) — per-encounter views for the controllers: `mode.present(params, spec.seed + index)`, memoized
 * per encounter (the runner shows the same view, D5). Metas only ever receive the VIEW (never params or solutions).
 * Also the cosmetic seed per station: spec.seed ^ hash32(encounterId).
 */
import type { GameSpec } from "../../../../contracts/gamespec";
import { getMode } from "../../../../mechanics/registry";
import { hash32 } from "../art/stub-spec";

export function stationSeed(specSeed: number, encounterId: string): number {
  return (specSeed ^ hash32(encounterId)) >>> 0;
}

export function viewsFor(spec: GameSpec): (encounterId: string) => unknown {
  const memo = new Map<string, unknown>();
  return (encounterId) => {
    if (memo.has(encounterId)) return memo.get(encounterId);
    const index = spec.encounters.findIndex((e) => e.id === encounterId);
    const enc = spec.encounters[index];
    let view: unknown = null;
    if (enc) {
      const mode = getMode(enc.familyId, enc.mode);
      try {
        view = mode ? mode.present(enc.params, spec.seed + index) : null;
      } catch {
        view = null;
      }
    }
    memo.set(encounterId, view);
    return view;
  };
}
