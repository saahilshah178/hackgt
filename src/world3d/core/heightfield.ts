import type { Terrain, TerrainFeature, World3D } from "../../contracts/world3d";
import { BIOMES } from "./biomes";
import { clamp, createNoise2, fbm, lerp, ridged, smoothstep, type Noise2 } from "./noise";
import { hashString, mulberry32 } from "./prng";

/*
 * The terrain as a height grid, built deterministically from a World3D (terrain + biome + seed) plus the pads and paths
 * the composer derives. Pure TS: the renderer builds its mesh from `heights`, and the server's checks and the critic's
 * digest sample the very same function.
 *
 * Grid: `res × res` samples covering [-size/2, size/2]² with `cell = size / (res - 1)` metres between samples.
 * heights[iz * res + ix] is the ground height (metres) at x = -size/2 + ix·cell, z = -size/2 + iz·cell.
 */

export interface Pad {
  x: number;
  z: number;
  /** flat core radius */
  radius: number;
  /** extra metres over which the pad blends back into the terrain */
  blend: number;
  /** minimum height of the pad (keeps it above the water) */
  minHeight: number;
}

export interface PathRoute {
  points: { x: number; z: number }[];
  width: number;
}

export interface HeightfieldOptions {
  /** samples per edge (odd, so the centre is a sample); default by map size */
  res?: number;
  pads?: readonly Pad[];
  paths?: readonly PathRoute[];
}

export interface Heightfield {
  size: number;
  res: number;
  cell: number;
  heights: Float32Array;
  /** water surface height, or null when the world has no water */
  waterLevel: number | null;
  /** densified river centreline (empty unless water.kind is river) */
  river: { x: number; z: number }[];
  riverWidth: number;
  height(x: number, z: number): number;
  /** unit normal (y up) by central differences */
  normal(x: number, z: number): { x: number; y: number; z: number };
  /** slope in degrees, 0 = flat */
  slope(x: number, z: number): number;
  /** metres of water above the ground (0 on dry land) */
  waterDepth(x: number, z: number): number;
  /** grid helpers */
  index(ix: number, iz: number): number;
  toWorld(ix: number, iz: number): { x: number; z: number };
}

/** Default grid resolution: ~2 m cells, capped for very large maps. */
export function defaultRes(size: number): number {
  const n = Math.round(size / 2.1);
  return clamp(n % 2 === 0 ? n + 1 : n, 129, 513);
}

// ---------------------------------------------------------------- geometry helpers

/** Catmull-Rom through the control points, resampled every `step` metres. */
export function smoothPolyline(points: readonly { x: number; z: number }[], step = 4): { x: number; z: number }[] {
  if (points.length < 2) return [...points];
  const pts = [points[0], ...points, points[points.length - 1]];
  const out: { x: number; z: number }[] = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: cr(p0.x, p1.x, p2.x, p3.x), z: cr(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Distance from (x, z) to a polyline, and the parameter (0..1 along its length) of the closest point. */
export function distanceToPolyline(x: number, z: number, line: readonly { x: number; z: number }[]): { d: number; t: number } {
  let best = Infinity;
  let bestT = 0;
  let acc = 0;
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) total += Math.hypot(line[i + 1].x - line[i].x, line[i + 1].z - line[i].z);
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const u = len2 > 0 ? clamp(((x - a.x) * dx + (z - a.z) * dz) / len2, 0, 1) : 0;
    const px = a.x + u * dx;
    const pz = a.z + u * dz;
    const d = Math.hypot(x - px, z - pz);
    const segLen = Math.sqrt(len2);
    if (d < best) {
      best = d;
      bestT = total > 0 ? (acc + u * segLen) / total : 0;
    }
    acc += segLen;
  }
  return { d: best, t: bestT };
}

// ---------------------------------------------------------------- features

function featureHeight(f: TerrainFeature, index: number, x: number, z: number, noise: Noise2): number {
  const dx = x - f.at.x;
  const dz = z - f.at.z;
  const r = f.radius;
  // elongated features get a stable orientation from their index and position
  const angle = ((hashString(`${f.kind}:${index}:${Math.round(f.at.x)}:${Math.round(f.at.z)}`) % 360) * Math.PI) / 180;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const along = dx * ca + dz * sa;
  const across = -dx * sa + dz * ca;
  const d = Math.hypot(dx, dz);
  const q = d / r;
  const bump = q < 1 ? (1 - q * q) * (1 - q * q) : 0;
  switch (f.kind) {
    case "mountain": {
      if (q >= 1) return 0;
      const shape = Math.pow(1 - q, 1.6);
      const rough = 0.7 + 0.3 * ridged(noise, x / (r * 0.45), z / (r * 0.45), 4);
      return f.height * shape * rough;
    }
    case "hill":
      return f.height * bump;
    case "ridge":
    case "valley": {
      const e = Math.hypot(along / (r * 1.0), across / (r * 0.28));
      if (e >= 1) return 0;
      const s = (1 - e * e) * (1 - e * e);
      const rough = f.kind === "ridge" ? 0.75 + 0.25 * ridged(noise, x / 40, z / 40, 3) : 1;
      return f.height * s * rough;
    }
    case "crater": {
      if (q >= 1.25) return 0;
      const depth = -Math.abs(f.height);
      const rim = Math.abs(f.height) * 0.35 * Math.exp(-Math.pow((q - 0.85) / 0.16, 2));
      const bowl = q < 0.85 ? depth * (1 - Math.pow(q / 0.85, 2)) : 0;
      return bowl + rim;
    }
    case "plateau":
      return f.height * smoothstep(1, 0.7, q + 0.04 * noise(x / 30, z / 30));
    case "mesa":
      return f.height * smoothstep(1, 0.9, q + 0.03 * noise(x / 25, z / 25));
    case "dunes": {
      if (q >= 1) return 0;
      const wave = 0.5 + 0.5 * Math.sin(along / 18 + 0.8 * noise(x / 60, z / 60));
      return f.height * bump * (0.35 + 0.65 * wave * wave);
    }
    case "volcano": {
      if (q >= 1) return 0;
      const cone = Math.pow(1 - q, 1.25);
      const crater = q < 0.16 ? (1 - q / 0.16) * 0.28 : 0;
      const rough = 0.88 + 0.12 * ridged(noise, x / (r * 0.3), z / (r * 0.3), 3);
      return f.height * (cone * rough - crater);
    }
    case "basin":
      return -Math.abs(f.height) * bump;
  }
}

// ---------------------------------------------------------------- build

/**
 * Base terrain (noise + features), then water shaping (river valley and channel, ocean falloff, lake shelf), then
 * pads (flattened ground under structures) and paths (smoothed walkways). Deterministic in (world, options).
 */
export function buildHeightfield(
  world: Pick<World3D, "seed" | "biome" | "terrain">,
  options: HeightfieldOptions = {},
): Heightfield {
  const terrain: Terrain = world.terrain;
  const size = terrain.size;
  const res = options.res ?? defaultRes(size);
  const cell = size / (res - 1);
  const half = size / 2;
  const biome = BIOMES[world.biome];
  const noise = createNoise2(world.seed ^ 0x5eed);
  const warp = createNoise2(world.seed ^ 0xa11ce);
  const water = terrain.water;
  const hasWater = water.kind !== "none";
  const level = water.level;
  const river = water.kind === "river" ? smoothPolyline(water.course, 3) : [];
  const riverHalf = water.width / 2;
  const amp = biome.noiseAmplitude * (0.15 + 0.85 * terrain.relief);
  const scale = biome.noiseScale;
  const rippleDir = (mulberry32(world.seed)() * Math.PI) / 2;

  const heights = new Float32Array(res * res);
  // 1. base noise + features
  for (let iz = 0; iz < res; iz++) {
    const z = -half + iz * cell;
    for (let ix = 0; ix < res; ix++) {
      const x = -half + ix * cell;
      const wx = x + 40 * warp(x / 300, z / 300);
      const wz = z + 40 * warp(z / 300 + 11, x / 300 - 7);
      let h = amp * (0.75 * fbm(noise, wx / scale, wz / scale, 5) + 0.35 * (ridged(noise, wx / (scale * 1.6), wz / (scale * 1.6), 4) - 0.5));
      if (biome.ripples > 0) {
        const along = x * Math.cos(rippleDir) + z * Math.sin(rippleDir);
        h += biome.ripples * 1.2 * Math.sin(along / 7 + 2.5 * noise(x / 50, z / 50)) * (0.6 + 0.4 * noise(x / 120, z / 120));
      }
      for (let i = 0; i < terrain.features.length; i++) h += featureHeight(terrain.features[i], i, x, z, noise);
      heights[iz * res + ix] = h;
    }
  }

  // 2. keep dry land above the water: lift the whole map so its low ground (excluding basins) sits just above the level
  if (hasWater) {
    const sample: number[] = [];
    const basins = terrain.features.filter((f) => f.kind === "basin" || f.kind === "crater" || f.kind === "valley");
    for (let i = 0; i < heights.length; i += 7) {
      const ix = i % res;
      const iz = Math.floor(i / res);
      const x = -half + ix * cell;
      const z = -half + iz * cell;
      if (basins.some((b) => Math.hypot(x - b.at.x, z - b.at.z) < b.radius)) continue;
      sample.push(heights[i]);
    }
    sample.sort((a, b) => a - b);
    const low = sample.length > 0 ? sample[Math.floor(sample.length * 0.04)] : 0;
    const lift = level + 1.6 - low;
    for (let i = 0; i < heights.length; i++) heights[i] += lift;
  }

  // 3. water shaping
  if (water.kind === "river" && river.length >= 2) {
    const valley = Math.max(40, water.width * 2.5);
    const bank = level + 1.2;
    for (let iz = 0; iz < res; iz++) {
      const z = -half + iz * cell;
      for (let ix = 0; ix < res; ix++) {
        const x = -half + ix * cell;
        const i = iz * res + ix;
        const { d } = distanceToPolyline(x, z, river);
        if (d > riverHalf + valley) continue;
        const wobble = 2.5 * noise(x / 25, z / 25);
        // floodplain: pull the land near the river down to a gentle bank
        const plain = smoothstep(riverHalf + valley, riverHalf + 6, d + wobble);
        let h = lerp(heights[i], Math.min(heights[i], bank + 0.08 * (d - riverHalf)), plain);
        // channel: below the water level inside the banks
        const depth = Math.min(4.5, 1.2 + water.width * 0.06);
        const inChannel = smoothstep(riverHalf + 2, riverHalf * 0.55, d + wobble * 0.5);
        h = lerp(h, level - depth, inChannel);
        heights[i] = h;
      }
    }
  } else if (water.kind === "ocean" && water.coast) {
    const shelf = size * 0.26;
    for (let iz = 0; iz < res; iz++) {
      const z = -half + iz * cell;
      for (let ix = 0; ix < res; ix++) {
        const x = -half + ix * cell;
        const i = iz * res + ix;
        const edge = water.coast === "east" ? half - x : water.coast === "west" ? x + half : water.coast === "north" ? z + half : half - z;
        const e = edge + 28 * noise(x / 90 + 3, z / 90 - 5) + 10 * noise(x / 22, z / 22);
        const t = smoothstep(shelf * 0.25, shelf, e);
        heights[i] = lerp(level - 14 + 6 * t, heights[i], t);
      }
    }
  }

  // 4. pads: flatten under structures (target = mean height over the core, never below minHeight)
  for (const pad of options.pads ?? []) {
    const target = Math.max(pad.minHeight, meanInRadius(heights, res, cell, half, pad.x, pad.z, pad.radius));
    const outer = pad.radius + pad.blend;
    forEachInRadius(res, cell, half, pad.x, pad.z, outer, (i, x, z) => {
      const d = Math.hypot(x - pad.x, z - pad.z);
      const t = smoothstep(outer, pad.radius, d);
      heights[i] = lerp(heights[i], target, t);
    });
  }

  // 5. paths: smooth the ground along each route toward a running average of its own height
  for (const route of options.paths ?? []) {
    if (route.points.length < 2) continue;
    const line = smoothPolyline(route.points, 3);
    const along = line.map((p) => sampleGrid(heights, res, cell, half, p.x, p.z));
    const smooth = along.map((_, k) => {
      let s = 0;
      let n = 0;
      for (let j = Math.max(0, k - 5); j <= Math.min(along.length - 1, k + 5); j++) {
        s += along[j];
        n++;
      }
      return s / n;
    });
    const halfW = route.width / 2;
    const reach = halfW + 3.5;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of line) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const ix0 = clamp(Math.floor((minX - reach + half) / cell), 0, res - 1);
    const ix1 = clamp(Math.ceil((maxX + reach + half) / cell), 0, res - 1);
    const iz0 = clamp(Math.floor((minZ - reach + half) / cell), 0, res - 1);
    const iz1 = clamp(Math.ceil((maxZ + reach + half) / cell), 0, res - 1);
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const x = -half + ix * cell;
        const z = -half + iz * cell;
        const { d, t } = distanceToPolyline(x, z, line);
        if (d > reach) continue;
        const target = smooth[Math.min(smooth.length - 1, Math.round(t * (smooth.length - 1)))];
        const i = iz * res + ix;
        // never drag a path into the water; bridges carry paths over rivers
        const floor = hasWater ? level + 0.4 : -Infinity;
        if (heights[i] < floor) continue;
        heights[i] = lerp(heights[i], Math.max(target, floor), smoothstep(reach, halfW, d) * 0.85);
      }
    }
  }

  return makeHeightfield(size, res, heights, hasWater ? level : null, river, water.width);
}

function sampleGrid(heights: Float32Array, res: number, cell: number, half: number, x: number, z: number): number {
  const fx = clamp((x + half) / cell, 0, res - 1.0001);
  const fz = clamp((z + half) / cell, 0, res - 1.0001);
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const i = iz * res + ix;
  const h00 = heights[i];
  const h10 = heights[i + 1];
  const h01 = heights[i + res];
  const h11 = heights[i + res + 1];
  return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
}

function forEachInRadius(res: number, cell: number, half: number, cx: number, cz: number, r: number, fn: (i: number, x: number, z: number) => void) {
  const ix0 = clamp(Math.floor((cx - r + half) / cell), 0, res - 1);
  const ix1 = clamp(Math.ceil((cx + r + half) / cell), 0, res - 1);
  const iz0 = clamp(Math.floor((cz - r + half) / cell), 0, res - 1);
  const iz1 = clamp(Math.ceil((cz + r + half) / cell), 0, res - 1);
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const x = -half + ix * cell;
      const z = -half + iz * cell;
      if (Math.hypot(x - cx, z - cz) <= r) fn(iz * res + ix, x, z);
    }
  }
}

function meanInRadius(heights: Float32Array, res: number, cell: number, half: number, cx: number, cz: number, r: number): number {
  let s = 0;
  let n = 0;
  forEachInRadius(res, cell, half, cx, cz, Math.max(r, cell), (i) => {
    s += heights[i];
    n++;
  });
  return n > 0 ? s / n : sampleGrid(heights, res, cell, half, cx, cz);
}

/** Wraps a finished grid in the sampling API (also used by tests and by the client after a worker builds the grid). */
export function makeHeightfield(
  size: number,
  res: number,
  heights: Float32Array,
  waterLevel: number | null,
  river: { x: number; z: number }[] = [],
  riverWidth = 0,
): Heightfield {
  const cell = size / (res - 1);
  const half = size / 2;
  const height = (x: number, z: number) => sampleGrid(heights, res, cell, half, x, z);
  const normal = (x: number, z: number) => {
    const e = cell;
    const hx = height(x + e, z) - height(x - e, z);
    const hz = height(x, z + e) - height(x, z - e);
    const nx = -hx;
    const ny = 2 * e;
    const nz = -hz;
    const len = Math.hypot(nx, ny, nz);
    return { x: nx / len, y: ny / len, z: nz / len };
  };
  return {
    size,
    res,
    cell,
    heights,
    waterLevel,
    river,
    riverWidth,
    height,
    normal,
    slope: (x, z) => (Math.acos(clamp(normal(x, z).y, -1, 1)) * 180) / Math.PI,
    waterDepth: (x, z) => (waterLevel === null ? 0 : Math.max(0, waterLevel - height(x, z))),
    index: (ix, iz) => iz * res + ix,
    toWorld: (ix, iz) => ({ x: -half + ix * cell, z: -half + iz * cell }),
  };
}
