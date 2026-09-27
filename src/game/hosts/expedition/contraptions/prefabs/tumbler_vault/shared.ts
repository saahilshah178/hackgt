/**
 * tumbler_vault prefab shared helpers (docs/design/20 §2.5.5, §4 row 12; civil §5.12). Owned by KC (L8) with the
 * prefab core; skin files import it read-only. The pure half (door geometry, tumbler and bolt placement, the door
 * swing, beat routing) is unit-tested in shared.test.ts; drawing uses the civil kit (../oracle_ticker/civil-kit.ts).
 */
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import type { XY } from "../../types";
import { anchorIndex, numParam } from "../oracle_ticker/civil-kit";

/** W0 seam (tests/world-contract.test.ts checks every prefab shared.ts keeps it); the vault skin no longer uses it. */
export { stubBox, type StubBoxOptions } from "../_stub";

export const ARCHETYPE_ID = "tumbler_vault";
/** Placeholder tint for the W0 labelled box (kept for the seam). */
export const STUB_COLOR = 0x4a4a4a;

/** The vault door (container-local; the root sits at station.anchor, the vault floor). Civil §5.12: a 1000 px door. */
export const VAULT = {
  center: { x: 0, y: -560 },
  socketR: 522,
  doorR: 468,
  goldRingR: 440,
  innerRingR: 190,
  tumblerRingR: 292,
  tumblerR: 88,
  handwheelR: 104,
  boltLen: 104,
  boltW: 38,
  retractPx: 96,
  grille: { x: 590, y: -960, r: 54 },
} as const;

/** Tumbler i of n (display order = view.hypotheses order) on its ring, clockwise from 12 o'clock (4 → 12, 3, 6, 9). */
export function tumblerAngle(i: number, n: number): number {
  return -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n);
}
export function tumblerCenter(i: number, n: number, slidePx = 0): XY {
  const a = tumblerAngle(i, n);
  const r = VAULT.tumblerRingR - slidePx; // "slides toward the bolt channel": inward, toward the hub
  return { x: VAULT.center.x + Math.cos(a) * r, y: VAULT.center.y + Math.sin(a) * r };
}
/** Bolt j of nb sits on the rim between tumblers (4 bolts → 45°, 135°, 225°, 315°). */
export function boltAngle(j: number, nb: number): number {
  const n = Math.max(1, nb);
  return -Math.PI / 2 + Math.PI / n + (2 * Math.PI * j) / n;
}
/** The bolt bar's inner and outer ends: thrown (retract 0) it spans the rim into the socket; retracted it is drawn in. */
export function boltSpan(j: number, nb: number, retract: number): { a: XY; b: XY; angle: number } {
  const ang = boltAngle(j, nb);
  const pull = Math.max(0, Math.min(1, retract)) * VAULT.retractPx;
  const r0 = VAULT.doorR - 36 - pull;
  const r1 = r0 + VAULT.boltLen;
  const c = VAULT.center;
  return { a: { x: c.x + Math.cos(ang) * r0, y: c.y + Math.sin(ang) * r0 }, b: { x: c.x + Math.cos(ang) * r1, y: c.y + Math.sin(ang) * r1 }, angle: ang };
}
/** The door swinging on its left hinge: the face's horizontal scale and shade for door ∈ [0, 1]. */
export function doorSwing(door: number): { scaleX: number; shade: number } {
  const d = Math.max(0, Math.min(1, door));
  const a = (d * 82 * Math.PI) / 180;
  return { scaleX: Math.max(0.12, Math.cos(a)), shade: 0.45 * d };
}

// ================================================================ beat routing

export interface VaultFailRoute {
  grind: { index: number; atMs: number; deg: number; times: number } | null; // the accused tumbler grinds
  hold: { index: number; atMs: number } | null; // it holds bright while the eliminating clue slides beside its row
}
export function routeVaultFail(plan: Pick<FailurePlan, "beats">): VaultFailRoute {
  const out: VaultFailRoute = { grind: null, hold: null };
  for (const b of plan.beats as readonly FailBeat[]) {
    const i = anchorIndex(b.anchor, "tumbler_");
    if (i === null) continue;
    if (b.action === "grind" && !out.grind) out.grind = { index: i, atMs: b.atMs, deg: numParam(b, "deg", 4), times: numParam(b, "times", 3) };
    else if (b.action === "hold_bright" && !out.hold) out.hold = { index: i, atMs: b.atMs };
  }
  return out;
}

export interface VaultSuccessRoute {
  lock: { index: number | null; atMs: number } | null;
  bolts: { index: number; atMs: number }[];
  spin: { atMs: number; ringTurns: number; wheelTurns: number } | null;
  open: { atMs: number; swingMs: number } | null;
}
export function routeVaultSuccess(plan: Pick<SuccessPlan, "beats">): VaultSuccessRoute {
  const out: VaultSuccessRoute = { lock: null, bolts: [], spin: null, open: null };
  for (const b of plan.beats as readonly SuccessBeat[]) {
    if (b.action === "lock" && !out.lock) out.lock = { index: anchorIndex(b.anchor, "tumbler_"), atMs: b.atMs };
    else if (b.action === "open" && anchorIndex(b.anchor, "bolt_") !== null) out.bolts.push({ index: numParam(b, "index", anchorIndex(b.anchor, "bolt_")!), atMs: b.atMs });
    else if (b.action === "spin" && !out.spin) out.spin = { atMs: b.atMs, ringTurns: numParam(b, "ringTurns", 1.5), wheelTurns: numParam(b, "handwheelTurns", 2) };
    else if (b.action === "open" && b.anchor === "hub" && !out.open) out.open = { atMs: b.atMs, swingMs: numParam(b, "swingMs", 1200) };
  }
  return out;
}
