/**
 * scripts/art/vram.ts — texture sizes, per-zone residency VRAM and the budgets (20 §5.1 raster factor, §5.7, §5.8).
 * Pure: the build and tests/world-assets.test.ts share it.
 */
import type { AssetManifest, ManifestEntry } from "../../src/contracts/world";

/** `ceil4(x) = ceil(4x) / 4` (20 §5.1). */
export function ceil4(x: number): number {
  return Math.ceil(x * 4 - 1e-9) / 4;
}
/** Raster factor k = ceil4(rasterScale × min(dpr, 1.5)). */
export function rasterFactor(rasterScale: number, dpr = 1.5): number {
  return ceil4(rasterScale * Math.min(dpr, 1.5));
}
/** The packed sheet size of a puppet entry, in design units. */
export function puppetSheetSize(e: Extract<ManifestEntry, { kind: "puppet" }>): [number, number] {
  let w = 0;
  let h = 0;
  for (const p of e.parts) {
    w = Math.max(w, p.box[0] + p.box[2] * p.frames);
    h = Math.max(h, p.box[1] + p.box[3]);
  }
  return [w, h];
}
/** Atlas texture size in texels: protagonists 7 × 4 frames, NPCs 6 × 2 (20 §5.5). */
export function atlasSize(e: Extract<ManifestEntry, { kind: "atlas" }>): [number, number] {
  const cols = e.poses.length > 12 ? 7 : 6;
  const rows = Math.ceil(e.poses.length / cols);
  return [cols * e.frameWidth, rows * e.frameHeight];
}
/** Texture bytes of one entry at `dpr` (RGBA, no mipmaps). */
export function textureBytes(e: ManifestEntry, dpr = 1.5): number {
  if (e.kind === "atlas") {
    const [w, h] = atlasSize(e);
    return w * h * 4;
  }
  const k = rasterFactor(e.rasterScale, dpr);
  const [w, h] = e.kind === "puppet" ? puppetSheetSize(e) : [e.width, e.height];
  return Math.round(w * k) * Math.round(h * k) * 4;
}
export const MB = 1024 * 1024;
const mb = (bytes: number) => Math.round((bytes / MB) * 10) / 10;

/** VRAM of `all` alone and of `all` + each zone (MB, at dpr 1.5), plus the worst adjacent pair. */
export function zoneVram(entries: readonly ManifestEntry[], zones: readonly string[], extraAllBytes = 0, dpr = 1.5): { vram: Array<{ zone: string; mb: number }>; swapPeakMb: number } {
  const bytesOf = (tag: string) => entries.filter((e) => e.zone === tag).reduce((s, e) => s + textureBytes(e, dpr), 0);
  const all = bytesOf("all") + extraAllBytes;
  const vram = [{ zone: "all", mb: mb(all) }, ...zones.map((z) => ({ zone: z, mb: mb(all + bytesOf(z)) }))];
  let peak = all;
  for (let i = 0; i < zones.length; i++) peak = Math.max(peak, all + bytesOf(zones[i]) + (i + 1 < zones.length ? bytesOf(zones[i + 1]) : 0));
  return { vram, swapPeakMb: mb(peak) };
}

/** 20 §5.8 P0 budgets. */
export const BUDGETS = {
  swapPeakMb: 180,
  zoneMb: { orrery_terraces: 120, living_gate: 135, archive_of_voices: 140 } as Readonly<Record<string, number>>,
  sourceBytes: { shared: 0.3 * MB, orrery_terraces: 1.2 * MB, living_gate: 1.2 * MB, archive_of_voices: 1.2 * MB } as Readonly<Record<string, number>>,
  gzipBytes: { orrery_terraces: 350 * 1024, living_gate: 400 * 1024, archive_of_voices: 400 * 1024 } as Readonly<Record<string, number>>,
} as const;

/** Budget violations for one manifest ([] when within budget). */
export function budgetIssues(m: AssetManifest): string[] {
  const out: string[] = [];
  if (m.heroCount > m.heroCap) out.push(`${m.namespace}: ${m.heroCount} hero files > heroCap ${m.heroCap}`);
  const src = BUDGETS.sourceBytes[m.namespace];
  if (src !== undefined && m.totalBytes > src) out.push(`${m.namespace}: SVG source ${(m.totalBytes / MB).toFixed(2)} MB > ${(src / MB).toFixed(2)} MB`);
  const gz = BUDGETS.gzipBytes[m.namespace];
  if (gz !== undefined && m.gzipBytes > gz) out.push(`${m.namespace}: gzip ${(m.gzipBytes / 1024).toFixed(0)} KB > ${gz / 1024} KB`);
  const zoneCap = BUDGETS.zoneMb[m.namespace];
  if (zoneCap !== undefined) for (const v of m.vram) if (v.zone !== "all" && v.mb > zoneCap) out.push(`${m.namespace}: zone ${v.zone} ${v.mb} MB > ${zoneCap} MB resident`);
  if (m.swapPeakMb > BUDGETS.swapPeakMb) out.push(`${m.namespace}: zone swap peak ${m.swapPeakMb} MB > ${BUDGETS.swapPeakMb} MB`);
  return out;
}
