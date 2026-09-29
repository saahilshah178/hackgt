import type { Biome } from "../../../contracts/world3d";
import { BIOMES } from "../../core/biomes";
import type { ComposedWorld, Placed } from "../../core/compose";
import { distanceToPolyline, type Heightfield } from "../../core/heightfield";
import { clamp, createNoise2, fbm, lerp, ridged, smoothstep } from "../../core/noise";
import { hashString } from "../../core/prng";

/*
 * CPU bakes for the terrain and its neighbours, all pure and deterministic (no three.js): the splat masks texture, the
 * long-range sun visibility (terrain + landmark shadows the realtime shadow box can't reach), the horizon ring that
 * carries the land from the map edge into the fog, the tileable noise the shaders use to break up tiling, and the
 * river flow field for the water. Grids match the heightfield: index iz*res + ix, x = -size/2 + ix*cell.
 */

// ---------------------------------------------------------------- masks

/**
 * RGBA8 res×res: R = any path, G = tilled field, B = paved (stone style) path, A = cavity (255 = open, lower = concave
 * ground that gets less sky light).
 */
export function terrainMasks(c: Pick<ComposedWorld, "hf" | "pathMask" | "fieldMask" | "paths">): Uint8Array {
  const { hf } = c;
  const { res, cell } = hf;
  const half = hf.size / 2;
  const out = new Uint8Array(res * res * 4);
  const stone = new Uint8Array(res * res);
  for (const p of c.paths) {
    if (p.style !== "stone") continue;
    const reach = p.width / 2 + 1.2;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const q of p.points) {
      minX = Math.min(minX, q.x);
      maxX = Math.max(maxX, q.x);
      minZ = Math.min(minZ, q.z);
      maxZ = Math.max(maxZ, q.z);
    }
    const ix0 = clamp(Math.floor((minX - reach + half) / cell), 0, res - 1);
    const ix1 = clamp(Math.ceil((maxX + reach + half) / cell), 0, res - 1);
    const iz0 = clamp(Math.floor((minZ - reach + half) / cell), 0, res - 1);
    const iz1 = clamp(Math.ceil((maxZ + reach + half) / cell), 0, res - 1);
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const { d } = distanceToPolyline(-half + ix * cell, -half + iz * cell, p.points);
        if (d > reach) continue;
        const i = iz * res + ix;
        stone[i] = Math.max(stone[i], Math.round(255 * smoothstep(reach, p.width / 2 - 0.5, d)));
      }
    }
  }
  const h = hf.heights;
  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const i = iz * res + ix;
      // cavity: how far the cell sits below the mean of a ring of neighbours two cells out
      const at = (dx: number, dz: number) => h[clamp(iz + dz, 0, res - 1) * res + clamp(ix + dx, 0, res - 1)];
      const ring = (at(-2, 0) + at(2, 0) + at(0, -2) + at(0, 2) + at(-2, -2) + at(2, 2) + at(-2, 2) + at(2, -2)) / 8;
      const concave = ring - h[i];
      const cavity = clamp(1 - Math.max(0, concave) * 0.35, 0.35, 1);
      out[i * 4] = c.pathMask[i];
      out[i * 4 + 1] = c.fieldMask[i];
      out[i * 4 + 2] = stone[i];
      out[i * 4 + 3] = Math.round(cavity * 255);
    }
  }
  return out;
}

// ---------------------------------------------------------------- sun visibility

export interface Occluder {
  kind: Placed["kind"];
  x: number;
  y: number;
  z: number;
  rotation: number;
  radius: number;
  height: number;
}

/** Top of an occluder's rough silhouette at (x, z), or -Infinity outside it. */
export function occluderTop(o: Occluder, x: number, z: number): number {
  const dx = x - o.x;
  const dz = z - o.z;
  const c = Math.cos(o.rotation);
  const s = Math.sin(o.rotation);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  if (o.kind === "pyramid" || o.kind === "step_pyramid") {
    const r = o.radius;
    const m = Math.max(Math.abs(lx), Math.abs(lz)) / r;
    return m < 1 ? o.y + o.height * (1 - m) : -Infinity;
  }
  if (o.kind === "obelisk" || o.kind === "tower" || o.kind === "lighthouse" || o.kind === "beacon" || o.kind === "monolith") {
    return Math.hypot(dx, dz) < Math.max(1.2, o.radius * 0.6) ? o.y + o.height : -Infinity;
  }
  const r = o.radius * 0.72;
  return Math.abs(lx) < r && Math.abs(lz) < r ? o.y + o.height * 0.9 : -Infinity;
}

/**
 * Sun visibility per heightfield cell (0 = in shadow, 255 = lit) by marching toward the sun over the terrain plus the
 * rough silhouettes of tall structures. The penumbra widens with the occluder's distance, like a real sun (0.5°).
 */
export function bakeSunVisibility(hf: Heightfield, sun: { x: number; y: number; z: number }, occluders: readonly Occluder[], maxDistance = 900): Uint8Array {
  const { res, cell, heights } = hf;
  const half = hf.size / 2;
  const out = new Uint8Array(res * res).fill(255);
  const horiz = Math.hypot(sun.x, sun.z);
  if (sun.y <= 0.02 || horiz < 1e-4) {
    if (sun.y <= 0.02) out.fill(90);
    return out;
  }
  // occluder height grid = terrain, raised by structures
  const occ = new Float32Array(heights);
  let maxH = -Infinity;
  for (const o of occluders) {
    if (o.height < 4) continue;
    const r = o.radius * 1.05;
    const ix0 = clamp(Math.floor((o.x - r + half) / cell), 0, res - 1);
    const ix1 = clamp(Math.ceil((o.x + r + half) / cell), 0, res - 1);
    const iz0 = clamp(Math.floor((o.z - r + half) / cell), 0, res - 1);
    const iz1 = clamp(Math.ceil((o.z + r + half) / cell), 0, res - 1);
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const top = occluderTop(o, -half + ix * cell, -half + iz * cell);
        const i = iz * res + ix;
        if (top > occ[i]) occ[i] = top;
      }
    }
  }
  for (let i = 0; i < occ.length; i++) if (occ[i] > maxH) maxH = occ[i];
  const dx = sun.x / horiz;
  const dz = sun.z / horiz;
  const rise = sun.y / horiz; // metres up per metre along
  const step = cell * 0.85;
  const penumbra = 0.0095; // ≈ tan(0.55°): the sun's disc plus a little softness
  const sample = (x: number, z: number) => {
    const fx = clamp((x + half) / cell, 0, res - 1.001);
    const fz = clamp((z + half) / cell, 0, res - 1.001);
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const i = iz * res + ix;
    return lerp(lerp(occ[i], occ[i + 1], tx), lerp(occ[i + res], occ[i + res + 1], tx), tz);
  };
  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const i = iz * res + ix;
      const x0 = -half + ix * cell;
      const z0 = -half + iz * cell;
      const y0 = heights[i] + 0.4;
      let vis = 1;
      for (let t = step; t < maxDistance; t += step) {
        const y = y0 + t * rise;
        if (y > maxH + 1) break;
        const x = x0 + dx * t;
        const z = z0 + dz * t;
        if (x < -half || x > half || z < -half || z > half) break;
        const gap = y - sample(x, z);
        const v = clamp(0.5 + gap / (penumbra * t * 2 + 0.6), 0, 1);
        if (v < vis) {
          vis = v;
          if (vis <= 0) break;
        }
      }
      out[i] = Math.round(vis * 255);
    }
  }
  return out;
}

export function occludersOf(c: Pick<ComposedWorld, "landmarks" | "pieces">): Occluder[] {
  return [...c.landmarks, ...c.pieces]
    .filter((p) => p.height >= 4 && p.kind !== "bridge" && p.kind !== "dock" && p.kind !== "boat")
    .map((p) => ({ kind: p.kind, x: p.x, y: p.y, z: p.z, rotation: p.rotation, radius: p.radius, height: p.height }));
}

// ---------------------------------------------------------------- horizon ring

export interface RingGeometry {
  positions: Float32Array;
  indices: Uint32Array;
  /** vertex count per ring (the map perimeter) */
  perimeter: number;
  rings: number;
}

/** The map perimeter as grid indices, walked clockwise from the north-west corner. */
export function perimeterCells(res: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let ix = 0; ix < res - 1; ix++) cells.push([ix, 0]);
  for (let iz = 0; iz < res - 1; iz++) cells.push([res - 1, iz]);
  for (let ix = res - 1; ix > 0; ix--) cells.push([ix, res - 1]);
  for (let iz = res - 1; iz > 0; iz--) cells.push([0, iz]);
  return cells;
}

export interface HorizonField {
  outer: number;
  /** ground height anywhere in ±outer (the heightfield inside the map, the ring's shape outside) */
  heightAt(x: number, z: number): number;
  /** the ring vertex height for perimeter index j at `dist` metres beyond the edge, point (x, z) */
  ringHeight(j: number, dist: number, x: number, z: number): number;
}

/**
 * The land beyond the map edge, as a function. Heights start as the edge profile (so rivers and coasts carry on),
 * blurred along the perimeter more and more with distance (edge ridges and channels melt away instead of streaking
 * radially) and blend into far-field hills shaped by the biome; open water at the edge stays under water.
 */
export function horizonField(hf: Heightfield, biome: Biome, seed: number, outer = 2600): HorizonField {
  const { res, cell, heights } = hf;
  const half = hf.size / 2;
  const cells = perimeterCells(res);
  const n = cells.length;
  const preset = BIOMES[biome];
  const noise = createNoise2((seed ^ 0x40e1) >>> 0);
  const edge = cells.map(([ix, iz]) => heights[iz * res + ix]);
  let edgeMean = 0;
  for (const h of edge) edgeMean += h;
  edgeMean /= n;
  const prefix = new Float64Array(n * 3 + 1);
  for (let i = 0; i < n * 3; i++) prefix[i + 1] = prefix[i] + edge[i % n];
  const blurred = (j: number, radius: number) => {
    const r = Math.min(Math.floor(n / 2) - 1, Math.max(0, Math.round(radius)));
    if (r === 0) return edge[j];
    const a = j + n - r;
    const b = j + n + r + 1;
    return (prefix[b] - prefix[a]) / (b - a);
  };
  const level = hf.waterLevel;
  const amp = biome === "alpine" ? 260 : biome === "lunar" ? 38 : biome === "canyon" ? 90 : biome === "volcanic" ? 120 : biome === "desert" ? 26 : Math.max(24, preset.noiseAmplitude * 2.2);
  const ringHeight = (j: number, dist: number, x: number, z: number) => {
    const rawEdge = edge[j];
    if (dist <= 0) return rawEdge;
    const edgeH = blurred(j, 2 + (dist / cell) * 1.3);
    // far field: broad hills that rise toward the horizon so the skyline has a silhouette
    const shape = biome === "lunar" ? ridged(noise, x / 420, z / 420, 4) : 0.5 + 0.5 * fbm(noise, x / 650, z / 650, 5);
    const rise = smoothstep(0, outer - half, dist);
    let far = edgeMean + amp * shape * (0.25 + 0.75 * rise);
    if (biome === "desert") far += 10 * Math.sin(x / 95 + 2 * noise(x / 300, z / 300)) * (0.4 + 0.6 * rise);
    const t = smoothstep(0, Math.min(700, (outer - half) * 0.45), dist);
    let y = lerp(edgeH, far, t);
    if (level !== null && rawEdge < level - 0.3) {
      // water at the edge (ocean, a river leaving the map): keep this line of the ring under water, deepening outward,
      // until the fog has long swallowed it
      const under = Math.min(rawEdge, level - 1.5 - dist * 0.004);
      const keep = edgeH < level - 4 ? 1 : 1 - smoothstep(1100, 2000, dist);
      y = lerp(y, under, keep);
    }
    return y;
  };
  const heightAt = (x: number, z: number) => {
    const m = Math.max(Math.abs(x), Math.abs(z));
    if (m <= half) return hf.height(x, z);
    const s = m / half;
    const ex = x / s;
    const ez = z / s;
    let j: number;
    if (Math.abs(ez) >= Math.abs(ex)) {
      const ix = clamp(Math.round((ex + half) / cell), 0, res - 1);
      j = ez < 0 ? ix : 2 * (res - 1) + (res - 1 - ix);
    } else {
      const iz = clamp(Math.round((ez + half) / cell), 0, res - 1);
      j = ex > 0 ? res - 1 + iz : 3 * (res - 1) + (res - 1 - iz);
    }
    return ringHeight(((j % n) + n) % n, m - half, x, z);
  };
  return { outer, heightAt, ringHeight };
}

/** The horizon field as a square annulus mesh; its inner ring shares the terrain's edge vertices exactly (no seam). */
export function horizonRing(hf: Heightfield, biome: Biome, seed: number, outer = 2600, rings = 22): RingGeometry {
  const { res, cell } = hf;
  const half = hf.size / 2;
  const cells = perimeterCells(res);
  const n = cells.length;
  const field = horizonField(hf, biome, seed, outer);
  const positions = new Float32Array(n * (rings + 1) * 3);
  for (let k = 0; k <= rings; k++) {
    const f = k / rings;
    const extent = half + (outer - half) * f * f;
    const s = extent / half;
    for (let j = 0; j < n; j++) {
      const [ix, iz] = cells[j];
      const x = (-half + ix * cell) * s;
      const z = (-half + iz * cell) * s;
      const o = (k * n + j) * 3;
      positions[o] = x;
      positions[o + 1] = field.ringHeight(j, extent - half, x, z);
      positions[o + 2] = z;
    }
  }
  const indices = new Uint32Array(rings * n * 6);
  let q = 0;
  for (let k = 0; k < rings; k++) {
    for (let j = 0; j < n; j++) {
      const a = k * n + j;
      const b = k * n + ((j + 1) % n);
      const c2 = (k + 1) * n + j;
      const d = (k + 1) * n + ((j + 1) % n);
      // wound so the faces point up: (b - a) × (c2 - a) is +y for a clockwise perimeter with z south
      indices[q++] = a;
      indices[q++] = b;
      indices[q++] = c2;
      indices[q++] = b;
      indices[q++] = d;
      indices[q++] = c2;
    }
  }
  return { positions, indices, perimeter: n, rings };
}

/** Ground minus water level on a coarse grid over ±outer (the water's depth tint outside the map). */
export function farDepthGrid(field: HorizonField, level: number, size = 256): Float32Array {
  const out = new Float32Array(size * size);
  const o = field.outer;
  for (let iz = 0; iz < size; iz++) {
    for (let ix = 0; ix < size; ix++) {
      const x = -o + ((ix + 0.5) / size) * 2 * o;
      const z = -o + ((iz + 0.5) / size) * 2 * o;
      out[iz * size + ix] = clamp(field.heightAt(x, z) - level, -40, 40);
    }
  }
  return out;
}

// ---------------------------------------------------------------- tileable noise

/**
 * RGBA8 size×size tileable value-noise fbm, one independent pattern per channel (base periods 4, 6, 8, 12 cells).
 * Deterministic in `seed`. Shaders sample it at several world scales to break up texture tiling.
 */
export function tileableNoise(size = 256, seed = 1): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const periods = [4, 6, 8, 12];
  const hash = (x: number, y: number, s: number) => (hashString(`${x},${y},${s}`) & 0xffff) / 0xffff;
  for (let ch = 0; ch < 4; ch++) {
    const lattices: { p: number; v: Float32Array }[] = [];
    for (let o = 0; o < 5; o++) {
      const p = periods[ch] << o;
      const v = new Float32Array(p * p);
      for (let y = 0; y < p; y++) for (let x = 0; x < p; x++) v[y * p + x] = hash(x, y, seed * 131 + ch * 17 + o);
      lattices.push({ p, v });
    }
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        let sum = 0;
        let norm = 0;
        let amp = 1;
        for (const { p, v } of lattices) {
          const fx = (px / size) * p;
          const fy = (py / size) * p;
          const x0 = Math.floor(fx);
          const y0 = Math.floor(fy);
          const tx = fx - x0;
          const ty = fy - y0;
          const sx = tx * tx * (3 - 2 * tx);
          const sy = ty * ty * (3 - 2 * ty);
          const x1 = (x0 + 1) % p;
          const y1 = (y0 + 1) % p;
          const a = lerp(v[y0 * p + x0], v[y0 * p + x1], sx);
          const b = lerp(v[y1 * p + x0], v[y1 * p + x1], sx);
          sum += amp * lerp(a, b, sy);
          norm += amp;
          amp *= 0.5;
        }
        // stretch the fbm's narrow histogram back toward 0..1
        const val = clamp((sum / norm - 0.5) * 1.9 + 0.5, 0, 1);
        out[(py * size + px) * 4 + ch] = Math.round(val * 255);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- water helpers

/** Ground height minus the water level per cell (metres), for the water's depth tint; +8 where there is no water. */
export function relativeDepthGrid(hf: Heightfield): Float32Array {
  const out = new Float32Array(hf.res * hf.res);
  const level = hf.waterLevel ?? 0;
  for (let i = 0; i < out.length; i++) out[i] = clamp(hf.heights[i] - level, -40, 40);
  return out;
}

/**
 * RG8 res×res river flow (direction × speed encoded 0..255 around 128) near the river centreline, zero elsewhere; the
 * water shader scrolls its normals along it. Speed peaks mid-channel and falls to 0 at the banks.
 */
export function riverFlow(hf: Heightfield): Uint8Array {
  const { res, cell } = hf;
  const half = hf.size / 2;
  const out = new Uint8Array(res * res * 2).fill(128);
  const line = hf.river;
  if (line.length < 2) return out;
  const halfW = hf.riverWidth / 2;
  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const x = -half + ix * cell;
      const z = -half + iz * cell;
      const { d, t } = distanceToPolyline(x, z, line);
      if (d > halfW + 8) continue;
      const k = clamp(Math.round(t * (line.length - 1)), 0, line.length - 2);
      const a = line[k];
      const b = line[k + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const speed = 1 - smoothstep(halfW * 0.2, halfW + 6, d);
      const i = (iz * res + ix) * 2;
      out[i] = Math.round(128 + 127 * ((b.x - a.x) / len) * speed);
      out[i + 1] = Math.round(128 + 127 * ((b.z - a.z) / len) * speed);
    }
  }
  return out;
}
