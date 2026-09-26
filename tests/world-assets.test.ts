/**
 * tests/world-assets.test.ts — the committed art against its contracts (docs/design/20 §5.1, §5.7, §5.8).
 * Manifests parse and match their files (sha1) and the generated asset index; heroCount ≤ 40; per-zone residency VRAM
 * and every adjacent swap pair within budget on the three side-cars; `assetsForZone` on the side-cars; the loader's
 * pure helpers and `loadZone` / `unloadZone` against a fake Phaser scene (incl. the atlasXML fallback with a
 * console.warn, never an error).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type Phaser from "phaser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetManifest, WorldFile, type ManifestEntry, type WorldOverlay } from "../src/contracts/world";
import { ASSET_INDEX, ASSET_INDEX_BY_NAMESPACE } from "../src/world/asset-index";
import { assetsForZone } from "../src/world/residency";
import {
  anchorsOf,
  assetUrl,
  atlasFrame,
  catalogFrom,
  flagsFrom,
  isFallbackAtlas,
  keysToUnload,
  loadZone,
  missingKeys,
  rasterFactorOf,
  textureK,
  textureSize,
  unloadZone,
  zoneKeys,
  type ArtCatalog,
} from "../src/game/art/manifest-loader";
import { BUDGETS, ceil4, MB, rasterFactor, textureBytes } from "../scripts/art/vram";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUB = path.join(ROOT, "public/assets/expedition");
const NAMESPACES = ["shared", "orrery_terraces", "living_gate", "archive_of_voices"] as const;
const manifests = Object.fromEntries(
  NAMESPACES.map((ns) => [ns, AssetManifest.parse(JSON.parse(fs.readFileSync(path.join(PUB, ns, "manifest.json"), "utf8")))]),
) as Record<(typeof NAMESPACES)[number], AssetManifest>;
const SIDECARS = { orrery_terraces: "trig.world.json", living_gate: "cell-transport.world.json", archive_of_voices: "civil-rights.world.json" } as const;
const worlds = Object.fromEntries(
  Object.entries(SIDECARS).map(([ns, f]) => [ns, WorldFile.parse(JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/worlds", f), "utf8"))).world]),
) as Record<keyof typeof SIDECARS, WorldOverlay>;
const sha1 = (b: Buffer) => crypto.createHash("sha1").update(b).digest("hex");

describe("committed manifests", () => {
  it.each(NAMESPACES.map((n) => [n]))("%s: parses, names its namespace, files exist with matching sha1, heroCount ≤ 40", (ns) => {
    const m = manifests[ns];
    expect(m.namespace).toBe(ns);
    expect(m.heroCount).toBeLessThanOrEqual(m.heroCap);
    expect(m.heroCap).toBeLessThanOrEqual(40);
    const keys = m.entries.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of m.entries) {
      expect(e.key.startsWith(`${ns}.`), e.key).toBe(true);
      if (e.kind === "svg") {
        const buf = fs.readFileSync(path.join(PUB, e.file));
        expect(sha1(buf), e.key).toBe(e.sha1);
        expect(buf.toString("utf8")).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="/);
      } else if (e.kind === "puppet") {
        expect(sha1(fs.readFileSync(path.join(PUB, e.file))), e.key).toBe(e.sha1);
        expect(fs.existsSync(path.join(PUB, e.restFile)), e.restFile).toBe(true);
        expect(e.parts.length).toBeLessThanOrEqual(8);
        expect(e.anims.map((a) => a.id)).toContain("idle");
      } else {
        expect(sha1(fs.readFileSync(path.join(PUB, e.image))), e.key).toBe(e.sha1);
        expect(fs.existsSync(path.join(PUB, e.frames))).toBe(true);
      }
    }
    expect(fs.existsSync(path.join(PUB, ns, "License.txt"))).toBe(true);
  });

  it("the generated asset index mirrors the manifests", () => {
    for (const ns of NAMESPACES) {
      const idx = ASSET_INDEX_BY_NAMESPACE[ns];
      expect(Object.keys(idx).sort(), ns).toEqual(manifests[ns].entries.map((e) => e.key).sort());
      for (const e of manifests[ns].entries) {
        const i = idx[e.key];
        expect(i.kind).toBe(e.kind);
        expect(i.ns).toBe(ns);
        expect(i.zone).toBe(e.zone);
        expect(i.source).toBe(e.source);
        if (e.kind === "atlas") {
          expect([i.width, i.height]).toEqual([e.displayWidth, e.displayHeight]);
          expect(i.poses).toEqual(e.poses);
        } else {
          expect([i.width, i.height]).toEqual([e.width, e.height]);
          expect(Object.keys(i.anchors).sort()).toEqual(e.anchors.map((a) => a.name).sort());
        }
        if (e.kind === "puppet") expect(i.anims).toEqual(e.anims.map((a) => a.id));
      }
    }
    expect(Object.keys(ASSET_INDEX).length).toBe(NAMESPACES.reduce((s, ns) => s + manifests[ns].entries.length, 0));
  });

  it("ships the stand-in companion puppet with idle, talk and cue", () => {
    const e = manifests.shared.entries.find((x) => x.key === "shared.companion.guide_standin");
    expect(e?.kind).toBe("puppet");
    if (e?.kind === "puppet") {
      expect(e.anims.map((a) => a.id)).toEqual(["idle", "talk", "cue"]);
      expect(e.parts.map((p) => p.name).sort()).toEqual(["belly_gears", "body", "eye_glow", "feet", "head", "key", "wing_l", "wing_r"]);
      expect(e.rasterScale).toBe(1.5);
    }
  });
});

// ── residency and VRAM ───────────────────────────────────────────────────────────────────────────────────────
const flags = flagsFrom("", 2);
function catalogFor(ns: keyof typeof SIDECARS): ArtCatalog {
  return catalogFrom([manifests.shared, manifests[ns]], flags);
}
function residentMb(cat: ArtCatalog, keys: readonly string[]): number {
  return keys.reduce((s, k) => s + textureBytes(cat.entries.get(k)!, 1.5), 0) / MB;
}

describe("residency on the three side-cars", () => {
  it.each(Object.keys(SIDECARS).map((n) => [n]))("%s: assetsForZone covers the cast and every zone's layers; unknown zones are empty", (ns) => {
    const world = worlds[ns as keyof typeof SIDECARS];
    expect(world.zones.length).toBeGreaterThan(0);
    for (const z of world.zones) {
      const keys = assetsForZone(world, z.id);
      expect(keys, z.id).toContain(world.cast.protagonist.look.atlas);
      expect(keys).toContain(world.cast.guide.companion.asset);
      expect(keys).toContain(z.ground.surface);
      for (const ls of z.layerSets) for (const l of ls.layers) expect(keys).toContain(l.asset);
      expect([...keys].sort()).toEqual(keys);
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(assetsForZone(world, "no_such_zone")).toEqual([]);
  });

  it.each(Object.keys(SIDECARS).map((n) => [n]))("%s: resident VRAM per zone and per adjacent swap pair within 20 §5.8", (ns) => {
    const key = ns as keyof typeof SIDECARS;
    const world = worlds[key];
    const cat = catalogFor(key);
    const cap = BUDGETS.zoneMb[ns];
    const zones = world.zones.map((z) => z.id);
    for (let i = 0; i < zones.length; i++) {
      const here = zoneKeys(cat, world, zones[i]);
      expect(residentMb(cat, here), `${ns} ${zones[i]}`).toBeLessThanOrEqual(cap);
      if (i + 1 < zones.length) {
        const pair = [...new Set([...here, ...zoneKeys(cat, world, zones[i + 1])])];
        expect(residentMb(cat, pair), `${ns} ${zones[i]}+${zones[i + 1]}`).toBeLessThanOrEqual(BUDGETS.swapPeakMb);
      }
    }
    expect(manifests[key].swapPeakMb).toBeLessThanOrEqual(BUDGETS.swapPeakMb);
  });

  it("loads only the characters a world references (civil never loads Wren; trig never loads Otis)", () => {
    const trig = zoneKeys(catalogFor("orrery_terraces"), worlds.orrery_terraces, worlds.orrery_terraces.zones[0].id);
    expect(trig).toContain("shared.char.wren");
    expect(trig).not.toContain("shared.char.otis");
    expect(trig).not.toContain("shared.char.nell");
    const civil = zoneKeys(catalogFor("archive_of_voices"), worlds.archive_of_voices, worlds.archive_of_voices.zones[0].id);
    expect(civil).toContain("shared.char.nell");
    expect(civil).not.toContain("shared.char.wren");
    // the stand-in companion is on-demand too: only a world that references it loads it
    expect(civil).not.toContain("shared.companion.guide_standin");
  });
});

// ── the loader ───────────────────────────────────────────────────────────────────────────────────────────────
describe("manifest-loader pure helpers", () => {
  it("k = ceil4(rasterScale × min(dpr, 1.5)); ?lowres=1 caps dpr at 1; atlases are 192/168", () => {
    expect(ceil4(0.75 * 1.5)).toBe(1.25);
    expect(rasterFactor(1.5, 2)).toBe(2.25);
    expect(rasterFactor(0.5, 1)).toBe(0.5);
    const e = manifests.shared.entries.find((x) => x.kind === "puppet")!;
    expect(rasterFactorOf(catalogFrom([manifests.shared], flagsFrom("", 3)), e)).toBe(2.25);
    expect(rasterFactorOf(catalogFrom([manifests.shared], flagsFrom("?lowres=1", 3)), e)).toBe(1.5);
    const atlas = manifests.shared.entries.find((x) => x.kind === "atlas")!;
    expect(rasterFactorOf(catalogFrom([manifests.shared], flags), atlas)).toBeCloseTo(192 / 168, 6);
    expect(flagsFrom("?charfallback=1&lowres=1", 2)).toMatchObject({ charFallback: true, lowres: true, dpr: 2 });
  });
  it("sizes puppet sheets from their part boxes and names part frames part#i", () => {
    const cat = catalogFrom([manifests.shared], flags);
    const e = manifests.shared.entries.find((x) => x.kind === "puppet");
    if (e?.kind !== "puppet") throw new Error("no puppet");
    const { width, height, k } = textureSize(cat, e);
    const w = Math.max(...e.parts.map((p) => p.box[0] + p.box[2] * p.frames));
    expect(width).toBe(Math.round(w * k));
    expect(height).toBeGreaterThan(0);
    expect(assetUrl(cat, e.key)).toBe(`/assets/expedition/${e.restFile}`);
    expect(anchorsOf(cat, "shared.char.wren")).toEqual({});
  });
  it("maps poses to the Kenney XML names only on the fallback sheet", () => {
    const cat = catalogFrom([manifests.shared], flags);
    expect(atlasFrame(cat, "shared.char.wren", "walk3", false)).toBe("walk3");
    expect(atlasFrame(cat, "shared.char.wren", "walk3", true)).toBe("walk3");
    expect(atlasFrame(cat, "shared.char.ida", "cheer0", true)).toBe("cheer0");
  });
  it("unloads the previous zone's non-shared keys only; reports referenced keys with no manifest", () => {
    const world = worlds.orrery_terraces;
    const cat = catalogFor("orrery_terraces");
    const [a, b] = world.zones.map((z) => z.id);
    for (const k of keysToUnload(cat, world, a, b)) expect(cat.entries.get(k)?.zone).not.toBe("all");
    expect(missingKeys(cat, world, a).every((k) => !cat.entries.has(k))).toBe(true);
  });
});

// A fake Phaser scene: enough of LoaderPlugin and TextureManager for loadZone / unloadZone.
interface FakeTex {
  frames: Map<string, number[]>;
  customData: Record<string, unknown>;
}
function fakeScene(opts: { failAtlas?: boolean } = {}) {
  const textures = new Map<string, FakeTex>();
  const calls: Array<{ type: string; key: string; url: string; cfg?: unknown }> = [];
  const handlers = new Map<string, Array<(...a: unknown[]) => void>>();
  const queue: typeof calls = [];
  const on = (ev: string, fn: (...a: unknown[]) => void) => handlers.set(ev, [...(handlers.get(ev) ?? []), fn]);
  const emit = (ev: string, ...a: unknown[]) => [...(handlers.get(ev) ?? [])].forEach((fn) => fn(...a));
  const push = (type: string) => (key: string, url: string, cfg?: unknown) => {
    const c = { type, key, url, cfg };
    calls.push(c);
    queue.push(c);
  };
  const load = {
    svg: push("svg"),
    atlas: push("atlas"),
    atlasXML: push("atlasXML"),
    on: (ev: string, fn: (...a: unknown[]) => void) => on(ev, fn),
    off: (ev: string, fn: (...a: unknown[]) => void) => handlers.set(ev, (handlers.get(ev) ?? []).filter((f) => f !== fn)),
    once: (ev: string, fn: (...a: unknown[]) => void) => {
      const w = (...a: unknown[]) => {
        load.off(ev, w);
        fn(...a);
      };
      on(ev, w);
    },
    isLoading: () => false,
    start: () => {
      while (queue.length) {
        const c = queue.shift()!;
        if (opts.failAtlas && c.type === "atlas") emit("loaderror", { key: c.key, src: c.url });
        else textures.set(c.key, { frames: new Map(), customData: {} });
        emit("progress", calls.length ? 1 - queue.length / calls.length : 1);
      }
      emit("complete");
    },
  };
  const tm = {
    exists: (k: string) => textures.has(k),
    get: (k: string) => {
      const t = textures.get(k)!;
      return {
        get customData() {
          return t.customData;
        },
        set customData(v: Record<string, unknown>) {
          t.customData = v;
        },
        has: (n: string) => t.frames.has(n),
        add: (n: string, _s: number, x: number, y: number, w: number, h: number) => t.frames.set(n, [x, y, w, h]),
      };
    },
    remove: (k: string) => textures.delete(k),
  };
  return { scene: { load, textures: tm } as unknown as Phaser.Scene, calls, textures };
}

/** A small synthetic world: one zone that references the stand-in companion and Wren. */
function tinyWorld(): WorldOverlay {
  const w = structuredClone(worlds.orrery_terraces);
  w.cast.guide.companion.asset = "shared.companion.guide_standin";
  return w;
}

describe("loadZone / unloadZone against a fake scene", () => {
  afterEach(() => vi.restoreAllMocks());
  it("queues svg at design × k, atlases by PNG + JSON, puppets as one sheet + Texture.add per part frame", async () => {
    const { scene, calls, textures } = fakeScene();
    const cat = catalogFrom([manifests.shared, manifests.orrery_terraces], flagsFrom("", 2));
    const world = tinyWorld();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error");
    const progress: number[] = [];
    const res = await loadZone(scene, cat, world, world.zones[0].id, (v) => progress.push(v));
    expect(res.queued).toContain("shared.char.wren");
    expect(res.queued).toContain("shared.companion.guide_standin");
    expect(calls.find((c) => c.key === "shared.char.wren")).toMatchObject({ type: "atlas", url: "/assets/expedition/shared/char/wren.png" });
    const pup = manifests.shared.entries.find((e) => e.key === "shared.companion.guide_standin") as Extract<ManifestEntry, { kind: "puppet" }>;
    const size = textureSize(cat, pup);
    expect(calls.find((c) => c.key === pup.key)?.cfg).toEqual({ width: size.width, height: size.height });
    const tex = textures.get(pup.key)!;
    expect([...tex.frames.keys()].sort()).toEqual(pup.parts.flatMap((p) => Array.from({ length: p.frames }, (_, i) => `${p.name}#${i}`)).sort());
    expect(textureK(scene, pup.key)).toBe(2.25);
    expect(progress.length).toBeGreaterThan(0);
    expect(err).not.toHaveBeenCalled();
    expect(warn.mock.calls.every((c) => String(c[0]).startsWith("[art]"))).toBe(true);
    // a second load of the same zone queues nothing
    expect((await loadZone(scene, cat, world, world.zones[0].id)).queued).toEqual([]);
  });

  it("falls back to Kenney's untinted sheet via load.atlasXML with a console.warn when an atlas fails", async () => {
    const { scene, calls } = fakeScene({ failAtlas: true });
    const cat = catalogFrom([manifests.shared, manifests.orrery_terraces], flagsFrom("", 1));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error");
    const world = tinyWorld();
    const res = await loadZone(scene, cat, world, world.zones[0].id);
    const xml = calls.find((c) => c.type === "atlasXML" && c.key === "shared.char.wren");
    expect(xml?.url).toBe("/assets/expedition/shared/char/kenney/character_femaleAdventurer_sheetHD.png");
    expect(res.failed).not.toContain("shared.char.wren");
    expect(isFallbackAtlas(scene, "shared.char.wren")).toBe(true);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("fallback"))).toBe(true);
    expect(err).not.toHaveBeenCalled();
  });

  it("?charfallback=1 loads the Kenney sheet directly", async () => {
    const { scene, calls } = fakeScene();
    const cat = catalogFrom([manifests.shared, manifests.orrery_terraces], flagsFrom("?charfallback=1", 1));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const world = tinyWorld();
    await loadZone(scene, cat, world, world.zones[0].id);
    expect(calls.filter((c) => c.key === "shared.char.wren").map((c) => c.type)).toEqual(["atlasXML"]);
    expect(isFallbackAtlas(scene, "shared.char.wren")).toBe(true);
  });

  it("unloadZone removes only what the next zone does not need (never 'all' entries)", async () => {
    const { scene, textures } = fakeScene();
    const cat = catalogFrom([manifests.shared, manifests.orrery_terraces], flagsFrom("", 1));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const world = tinyWorld();
    const [a, b] = world.zones.map((z) => z.id);
    await loadZone(scene, cat, world, a);
    const removed = unloadZone(scene, cat, world, a, b);
    for (const k of removed) {
      expect(textures.has(k)).toBe(false);
      expect(cat.entries.get(k)?.zone).not.toBe("all");
    }
    expect(textures.has("shared.char.wren")).toBe(true);
  });
});

describe("createManifestZoneLoader (the host's ZoneArtLoader seam)", () => {
  afterEach(() => vi.restoreAllMocks());
  it("answers texture / info / rig for resident keys and null otherwise; destroy removes what it loaded", async () => {
    const { createManifestZoneLoader } = await import("../src/game/art/manifest-loader");
    const { scene, textures } = fakeScene();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const loader = createManifestZoneLoader(catalogFrom([manifests.shared, manifests.orrery_terraces], flagsFrom("", 1)));
    const world = tinyWorld();
    expect(loader.texture("shared.char.wren")).toBeNull();
    await loader.loadZone(scene, world, world.zones[0].id);
    expect(loader.texture("shared.char.wren")).toBe("shared.char.wren");
    expect(loader.texture("orrery_terraces.layer.nope")).toBeNull();
    const rig = loader.rig("shared.char.wren")!;
    expect(rig.poses.has("walk3")).toBe(true);
    expect(rig.anchors("idle")?.points).toHaveLength(7);
    expect(rig.scale).toBeCloseTo(0.875, 6);
    const pup = loader.info("shared.companion.guide_standin")!;
    expect(pup).toMatchObject({ kind: "puppet", w: 72, h: 72, scale: 1 / 1.5 });
    expect(loader.resident()).toBeGreaterThanOrEqual(2);
    expect(loader.last?.missing.length).toBeGreaterThan(0);
    loader.destroy(scene);
    expect(textures.size).toBe(0);
  });
});
