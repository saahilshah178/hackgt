import { SCATTER, STRUCTURES } from "../../world3d/core/catalog";
import type { ComposedWorld, Placed } from "../../world3d/core/compose";
import { MAX_WADE_DEPTH, MAX_WALK_SLOPE, onDeck, type Deck } from "../../world3d/core/navgrid";

/*
 * Movement physics for the third-person player, on the composed world: the ground height (terrain, or a bridge/dock
 * deck), what blocks a step (steep uphill ground, deep water, the map edge), and collision against structures, solid
 * vegetation and npcs. Pure and allocation-light: the controller calls `step()` every frame.
 */

export type Collider = { kind: "circle"; x: number; z: number; r: number } | { kind: "box"; x: number; z: number; hx: number; hz: number; rot: number };

export interface DeckWithHeight extends Deck {
  y: number;
}

export interface Physics {
  ground(x: number, z: number): number;
  /** can the player stand here (ignoring colliders)? `fromY` lets steep ground be walked DOWN */
  standable(x: number, z: number, fromY: number): boolean;
  /** push (x, z) out of every collider within reach; returns the corrected point */
  resolve(x: number, z: number, radius: number): { x: number; z: number };
  colliders: Collider[];
  decks: DeckWithHeight[];
  half: number;
}

const BOXY: ReadonlySet<Placed["kind"]> = new Set(["pyramid", "step_pyramid", "temple", "house", "keep", "palace", "library", "workshop", "tomb", "market_stall", "research_station", "greenhouse", "wall", "sphinx"]);

/** Solid vegetation trunk/body radius (metres) at an instance's size. */
function solidRadius(kind: keyof typeof SCATTER, height: number): number {
  switch (kind) {
    case "boulder":
      return height * 0.5;
    case "crystal":
    case "ice_shard":
      return Math.max(0.35, height * 0.18);
    case "cactus":
      return 0.35;
    default:
      return Math.max(0.25, height * 0.03);
  }
}

class SpatialHash {
  private cells = new Map<number, Collider[]>();
  constructor(private readonly size: number) {}
  private key(cx: number, cz: number) {
    return ((cx + 4096) << 13) ^ (cz + 4096);
  }
  insert(c: Collider) {
    const r = c.kind === "circle" ? c.r : Math.hypot(c.hx, c.hz);
    const x0 = Math.floor((c.x - r) / this.size);
    const x1 = Math.floor((c.x + r) / this.size);
    const z0 = Math.floor((c.z - r) / this.size);
    const z1 = Math.floor((c.z + r) / this.size);
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const k = this.key(cx, cz);
        const list = this.cells.get(k);
        if (list) list.push(c);
        else this.cells.set(k, [c]);
      }
  }
  near(x: number, z: number): Collider[] {
    return this.cells.get(this.key(Math.floor(x / this.size), Math.floor(z / this.size))) ?? [];
  }
}

export function buildPhysics(c: ComposedWorld, extra: Collider[] = []): Physics {
  const half = c.hf.size / 2;
  const colliders: Collider[] = [...extra];
  for (const p of [...c.landmarks, ...c.pieces]) {
    const info = STRUCTURES[p.kind];
    if (info.walkable || info.placement === "water") continue;
    if (BOXY.has(p.kind)) {
      const h = p.kind === "pyramid" || p.kind === "step_pyramid" ? p.radius * 0.98 : p.radius * 0.72;
      const hz = p.kind === "wall" ? 1.2 * p.scale : p.kind === "sphinx" ? p.radius * 0.35 : h;
      const hx = p.kind === "sphinx" ? p.radius * 0.95 : h;
      colliders.push({ kind: "box", x: p.x, z: p.z, hx, hz, rot: p.rotation });
    } else colliders.push({ kind: "circle", x: p.x, z: p.z, r: p.radius * 0.85 });
  }
  for (const batch of c.scatter) {
    const info = SCATTER[batch.kind];
    if (!info.solid) continue;
    for (let i = 0; i < batch.count; i++) {
      const o = i * 5;
      const height = info.size[1] * batch.data[o + 4];
      colliders.push({ kind: "circle", x: batch.data[o], z: batch.data[o + 2], r: solidRadius(batch.kind, height) });
    }
  }
  const hash = new SpatialHash(8);
  for (const col of colliders) hash.insert(col);

  const decks: DeckWithHeight[] = [];
  for (const p of [...c.landmarks, ...c.pieces]) {
    if (p.kind !== "bridge" && p.kind !== "dock") continue;
    const d = c.decks.find((k) => Math.abs(k.x - p.x) < 0.5 && Math.abs(k.z - p.z) < 0.5);
    if (d) decks.push({ ...d, y: p.y + (p.kind === "bridge" ? 0.35 : 0.3) });
  }

  const ground = (x: number, z: number) => {
    let h = c.hf.height(x, z);
    for (const d of decks) if (onDeck(d, x, z)) h = Math.max(h, d.y);
    return h;
  };
  const standable = (x: number, z: number, fromY: number) => {
    if (Math.abs(x) > half - 3 || Math.abs(z) > half - 3) return false;
    if (decks.some((d) => onDeck(d, x, z))) return true;
    if (c.hf.waterDepth(x, z) > MAX_WADE_DEPTH) return false;
    const g = c.hf.height(x, z);
    return !(g > fromY + 0.05 && c.hf.slope(x, z) > MAX_WALK_SLOPE);
  };
  const resolve = (x: number, z: number, radius: number) => {
    let px = x;
    let pz = z;
    for (let pass = 0; pass < 2; pass++) {
      for (const col of hash.near(px, pz)) {
        if (col.kind === "circle") {
          const dx = px - col.x;
          const dz = pz - col.z;
          const d = Math.hypot(dx, dz);
          const min = col.r + radius;
          if (d < min && d > 1e-6) {
            px = col.x + (dx / d) * min;
            pz = col.z + (dz / d) * min;
          }
        } else {
          // to box space (rotation about y), clamp, push out along the shallowest axis
          const s = Math.sin(col.rot);
          const co = Math.cos(col.rot);
          const dx = px - col.x;
          const dz = pz - col.z;
          const lx = dx * co - dz * s;
          const lz = dx * s + dz * co;
          const ex = col.hx + radius;
          const ez = col.hz + radius;
          if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
            let nx = lx;
            let nz = lz;
            if (ex - Math.abs(lx) < ez - Math.abs(lz)) nx = Math.sign(lx || 1) * ex;
            else nz = Math.sign(lz || 1) * ez;
            px = col.x + nx * co + nz * s;
            pz = col.z - nx * s + nz * co;
          }
        }
      }
    }
    return { x: px, z: pz };
  };
  return { ground, standable, resolve, colliders, decks, half };
}

export interface Body {
  x: number;
  y: number;
  z: number;
  vy: number;
  grounded: boolean;
}

/**
 * One physics step: try the horizontal move (whole, then each axis alone so walls slide), resolve colliders, then
 * gravity and ground contact. `jump` only fires from the ground.
 */
export function step(ph: Physics, body: Body, move: { dx: number; dz: number }, jump: boolean, dt: number, radius = 0.38): Body {
  let { x, z } = body;
  const tryMove = (nx: number, nz: number) => ph.standable(nx, nz, body.y);
  if (tryMove(x + move.dx, z + move.dz)) {
    x += move.dx;
    z += move.dz;
  } else if (tryMove(x + move.dx, z)) x += move.dx;
  else if (tryMove(x, z + move.dz)) z += move.dz;
  const r = ph.resolve(x, z, radius);
  // never let a collider push the player into water or off a cliff
  if (ph.standable(r.x, r.z, body.y)) {
    x = r.x;
    z = r.z;
  }
  const g = ph.ground(x, z);
  let vy = body.vy;
  let y = body.y;
  let grounded = body.grounded;
  if (grounded && jump) {
    vy = 7.2;
    grounded = false;
  }
  vy -= 22 * dt;
  y += vy * dt;
  // stick to the ground on gentle descents instead of hopping down every slope
  if (grounded && y > g && y - g < 0.6 && vy <= 0) y = g;
  if (y <= g) {
    y = g;
    vy = 0;
    grounded = true;
  } else if (y - g > 0.6) grounded = false;
  return { x, y, z, vy, grounded };
}
