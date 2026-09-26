/**
 * src/world/state/bonus.ts (S1) — the debrief mirror (docs/design/20 §2.4.6): collectibles and quest debrief lines are
 * mirrored to `sessionStorage["expedition:bonus:<specId>"]` for the debrief only. Pure: the storage is injected.
 */
export interface BonusRecord {
  collected: string[];
  debrief: string[];
}
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function bonusKey(specId: string): string {
  return `expedition:bonus:${specId}`;
}

export function readBonus(store: KeyValueStore | null, specId: string): BonusRecord {
  const empty: BonusRecord = { collected: [], debrief: [] };
  if (!store) return empty;
  try {
    const raw = store.getItem(bonusKey(specId));
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return empty;
    const rec = parsed as Partial<Record<keyof BonusRecord, unknown>>;
    const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    return { collected: strings(rec.collected), debrief: strings(rec.debrief) };
  } catch {
    return empty;
  }
}

/** Merges (deduped, order kept) and writes; returns the merged record. Storage failures are ignored. */
export function mirrorBonus(
  store: KeyValueStore | null,
  specId: string,
  add: { collected?: readonly string[]; debrief?: readonly string[] },
): BonusRecord {
  const cur = readBonus(store, specId);
  const merge = (a: string[], b: readonly string[] | undefined) => {
    const out = [...a];
    for (const x of b ?? []) if (!out.includes(x)) out.push(x);
    return out;
  };
  const next: BonusRecord = { collected: merge(cur.collected, add.collected), debrief: merge(cur.debrief, add.debrief) };
  if (store) {
    try {
      store.setItem(bonusKey(specId), JSON.stringify(next));
    } catch {
      // private mode or quota: the debrief simply shows no bonus lines
    }
  }
  return next;
}
