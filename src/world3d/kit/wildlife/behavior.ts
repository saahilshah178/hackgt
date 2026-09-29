import type { WildlifeKind } from "../../../contracts/world3d";
import type { ComposedWildlife } from "../../core/compose";
import { hashString, mulberry32, type Rng } from "../../core/prng";

/*
 * Wildlife behaviour, pure and deterministic (no React, no three). Ground animals are spawned from the composed homes
 * (x, z, radius, count) and the world seed onto valid ground (walkable land; the ibis on dry land by the water or in the
 * shallows), then run a small state machine: wander to a target inside the home radius, then idle, sit, groom, graze,
 * lie down or feed for a while. Friendly cats (and some dogs) walk up to a nearby player and sit looking up at them.
 * Flocks, butterflies, fireflies and fish follow closed-form paths of time (boid-like circling, flutter, hover, swim),
 * so they cost nothing to simulate and never leave their element.
 */

export type GroundMode = "idle" | "walk" | "sit" | "groom" | "graze" | "lie" | "feed";

export interface GroundAnimal {
  id: string;
  kind: WildlifeKind;
  x: number;
  z: number;
  yaw: number;
  mode: GroundMode;
  timer: number;
  tx: number;
  tz: number;
  /** current forward speed (m/s) */
  v: number;
  phase: number;
  homeX: number;
  homeZ: number;
  radius: number;
  /** walks up to the player */
  friendly: boolean;
  /** currently going to / sitting by the player */
  withPlayer: boolean;
  /** body scale variation */
  size: number;
  /** coat colour variant */
  coat: number;
  rng: Rng;
}

export interface WorldQuery {
  height(x: number, z: number): number;
  walkable(x: number, z: number): boolean;
  waterDepth(x: number, z: number): number;
}

export const GROUND_KINDS: ReadonlySet<WildlifeKind> = new Set(["cat", "dog", "goat", "camel", "horse", "ibis"]);

const WALK_SPEED: Partial<Record<WildlifeKind, number>> = { cat: 0.65, dog: 1.2, goat: 0.7, camel: 1.1, horse: 1.3, ibis: 0.35 };
const RESTS: Partial<Record<WildlifeKind, GroundMode[]>> = {
  cat: ["idle", "sit", "sit", "groom"],
  dog: ["idle", "sit", "idle"],
  goat: ["idle", "graze", "graze"],
  camel: ["idle", "graze", "lie"],
  horse: ["idle", "graze", "graze"],
  ibis: ["feed", "feed", "idle"],
};
const DURATION: Record<GroundMode, [number, number]> = {
  idle: [2, 5],
  walk: [4, 14],
  sit: [6, 16],
  groom: [4, 8],
  graze: [5, 12],
  lie: [18, 35],
  feed: [3, 7],
};

const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();

/** Can this kind stand here? */
export function validSpot(kind: WildlifeKind, q: WorldQuery, x: number, z: number): boolean {
  if (kind === "ibis") {
    const d = q.waterDepth(x, z);
    if (d > 0.25) return false;
    if (d > 0) return true;
    // dry, but within a few metres of water
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (q.waterDepth(x + Math.cos(a) * 5, z + Math.sin(a) * 5) > 0) return true;
    }
    return false;
  }
  return q.walkable(x, z) && q.waterDepth(x, z) <= 0;
}

export function spawnGround(list: readonly ComposedWildlife[], seed: number, q: WorldQuery, density = 1): GroundAnimal[] {
  const out: GroundAnimal[] = [];
  const perKind = new Map<WildlifeKind, number>();
  list.forEach((w, gi) => {
    if (!GROUND_KINDS.has(w.kind)) return;
    const n = Math.max(1, Math.round(w.count * density));
    for (let i = 0; i < n; i++) {
      const rng = mulberry32(hashString(`${seed}:wild:${w.kind}:${gi}:${i}`));
      let spot: { x: number; z: number } | null = null;
      for (let t = 0; t < 40 && !spot; t++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * w.radius * (t < 20 ? 1 : 1.6);
        const x = w.x + Math.cos(a) * d;
        const z = w.z + Math.sin(a) * d;
        if (validSpot(w.kind, q, x, z)) spot = { x, z };
      }
      if (!spot) continue;
      const idx = perKind.get(w.kind) ?? 0;
      perKind.set(w.kind, idx + 1);
      const rests = RESTS[w.kind] ?? ["idle"];
      const mode = rests[Math.floor(rng() * rests.length)];
      out.push({
        id: `${w.kind}_${idx}`,
        kind: w.kind,
        x: spot.x,
        z: spot.z,
        yaw: rng() * Math.PI * 2,
        mode,
        timer: range(rng, 0.5, DURATION[mode][1]),
        tx: spot.x,
        tz: spot.z,
        v: 0,
        phase: rng(),
        homeX: w.x,
        homeZ: w.z,
        radius: w.radius,
        friendly: w.kind === "cat" ? rng() < 0.65 : w.kind === "dog" ? rng() < 0.5 : false,
        withPlayer: false,
        size: range(rng, 0.9, 1.1),
        coat: Math.floor(rng() * 4),
        rng,
      });
    }
  });
  return out;
}

function pickTarget(a: GroundAnimal, q: WorldQuery): boolean {
  for (let t = 0; t < 12; t++) {
    const ang = a.rng() * Math.PI * 2;
    const d = Math.sqrt(a.rng()) * a.radius;
    const x = a.homeX + Math.cos(ang) * d;
    const z = a.homeZ + Math.sin(ang) * d;
    if (Math.hypot(x - a.x, z - a.z) < 1.5) continue;
    if (!validSpot(a.kind, q, x, z)) continue;
    a.tx = x;
    a.tz = z;
    return true;
  }
  return false;
}

function rest(a: GroundAnimal) {
  const rests = RESTS[a.kind] ?? ["idle"];
  a.mode = rests[Math.floor(a.rng() * rests.length)];
  const [lo, hi] = DURATION[a.mode];
  a.timer = range(a.rng, lo, hi);
}

const wrap = (r: number) => Math.atan2(Math.sin(r), Math.cos(r));

/** Advance one animal by dt seconds. `player` is the player's ground position (or null). */
export function stepGround(a: GroundAnimal, dt: number, q: WorldQuery, player: { x: number; z: number } | null) {
  const walkSpeed = (WALK_SPEED[a.kind] ?? 0.8) * a.size;
  // friendly animals come over when the player is near, and wander off when they leave
  if (a.friendly && player) {
    const dp = Math.hypot(player.x - a.x, player.z - a.z);
    const stop = a.kind === "cat" ? 1.1 : 1.6;
    if (!a.withPlayer && dp < 7.5 && dp > stop + 0.3) {
      a.withPlayer = true;
      a.mode = "walk";
      a.timer = 12;
    }
    if (a.withPlayer) {
      if (dp > 11) {
        a.withPlayer = false;
        rest(a);
      } else if (a.mode === "walk") {
        const k = (dp - stop) / Math.max(dp, 0.01);
        a.tx = a.x + (player.x - a.x) * k;
        a.tz = a.z + (player.z - a.z) * k;
        if (dp <= stop + 0.35) {
          a.mode = "sit";
          a.timer = 30;
        }
      } else if (a.mode === "sit" || a.mode === "idle") {
        // stay facing the player; follow when they step away
        a.yaw += wrap(Math.atan2(player.x - a.x, player.z - a.z) - a.yaw) * Math.min(1, dt * 3);
        if (dp > stop + 1.2) {
          a.mode = "walk";
          a.timer = 12;
        }
        a.v += (0 - a.v) * Math.min(1, dt * 6);
        return;
      }
    }
  }
  a.timer -= dt;
  if (a.mode === "walk") {
    const dx = a.tx - a.x;
    const dz = a.tz - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25 || a.timer <= 0) {
      if (!a.withPlayer) rest(a);
      else {
        a.mode = "sit";
        a.timer = 30;
      }
      a.v = Math.max(0, a.v - dt * 3);
      return;
    }
    const want = Math.atan2(dx, dz);
    const turn = wrap(want - a.yaw);
    a.yaw += Math.sign(turn) * Math.min(Math.abs(turn), dt * 2.6);
    const align = Math.max(0, Math.cos(turn));
    const target = walkSpeed * align * Math.min(1, d / 0.8 + 0.3);
    a.v += (target - a.v) * Math.min(1, dt * 4);
    const nx = a.x + Math.sin(a.yaw) * a.v * dt;
    const nz = a.z + Math.cos(a.yaw) * a.v * dt;
    if (validSpot(a.kind, q, nx, nz)) {
      a.x = nx;
      a.z = nz;
    } else {
      a.v = 0;
      if (!pickTarget(a, q)) rest(a);
    }
  } else {
    a.v += (0 - a.v) * Math.min(1, dt * 5);
    if (a.timer <= 0) {
      if (pickTarget(a, q)) {
        a.mode = "walk";
        a.timer = DURATION.walk[1];
      } else rest(a);
    }
  }
}

// ------------------------------------------------------------------------------------------------ closed-form movers

export interface FlyPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  roll: number;
  pitch: number;
  flap: number;
}

/** Birds of a flock circling high over their home, each on its own ring, gliding between bouts of flapping. */
export function flockBird(home: { x: number; z: number; radius: number }, i: number, seed: number, t: number, out: FlyPose) {
  const r = mulberry32(hashString(`${seed}:flock:${i}`));
  const ring = home.radius * (0.25 + r() * 0.35);
  const alt = 24 + r() * 16;
  const speed = 7 + r() * 4;
  const dir = r() < 0.8 ? 1 : -1;
  const w = (dir * speed) / ring;
  const ph = r() * Math.PI * 2;
  const cx = home.x + (r() - 0.5) * 12;
  const cz = home.z + (r() - 0.5) * 12;
  const a = ph + w * t + 0.25 * Math.sin(t * 0.13 + i);
  out.x = cx + Math.cos(a) * ring;
  out.z = cz + Math.sin(a) * ring;
  out.y = alt + 2.5 * Math.sin(t * 0.4 + i * 1.7);
  // heading along the tangent of the circle
  out.yaw = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
  out.roll = -dir * 0.35;
  out.pitch = 0.1 * Math.cos(t * 0.4 + i * 1.7);
  const bout = Math.sin(t * 0.35 + i * 2.1) > -0.2 ? 1 : 0;
  out.flap = bout * Math.sin(t * (7.5 + r() * 2) + ph) * 0.75 + (1 - bout) * 0.08;
}

/** A butterfly fluttering around a spot near its home. */
export function butterfly(home: { x: number; z: number; radius: number }, i: number, seed: number, t: number, out: FlyPose) {
  const r = mulberry32(hashString(`${seed}:bfly:${i}`));
  const cx = home.x + (r() - 0.5) * home.radius * 1.2;
  const cz = home.z + (r() - 0.5) * home.radius * 1.2;
  const s = 0.6 + r() * 0.5;
  const ph = r() * 10;
  const tt = t * s + ph;
  out.x = cx + Math.sin(tt * 0.7) * 2.2 + Math.sin(tt * 1.9) * 0.6;
  out.z = cz + Math.cos(tt * 0.53) * 2.2 + Math.cos(tt * 2.3) * 0.5;
  out.y = 0.7 + 0.45 * Math.sin(tt * 1.3) + 0.25 * Math.sin(tt * 4.1);
  const vx = Math.cos(tt * 0.7) * 0.7 * 2.2 + Math.cos(tt * 1.9) * 1.9 * 0.6;
  const vz = -Math.sin(tt * 0.53) * 0.53 * 2.2 - Math.sin(tt * 2.3) * 2.3 * 0.5;
  out.yaw = Math.atan2(vx, vz);
  out.roll = 0.2 * Math.sin(tt * 3);
  out.pitch = -0.3;
  out.flap = Math.sin(t * 22 + ph * 3);
}

/** A firefly hovering low around its home; returns its glow (0..1). */
export function firefly(home: { x: number; z: number; radius: number }, i: number, seed: number, t: number, out: { x: number; y: number; z: number }): number {
  const r = mulberry32(hashString(`${seed}:ffly:${i}`));
  const cx = home.x + (r() - 0.5) * home.radius * 1.6;
  const cz = home.z + (r() - 0.5) * home.radius * 1.6;
  const ph = r() * 20;
  const tt = t * (0.25 + r() * 0.2) + ph;
  out.x = cx + Math.sin(tt) * 1.8 + Math.sin(tt * 2.7) * 0.4;
  out.z = cz + Math.cos(tt * 0.8) * 1.8 + Math.cos(tt * 3.1) * 0.4;
  out.y = 0.6 + r() * 1.6 + 0.3 * Math.sin(tt * 1.7);
  const pulse = Math.sin(t * (1.1 + r() * 0.8) + ph);
  return Math.max(0, pulse) ** 3;
}

/** A fish swimming loops below the surface; `ok` rejects paths that leave deep water. */
export function fishPath(home: { x: number; z: number; radius: number }, i: number, seed: number) {
  const r = mulberry32(hashString(`${seed}:fish:${i}`));
  return {
    cx: home.x + (r() - 0.5) * home.radius,
    cz: home.z + (r() - 0.5) * home.radius,
    rx: 2 + r() * 5,
    rz: 2 + r() * 5,
    w: (0.2 + r() * 0.25) * (r() < 0.5 ? -1 : 1),
    ph: r() * Math.PI * 2,
    depth: 0.35 + r() * 0.6,
    size: 0.7 + r() * 0.6,
  };
}

export type FishPath = ReturnType<typeof fishPath>;

export function fishAt(p: FishPath, t: number): { x: number; z: number; yaw: number } {
  const a = p.ph + p.w * t;
  const x = p.cx + Math.cos(a) * p.rx;
  const z = p.cz + Math.sin(a) * p.rz;
  const vx = -Math.sin(a) * p.rx * p.w;
  const vz = Math.cos(a) * p.rz * p.w;
  return { x, z, yaw: Math.atan2(vx, vz) };
}
