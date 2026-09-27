/**
 * art/stub-spec.ts (pure, H1) — what the STUB loader paints for an asset key until A1's manifest loader and the kit
 * art exist: a kit-coloured shape per group (docs/design/20 §5.1 groups), sized by the key's role in the world
 * (layer depth, hub, console, blocker...). Also the residency diff every loader applies on a zone swap (A4, §5.7).
 *
 * Backdrops stay clean: the topmost far layer of a set dresses the sky (planets and sparse stars over the segment
 * gradient), the other far and fore layers are smooth silhouettes, and the mid layer is one low ridge. No columns or
 * scaffolding float in the sky while the real art is missing.
 */
import type { Depth, WorldOverlay } from "../../../../contracts/world";

export type StubStyle = "hills" | "haze" | "strip" | "block" | "disc" | "glow" | "figure" | "plaque" | "vista" | "pillar" | "arch" | "ridge" | "celestial" | "wisp" | "none" | "shard";
export interface StubSpec {
  key: string;
  w: number; // design units
  h: number;
  pivot: readonly [number, number];
  style: StubStyle;
  /** palette tokens, first found wins */
  color: readonly string[];
  accent: readonly string[];
  seed: number;
  depth: Depth | null;
}
export interface StubHints {
  layers: ReadonlyMap<string, Depth>;
  /** per layer set, the topmost repeating L1_far layer: painted as the sky dressing (planets, stars) */
  skies: ReadonlySet<string>;
  hubs: ReadonlySet<string>;
  consoles: ReadonlySet<string>;
  blockers: ReadonlySet<string>;
  facades: ReadonlySet<string>;
  vehicles: ReadonlySet<string>;
}

/** FNV-1a, 32-bit (seeds for stub shapes and prefab cosmetics). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
export function groupOfKey(key: string): string {
  return key.split(".")[1] ?? "kit";
}

export function stubHintsFor(world: WorldOverlay): StubHints {
  const layers = new Map<string, Depth>();
  const skies = new Set<string>();
  const hubs = new Set<string>();
  const facades = new Set<string>();
  const vehicles = new Set<string>();
  for (const z of world.zones) {
    for (const ls of z.layerSets) {
      for (const l of ls.layers) if (!layers.has(l.asset)) layers.set(l.asset, l.depth);
      const top = ls.layers.filter((l) => l.depth === "L1_far" && l.repeatX).sort((a, b) => a.y - b.y)[0];
      if (top) skies.add(top.asset);
    }
    if (z.hub) hubs.add(z.hub.asset);
    for (const i of z.interiors) facades.add(i.facade);
    for (const l of z.links) if (l.kind === "ride") vehicles.add(l.vehicle);
  }
  const consoles = new Set<string>();
  const blockers = new Set<string>();
  for (const st of world.stations) {
    if (st.consoleAsset) consoles.add(st.consoleAsset);
    if (st.payoff.blocker?.asset) blockers.add(st.payoff.blocker.asset);
  }
  return { layers, skies, hubs, consoles, blockers, facades, vehicles };
}

/** The sky dressing tile (transparent apart from its planets and stars). */
const SKY_H = 560;
/**
 * Silhouette tiles are tall on purpose: worlds place layer tops for real art of unknown height, and a stub that ends
 * above the ground leaves a band of sky floating over the play layer. The painter keeps each crest at its design
 * height (hills 470, ridge 420) and fills the rest of the tile, so the tile bottom lands below the ground in every
 * shipped zone and the ground fill hides the overshoot.
 */
const LAYER_SIZE: Readonly<Record<Depth, { h: number; style: StubStyle; color: string[]; accent: string[] }>> = {
  L1_far: { h: 1000, style: "hills", color: ["rock.light", "foliage.blue.hi", "stone.shade"], accent: ["haze"] },
  L2_midfar: { h: 1000, style: "hills", color: ["foliage.blue", "rock.base", "stone.deep"], accent: ["crystal.base", "gold.base"] },
  L3_mid: { h: 1200, style: "ridge", color: ["rock.shade", "stone.deep", "foliage.blue"], accent: ["gold.deep"] },
  L5_fore: { h: 220, style: "hills", color: ["grass.shade", "foliage.rust", "rock.shade"], accent: ["grass.base"] },
  L6_light: { h: 1080, style: "haze", color: ["haze"], accent: ["gold.hi"] },
};

/** The stub shape for an asset key. */
export function stubSpecFor(key: string, hints: StubHints): StubSpec {
  const seed = hash32(key);
  const depth = hints.layers.get(key) ?? null;
  if (depth === "L1_far" && hints.skies.has(key)) {
    // the sky dressing: a wide tile so its planets repeat rarely at L1's scroll factor
    return { key, w: 2048, h: SKY_H, pivot: [0, 0], style: "celestial", color: ["crystal.base", "foliage.blue", "stone.base"], accent: ["gold.hi", "crystal.hi", "stone.lit"], seed, depth };
  }
  if (depth) {
    const d = LAYER_SIZE[depth];
    return { key, w: 1024, h: d.h, pivot: [0, 0], style: d.style, color: d.color, accent: d.accent, seed, depth };
  }
  const base = { key, seed, depth: null };
  if (hints.hubs.has(key)) return { ...base, w: 560, h: 760, pivot: [0.5, 1], style: "arch", color: ["stone.base", "gold.base"], accent: ["gold.hi", "crystal.base"] };
  if (hints.facades.has(key)) return { ...base, w: 900, h: 620, pivot: [0, 0], style: "block", color: ["stone.shade", "rock.base"], accent: ["gold.base"] };
  if (hints.consoles.has(key)) return { ...base, w: 110, h: 170, pivot: [0.5, 1], style: "pillar", color: ["bronze.ring", "gold.deep"], accent: ["gold.hi"] };
  // a payoff blocker (the frozen ridge, a sealed door): a translucent shard cluster reads as "sealed until solved"
  if (hints.blockers.has(key)) return { ...base, w: 110, h: 320, pivot: [0.5, 1], style: "shard", color: ["crystal.base", "inlay.navy", "stone.shade"], accent: ["crystal.hi", "gold.hi", "stone.lit"] };
  if (hints.vehicles.has(key)) return { ...base, w: 240, h: 90, pivot: [0.5, 1], style: "block", color: ["bronze.ring", "gold.deep"], accent: ["gold.hi"] };
  const group = groupOfKey(key);
  switch (group) {
    case "ground":
      return { ...base, w: 512, h: 140, pivot: [0, 0], style: "strip", color: ["sand.path", "stone.base", "grass.base"], accent: ["grass.shade", "stone.shade"] };
    case "prop":
      return { ...base, w: 140, h: 220, pivot: [0.5, 1], style: "pillar", color: ["stone.base", "rock.light"], accent: ["gold.base"] };
    case "part":
      return key.endsWith("_console")
        ? { ...base, w: 110, h: 170, pivot: [0.5, 1], style: "pillar", color: ["bronze.ring", "gold.deep"], accent: ["gold.hi"] }
        : { ...base, w: 160, h: 160, pivot: [0.5, 0.5], style: "disc", color: ["gold.base", "stone.base"], accent: ["inlay.navy"] };
    case "costume":
      // a scarf, satchel or hat pinned to a rig anchor: purely decorative, so the stand-in is invisible rather than a
      // disc stuck on the character's face or hand (the real hero SVG takes over once the manifest lists it)
      return { ...base, w: 56, h: 56, pivot: [0.5, 0.5], style: "none", color: ["foliage.salmon", "gold.base"], accent: ["gold.hi"] };
    case "companion":
      // the guide companion talks and flies to hint targets, so it stays visible: a small glowing creature, not a marker
      return { ...base, w: 84, h: 84, pivot: [0.5, 0.5], style: "wisp", color: ["gold.base", "bronze.ring"], accent: ["crystal.hi", "glow.cyan", "gold.hi"] };
    case "npc":
      return { ...base, w: 130, h: 210, pivot: [0.5, 1], style: "figure", color: ["gold.deep", "stone.shade"], accent: ["crystal.base"] };
    case "fx":
      return { ...base, w: 128, h: 128, pivot: [0.5, 0.5], style: "glow", color: ["glow.cyan", "crystal.hi", "haze"], accent: ["haze"] };
    case "vista":
      return { ...base, w: 1920, h: 1080, pivot: [0, 0], style: "vista", color: ["sky.dusk.mid", "sky.day.mid", "stone.base"], accent: ["gold.hi"] };
    case "doc":
      return { ...base, w: 120, h: 170, pivot: [0.5, 1], style: "plaque", color: ["stone.lit", "stone.base"], accent: ["bronze.ring"] };
    case "silhouette":
      return { ...base, w: 100, h: 220, pivot: [0.5, 1], style: "figure", color: ["shadow", "rock.shade"], accent: ["stone.lit"] };
    case "ui":
      return { ...base, w: 64, h: 64, pivot: [0.5, 0.5], style: "disc", color: ["ui.panel.solid", "inlay.navy"], accent: ["ui.accent"] };
    default:
      return { ...base, w: 200, h: 200, pivot: [0.5, 1], style: "block", color: ["stone.base"], accent: ["gold.base"] };
  }
}

/** First token present in a palette, else a neutral grey. */
export function pickColor(palette: Readonly<Record<string, string>>, tokens: readonly string[], fallback = "#8A96A0"): string {
  for (const t of tokens) {
    const c = palette[t];
    if (c && /^#[0-9a-fA-F]{6}$/.test(c)) return c;
  }
  return fallback;
}

/** Keys to remove after a zone swap: resident for the previous zone, not needed by the next, not tagged "all". */
export function unloadKeys(prev: Iterable<string>, next: Iterable<string>, all: Iterable<string>): string[] {
  const keep = new Set<string>([...next, ...all]);
  return [...new Set(prev)].filter((k) => !keep.has(k)).sort();
}
