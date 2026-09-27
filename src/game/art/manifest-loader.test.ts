/**
 * src/game/art/manifest-loader.test.ts (A2) — missing art in normal play (the W1a fix list, docs/design/w1a-report.md
 * §5 #2): a referenced companion with no manifest entry resolves to the shared stand-in puppet under its own key; a
 * referenced costume overlay with no entry gets a blank texture (nothing draws) unless `?artdebug=1`; both warn,
 * neither errors. The rest of the loader is covered by tests/world-assets.test.ts.
 */
import fs from "node:fs";
import path from "node:path";
import type Phaser from "phaser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetManifest, WorldFile, type WorldOverlay } from "../../contracts/world";
import { allSkins } from "../../world/library";
import {
  assetUrl,
  blankKeys,
  catalogFrom,
  COMPANION_STANDIN,
  createManifestZoneLoader,
  fallbackEntryFor,
  flagsFrom,
  loadZone,
  registerFallbacks,
  type ArtCatalog,
} from "./manifest-loader";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const manifest = (ns: string) => AssetManifest.parse(JSON.parse(fs.readFileSync(path.join(ROOT, "public/assets/expedition", ns, "manifest.json"), "utf8")));
const shared = manifest("shared");
const trigWorld = (): WorldOverlay => WorldFile.parse(JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/worlds/trig.world.json"), "utf8"))).world;
const catalog = (search = ""): ArtCatalog => catalogFrom([shared, manifest("orrery_terraces")], flagsFrom(search, 1));

/** A world whose companion and costumes are guaranteed to have no manifest entry. */
function worldWithMissingCast(): WorldOverlay {
  const w = structuredClone(trigWorld());
  w.cast.guide.companion.asset = "orrery_terraces.companion.zz_missing_guide";
  w.cast.protagonist.look.costume = [{ ...w.cast.protagonist.look.costume[0], asset: "orrery_terraces.costume.zz_missing_hat" }];
  return w;
}

/** Just enough of Phaser's loader and texture manager (incl. createCanvas) for loadZone. */
function fakeScene() {
  const textures = new Map<string, { frames: Map<string, number[]>; customData: Record<string, unknown>; canvas: boolean }>();
  const handlers = new Map<string, Array<(...a: unknown[]) => void>>();
  const queue: Array<{ key: string; url: string }> = [];
  const on = (ev: string, fn: (...a: unknown[]) => void) => handlers.set(ev, [...(handlers.get(ev) ?? []), fn]);
  const load = {
    svg: (key: string, url: string) => queue.push({ key, url }),
    atlas: (key: string, url: string) => queue.push({ key, url }),
    atlasXML: (key: string, url: string) => queue.push({ key, url }),
    on,
    off: (ev: string, fn: (...a: unknown[]) => void) => handlers.set(ev, (handlers.get(ev) ?? []).filter((f) => f !== fn)),
    once: (ev: string, fn: (...a: unknown[]) => void) => on(ev, fn),
    isLoading: () => false,
    start: () => {
      while (queue.length) {
        const c = queue.shift()!;
        textures.set(c.key, { frames: new Map(), customData: { url: c.url }, canvas: false });
      }
      for (const fn of handlers.get("complete") ?? []) fn();
    },
  };
  const tm = {
    exists: (k: string) => textures.has(k),
    createCanvas: (k: string) => {
      textures.set(k, { frames: new Map(), customData: {}, canvas: true });
      return { refresh: () => undefined };
    },
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
  return { scene: { load, textures: tm } as unknown as Phaser.Scene, textures };
}

describe("missing cast art resolves to kit fallbacks, never a debug disc", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fallbackEntryFor re-keys the shared stand-in puppet for a missing companion only", () => {
    const cat = catalog();
    const e = fallbackEntryFor(cat, "orrery_terraces.companion.zz_missing_guide");
    expect(e?.kind).toBe("puppet");
    expect(e?.key).toBe("orrery_terraces.companion.zz_missing_guide");
    if (e?.kind === "puppet") expect(e.file).toBe((cat.entries.get(COMPANION_STANDIN) as { file: string }).file);
    expect(fallbackEntryFor(cat, COMPANION_STANDIN)).toBeNull(); // present keys resolve to themselves
    expect(fallbackEntryFor(cat, "orrery_terraces.npc.zz_missing")).toBeNull();
    expect(fallbackEntryFor(cat, "orrery_terraces.costume.zz_missing_hat")).toBeNull();
    // without the stand-in there is nothing to fall back to
    const bare = catalogFrom([manifest("orrery_terraces")], flagsFrom("", 1));
    expect(fallbackEntryFor(bare, "orrery_terraces.companion.zz_missing_guide")).toBeNull();
    // the DOM host's <img> URL follows the same fallback (the stand-in's rest pose)
    expect(assetUrl(cat, "orrery_terraces.companion.zz_missing_guide")).toMatch(/guide_standin\.rest\.svg$/);
  });

  it("registerFallbacks adds each missing companion once, with one [art] warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const cat = catalog();
    const keys = ["orrery_terraces.companion.zz_missing_guide", "orrery_terraces.costume.zz_missing_hat", "shared.char.wren"];
    expect(registerFallbacks(cat, keys)).toEqual(["orrery_terraces.companion.zz_missing_guide"]);
    expect(registerFallbacks(cat, keys)).toEqual([]);
    expect(cat.entries.get("orrery_terraces.companion.zz_missing_guide")?.kind).toBe("puppet");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[art\]/);
  });

  it("blankKeys picks missing costume overlays, and none under ?artdebug=1", () => {
    const keys = ["orrery_terraces.costume.zz_missing_hat", "orrery_terraces.prop.zz_missing", "shared.char.wren"];
    expect(blankKeys(catalog(), keys)).toEqual(["orrery_terraces.costume.zz_missing_hat"]);
    expect(blankKeys(catalog("?artdebug=1"), keys)).toEqual([]);
    expect(flagsFrom("?artdebug=1", 1).artDebug).toBe(true);
    expect(flagsFrom("", 1).artDebug).toBe(false);
  });

  it("loadZone loads the stand-in sheet under the companion's key and blanks missing costumes before any stand-in can paint", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error");
    const { scene, textures } = fakeScene();
    const cat = catalog();
    const world = worldWithMissingCast();
    const res = await loadZone(scene, cat, world, world.zones[0].id);
    const guide = "orrery_terraces.companion.zz_missing_guide";
    expect(res.queued).toContain(guide);
    expect(String(textures.get(guide)?.customData.url)).toMatch(/guide_standin\.svg$/);
    const standin = cat.entries.get(COMPANION_STANDIN);
    if (standin?.kind !== "puppet") throw new Error("no stand-in puppet");
    expect([...textures.get(guide)!.frames.keys()].sort()).toEqual(standin.parts.flatMap((p) => Array.from({ length: p.frames }, (_, i) => `${p.name}#${i}`)).sort());
    expect(res.missing).not.toContain(guide);
    expect(res.blanked).toEqual(["orrery_terraces.costume.zz_missing_hat"]);
    expect(textures.get("orrery_terraces.costume.zz_missing_hat")?.canvas).toBe(true);
    expect(err).not.toHaveBeenCalled();
    expect(warn.mock.calls.every((c) => String(c[0]).startsWith("[art]"))).toBe(true);
  });

  it("?artdebug=1 leaves missing costumes to the host's stand-ins", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { scene, textures } = fakeScene();
    const world = worldWithMissingCast();
    const res = await loadZone(scene, catalog("?artdebug=1"), world, world.zones[0].id);
    expect(res.blanked).toEqual([]);
    expect(textures.has("orrery_terraces.costume.zz_missing_hat")).toBe(false);
  });

  it("the host seam answers texture/info for blanked keys and removes them on destroy", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { scene, textures } = fakeScene();
    const loader = createManifestZoneLoader(catalog());
    const world = worldWithMissingCast();
    await loader.loadZone(scene, world, world.zones[0].id);
    const hat = "orrery_terraces.costume.zz_missing_hat";
    expect(loader.texture(hat)).toBe(hat);
    expect(loader.info(hat)).toMatchObject({ w: 2, h: 2, scale: 1 });
    expect(loader.info("orrery_terraces.companion.zz_missing_guide")).toMatchObject({ kind: "puppet", w: 72, h: 72 });
    loader.destroy(scene);
    expect(textures.has(hat)).toBe(false);
    expect(textures.size).toBe(0);
  });
});

describe("kit coverage (A2): no station part or zone layer ever falls through to a debug texture", () => {
  const biomes = ["orrery_terraces", "living_gate", "archive_of_voices"] as const;
  const all = catalogFrom([shared, ...biomes.map(manifest)], flagsFrom("", 1));

  it("every part slot and console of every skin has a manifest entry (its kit stand-in at least)", () => {
    const missing = allSkins().flatMap(({ skin }) => [...skin.parts.map((p) => p.asset), skin.console]).filter((k) => !all.entries.has(k));
    expect([...new Set(missing)]).toEqual([]);
  });

  it.each([
    ["trig.world.json"],
    ["cell-transport.world.json"],
    ["civil-rights.world.json"],
  ])("%s: every zone shows at least 5 parallax layers with art, and its ground strip exists", (file) => {
    const w = WorldFile.parse(JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/worlds", file), "utf8"))).world;
    for (const z of w.zones) {
      const layers = new Set(z.layerSets.flatMap((ls) => ls.layers.map((l) => l.asset)).filter((k) => all.entries.has(k)));
      expect(layers.size, z.id).toBeGreaterThanOrEqual(5);
      expect(all.entries.has(z.ground.surface), `${z.id} ${z.ground.surface}`).toBe(true);
    }
  });

  it("the default kit zone presets of every biome (BIOME_KITS zonePresets) are built and tagged off-zone", async () => {
    const { BIOME_KITS } = await import("../../world/biomes");
    for (const kit of Object.values(BIOME_KITS)) {
      for (const preset of kit.zonePresets) {
        const keys = [...preset.layerSet.layers.map((l) => l.asset), preset.ground.surface, preset.ground.underside].filter((k): k is string => typeof k === "string");
        for (const k of keys) {
          const e = all.entries.get(k);
          expect(e, k).toBeDefined();
          // presets are resident only when a world references them, never in a showcase zone's VRAM
          expect(e?.zone, k).toBe("kit");
        }
      }
    }
  });
});
