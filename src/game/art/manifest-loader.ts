/**
 * src/game/art/manifest-loader.ts — per-zone texture loading and unloading (docs/design/20 §5.7, 02 §3d; A4).
 *
 * Boot: `fetchCatalog(["shared", biome])` reads `public/assets/expedition/<ns>/manifest.json` (AssetManifest).
 * `loadZone(scene, catalog, world, zoneId, onProgress)` loads the union of (a) the biome's entries tagged "all", (b) the
 * shared entries tagged "all" (characters, companions, NPC puppets, costumes and vistas only when the world references
 * them), (c) the entries tagged `zoneId`, and (d) `assetsForZone(world, zoneId)` (src/world/residency.ts), so a
 * mis-tagged entry still loads when referenced. Per kind:
 *   svg    → load.svg(key, url, {width: round(w·k), height: round(h·k)}), sprites setScale(1/k); a tileWidth narrower
 *            than the texture adds frames "0", "1", … (one per tile)
 *   atlas  → load.atlas(key, png, json); on failure (or ?charfallback=1) load.atlasXML on Kenney's untinted HD sheet,
 *            with a console.warn — never console.error
 *   puppet → load.svg of the packed part sheet, then Texture.add(`${part}#${frame}`) per part frame
 * `unloadZone(scene, catalog, world, prevId, nextId)` removes every key of the previous zone that is neither "all" nor
 * needed by the next zone (call it after the transition wipe). k = ceil4(rasterScale × min(dpr, 1.5)); `?lowres=1`
 * caps dpr at 1. Phaser is imported for types only, so the pure helpers run in node tests.
 *
 * Missing art in normal play (the W1a fix list): a referenced `<ns>.companion.*` key with no manifest entry resolves to
 * the shared kit stand-in puppet (`shared.companion.guide_standin`, fallback ladder step 1) under its own key; a
 * referenced `costume` overlay with no entry becomes a blank 2 × 2 texture, so the host's debug stand-in never paints a
 * disc on a face or a hand. Both keep their `console.warn`. `?artdebug=1` turns the blanking off (the host's stand-ins
 * then show every missing overlay).
 */
import type Phaser from "phaser";
import { AssetManifest, type ManifestEntry, type WorldOverlay } from "../../contracts/world";
import { assetsForZone } from "../../world/residency";

export const ASSET_BASE = "/assets/expedition/";
/** Shared groups that load only when the world references them (every other shared "all" entry is resident). */
export const ON_DEMAND_SHARED_GROUPS: ReadonlySet<string> = new Set(["char", "companion", "npc", "costume", "vista"]);

export type SvgEntry = Extract<ManifestEntry, { kind: "svg" }>;
export type PuppetEntry = Extract<ManifestEntry, { kind: "puppet" }>;
export type AtlasEntry = Extract<ManifestEntry, { kind: "atlas" }>;

export interface LoaderFlags {
  dpr: number; // window.devicePixelRatio
  lowres: boolean; // ?lowres=1
  charFallback: boolean; // ?charfallback=1
  /** ?artdebug=1: missing costume overlays are left to the host's visible debug stand-ins instead of drawing nothing */
  artDebug: boolean;
  base: string; // URL prefix of public/assets/expedition/
}
export interface ArtCatalog {
  flags: LoaderFlags;
  manifests: Readonly<Record<string, AssetManifest>>;
  entries: ReadonlyMap<string, ManifestEntry>;
}

/** Flags from a location search string (`?lowres=1&charfallback=1`) and the device pixel ratio. */
export function flagsFrom(search: string, dpr: number, base = ASSET_BASE): LoaderFlags {
  const q = new URLSearchParams(search);
  return { dpr: Number.isFinite(dpr) && dpr > 0 ? dpr : 1, lowres: q.get("lowres") === "1", charFallback: q.get("charfallback") === "1", artDebug: q.get("artdebug") === "1", base };
}

/** Build a catalog from parsed manifests (pure). Later namespaces never override earlier keys. */
export function catalogFrom(manifests: readonly AssetManifest[], flags: LoaderFlags): ArtCatalog {
  const byNs: Record<string, AssetManifest> = {};
  const entries = new Map<string, ManifestEntry>();
  for (const m of manifests) {
    byNs[m.namespace] = m;
    for (const e of m.entries) if (!entries.has(e.key)) entries.set(e.key, e);
  }
  return { flags, manifests: byNs, entries };
}

/** Fetch and parse the manifests (a missing or invalid one is a console.warn and an empty namespace). */
export async function fetchCatalog(namespaces: readonly string[], flags: LoaderFlags, fetchFn: typeof fetch = fetch): Promise<ArtCatalog> {
  const manifests = await Promise.all(
    namespaces.map(async (ns) => {
      try {
        const res = await fetchFn(`${flags.base}${ns}/manifest.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return AssetManifest.parse(await res.json());
      } catch (e) {
        console.warn(`[art] manifest for "${ns}" unavailable (${(e as Error).message}); its assets fall back to debug textures`);
        return null;
      }
    }),
  );
  return catalogFrom(
    manifests.filter((m): m is AssetManifest => m !== null),
    flags,
  );
}

const ceil4 = (x: number) => Math.ceil(x * 4 - 1e-9) / 4;
/** The raster factor k for an entry (20 §5.1). Atlases are PNGs at 2× the 1× Kenney cell: k = 192 / 168. */
export function rasterFactorOf(catalog: ArtCatalog, entry: ManifestEntry): number {
  if (entry.kind === "atlas") return entry.frameWidth / entry.displayWidth;
  const dpr = Math.min(catalog.flags.lowres ? 1 : catalog.flags.dpr, 1.5);
  return ceil4(entry.rasterScale * dpr);
}
function groupOf(key: string): string {
  return key.split(".")[1] ?? "";
}
function nsOf(key: string): string {
  return key.split(".")[0] ?? "";
}

/** The kit stand-in every guide companion falls back to (a ≤ 8-part puppet with idle, talk and cue). */
export const COMPANION_STANDIN = "shared.companion.guide_standin";
/** Groups whose missing keys draw nothing in normal play (overlays on a character must never show a debug disc). */
export const BLANK_WHEN_MISSING: ReadonlySet<string> = new Set(["costume"]);

/**
 * The entry a key resolves to when no manifest provides it: a missing `<ns>.companion.<name>` resolves to the shared
 * stand-in puppet re-keyed under the missing key (so its textures, part frames and anims live under that key). Null for
 * every other group, for keys the catalog already has, and when the stand-in itself is absent. Pure.
 */
export function fallbackEntryFor(catalog: ArtCatalog, key: string): ManifestEntry | null {
  if (catalog.entries.has(key) || groupOf(key) !== "companion") return null;
  const standin = catalog.entries.get(COMPANION_STANDIN);
  return standin && standin.kind === "puppet" ? { ...standin, key } : null;
}
/**
 * Registers the fallback entries for the keys a world references (see `fallbackEntryFor`) in the catalog, once per key,
 * with a console.warn each. Returns the keys it added. Idempotent.
 */
export function registerFallbacks(catalog: ArtCatalog, keys: readonly string[]): string[] {
  const added: string[] = [];
  for (const k of keys) {
    const e = fallbackEntryFor(catalog, k);
    if (!e) continue;
    (catalog.entries as Map<string, ManifestEntry>).set(k, e);
    added.push(k);
    console.warn(`[art] ${k}: no manifest entry yet; the kit stand-in companion (${COMPANION_STANDIN}) plays in its place`);
  }
  return added;
}
/** Referenced keys that should draw nothing while they have no entry (costume overlays), unless `?artdebug=1`. */
export function blankKeys(catalog: ArtCatalog, keys: readonly string[]): string[] {
  if (catalog.flags.artDebug) return [];
  return keys.filter((k) => !catalog.entries.has(k) && BLANK_WHEN_MISSING.has(groupOf(k)));
}

/** Every key resident while `zoneId` is current (sorted). Keys the catalog does not know are left out (see `missingKeys`). */
export function zoneKeys(catalog: ArtCatalog, world: WorldOverlay, zoneId: string): string[] {
  const referenced = new Set(assetsForZone(world, zoneId));
  const out = new Set<string>();
  for (const e of catalog.entries.values()) {
    if (e.zone === zoneId) out.add(e.key);
    else if (e.zone === "all") {
      const shared = nsOf(e.key) === "shared";
      if (!shared || !ON_DEMAND_SHARED_GROUPS.has(groupOf(e.key)) || referenced.has(e.key)) out.add(e.key);
    }
  }
  for (const k of referenced) if (catalog.entries.has(k)) out.add(k);
  return [...out].sort();
}
/** Keys the zone references that no manifest provides (the host draws its debug texture for them). */
export function missingKeys(catalog: ArtCatalog, world: WorldOverlay, zoneId: string): string[] {
  return assetsForZone(world, zoneId).filter((k) => !catalog.entries.has(k));
}
/** Keys to remove after moving from `prevId` to `nextId`: in prev's set, not tagged "all", not in next's set. */
export function keysToUnload(catalog: ArtCatalog, world: WorldOverlay, prevId: string, nextId: string): string[] {
  const next = new Set(zoneKeys(catalog, world, nextId));
  return zoneKeys(catalog, world, prevId).filter((k) => !next.has(k) && catalog.entries.get(k)?.zone !== "all");
}

/** The texture size a loader requests for an svg or puppet sheet entry. */
export function textureSize(catalog: ArtCatalog, entry: SvgEntry | PuppetEntry): { width: number; height: number; k: number } {
  const k = rasterFactorOf(catalog, entry);
  let [w, h] = [entry.width, entry.height];
  if (entry.kind === "puppet") {
    w = 0;
    h = 0;
    for (const p of entry.parts) {
      w = Math.max(w, p.box[0] + p.box[2] * p.frames);
      h = Math.max(h, p.box[1] + p.box[3]);
    }
  }
  return { width: Math.round(w * k), height: Math.round(h * k), k };
}
/** Puppet part frame names inside the sheet texture. */
export function puppetFrameName(part: string, frame: number): string {
  return `${part}#${frame}`;
}
/** Frame name for a pose on a character texture (identity on our atlas; the XML map on the Kenney fallback). */
export function atlasFrame(catalog: ArtCatalog, key: string, pose: string, usingFallback: boolean): string {
  const e = catalog.entries.get(key);
  if (!e || e.kind !== "atlas" || !usingFallback) return pose;
  return e.fallback.frameNames[pose] ?? e.fallback.frameNames.idle ?? pose;
}

// ── Phaser side ────────────────────────────────────────────────────────────────────────────────────────────
interface TexMeta {
  k: number;
  fallback?: boolean;
}
function setMeta(scene: Phaser.Scene, key: string, meta: TexMeta): void {
  const tex = scene.textures.get(key) as unknown as { customData?: Record<string, unknown> };
  if (tex) tex.customData = { ...(tex.customData ?? {}), art: meta };
}
/** The raster factor a loaded texture was made at (sprites use setScale(1 / k)); 1 when unknown. */
export function textureK(scene: Phaser.Scene, key: string): number {
  const tex = scene.textures.exists(key) ? (scene.textures.get(key) as unknown as { customData?: { art?: TexMeta } }) : null;
  return tex?.customData?.art?.k ?? 1;
}
/** True when the character texture is Kenney's untinted fallback sheet. */
export function isFallbackAtlas(scene: Phaser.Scene, key: string): boolean {
  const tex = scene.textures.exists(key) ? (scene.textures.get(key) as unknown as { customData?: { art?: TexMeta } }) : null;
  return tex?.customData?.art?.fallback === true;
}

function queueEntry(scene: Phaser.Scene, catalog: ArtCatalog, e: ManifestEntry): boolean {
  if (scene.textures.exists(e.key)) return false;
  const base = catalog.flags.base;
  if (e.kind === "atlas") {
    if (catalog.flags.charFallback) scene.load.atlasXML(e.key, base + e.fallback.image, base + e.fallback.xml);
    else scene.load.atlas(e.key, base + e.image, base + e.frames);
    return true;
  }
  const { width, height } = textureSize(catalog, e);
  scene.load.svg(e.key, base + e.file, { width, height });
  return true;
}

function finalize(scene: Phaser.Scene, catalog: ArtCatalog, e: ManifestEntry, fallback: boolean): void {
  if (!scene.textures.exists(e.key)) return;
  if (e.kind === "atlas") {
    setMeta(scene, e.key, { k: e.frameWidth / e.displayWidth, fallback: fallback || catalog.flags.charFallback });
    return;
  }
  const { k } = textureSize(catalog, e);
  setMeta(scene, e.key, { k });
  const tex = scene.textures.get(e.key);
  if (e.kind === "puppet") {
    for (const p of e.parts) for (let i = 0; i < p.frames; i++) {
      const name = puppetFrameName(p.name, i);
      if (!tex.has(name)) tex.add(name, 0, Math.round((p.box[0] + i * p.box[2]) * k), Math.round(p.box[1] * k), Math.round(p.box[2] * k), Math.round(p.box[3] * k));
    }
  } else if (e.tileWidth !== null && e.tileWidth < e.width) {
    const n = Math.ceil(e.width / e.tileWidth);
    for (let i = 0; i < n; i++) {
      const name = String(i);
      const x = Math.round(i * e.tileWidth * k);
      const w = Math.min(Math.round(e.tileWidth * k), Math.round(e.width * k) - x);
      if (!tex.has(name) && w > 0) tex.add(name, 0, x, 0, w, Math.round(e.height * k));
    }
  }
}

export interface ZoneLoadResult {
  keys: string[]; // resident after the load
  queued: string[]; // newly requested
  missing: string[]; // referenced but in no manifest
  failed: string[]; // requested but failed (no fallback)
  /** missing costume overlays given a blank texture (nothing draws; `?artdebug=1` leaves them to the host's stand-ins) */
  blanked: string[];
}

/** A transparent 2 × 2 texture under `key` (so nothing, not a debug stand-in, draws for it). False without a canvas API. */
function blankTexture(scene: Phaser.Scene, key: string): boolean {
  const tm = scene.textures as unknown as { exists(k: string): boolean; createCanvas?: (k: string, w: number, h: number) => { refresh(): unknown } | null };
  if (tm.exists(key) || typeof tm.createCanvas !== "function") return false;
  const tex = tm.createCanvas(key, 2, 2);
  tex?.refresh();
  setMeta(scene, key, { k: 1 });
  return tex !== null && tex !== undefined;
}

/**
 * Load everything the zone needs. Safe to call from `preload` (the scene starts the loader) or later (it starts the
 * loader itself). Resolves when the queue completes; never rejects; logs only console.warn.
 */
export function loadZone(scene: Phaser.Scene, catalog: ArtCatalog, world: WorldOverlay, zoneId: string, onProgress?: (fraction: number) => void): Promise<ZoneLoadResult> {
  registerFallbacks(catalog, assetsForZone(world, zoneId));
  const keys = zoneKeys(catalog, world, zoneId);
  const missing = missingKeys(catalog, world, zoneId);
  if (missing.length) console.warn(`[art] zone ${zoneId}: ${missing.length} referenced asset(s) have no manifest entry yet: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}`);
  // before anything else can paint a stand-in for them: missing costume overlays draw nothing in normal play
  const blanked = blankKeys(catalog, missing).filter((k) => blankTexture(scene, k));
  const queued = keys.filter((k) => queueEntry(scene, catalog, catalog.entries.get(k)!));
  const failed: string[] = [];
  const fellBack = new Set<string>();
  return new Promise((resolve) => {
    if (queued.length === 0) {
      resolve({ keys, queued, missing, failed, blanked });
      return;
    }
    const onProgressEv = (v: number) => onProgress?.(v);
    const onError = (file: Phaser.Loader.File) => {
      const e = catalog.entries.get(file.key);
      if (e?.kind === "atlas" && !catalog.flags.charFallback && !fellBack.has(e.key)) {
        fellBack.add(e.key);
        console.warn(`[art] ${e.key}: atlas failed to load; using Kenney's untinted fallback sheet`);
        if (scene.textures.exists(e.key)) scene.textures.remove(e.key);
        scene.load.atlasXML(e.key, catalog.flags.base + e.fallback.image, catalog.flags.base + e.fallback.xml);
        return;
      }
      failed.push(file.key);
      console.warn(`[art] ${file.key}: failed to load (${file.src})`);
    };
    scene.load.on("progress", onProgressEv);
    scene.load.on("loaderror", onError);
    scene.load.once("complete", () => {
      scene.load.off("progress", onProgressEv);
      scene.load.off("loaderror", onError);
      for (const k of queued) {
        const e = catalog.entries.get(k);
        if (e) finalize(scene, catalog, e, fellBack.has(k));
      }
      resolve({ keys, queued, missing, failed: [...new Set(failed.filter((k) => !fellBack.has(k) || !scene.textures.exists(k)))], blanked });
    });
    if (!scene.load.isLoading()) scene.load.start();
  });
}

/** Remove the previous zone's textures that the next zone does not need (after the wipe). Returns the removed keys. */
export function unloadZone(scene: Phaser.Scene, catalog: ArtCatalog, world: WorldOverlay, prevId: string, nextId: string): string[] {
  const removed: string[] = [];
  for (const k of keysToUnload(catalog, world, prevId, nextId)) {
    if (scene.textures.exists(k)) {
      scene.textures.remove(k);
      removed.push(k);
    }
  }
  return removed;
}

/** Design-unit anchors of an asset as {x, y} (PrefabProps.anchorsOf); {} when unknown. */
export function anchorsOf(catalog: ArtCatalog, key: string): Readonly<Record<string, { x: number; y: number }>> {
  const e = catalog.entries.get(key);
  if (!e || e.kind === "atlas") return {};
  return Object.fromEntries(e.anchors.map((a) => [a.name, { x: a.x, y: a.y }]));
}
/** The URL of an asset's file (the DOM host and snapshots draw `<img>` from it; puppets use the rest pose). */
export function assetUrl(catalog: ArtCatalog, key: string): string | null {
  const e = catalog.entries.get(key) ?? fallbackEntryFor(catalog, key);
  if (!e) return null;
  const file = e.kind === "atlas" ? e.image : e.kind === "puppet" ? e.restFile : e.file;
  return catalog.flags.base + file;
}

// ── the host seam (src/game/hosts/expedition/art/zone-loader.ts `ZoneArtLoader`), structurally ──────────────────
export interface AssetInfoView {
  key: string;
  kind: "svg" | "atlas" | "puppet";
  w: number; // design units
  h: number;
  pivot: readonly [number, number];
  anchors: Readonly<Record<string, { x: number; y: number }>>;
  scale: number; // 1 / k: the Image scale that shows the texture at design size
}
export interface RigView {
  key: string;
  texture: string; // frames are pose names (on the Kenney fallback too)
  poses: ReadonlySet<string>;
  anchors(pose: string): AtlasEntry["anchors"][number] | null;
  displayW: number;
  displayH: number;
  scale: number; // sprite scale so a 192 × 256 frame shows at 168 × 224
}
export interface ManifestZoneLoader {
  readonly name: "manifest";
  readonly catalog: ArtCatalog;
  loadZone(scene: Phaser.Scene, world: WorldOverlay, zoneId: string, onProgress?: (fraction: number) => void): Promise<void>;
  unloadZone(scene: Phaser.Scene, world: WorldOverlay, prevZoneId: string, nextZoneId: string): void;
  texture(key: string): string | null;
  info(key: string): AssetInfoView | null;
  rig(key: string): RigView | null;
  resident(): number;
  destroy(scene: Phaser.Scene): void;
  /** the last loadZone result (missing keys are for the host's stand-in painter) */
  readonly last: ZoneLoadResult | null;
}

/** The manifest loader behind the host's ZoneArtLoader interface. Keys it cannot provide return null. */
export function createManifestZoneLoader(catalog: ArtCatalog): ManifestZoneLoader {
  let scene: Phaser.Scene | null = null;
  const owned = new Set<string>();
  const blank = new Set<string>();
  let last: ZoneLoadResult | null = null;
  const resident = (key: string) => scene !== null && scene.textures.exists(key);
  return {
    name: "manifest",
    catalog,
    get last() {
      return last;
    },
    async loadZone(sc, world, zoneId, onProgress) {
      scene = sc;
      last = await loadZone(sc, catalog, world, zoneId, onProgress);
      last.queued.forEach((k) => owned.add(k));
      last.blanked.forEach((k) => {
        owned.add(k);
        blank.add(k);
      });
    },
    unloadZone(sc, world, prev, next) {
      for (const k of unloadZone(sc, catalog, world, prev, next)) owned.delete(k);
    },
    texture(key) {
      return (catalog.entries.has(key) || blank.has(key)) && resident(key) ? key : null;
    },
    info(key) {
      if (blank.has(key) && resident(key)) return { key, kind: "svg", w: 2, h: 2, pivot: [0.5, 0.5], anchors: {}, scale: 1 };
      const e = catalog.entries.get(key);
      if (!e || !resident(key)) return null;
      if (e.kind === "atlas") return { key, kind: "atlas", w: e.displayWidth, h: e.displayHeight, pivot: e.pivot, anchors: {}, scale: e.displayWidth / e.frameWidth };
      return { key, kind: e.kind, w: e.width, h: e.height, pivot: e.pivot, anchors: anchorsOf(catalog, key), scale: 1 / textureK(scene!, key) };
    },
    rig(key) {
      const e = catalog.entries.get(key);
      if (!e || e.kind !== "atlas" || !resident(key)) return null;
      const byPose = new Map(e.anchors.map((a) => [a.pose, a]));
      return { key, texture: key, poses: new Set(e.poses), anchors: (pose) => byPose.get(pose) ?? null, displayW: e.displayWidth, displayH: e.displayHeight, scale: e.displayWidth / e.frameWidth };
    },
    resident() {
      return [...owned].filter((k) => resident(k)).length;
    },
    destroy(sc) {
      for (const k of owned) if (sc.textures.exists(k)) sc.textures.remove(k);
      owned.clear();
      blank.clear();
      scene = null;
    },
  };
}
