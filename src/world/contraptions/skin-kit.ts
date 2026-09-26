/**
 * src/world/contraptions/skin-kit.ts (W0, main) — builds ContraptionSkin records from the §4.3 art contract table.
 * Part keys follow §5.1: `<ns>.part.<skin>_<slot>`; the default console is `<ns>.part.<skin>_console`.
 * Metas own their skins; this helper keeps the key spelling in one place.
 */
import type { ContraptionSkin, HintTarget, HintTargetTable, SnapshotPart } from "../types";

/** [slot, "H" hero | "K" kit, optional asset key override for parts shared with another skin or namespace]. */
export type PartSpec = readonly [slot: string, source: "H" | "K", asset?: string];

export interface SkinSpec {
  id: string;
  name: string;
  /** asset namespace: a biome id, or "shared" */
  ns: string;
  biomes?: readonly string[] | "any";
  nouns: readonly string[];
  parts: readonly PartSpec[];
  /** §4.3 "Required anchors"; ranges like "spoke_0…4" or "spoke_0..4" expand to spoke_0 … spoke_4 */
  anchors: readonly string[];
  cues: ContraptionSkin["cues"];
  sensitiveSafe?: boolean;
  /** anchors used by the default hint table (rung 1, 2, 3); defaults to the first three anchors */
  hintAnchors?: readonly [string, string, string];
  hintTargets?: HintTargetTable;
}

export function partKey(ns: string, skinId: string, slot: string): string {
  return `${ns}.part.${skinId}_${slot}`;
}

/** "spoke_0…4" → spoke_0, spoke_1, …, spoke_4. Other names pass through. */
export function expandAnchors(names: readonly string[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    const m = /^(.*_)(\d+)(?:…|\.\.)(\d+)$/.exec(n);
    if (!m) {
      out.push(n);
      continue;
    }
    for (let i = Number(m[2]); i <= Number(m[3]); i++) out.push(`${m[1]}${i}`);
  }
  return out;
}

export function defaultHintTable(a1: string, a2: string, a3: string): HintTargetTable {
  const t = (anchor: string, action: HintTarget["action"], holdMs: number): HintTarget => ({ anchor, action, holdMs });
  return [[t(a1, "hover", 1500)], [t(a2, "circle", 1800)], [t(a3, "land", 2000)]];
}

export function defineSkin(spec: SkinSpec): ContraptionSkin {
  const anchors = expandAnchors(spec.anchors);
  const parts = spec.parts.map(([slot, source, asset]) => ({ slot, asset: asset ?? partKey(spec.ns, spec.id, slot), hero: source === "H" }));
  const console = partKey(spec.ns, spec.id, "console");
  const [h1, h2, h3] = spec.hintAnchors ?? [anchors[0] ?? "console", anchors[1] ?? anchors[0] ?? "console", anchors[2] ?? "console"];
  const rest: SnapshotPart[] = parts.filter((p) => p.hero).map((p) => ({ asset: p.asset, dx: 0, dy: 0 }));
  return {
    id: spec.id,
    name: spec.name,
    biomes: spec.biomes ?? (spec.ns === "shared" ? "any" : [spec.ns]),
    nouns: spec.nouns,
    parts,
    anchors,
    console,
    // dormant = hero parts at rest; solved offsets are baked from meta.solvedPose by the K lanes (§4.3)
    snapshot: { dormant: [...rest, { asset: console, dx: 0, dy: 0 }], solved: [...rest, { asset: console, dx: 0, dy: 0 }] },
    sensitiveSafe: spec.sensitiveSafe ?? false,
    cues: spec.cues,
    hintTargets: spec.hintTargets ?? defaultHintTable(h1, h2, h3),
  };
}
