import { describe, expect, it } from "vitest";
import { SCATTER_KINDS, type ScatterKind } from "../src/contracts/world3d";
import { BIOMES } from "../src/world3d/core/biomes";
import { SCATTER } from "../src/world3d/core/catalog";
import { composeWorld } from "../src/world3d/core/compose";
import { makeHeightfield } from "../src/world3d/core/heightfield";
import { lightRig, sunDirection } from "../src/world3d/core/moods";
import { NILE_SAMPLE } from "../src/world3d/core/samples";
import { albedoTint } from "../src/world3d/kit/materials/textures";
import { QUALITY, qualityFromGpu } from "../src/world3d/kit/quality";
import { applyCalibration, calibrateSky, calibratedHorizon, luminance, skyIrradiance, skyRadiance } from "../src/world3d/kit/sky/preetham";
import { bakeSunVisibility, horizonField, horizonRing, occluderTop, perimeterCells, riverFlow, terrainMasks, tileableNoise } from "../src/world3d/kit/terrain/bake";
import { splatLayers, splatWeights } from "../src/world3d/kit/terrain/splat";
import { CELLS } from "../src/world3d/kit/vegetation/atlas";
import { CHUNK_SIZE, chunkBatch, instanceTint, positionHash, thinning } from "../src/world3d/kit/vegetation/chunks";
import { buildSpecies, VARIANTS } from "../src/world3d/kit/vegetation/geometry";

/*
 * Pure helpers of the 3D kit's environment half (src/world3d/kit): quality tiers, the terrain splat rules, the CPU bakes
 * (masks, sun visibility, horizon ring, noise, river flow), the sky calibration, instancing chunks and the procedural
 * vegetation. Rendering itself is checked visually (/dev/kit3d + pnpm world3d:shot).
 */

const flat = (res: number, size: number, h = 0, level: number | null = null) => makeHeightfield(size, res, new Float32Array(res * res).fill(h), level);

describe("quality tiers", () => {
  it("scale monotonically from low to high", () => {
    const [l, m, h] = [QUALITY.low, QUALITY.medium, QUALITY.high];
    expect(l.shadowMapSize).toBeLessThanOrEqual(m.shadowMapSize);
    expect(m.shadowMapSize).toBeLessThanOrEqual(h.shadowMapSize);
    expect(l.grassDensity).toBeLessThanOrEqual(m.grassDensity);
    expect(m.grassDensity).toBeLessThanOrEqual(h.grassDensity);
    expect(l.dpr[1]).toBeLessThanOrEqual(h.dpr[1]);
    expect(l.post).toBe("none");
    expect(h.post).toBe("full");
    expect(l.textures).toBe(false);
  });

  it("picks a tier from GPU hints", () => {
    expect(qualityFromGpu({ renderer: "Google SwiftShader" })).toBe("low");
    expect(qualityFromGpu({ renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)" })).toBe("high");
    expect(qualityFromGpu({ renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU Direct3D11 vs_5_0 ps_5_0)" })).toBe("high");
    expect(qualityFromGpu({ renderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)" })).toBe("medium");
    expect(qualityFromGpu({ renderer: "Mali-G52", mobile: true })).toBe("low");
    expect(qualityFromGpu({ renderer: "something new" })).toBe("medium");
  });
});

describe("terrain splat", () => {
  it("dedupes textures into array layers and maps every slot", () => {
    const l = splatLayers("lunar");
    expect(new Set(l.textures).size).toBe(l.textures.length);
    expect(l.layerOf).toHaveLength(8);
    l.layerOf.forEach((layer, slot) => expect(l.textures[layer]).toBe(l.textureOf[slot]));
    // lunar shares regolith across shore/low/high/peak
    expect(l.textures.length).toBeLessThan(8);
  });

  const params = { hasWater: true, highLine: BIOMES.desert.highLine, peakLine: BIOMES.desert.peakLine };
  const base = { rel: 20, slope: 0, path: 0, field: 0, stone: 0, n1: 0, n2: 0 };

  it("weights always sum to one", () => {
    for (const rel of [-2, 0.5, 3, 8, 60, 120]) {
      for (const slope of [0, 0.2, 0.5]) {
        const w = splatWeights({ ...base, rel, slope, path: 0.5, n1: 0.3, n2: -0.2 }, params);
        expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
        w.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
      }
    }
  });

  it("puts shore at the waterline, cliff on steep ground, path on the path mask", () => {
    expect(splatWeights({ ...base, rel: 0.2 }, params)[0]).toBeGreaterThan(0.9);
    expect(splatWeights({ ...base, rel: 4, slope: 0.45 }, params)[3]).toBeGreaterThan(0.9);
    expect(splatWeights({ ...base, rel: 4, path: 1 }, params)[5]).toBeGreaterThan(0.9);
    expect(splatWeights({ ...base, rel: 4, path: 1, stone: 1 }, params)[7]).toBeGreaterThan(0.9);
    expect(splatWeights({ ...base, rel: 4, field: 1 }, params)[6]).toBeGreaterThan(0.9);
    expect(splatWeights({ ...base, rel: 4 }, { ...params, hasWater: false })[0]).toBe(0);
  });
});

describe("terrain bakes", () => {
  it("masks match the heightfield grid and carry the composed paths", () => {
    const c = composeWorld(NILE_SAMPLE, { skipScatter: true });
    const m = terrainMasks(c);
    expect(m.length).toBe(c.hf.res * c.hf.res * 4);
    let path = 0;
    let stone = 0;
    for (let i = 0; i < c.hf.res * c.hf.res; i++) {
      if (m[i * 4] > 128) path++;
      if (m[i * 4 + 2] > 128) stone++;
    }
    expect(path).toBeGreaterThan(50);
    expect(stone).toBeGreaterThan(10);
    expect(stone).toBeLessThanOrEqual(path + 200);
  });

  it("shadows the far side of a tall occluder and not the sunny side", () => {
    const hf = flat(101, 200);
    const sun = { x: 1, y: 0.3, z: 0 }; // low sun in the east
    const len = Math.hypot(sun.x, sun.y);
    const dir = { x: sun.x / len, y: sun.y / len, z: 0 };
    const vis = bakeSunVisibility(hf, dir, [{ kind: "tower", x: 0, y: 0, z: 0, rotation: 0, radius: 4, height: 30 }]);
    const at = (x: number, z: number) => vis[Math.round((z + 100) / 2) * 101 + Math.round((x + 100) / 2)];
    expect(at(-30, 0)).toBeLessThan(40); // west of the tower: in its shadow
    expect(at(30, 0)).toBe(255); // east: lit
    expect(at(-30, 40)).toBe(255); // off to the side: lit
    const night = bakeSunVisibility(hf, { x: 0, y: -1, z: 0 }, []);
    expect(night[0]).toBeLessThan(255);
  });

  it("gives pyramids a pyramid-shaped silhouette", () => {
    const o = { kind: "pyramid" as const, x: 0, y: 5, z: 0, rotation: 0, radius: 50, height: 60 };
    expect(occluderTop(o, 0, 0)).toBeCloseTo(65);
    expect(occluderTop(o, 25, 0)).toBeCloseTo(35);
    expect(occluderTop(o, 60, 0)).toBe(-Infinity);
  });

  it("builds a seamless horizon ring whose inner ring is the map edge", () => {
    const c = composeWorld(NILE_SAMPLE, { skipScatter: true });
    const ring = horizonRing(c.hf, "desert", 1, 1800, 10);
    const cells = perimeterCells(c.hf.res);
    expect(cells.length).toBe(4 * (c.hf.res - 1));
    expect(ring.perimeter).toBe(cells.length);
    cells.forEach(([ix, iz], j) => {
      expect(ring.positions[j * 3 + 1]).toBeCloseTo(c.hf.heights[iz * c.hf.res + ix], 4);
    });
    for (let i = 0; i < ring.positions.length; i++) expect(Number.isFinite(ring.positions[i])).toBe(true);
    expect(ring.indices.length).toBe(10 * cells.length * 6);
    // the height function agrees with the map inside it and stays finite far out
    const field = horizonField(c.hf, "desert", 1, 1800);
    expect(field.heightAt(10, 20)).toBeCloseTo(c.hf.height(10, 20), 5);
    expect(Number.isFinite(field.heightAt(1500, -1700))).toBe(true);
  });

  it("makes deterministic, tileable noise", () => {
    const a = tileableNoise(64, 3);
    const b = tileableNoise(64, 3);
    expect(a).toEqual(b);
    // opposite edges continue each other (small jump across the wrap, like any neighbouring pair)
    let wrapJump = 0;
    let innerJump = 0;
    for (let y = 0; y < 64; y++) {
      wrapJump += Math.abs(a[(y * 64 + 63) * 4] - a[(y * 64) * 4]);
      innerJump += Math.abs(a[(y * 64 + 31) * 4] - a[(y * 64 + 32) * 4]);
    }
    expect(wrapJump).toBeLessThan(innerJump * 3 + 64 * 8);
  });

  it("points the river flow along the river", () => {
    const c = composeWorld(NILE_SAMPLE, { skipScatter: true });
    const f = riverFlow(c.hf);
    // the Nile sample runs north→south along the east: flow z component clearly non-zero somewhere mid-channel
    let strong = 0;
    for (let i = 0; i < f.length; i += 2) if (Math.abs(f[i + 1] - 128) > 80) strong++;
    expect(strong).toBeGreaterThan(20);
  });
});

describe("sky calibration", () => {
  const rig = lightRig("golden_hour", "haze", "desert", 0.35);
  const s = sunDirection(rig);
  const sun: [number, number, number] = [s.x, s.y, s.z];

  it("maps the zenith onto the target and preserves hue", () => {
    const cal = calibrateSky(sun, rig.sky, rig.sun.intensity);
    const zen = skyRadiance([0, 1, 0], sun, rig.sky);
    const out = applyCalibration(zen, cal);
    expect(luminance(out)).toBeCloseTo(cal.target, 5);
    expect(out[2] / out[0]).toBeCloseTo(zen[2] / zen[0], 5);
  });

  it("compresses the raw horizon/zenith range", () => {
    const cal = calibrateSky(sun, rig.sky, rig.sun.intensity);
    const rawRatio = luminance(skyRadiance([0.99, 0.05, 0].map((v, i, a) => v / Math.hypot(...a)) as [number, number, number], sun, rig.sky)) / cal.ref;
    const hor = calibratedHorizon(sun, rig.sky, cal);
    expect(luminance(hor) / cal.target).toBeLessThan(rawRatio);
    expect(skyIrradiance(sun, rig.sky, cal)).toBeGreaterThan(0);
  });
});

describe("materials", () => {
  it("moves a photo's average albedo onto the palette colour", () => {
    expect(albedoTint("#808080", "#808080")).toEqual([1, 1, 1].map((v) => expect.closeTo(v, 5)));
    const [r, , b] = albedoTint("#c08040", "#808080", 1);
    expect(r).toBeGreaterThan(1);
    expect(b).toBeLessThan(1);
    expect(albedoTint("#ffffff", "#000000", 1, 3.2)[0]).toBeLessThanOrEqual(3.2);
    expect(albedoTint("#123456", null)).toEqual([1, 1, 1]);
  });
});

describe("vegetation instancing", () => {
  const batch = (n: number) => {
    const d = new Float32Array(n * 5);
    for (let i = 0; i < n; i++) {
      d[i * 5] = ((i * 37) % 400) - 200 + 0.3;
      d[i * 5 + 2] = ((i * 91) % 400) - 200 + 0.7;
      d[i * 5 + 4] = 0.5;
    }
    return d;
  };

  it("puts every instance in exactly one chunk, inside its square", () => {
    const d = batch(2000);
    const groups = chunkBatch(d, 2000, 64, 2);
    const seen = new Set<number>();
    for (const g of groups) {
      for (const i of g.items) {
        expect(seen.has(i)).toBe(false);
        seen.add(i);
        expect(Math.abs(d[i * 5] - g.cx)).toBeLessThanOrEqual(32);
        expect(Math.abs(d[i * 5 + 2] - g.cz)).toBeLessThanOrEqual(32);
      }
      expect(g.variant).toBeLessThan(2);
    }
    expect(seen.size).toBe(2000);
    expect(chunkBatch(d, 2000, 64, 2)).toEqual(groups);
  });

  it("thins deterministically to about the requested fraction", () => {
    const d = batch(4000);
    const keep = thinning(d, 0.6);
    let n = 0;
    for (let i = 0; i < 4000; i++) if (keep(i)) n++;
    expect(n / 4000).toBeGreaterThan(0.5);
    expect(n / 4000).toBeLessThan(0.7);
    expect(thinning(d, 0)(1)).toBe(false);
    expect(thinning(d, 1)(1)).toBe(true);
  });

  it("hashes positions into [0,1) and tints gently", () => {
    for (let i = 0; i < 200; i++) {
      const h = positionHash(i * 1.3, -i * 2.1, i % 5);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
    const t = instanceTint(10, 20, 0.1);
    t.forEach((v) => {
      expect(v).toBeGreaterThan(0.8);
      expect(v).toBeLessThan(1.2);
    });
  });

  it("has a chunk size and variant count for every scatter kind", () => {
    for (const k of SCATTER_KINDS) {
      expect(CHUNK_SIZE[k]).toBeGreaterThan(20);
      expect(VARIANTS[k]).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("procedural species", () => {
  it("builds every scatter kind with the attributes the shaders need, at about its catalogued size", () => {
    for (const kind of SCATTER_KINDS as readonly ScatterKind[]) {
      const sp = buildSpecies(kind, 0, { biome: "desert", grassBlades: 8 });
      const g = sp.geometry;
      for (const a of ["position", "normal", "uv", "color", "aWind"]) expect(g.getAttribute(a), `${kind}.${a}`).toBeTruthy();
      const pos = g.getAttribute("position");
      expect(pos.count).toBeGreaterThan(6);
      for (let i = 0; i < pos.array.length; i++) expect(Number.isFinite(pos.array[i]), kind).toBe(true);
      g.computeBoundingBox();
      const h = g.boundingBox!.max.y;
      const max = SCATTER[kind].size[1];
      expect(h, kind).toBeGreaterThan(max * 0.3);
      expect(h, kind).toBeLessThan(max * 1.5);
      g.dispose();
    }
  });

  it("is deterministic per variant and maps UVs inside the atlas", () => {
    const a = buildSpecies("palm", 1, { biome: "desert", grassBlades: 8 }).geometry;
    const b = buildSpecies("palm", 1, { biome: "desert", grassBlades: 8 }).geometry;
    expect(Array.from(a.getAttribute("position").array)).toEqual(Array.from(b.getAttribute("position").array));
    const uv = a.getAttribute("uv").array;
    for (let i = 0; i < uv.length; i++) {
      expect(uv[i]).toBeGreaterThanOrEqual(0);
      expect(uv[i]).toBeLessThanOrEqual(1);
    }
    for (const c of Object.values(CELLS)) {
      expect(c.u1).toBeGreaterThan(c.u0);
      expect(c.v1).toBeGreaterThan(c.v0);
    }
  });
});
