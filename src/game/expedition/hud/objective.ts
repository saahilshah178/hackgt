/**
 * src/game/expedition/hud/objective.ts (S1, pure) — HUD numbers and strings (docs/design/20 §2.6, bible §3.10):
 * the objective ring's segments, its tooltip / SR text, the objective line, the meter value and the counters.
 */
import type { Collectible, Meter, Story } from "../../../contracts/world";
import { arcPath } from "../dialogue/emblem-glyphs";

export interface ZoneProgress {
  solved: number;
  total: number;
}

/** Solved / total stations in the current zone (the ring re-segments on zone change). */
export function zoneProgress(
  stations: readonly { encounterId: string; zoneId: string }[],
  zoneId: string | null,
  solvedIds: ReadonlySet<string> | readonly string[],
): ZoneProgress {
  const solved = solvedIds instanceof Set ? solvedIds : new Set(solvedIds as readonly string[]);
  const inZone = zoneId === null ? stations : stations.filter((s) => s.zoneId === zoneId);
  return { solved: inZone.filter((s) => solved.has(s.encounterId)).length, total: inZone.length };
}

/** Game-wide progress (the debrief and the ring's fallback when a zone has no stations). */
export function gameProgress(stations: readonly { encounterId: string }[], solvedIds: ReadonlySet<string> | readonly string[]): ZoneProgress {
  const solved = solvedIds instanceof Set ? solvedIds : new Set(solvedIds as readonly string[]);
  return { solved: stations.filter((s) => solved.has(s.encounterId)).length, total: stations.length };
}

/** "rhythm" → "rhythms" (and "record" → "records"); the noun is authored singular. */
export function plural(noun: string, n: number): string {
  if (n === 1) return noun;
  if (/(s|x|z|ch|sh)$/i.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

/** Tooltip and screen-reader text: "Restore the orrery's starlight · 2 of 3 rhythms". */
export function objectiveSummary(story: Pick<Story, "objective" | "restoredNoun">, p: ZoneProgress): string {
  return `${story.objective} · ${p.solved} of ${p.total} ${plural(story.restoredNoun, p.total)}`;
}

/** The objective line under the ring: `${objectiveLabel} ${solved}/${total}`. */
export function objectiveLine(story: Pick<Story, "objectiveLabel">, p: ZoneProgress): string {
  return `${story.objectiveLabel} ${p.solved}/${p.total}`;
}

export interface RingSegment {
  d: string;
  filled: boolean;
  index: number;
}

/**
 * The inner ring's segments, clockwise from 12 o'clock, `gapDeg` apart; the first `solved` are filled.
 * A zone with no stations draws one empty ring.
 */
export function ringSegments(p: ZoneProgress, size: number, r: number, gapDeg = 8): RingSegment[] {
  const c = size / 2;
  const n = Math.max(1, p.total);
  if (n === 1) return [{ d: arcPath(c, c, r, 0, 360), filled: p.total > 0 && p.solved >= 1, index: 0 }];
  const step = 360 / n;
  return Array.from({ length: n }, (_, i) => ({
    d: arcPath(c, c, r, i * step + gapDeg / 2, (i + 1) * step - gapDeg / 2),
    filled: i < p.solved,
    index: i,
  }));
}

/** The meter's value: the value after the latest solved encounter it lists (never below `start`). */
export function meterValue(meter: Meter | null, solvedIds: ReadonlySet<string> | readonly string[]): number | null {
  if (!meter) return null;
  const solved = solvedIds instanceof Set ? solvedIds : new Set(solvedIds as readonly string[]);
  let v = meter.start;
  for (const e of meter.perEncounter) if (solved.has(e.encounterId)) v = Math.max(v, e.value);
  return Math.min(100, Math.max(0, v));
}

export function meterText(meter: Pick<Meter, "label" | "unit">, value: number): string {
  return meter.unit === "percent" ? `${meter.label} ${Math.round(value)} %` : `${meter.label} ${Math.round(value)}`;
}

const KIND_LABEL: Readonly<Record<Collectible["kind"], string>> = { page: "Pages", shard: "Shards", negative: "Negatives" };

export interface Counter {
  kind: Collectible["kind"];
  label: string;
  have: number;
  total: number;
}

/** Collectible counts per kind, in the order kinds first appear in the overlay. */
export function collectibleCounters(collectibles: readonly Pick<Collectible, "id" | "kind">[], collected: ReadonlySet<string>): Counter[] {
  const out: Counter[] = [];
  for (const c of collectibles) {
    let row = out.find((r) => r.kind === c.kind);
    if (!row) {
      row = { kind: c.kind, label: KIND_LABEL[c.kind], have: 0, total: 0 };
      out.push(row);
    }
    row.total++;
    if (collected.has(c.id)) row.have++;
  }
  return out;
}

/** "Pages 2/5 · Shards 1/3" */
export function countersText(counters: readonly Counter[]): string {
  return counters.map((c) => `${c.label} ${c.have}/${c.total}`).join(" · ");
}
