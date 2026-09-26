/**
 * art/select-loader.ts (H1) — the zone loader for a world: A1's manifest loader (src/game/art/manifest-loader.ts) for
 * every key a namespace manifest provides, and the STUB loader's kit-coloured stand-ins for the rest (keys no manifest
 * lists yet, or every key when the manifests are unavailable). Both honour per-zone residency (A4, §5.7): the stub only
 * owns (and unloads) what it painted.
 */
import type Phaser from "phaser";
import type { WorldOverlay } from "../../../../contracts/world";
import { assetsForZone } from "../../../../world/residency";
import { createManifestZoneLoader, fetchCatalog, flagsFrom, type ArtCatalog, type ManifestZoneLoader } from "../../../art/manifest-loader";
import { paletteTokensFor } from "../../../art/palette";
import { StubZoneLoader } from "./stub-loader";
import type { AssetInfo, RigInfo, ZoneArtLoader } from "./zone-loader";

export type HostLoader = ZoneArtLoader & { ensure: (scene: Phaser.Scene, key: string) => string; readonly catalog: ArtCatalog | null };

/** Palette tokens: shared first, the biome overriding (A1's palette module). */
export function paletteOf(biome: string): Readonly<Record<string, string>> {
  return paletteTokensFor(biome);
}

export function compositeLoader(manifest: ManifestZoneLoader | null, stub: StubZoneLoader): HostLoader {
  let scene: Phaser.Scene | null = null;
  return {
    name: manifest ? "manifest+stub" : "stub",
    catalog: manifest?.catalog ?? null,
    async loadZone(sc, world, zoneId, onProgress) {
      scene = sc;
      if (manifest) await manifest.loadZone(sc, world, zoneId, (f) => onProgress?.(f * 0.8));
      await stub.loadZone(sc, world, zoneId, (f) => onProgress?.(manifest ? 0.8 + f * 0.2 : f));
      // anything referenced that neither provided (a failed file) gets a stand-in too
      for (const k of assetsForZone(world, zoneId)) if (!sc.textures.exists(k)) stub.ensure(sc, k);
    },
    unloadZone(sc, world, prev, next) {
      manifest?.unloadZone(sc, world, prev, next);
      stub.unloadZone(sc, world, prev, next);
    },
    texture(key) {
      return manifest?.texture(key) ?? stub.texture(key);
    },
    info(key): AssetInfo | null {
      return manifest?.info(key) ?? stub.info(key);
    },
    rig(key): RigInfo | null {
      return manifest?.rig(key) ?? stub.rig(key);
    },
    ensure(sc, key) {
      scene = sc;
      return manifest?.texture(key) ?? stub.ensure(sc, key);
    },
    resident() {
      return (manifest?.resident() ?? 0) + stub.resident();
    },
    destroy(sc) {
      manifest?.destroy(sc);
      stub.destroy(sc ?? scene);
    },
  };
}

export async function selectLoader(world: WorldOverlay): Promise<{ loader: HostLoader; palette: Readonly<Record<string, string>> }> {
  const palette = paletteOf(world.biome);
  const stub = new StubZoneLoader(palette);
  let manifest: ManifestZoneLoader | null = null;
  try {
    const flags = flagsFrom(window.location.search, window.devicePixelRatio || 1);
    const catalog = await fetchCatalog(["shared", world.biome], flags);
    if (catalog.entries.size > 0) manifest = createManifestZoneLoader(catalog);
  } catch (err) {
    console.warn("Expedition: art manifests unavailable; drawing kit stand-ins.", err);
  }
  return { loader: compositeLoader(manifest, stub), palette };
}
