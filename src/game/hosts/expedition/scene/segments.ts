/**
 * scene/segments.ts (pure, H1) — lighting segments, their crossfade and variants, and cutaway interiors
 * (docs/design/20 §1.3 Segment/Interior, §2.2, §2.3). Segments are contiguous and cover [0, zone.width]; at a boundary
 * both layer sets and skies blend by alpha over CROSSFADE_WIDTH units (1 s at walking speed, 300 units/s).
 */
import type { Interior, MusicCue, Requirement, Segment, Sky, Weather, Zone } from "../../../../contracts/world";

export const CROSSFADE_WIDTH = 300;
export const FACADE_INSIDE_ALPHA = 0.2;
export const FACADE_FADE_MS = 300;

export function segmentAt(zone: Pick<Zone, "segments">, x: number): Segment {
  const segs = zone.segments;
  for (const s of segs) if (x >= s.x0 && x < s.x1) return s;
  return x < (segs[0]?.x0 ?? 0) ? segs[0] : segs[segs.length - 1];
}

/** Blend weights per segment id at x (they sum to 1): linear across ±width/2 of each boundary. */
export function crossfadeWeights(zone: Pick<Zone, "segments">, x: number, width = CROSSFADE_WIDTH): Map<string, number> {
  const w = new Map<string, number>();
  const segs = zone.segments;
  const cur = segmentAt(zone, x);
  const i = segs.indexOf(cur);
  const half = width / 2;
  const prev = i > 0 ? segs[i - 1] : null;
  const next = i + 1 < segs.length ? segs[i + 1] : null;
  if (prev && x - cur.x0 < half) {
    const f = 0.5 + (x - cur.x0) / width; // 0.5 at the boundary, 1 at +half
    w.set(cur.id, f);
    w.set(prev.id, (w.get(prev.id) ?? 0) + (1 - f));
  } else if (next && cur.x1 - x <= half) {
    const f = 0.5 + (cur.x1 - x) / width;
    w.set(cur.id, f);
    w.set(next.id, (w.get(next.id) ?? 0) + (1 - f));
  } else {
    w.set(cur.id, 1);
  }
  return w;
}

/** Layer-set weights: the sum of the weights of the segments that use each set (every set present, 0 if unused here). */
export function layerSetWeights(zone: Pick<Zone, "segments" | "layerSets">, x: number, width = CROSSFADE_WIDTH): Map<string, number> {
  const out = new Map<string, number>(zone.layerSets.map((ls) => [ls.id, 0]));
  for (const [segId, weight] of crossfadeWeights(zone, x, width)) {
    const seg = zone.segments.find((s) => s.id === segId);
    if (seg) out.set(seg.layerSet, (out.get(seg.layerSet) ?? 0) + weight);
  }
  return out;
}

export interface SegmentLook {
  sky: Sky;
  weather: Weather;
  music: MusicCue | null;
}
/** The segment's look after variants: the LAST variant whose requirement holds overrides its non-null fields. */
export function resolveSegmentLook(seg: Segment, reqOk: (r: Requirement | null) => boolean): SegmentLook {
  let look: SegmentLook = { sky: seg.sky, weather: seg.weather, music: seg.music };
  for (const v of seg.variants) {
    if (!reqOk(v.requires)) continue;
    look = { sky: v.sky ?? look.sky, weather: v.weather ?? look.weather, music: v.music ?? look.music };
  }
  return look;
}

export function interiorAt(zone: Pick<Zone, "interiors">, x: number): Interior | null {
  return zone.interiors.find((i) => x >= i.x0 && x <= i.x1) ?? null;
}

/** Façade alpha moving toward its target at 1 → 0.2 over FACADE_FADE_MS. */
export function stepFacadeAlpha(current: number, inside: boolean, dtMs: number): number {
  const target = inside ? FACADE_INSIDE_ALPHA : 1;
  const rate = (1 - FACADE_INSIDE_ALPHA) / FACADE_FADE_MS;
  if (current < target) return Math.min(target, current + rate * dtMs);
  return Math.max(target, current - rate * dtMs);
}

/** Hex "#rrggbb" → 0xrrggbb. */
export function hexToInt(hex: string): number {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  return m ? parseInt(m[1], 16) : 0;
}
/** Linear RGB blend of two 0xrrggbb colours. */
export function mixColor(a: number, b: number, t: number): number {
  const u = Math.min(1, Math.max(0, t));
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - u) + ((b >> s) & 255) * u);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
/** The sky colour at a fraction f (0 top … 1 bottom) of the view. */
export function skyColorAt(sky: Sky, f: number): number {
  const stops = [...sky.stops].sort((a, b) => a.at - b.at);
  if (f <= stops[0].at) return hexToInt(stops[0].color);
  for (let i = 1; i < stops.length; i++) {
    if (f <= stops[i].at) {
      const a = stops[i - 1];
      const b = stops[i];
      return mixColor(hexToInt(a.color), hexToInt(b.color), (f - a.at) / Math.max(1e-6, b.at - a.at));
    }
  }
  return hexToInt(stops[stops.length - 1].color);
}
