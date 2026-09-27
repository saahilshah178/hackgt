/**
 * claim_holders · skin specimen_pods (cell e1, e3, e4, e7; cell §5.P, §5.1, §5.3, §5.4, §5.7; §4.3 slots pod,
 * letter_plate, probe_emitter, mimic_mote, and per reference sim: probe_well + needle + ion / dye_tank + balance_beam /
 * basin + test_cell + raft_lock / low_tank + high_tank + flume_pump + lantern). Three Specimen Pods (1.1 H: a cream
 * pedestal with a navy band and a gold rim, a glass capsule in a bronze collar, dormant haze inside) stand on a low dais
 * left of the console; a coiled probe emitter on the console aims its beam at the chosen pod; the chosen pod projects its
 * claim GHOST (a white-cyan hologram at 45 %, 12 Hz scanline shimmer) onto the station's live REFERENCE APPARATUS:
 *   - bilayer_probe (e1): the Probe Well, a cutaway of the bilayer; the needle pushes d nm in, the heads part and reseal,
 *     the Na⁺ ion is held at the head/tail boundary;
 *   - diffusion_tank (e3): the Dye Tank split by a membrane window, the dye and the wandering tracer, the Balance Lock
 *     beam tilting with C_L − C_R and its boom across the road;
 *   - osmotic_cell (e4): the Osmometer Basin with the Test Cell swelling or crenating, bouncing salt cubes, water
 *     droplets, and the dry Raft Lock beside it;
 *   - pump_flume (e7): the Uphill Flume (Low Tank, pump, High Tank, leak trough, the ATP pipe) and the hall's 12 lanterns.
 * Letters on the plates follow display order (stroked glyphs; the claims card carries the words).
 *
 * Robust to the eased pose: the beam follows the pose's continuous `aimAngle` (mapped from the meta's standard rig to
 * this skin's pod row) and the aimed pod is read from the continuous `holderGlow`, so the world stays live even where a
 * discrete field lags; the ghost id comes from the station config for the aimed claim (claim renders, never verdicts).
 * Success plays the config's quarantine (`ridge_thaw`, `tank_dilate`, `raft_lock_flood`, `lanterns_ignite`) as read from
 * the success plan's beats; failure holds the honest pod bright and snaps its ghost into register. Code-drawn stand-ins
 * until C2's hero parts land.
 */
import type Phaser from "phaser";
import type { ClaimHoldersConfig } from "@/world/contraptions/claim-holders.config";
import { AIM_RIGS, chestsOf, osmoticVolume, type ClaimHoldersPose } from "@/world/contraptions/claim-holders.meta";
import { clamp, clamp01, ease, lerp } from "@/world/ease";
import type { FailurePlan, SuccessPlan } from "@/world/types";
import type { ContraptionState, PoseView, PrefabProps, SkinPrefab, XY } from "../../../types";
import {
  cellColors,
  drawAtpSpark,
  drawBeamLine,
  drawBubbles,
  drawCellLectern,
  drawHydrationShell,
  drawLetter,
  drawMolecule,
  drawSpark,
  fillPoly,
  hash01,
  mix,
  moleculeColor,
  strokePoly,
  timerBag,
} from "../../stage_machine/shared";

// ================================================================ pure helpers (unit-tested in specimen_pods.test.ts)

export const POD = { spacing: 118, fromConsole: 180, pedestal: 78, collar: 14, capsule: 96, w: 72 } as const;
export const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

/** Pod x (container-local) for display slot `slot` of `n`: a row left of the console, the last pod nearest it. */
export function podX(consoleX: number, n: number, slot: number): number {
  return consoleX - POD.fromConsole - (n - 1 - slot) * POD.spacing;
}
/** The capsule centre of a pod standing on ground y `g`. */
export function capsuleCenter(consoleX: number, g: number, n: number, slot: number): XY {
  return { x: podX(consoleX, n, slot), y: g - POD.pedestal - POD.collar - POD.capsule / 2 };
}
/**
 * The continuous slot the pose's eased `aimAngle` points at, through the meta's standard probe_emitter rig (the angle is
 * eased by the controller, so the beam sweeps smoothly between pods): the ray from the rig's aimer meets the rig's row.
 */
export function slotFromAim(aimAngle: number, n: number): number {
  const rig = AIM_RIGS.probe_emitter;
  const s = Math.sin(aimAngle);
  const dy = rig.holderY - rig.aimer.y;
  const rowX = Math.abs(s) < 1e-3 || Math.sign(s) !== Math.sign(dy) ? (Math.cos(aimAngle) >= 0 ? 1e4 : -1e4) : rig.aimer.x + (dy * Math.cos(aimAngle)) / s;
  return clamp((rowX - rig.cx) / rig.spacing + (n - 1) / 2, -0.4, n - 0.6);
}
/** The aimed display slot read from continuous fields: the brightest holder while the beam is on, else null. */
export function aimedSlotOf(pose: Pick<ClaimHoldersPose, "beam" | "holderGlow" | "aimed">): number | null {
  if (pose.beam < 0.3) return null;
  const g = pose.holderGlow;
  if (g.length === 0) return pose.aimed;
  let best = 0;
  for (let i = 1; i < g.length; i++) if ((g[i] ?? 0) > (g[best] ?? 0)) best = i;
  const spread = Math.max(...g) - Math.min(...g);
  return spread > 0.08 ? best : pose.aimed;
}
/** The claim ghost the aimed pod projects (from the station config: what the claim predicts, never a verdict). */
export function ghostOf(config: Pick<ClaimHoldersConfig, "holders">, view: unknown, slot: number | null): string | null {
  if (slot === null) return null;
  const chest = chestsOf(view)[slot];
  if (!chest) return null;
  return config.holders.find((h) => h.statementIndex === chest.statementIndex)?.ghost ?? null;
}
/** The probe value behind the pose's eased probeU. */
export function probeValueOf(config: Pick<ClaimHoldersConfig, "probe">, probeU: number | null): number | null {
  const p = config.probe;
  if (!p || probeU === null) return null;
  return p.min + probeU * (p.max - p.min);
}
/** Ghosts project only inside the claims' scenario (probe > scenarioMin, cell e4). */
export function scenarioOkOf(config: Pick<ClaimHoldersConfig, "probe" | "scenarioMin">, probeU: number | null): boolean {
  if (config.scenarioMin === null) return true;
  const v = probeValueOf(config, probeU);
  return v !== null && v > config.scenarioMin;
}
/** The fluid parting of the lipid heads around a needle at x_n pushed d nm in (cell §5.1): Δx, Δy per head. */
export function headParting(x: number, xn: number, d: number): { dx: number; dy: number; tilt: number } {
  const k = Math.min(Math.max(d, 0), 1) * Math.exp(-((x - xn) ** 2) / (2 * 36 * 36));
  const dx = Math.sign(x - xn) * 22 * k;
  return { dx, dy: -4 * k, tilt: (0.4 * dx) / 22 };
}
export type Quarantine = "ridge_thaw" | "tank_dilate" | "raft_lock_flood" | "lanterns_ignite" | "mimic_crab" | "retract_stamp";
/** What the success plan says: which pod is quarantined, by which animation, and when the payoff beat fires. */
export function readSuccess(plan: SuccessPlan): { slot: number | null; quarantine: Quarantine | null; payoffAtMs: number | null; honest: number[]; lanterns: { at: number; stagger: number; count: number } | null } {
  let slot: number | null = null;
  let quarantine: Quarantine | null = null;
  let payoffAtMs: number | null = null;
  let lanterns: { at: number; stagger: number; count: number } | null = null;
  const honest: number[] = [];
  for (const b of plan.beats) {
    const m = /^pod_(\d+)$/.exec(b.anchor);
    if (m && typeof b.params?.quarantine === "string") {
      slot = Number(m[1]);
      quarantine = b.params.quarantine as Quarantine;
    } else if (m && b.action === "spin") honest.push(Number(m[1]));
    if (b.anchor === "apparatus" && b.action === "light_sequence") {
      lanterns = { at: b.atMs, stagger: Number(b.params?.staggerMs ?? 80), count: Number(b.params?.count ?? 12) };
    } else if (b.anchor === "apparatus" && typeof b.params?.anim === "string") payoffAtMs = b.atMs;
  }
  return { slot, quarantine, payoffAtMs, honest, lanterns };
}
/** What the failure plan says: the honest pod held bright, and whether its ghost snaps into register. */
export function readFailure(plan: FailurePlan): { slot: number | null; ghostRegister: boolean; apparatus: string | null } {
  let slot: number | null = null;
  let ghostRegister = false;
  let apparatus: string | null = null;
  for (const b of plan.beats) {
    const m = /^pod_(\d+)$/.exec(b.anchor);
    if (m && b.action === "hold_bright") slot = Number(m[1]);
    if (b.anchor === "ghost_origin" && b.action === "flash") ghostRegister = true;
    if (b.anchor === "apparatus") apparatus = b.action;
  }
  return { slot, ghostRegister, apparatus };
}

// ================================================================ the view

type Sim = "bilayer_probe" | "diffusion_tank" | "osmotic_cell" | "pump_flume" | "none";
const DYE = 0xd46ba8;
const GHOST = 0xdff8ff;
const BEAM = 0x8fe0ea;

interface Dyn {
  now: number;
  state: ContraptionState;
  success: { start: number; slot: number | null; quarantine: Quarantine | null; honest: number[]; payoffAt: number | null; lanterns: { at: number; stagger: number; count: number } | null } | null;
  fail: { start: number; slot: number | null; ghost: boolean; apparatus: string | null } | null;
  payoff: number; // 0 … 1 (the station's own payoff parts: boom, raft lock, lanterns)
  tracer: XY[];
  tracerLoad: number;
  simAcc: number;
}

function createPodsView(scene: Phaser.Scene, props: PrefabProps<ClaimHoldersConfig>): PoseView<ClaimHoldersPose> {
  const config = props.config;
  const view = props.view;
  const anchor = props.station.anchor;
  const c = cellColors(props.palette);
  const reduced = props.reducedMotion;
  const g = props.groundY - anchor.y; // ground under the console, container-local
  const consoleLocal: XY = { x: props.station.consoleX - anchor.x, y: g };
  const cx = consoleLocal.x;
  const sim: Sim = config.referenceSim?.id ?? "none";
  const n = Math.max(1, chestsOf(view).length || 3);
  const seed = props.seed >>> 0;

  const root = scene.add.container(anchor.x, anchor.y);
  const back = scene.add.graphics(); // static: dais, pedestals, lectern, apparatus frames
  const appG = scene.add.graphics(); // the live apparatus
  const podG = scene.add.graphics(); // capsules, haze, motes, glows
  const ghostG = scene.add.graphics(); // ghost projections
  const frontG = scene.add.graphics(); // emitter, beam, fx
  root.add([back, appG, podG, ghostG, frontG]);

  let alive = true;
  const timers = timerBag(scene, () => alive);
  const dyn: Dyn = { now: 0, state: "dormant", success: null, fail: null, payoff: 0, tracer: [], tracerLoad: -1, simAcc: 0 };
  let pose: ClaimHoldersPose | null = null;

  // ---------------------------------------------------------------- layout per apparatus
  const A = (() => {
    switch (sim) {
      case "bilayer_probe":
        return { apparatus: { x: -55, y: g - 190 }, ghost: { x: -55, y: g + 104 }, well: { x0: -175, x1: 65 }, needleX: -55 };
      case "diffusion_tank":
        return { apparatus: { x: -190, y: g - 312 }, ghost: { x: 0, y: g - 312 }, tank: { x0: -320, x1: 320, y0: g - 300, y1: g - 26 }, pivot: { x: 0, y: g - 388 }, boom: { x: 370, y: g - 104 } };
      case "osmotic_cell":
        return { apparatus: { x: -40, y: g - 300 }, ghost: { x: 236, y: g - 210 }, basin: { x0: -300, x1: 222, y0: g - 292, y1: g - 8 }, cell: { x: -40, y: g - 150 }, lock: { x0: 252, x1: 384, y0: g - 510 } };
      case "pump_flume":
        return { apparatus: { x: 0, y: g - 290 }, ghost: { x: 0, y: g - 120 }, low: { x0: -330, x1: -150, y0: g - 210, y1: g }, high: { x0: 150, x1: 330, y0: g - 414, y1: g - 204 }, pump: { x0: -86, x1: 86, y0: g - 262, y1: g } };
      default:
        return { apparatus: { x: 0, y: g - 150 }, ghost: { x: 0, y: g - 250 } };
    }
  })() as {
    apparatus: XY;
    ghost: XY;
    well?: { x0: number; x1: number };
    needleX?: number;
    tank?: { x0: number; x1: number; y0: number; y1: number };
    pivot?: XY;
    boom?: XY;
    basin?: { x0: number; x1: number; y0: number; y1: number };
    cell?: XY;
    lock?: { x0: number; x1: number; y0: number };
    low?: { x0: number; x1: number; y0: number; y1: number };
    high?: { x0: number; x1: number; y0: number; y1: number };
    pump?: { x0: number; x1: number; y0: number; y1: number };
  };
  const emitter: XY = { x: cx + 18, y: g - 206 };
  const LANTERNS = Array.from({ length: 12 }, (_, i) => ({ x: -760 + i * 124, y: g - 540 + (i % 2) * 36 }));

  // ---------------------------------------------------------------- static parts
  const drawStatic = () => {
    // the dais and the pod pedestals (the capsules are dynamic: glow, frost, water)
    const x0 = podX(cx, n, 0) - 64;
    const x1 = podX(cx, n, n - 1) + 64;
    back.fillStyle(c.navyDark, 0.22);
    back.fillEllipse((x0 + x1) / 2, g - 2, x1 - x0 + 40, 20);
    back.fillStyle(c.stoneShade, 1);
    back.fillRoundedRect(x0, g - 16, x1 - x0, 16, 5);
    back.fillStyle(c.stoneLit, 1);
    back.fillRect(x0 + 6, g - 16, x1 - x0 - 12, 4);
    for (let i = 0; i < n; i++) {
      const x = podX(cx, n, i);
      const top = g - POD.pedestal;
      back.fillStyle(c.stoneShade, 1);
      fillPoly(back, [{ x: x - 30, y: g - 14 }, { x: x + 30, y: g - 14 }, { x: x + 24, y: top }, { x: x - 24, y: top }]);
      back.fillStyle(c.stone, 1);
      fillPoly(back, [{ x: x - 30, y: g - 14 }, { x: x + 4, y: g - 14 }, { x: x + 2, y: top }, { x: x - 24, y: top }]);
      back.fillStyle(c.navy, 1);
      back.fillRect(x - 27, g - 58, 54, 10);
      back.fillStyle(c.gold, 1);
      back.fillRect(x - 30, top - 4, 60, 6);
      // the letter plate (display order)
      back.fillStyle(c.goldDeep, 1);
      back.fillCircle(x, g - 34, 16);
      back.fillStyle(c.stoneLit, 1);
      back.fillCircle(x, g - 34, 13);
      drawLetter(back, LETTERS[i] ?? "?", x, g - 34, 16, c.navy);
    }
    drawCellLectern(back, consoleLocal, c, 0.7);
    // the emitter's coiled stem on the console
    back.lineStyle(7, c.stoneShade, 1);
    const coil: XY[] = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      coil.push({ x: cx + 18 + 10 * Math.sin(u * Math.PI * 5), y: g - 124 - u * 70 });
    }
    strokePoly(back, coil);
    back.lineStyle(3, c.gold, 1);
    strokePoly(back, coil);
    // the apparatus frames
    if (A.well) {
      const { x0: wx0, x1: wx1 } = A.well;
      back.fillStyle(c.navyDark, 0.9);
      back.fillRoundedRect(wx0 - 8, g - 8, wx1 - wx0 + 16, 226, 10);
      back.lineStyle(5, c.gold, 1);
      back.strokeRoundedRect(wx0 - 8, g - 8, wx1 - wx0 + 16, 226, 10);
      // the needle gantry
      const nx = A.needleX ?? 0;
      back.fillStyle(c.stoneShade, 1);
      back.fillRect(nx - 96, g - 330, 18, 322);
      back.fillRect(nx + 78, g - 330, 18, 322);
      back.fillStyle(c.stone, 1);
      back.fillRoundedRect(nx - 104, g - 350, 208, 26, 8);
      back.fillStyle(c.navy, 1);
      back.fillRect(nx - 104, g - 336, 208, 6);
    }
    if (A.tank && A.pivot) {
      const T = A.tank;
      back.fillStyle(c.stoneShade, 1);
      back.fillRoundedRect(T.x0 - 18, T.y1, T.x1 - T.x0 + 36, g - T.y1, 6);
      back.fillStyle(c.stone, 1);
      back.fillRect(A.pivot.x - 14, A.pivot.y, 28, T.y0 - A.pivot.y);
    }
    if (A.basin) {
      const B = A.basin;
      back.fillStyle(c.stoneShade, 1);
      back.fillRoundedRect(B.x0 - 16, B.y1 - 4, B.x1 - B.x0 + 32, g - B.y1 + 4, 6);
    }
    if (A.low && A.high && A.pump) {
      back.fillStyle(c.stoneShade, 1);
      back.fillRect(A.high.x0 - 10, A.high.y1, A.high.x1 - A.high.x0 + 20, g - A.high.y1);
      back.fillStyle(c.stone, 1);
      back.fillRect(A.high.x0 - 10, A.high.y1, 60, g - A.high.y1);
      back.fillStyle(c.navy, 1);
      back.fillRect(A.high.x0 - 10, A.high.y1 + 30, A.high.x1 - A.high.x0 + 20, 8);
      // the leak trough: from the High Tank's foot down to the Low Tank
      back.lineStyle(14, c.stoneDeep, 1);
      strokePoly(back, [{ x: A.high.x0, y: A.high.y1 - 12 }, { x: A.pump.x1 + 10, y: g - 40 }, { x: A.pump.x0 - 10, y: g - 40 }, { x: A.low.x1, y: A.low.y0 + 60 }]);
      back.lineStyle(6, c.tideDeep, 0.8);
      strokePoly(back, [{ x: A.high.x0, y: A.high.y1 - 14 }, { x: A.pump.x1 + 10, y: g - 42 }, { x: A.pump.x0 - 10, y: g - 42 }, { x: A.low.x1, y: A.low.y0 + 58 }]);
    }
  };
  drawStatic();

  // ---------------------------------------------------------------- per-frame state readers
  const apparatus = (p: ClaimHoldersPose, key: string, fallback: number): number => {
    const v = p.apparatus[key];
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  const probeNow = (p: ClaimHoldersPose): number => probeValueOf(config, p.probeU) ?? config.probe?.initial ?? config.probe?.min ?? 0;
  const tSec = () => dyn.now / 1000;
  const shimmer = () => (reduced ? 1 : 0.85 + 0.15 * Math.sin(dyn.now / 1000 * 2 * Math.PI * 12));

  // ---------------------------------------------------------------- pods
  const drawPods = (p: ClaimHoldersPose, aimed: number | null) => {
    podG.clear();
    const s = dyn.success;
    const f = dyn.fail;
    for (let i = 0; i < n; i++) {
      const cc = capsuleCenter(cx, g, n, i);
      const glow = p.holderGlow[i] ?? 0.8;
      const lit = dyn.state === "dormant" ? 0.4 : glow;
      const held = f && f.slot === i ? clamp01(1 - (dyn.now - f.start) / 2000) : 0;
      const quarantined = s && s.slot === i;
      const hum = s && s.honest.includes(i) ? clamp01((dyn.now - s.start - 400) / 500) : 0;
      // halo (crystal.base at 30 %) on the aimed pod, brighter when an honest pod holds bright after a failure
      if ((aimed === i && dyn.state !== "dormant") || held > 0) {
        podG.fillStyle(0x6ed2f2, 0.3 * Math.max(held, aimed === i ? 1 : 0));
        podG.fillEllipse(cc.x, cc.y, POD.w + 70, POD.capsule + 70);
      }
      // the bronze collar (irises open in tank_dilate)
      const iris = quarantined && s.quarantine === "tank_dilate" ? clamp01((dyn.now - s.start) / 400) : 0;
      const collarY = g - POD.pedestal - POD.collar;
      podG.fillStyle(c.bronze, 1);
      podG.fillRoundedRect(cc.x - POD.w / 2 - 4, collarY, POD.w + 8, POD.collar, 4);
      if (iris > 0) {
        podG.fillStyle(c.navyDark, 1);
        podG.fillRect(cc.x - (POD.w / 2) * iris, collarY + 3, POD.w * iris, POD.collar - 6);
      }
      // the glass capsule (#C9F3FF @ 30 %), its haze, rim
      const capTop = cc.y - POD.capsule / 2;
      podG.fillStyle(0xc9f3ff, 0.18 + 0.14 * lit);
      podG.fillRoundedRect(cc.x - POD.w / 2, capTop, POD.w, POD.capsule, 26);
      // dormant specimen haze: a slow swirl
      for (let k = 0; k < 4; k++) {
        const a = (reduced ? 0 : tSec() * 0.6) + k * 1.57 + i;
        podG.fillStyle(mix(0xdce8ea, 0x8fe0ea, lit), 0.18 + 0.1 * lit);
        podG.fillCircle(cc.x + Math.cos(a) * 14, cc.y + Math.sin(a) * 20, 12 - k * 1.5);
      }
      // quarantine: the Mimic Mote inside the chosen pod, acting out its claim
      if (quarantined) drawQuarantine(cc, s.quarantine, dyn.now - s.start);
      // honest pods hum: their rings turn 30° with a teal glow
      podG.lineStyle(3, mix(c.goldHi, 0x6ed2f2, hum), 1);
      podG.strokeRoundedRect(cc.x - POD.w / 2, capTop, POD.w, POD.capsule, 26);
      if (hum > 0) {
        const a0 = -Math.PI / 2 + (hum * Math.PI) / 6;
        for (let k = 0; k < 3; k++) {
          const a = a0 + (k * 2 * Math.PI) / 3;
          podG.fillStyle(0x6ed2f2, 0.9);
          podG.fillCircle(cc.x + Math.cos(a) * (POD.w / 2 + 8), cc.y + Math.sin(a) * (POD.capsule / 2 + 6), 5);
        }
      }
      podG.fillStyle(0xffffff, 0.35);
      podG.fillRoundedRect(cc.x - POD.w / 2 + 8, capTop + 10, 8, POD.capsule - 28, 4);
      // the failure chime: a small bell glyph over the honest pod
      if (f && f.slot === i && dyn.now - f.start < 900) {
        const u = clamp01((dyn.now - f.start) / 900);
        const by = capTop - 30 - 16 * u;
        podG.fillStyle(c.goldHi, 1 - u);
        fillPoly(podG, [{ x: cc.x - 12, y: by + 10 }, { x: cc.x + 12, y: by + 10 }, { x: cc.x + 8, y: by - 8 }, { x: cc.x - 8, y: by - 8 }]);
        podG.fillCircle(cc.x, by + 13, 4);
      }
    }
  };
  const drawMote = (at: XY, r: number, alpha: number, color = 0xb8e6c9) => {
    podG.fillStyle(color, 0.85 * alpha);
    podG.fillEllipse(at.x, at.y, r * 2.2, r * 1.8);
    podG.fillStyle(0xffffff, 0.6 * alpha);
    podG.fillCircle(at.x - r * 0.4, at.y - r * 0.3, r * 0.3);
    podG.fillStyle(c.navyDark, alpha);
    podG.fillCircle(at.x - 4, at.y - 2, 2);
    podG.fillCircle(at.x + 4, at.y - 2, 2);
  };
  const drawQuarantine = (cc: XY, q: Quarantine | null, e: number) => {
    const capTop = cc.y - POD.capsule / 2;
    switch (q) {
      case "ridge_thaw": {
        // the glass frosts in hex facets from the rim inward; the Mote stiffens into a holed slab, cracks and shatters
        const frost = clamp01(e / 250);
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * 2 * Math.PI;
          const r = 30 * (1 - frost * 0.6) + 8;
          podG.fillStyle(0xdce8ea, 0.5 * frost);
          podG.fillCircle(cc.x + Math.cos(a) * r, cc.y + Math.sin(a) * r * 1.3, 9);
        }
        if (e < 400) {
          const slab = clamp01((e - 150) / 150);
          if (slab <= 0) drawMote(cc, 14, 1);
          else {
            podG.fillStyle(0xc8cfd2, 1);
            podG.fillRect(cc.x - 22, cc.y - 16, 44, 32);
            podG.fillStyle(c.navyDark, 1);
            for (const [hx, hy] of [[-10, -6], [10, -6], [-10, 8], [10, 8]] as const) podG.fillCircle(cc.x + hx, cc.y + hy, 3.5 * slab);
          }
        } else if (e < 1100) {
          const u = clamp01((e - 400) / 700);
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * 2 * Math.PI + 0.3;
            podG.fillStyle(0xffffff, 1 - u);
            podG.fillCircle(cc.x + Math.cos(a) * 60 * u, cc.y + Math.sin(a) * 60 * u - 30 * u, 4);
          }
        }
        break;
      }
      case "tank_dilate": {
        // the Mote's dots march toward the open collar in formation, lose step, spill out and fade
        const u = clamp01(e / 900);
        for (let k = 0; k < 8; k++) {
          const col = k % 4;
          const row = Math.floor(k / 4);
          const march = { x: cc.x - 20 + col * 13, y: cc.y - 16 + row * 16 + 30 * clamp01(e / 250) };
          const jitter = e > 250 ? (hash01(k, Math.floor(e / 60)) - 0.5) * 16 * u : 0;
          const spill = e > 400 ? clamp01((e - 400) / 500) : 0;
          const a = (k / 8) * 2 * Math.PI;
          podG.fillStyle(DYE, 1 - spill);
          podG.fillCircle(march.x + jitter + Math.cos(a) * 70 * spill, march.y + jitter + Math.sin(a) * 40 * spill + 40 * spill, 4.5);
        }
        break;
      }
      case "raft_lock_flood": {
        // water rises in the capsule; the cube-shaped Mote stays pinned to the wall, crenates and pops
        const rise = clamp01(e / 600);
        podG.fillStyle(c.water, 0.55);
        podG.fillRoundedRect(cc.x - POD.w / 2 + 4, capTop + POD.capsule * (1 - rise), POD.w - 8, POD.capsule * rise - 4, 18);
        if (e < 400) {
          const cren = clamp01((e - 250) / 150);
          podG.fillStyle(0xffffff, 0.9);
          podG.fillRect(cc.x + 12 - cren * 2, cc.y - 10, 16 - cren * 4, 16 - cren * 4);
        } else if (e < 1000) drawBubbles(podG, { x: cc.x + 18, y: cc.y }, 1 - clamp01((e - 400) / 600), c);
        break;
      }
      case "lanterns_ignite": {
        // the capsule dims; a gold spark climbs the collar; the Mote (drifting downhill) is lifted out of the top vent
        const dim = clamp01(e / 200);
        podG.fillStyle(c.navyDark, 0.35 * dim);
        podG.fillRoundedRect(cc.x - POD.w / 2, capTop, POD.w, POD.capsule, 26);
        const climb = clamp01(e / 250);
        drawAtpSpark(podG, cc.x + POD.w / 2 + 6, lerp(cc.y + POD.capsule / 2, capTop, climb), 12, c, 1 - clamp01((e - 400) / 300));
        if (e < 400) drawMote({ x: cc.x, y: lerp(cc.y + 20, capTop - 20, ease("in_cubic", clamp01((e - 150) / 250))) }, 12, 1);
        else if (e < 1200) {
          const u = clamp01((e - 400) / 800);
          podG.fillStyle(c.atp, 0.5 * (1 - u));
          podG.fillCircle(cc.x, capTop - 40, 20 + 40 * u);
        }
        break;
      }
      default:
        drawMote(cc, 14, clamp01(1 - e / 900));
    }
  };

  // ---------------------------------------------------------------- the apparatus per reference sim
  const drawApparatus = (p: ClaimHoldersPose, ghost: string | null, ghostAlpha: number) => {
    appG.clear();
    ghostG.clear();
    const wobble = dyn.fail && dyn.fail.apparatus === "wobble" && dyn.now - dyn.fail.start < 520 && !reduced ? 2 * Math.sin((dyn.now - dyn.fail.start) / 18) : 0;
    const gAlpha = ghostAlpha * shimmer();
    if (sim === "bilayer_probe") drawWell(p, ghost, gAlpha, wobble);
    else if (sim === "diffusion_tank") drawTank(p, ghost, gAlpha);
    else if (sim === "osmotic_cell") drawBasin(p, ghost, gAlpha);
    else if (sim === "pump_flume") drawFlume(p, ghost, gAlpha);
    if (p.highlight && !p.solved) {
      const at = highlightAt(p);
      appG.lineStyle(4, 0xffffff, 0.9);
      appG.strokeCircle(at.x, at.y, 30);
    }
  };
  const highlightAt = (p: ClaimHoldersPose): XY => {
    if (sim === "bilayer_probe") return { x: A.needleX ?? 0, y: g + 37 };
    if (sim === "diffusion_tank") return dyn.tracer[dyn.tracer.length - 1] ?? A.apparatus;
    if (sim === "osmotic_cell") return { x: (A.cell?.x ?? 0) + cellR(p) + 16, y: A.cell?.y ?? 0 };
    if (sim === "pump_flume" && A.high) return { x: (A.high.x0 + A.high.x1) / 2, y: fillY(A.high, apparatus(p, "sim_cHigh", 5)) };
    return A.apparatus;
  };

  // e1 · the Probe Well
  const drawWell = (p: ClaimHoldersPose, ghost: string | null, gAlpha: number, wobble: number) => {
    const W = A.well!;
    const nx = (A.needleX ?? 0) + wobble;
    const d = sim === "bilayer_probe" ? apparatus(p, "sim_depth", apparatus(p, "depth", 0)) : 0;
    const retract = dyn.success ? clamp01((dyn.now - dyn.success.start) / 500) : 0;
    const tipD = d * (1 - retract);
    const jit = (x: number) => (reduced ? 0 : 1.5 * Math.sin(tSec() * 2 * Math.PI * 2 + x * 0.37));
    const rows = [
      { y: g + 6, dir: 1, dd: tipD },
      { y: g + 202, dir: -1, dd: Math.max(0, tipD - 4) },
    ];
    // tails and oil seam
    appG.fillStyle(c.navy, 0.9);
    appG.fillRect(W.x0, g + 100, W.x1 - W.x0, 8);
    for (const row of rows) {
      for (let x = W.x0 + 10; x <= W.x1 - 6; x += 22) {
        const pr = headParting(x, nx, row.dd);
        const hx = x + pr.dx;
        const hy = row.y + pr.dy * row.dir + jit(x);
        appG.lineStyle(5, c.tail, 1);
        strokePoly(appG, [{ x: hx, y: hy + 8 * row.dir }, { x: hx + Math.sin(pr.tilt) * 80, y: hy + 88 * row.dir }]);
        appG.fillStyle(c.headShade, 1);
        appG.fillCircle(hx + 2, hy + 2, 11);
        appG.fillStyle(c.head, 1);
        appG.fillCircle(hx, hy, 10);
        appG.fillStyle(c.headLit, 1);
        appG.fillCircle(hx - 3, hy - 3, 4);
      }
    }
    // the needle: a cream-and-gold piston with a fine gold tip at y = 41.6·d
    const tipY = g + 41.6 * tipD;
    appG.fillStyle(c.stoneShade, 1);
    appG.fillRect(nx - 12, g - 326, 24, tipY - (g - 326) - 22);
    appG.fillStyle(c.stoneLit, 1);
    appG.fillRect(nx - 12, g - 326, 10, tipY - (g - 326) - 22);
    appG.fillStyle(c.gold, 1);
    appG.fillRect(nx - 16, tipY - 60, 32, 12);
    fillPoly(appG, [{ x: nx - 8, y: tipY - 24 }, { x: nx + 8, y: tipY - 24 }, { x: nx, y: tipY }]);
    // the Na⁺ ion: rides the tip in the heads, held at the head/tail boundary past 0.9 nm (shell compressed 20 %)
    const ionD = apparatus(p, "sim_ionDepth", Math.min(tipD, 0.9));
    const held = ionD < tipD - 0.05;
    const ion = { x: nx + (held ? 18 : 0), y: g + 41.6 * Math.min(ionD, 0.9) - (held ? 4 : 18) };
    drawHydrationShell(appG, ion.x, ion.y, held ? 13 : 16, tSec(), 1, c, reduced);
    drawMolecule(appG, "na", ion.x, ion.y, 15, moleculeColor(props.palette, "na"), c, 1);
    // ghosts over the band
    if (gAlpha > 0.01 && ghost) {
      ghostG.lineStyle(3, GHOST, gAlpha);
      if (ghost === "bilayer_outline") {
        for (const row of rows) {
          for (let x = W.x0 + 10; x <= W.x1 - 6; x += 22) {
            const pr = headParting(x, nx, row.dd);
            ghostG.strokeCircle(x + pr.dx, row.y + pr.dy * row.dir, 12);
            strokePoly(ghostG, [{ x: x + pr.dx, y: row.y + 10 * row.dir }, { x: x + pr.dx + Math.sin(pr.tilt) * 80, y: row.y + 88 * row.dir }]);
          }
        }
      } else if (ghost === "rigid_holed_slab") {
        // a rigid grey-white slab with evenly spaced holes: it never parts, while the real heads flow through it
        ghostG.fillStyle(0xe6edf0, 0.75 * gAlpha);
        ghostG.fillRect(W.x0, g - 6, W.x1 - W.x0, 214);
        ghostG.fillStyle(c.navyDark, 0.9 * gAlpha);
        for (let x = W.x0 + 24; x < W.x1 - 10; x += 46) for (const y of [g + 40, g + 104, g + 168]) ghostG.fillCircle(x, y, 9);
        ghostG.strokeRect(W.x0, g - 6, W.x1 - W.x0, 214);
      } else if (ghost === "core_blocks_ion") {
        ghostG.fillStyle(GHOST, 0.3 * gAlpha);
        ghostG.fillRect(W.x0, g + 44, W.x1 - W.x0, 120);
        const by = g + 37 - 22 * Math.abs(Math.sin(tSec() * 4));
        ghostG.strokeCircle(nx - 40, by, 13);
      }
    }
  };

  // e3 · the Dye Tank and the Balance Lock
  const drawTank = (p: ClaimHoldersPose, ghost: string | null, gAlpha: number) => {
    const T = A.tank!;
    const piv = A.pivot!;
    const cL = apparatus(p, "sim_cL", probeNow(p));
    const cR = apparatus(p, "sim_cR", 0);
    const level = dyn.success ? clamp01((dyn.now - dyn.success.start) / 900) : dyn.payoff;
    // glass, water, frame
    appG.fillStyle(c.tide, 0.28);
    appG.fillRect(T.x0, T.y0 + 30, T.x1 - T.x0, T.y1 - T.y0 - 30);
    // dye particles (cosmetic, seeded): N = round(10·C) per chamber
    const dots = (count: number, x0: number, x1: number, side: number) => {
      for (let i = 0; i < Math.min(100, Math.round(count * 10)); i++) {
        const hx = x0 + 14 + hash01(seed, i, side) * (x1 - x0 - 28);
        const hy = T.y0 + 44 + hash01(seed, i, side + 7) * (T.y1 - T.y0 - 60);
        const j = reduced ? 0 : 8;
        appG.fillStyle(DYE, 0.9);
        appG.fillCircle(hx + j * Math.sin(tSec() * 3 + i), hy + j * Math.cos(tSec() * 2.3 + i * 1.7), 4.5);
      }
    };
    dots(cL, T.x0, -12, 1);
    dots(cR, 12, T.x1, 2);
    // the tracer (particle #0): a white ring and a 60-point fading trail
    for (let i = 1; i < dyn.tracer.length; i++) {
      appG.lineStyle(3, 0xffffff, (i / dyn.tracer.length) * 0.8 * (dyn.fail && dyn.now - dyn.fail.start < 1000 ? 1.4 : 1));
      strokePoly(appG, [dyn.tracer[i - 1]!, dyn.tracer[i]!]);
    }
    const tr = dyn.tracer[dyn.tracer.length - 1];
    if (tr) {
      appG.fillStyle(DYE, 1);
      appG.fillCircle(tr.x, tr.y, 6);
      appG.lineStyle(3, 0xffffff, 1);
      appG.strokeCircle(tr.x, tr.y, 10);
    }
    // the membrane window: a vertical bilayer strip with 5 pore gaps (dilates on success)
    for (let y = T.y0 + 36; y < T.y1 - 6; y += 18) {
      const pore = Math.floor((y - T.y0) / 50) % 2 === 1 && (y - T.y0) % 50 < 18;
      const dilated = level > 0 && (y - T.y0) % 50 < 18 + 24 * level;
      if (pore || dilated) continue;
      appG.fillStyle(c.head, 1);
      appG.fillCircle(-8, y, 7);
      appG.fillCircle(8, y, 7);
    }
    appG.lineStyle(6, c.stoneLit, 1);
    appG.strokeRect(T.x0, T.y0, T.x1 - T.x0, T.y1 - T.y0);
    appG.fillStyle(c.gold, 1);
    for (const [x, y] of [[T.x0, T.y0], [T.x1, T.y0], [T.x0, T.y1], [T.x1, T.y1]] as const) appG.fillRect(x - 9, y - 9, 18, 18);
    // the Balance Lock beam: θ = clamp(2.2°·(C_L − C_R), ±18°), levels on success; floats sink ∝ C
    const tilt = apparatus(p, "beamTilt", (clamp(2.2 * (cL - cR), -18, 18) * Math.PI) / 180) * (1 - level);
    const half = 280;
    const a = -tilt;
    const endL = { x: piv.x - half * Math.cos(a), y: piv.y - half * Math.sin(a) };
    const endR = { x: piv.x + half * Math.cos(a), y: piv.y + half * Math.sin(a) };
    const floatL = { x: -170, y: T.y0 + 70 + 6 * cL * (1 - level) + 30 * level };
    const floatR = { x: 170, y: T.y0 + 70 + 6 * cR * (1 - level) + 30 * level };
    appG.lineStyle(3, c.stoneDeep, 1);
    strokePoly(appG, [lerpXY(endL, endR, 0.2), floatL]);
    strokePoly(appG, [lerpXY(endL, endR, 0.8), floatR]);
    for (const fl of [floatL, floatR]) {
      appG.fillStyle(c.stoneLit, 1);
      appG.fillEllipse(fl.x, fl.y, 54, 22);
      appG.lineStyle(3, c.goldDeep, 1);
      appG.strokeEllipse(fl.x, fl.y, 54, 22);
    }
    appG.lineStyle(18, c.goldDeep, 1);
    strokePoly(appG, [endL, endR]);
    appG.lineStyle(10, c.gold, 1);
    strokePoly(appG, [endL, endR]);
    appG.fillStyle(c.stoneLit, 1);
    appG.fillCircle(piv.x, piv.y, 14);
    // the boom barrier across the road (latched to the beam): lifts 85° once the beam levels
    if (A.boom) {
      const up = dyn.success ? clamp01((dyn.now - dyn.success.start - 700) / 500) : dyn.payoff;
      const lift = ((85 * Math.PI) / 180) * ease("out_cubic", up);
      const b0 = A.boom;
      const tip = { x: b0.x + Math.cos(-lift) * 210, y: b0.y + Math.sin(-lift) * 210 };
      appG.fillStyle(c.stoneShade, 1);
      appG.fillRect(b0.x - 14, b0.y - 10, 28, g - b0.y + 10);
      appG.lineStyle(16, c.goldDeep, 1);
      strokePoly(appG, [b0, tip]);
      appG.lineStyle(8, c.gold, 1);
      strokePoly(appG, [b0, tip]);
      for (let k = 1; k < 5; k++) {
        appG.fillStyle(k % 2 ? c.navy : c.stoneLit, 1);
        const at = lerpXY(b0, tip, k / 5);
        appG.fillCircle(at.x, at.y, 5);
      }
    }
    // ghosts
    if (gAlpha > 0.01 && ghost) {
      if (ghost === "random_walk") {
        for (let k = 0; k < 6; k++) {
          const hx = (k < 3 ? T.x0 + 60 : 60) + (k % 3) * 70;
          const hy = T.y0 + 80 + (k % 2) * 90;
          ghostG.lineStyle(2, GHOST, gAlpha);
          const pts: XY[] = [];
          for (let s = 0; s < 8; s++) pts.push({ x: hx + (hash01(seed + k, s + Math.floor(tSec() * 4)) - 0.5) * 50, y: hy + (hash01(seed + k, s + 30 + Math.floor(tSec() * 4)) - 0.5) * 50 });
          strokePoly(ghostG, pts);
          ghostG.strokeCircle(pts[pts.length - 1]!.x, pts[pts.length - 1]!.y, 6);
        }
      } else if (ghost === "purposeful_march") {
        // ghost particles march in straight lines left → right in formation, and all STOP once the right side fills
        const stop = cR >= cL - 0.2;
        const u = stop ? 1 : (tSec() * 0.35) % 1;
        for (let k = 0; k < 6; k++) {
          const y = T.y0 + 70 + k * 36;
          const x = lerp(T.x0 + 40, T.x1 - 60, u) - (k % 2) * 30;
          ghostG.fillStyle(GHOST, gAlpha);
          ghostG.fillCircle(x, y, 6);
          ghostG.fillTriangle(x + 10, y - 7, x + 10, y + 7, x + 22, y);
          ghostG.lineStyle(2, GHOST, gAlpha * 0.6);
          strokePoly(ghostG, [{ x: x - 60, y }, { x: x - 8, y }]);
        }
      } else if (ghost === "net_flux_arrow") {
        const j0 = 0.35 * (cL - cR);
        const len = clamp(12 * Math.abs(j0) * 4, 20, 240) * Math.sign(j0 || 1);
        const y = (A.tank?.y0 ?? 0) + 150;
        ghostG.lineStyle(10, GHOST, gAlpha);
        strokePoly(ghostG, [{ x: -len / 2, y }, { x: len / 2, y }]);
        ghostG.fillStyle(GHOST, gAlpha);
        ghostG.fillTriangle(len / 2, y - 16, len / 2, y + 16, len / 2 + 22 * Math.sign(len), y);
      }
    }
  };

  // e4 · the Osmometer Basin, the Test Cell and the Raft Lock
  const cellR = (p: ClaimHoldersPose) => 92 * Math.sqrt(Math.max(0.3, apparatus(p, "sim_volume", apparatus(p, "volume", 1))));
  const drawBasin = (p: ClaimHoldersPose, ghost: string | null, gAlpha: number) => {
    const B = A.basin!;
    const cell = A.cell!;
    const s = probeNow(p);
    const r = cellR(p);
    const cren = apparatus(p, "crenation", 0) * 1.4;
    const flux = apparatus(p, "waterFlux", 0);
    // the Raft Lock shaft: glass walls, a cream raft, water rising on success
    if (A.lock) {
      const L = A.lock;
      const rise = dyn.success && dyn.success.quarantine === "raft_lock_flood" ? ease("in_out_cubic", clamp01((dyn.now - dyn.success.start - 500) / 1600)) : dyn.payoff;
      const waterTop = g - 340 * rise;
      appG.fillStyle(c.tideDeep, 0.2);
      appG.fillRect(L.x0, L.y0, L.x1 - L.x0, g - L.y0);
      if (rise > 0) {
        appG.fillStyle(c.water, 0.6);
        appG.fillRect(L.x0, waterTop, L.x1 - L.x0, g - waterTop);
      }
      appG.fillStyle(c.stoneLit, 1);
      appG.fillRoundedRect(L.x0 + 12, waterTop - 22, L.x1 - L.x0 - 24, 18, 6);
      appG.lineStyle(5, c.stoneShade, 1);
      appG.strokeRect(L.x0, L.y0, L.x1 - L.x0, g - L.y0);
      // the membrane window between basin and lock
      for (let y = B.y0 + 30; y < B.y1 - 10; y += 20) {
        appG.fillStyle(c.head, 1);
        appG.fillCircle(L.x0 - 12, y, 7);
      }
      if (dyn.success && dyn.success.quarantine === "raft_lock_flood") {
        const e = dyn.now - dyn.success.start;
        for (let k = 0; k < 10; k++) {
          const u = ((e / 700 + k / 10) % 1) * clamp01((e - 400) / 200) * clamp01((2400 - e) / 300);
          if (u <= 0) continue;
          appG.fillStyle(c.water, 0.9);
          appG.fillCircle(lerp(cell.x + r, L.x0 + 30, u), cell.y + (k - 5) * 12, 6);
        }
      }
    }
    // basin water
    appG.fillStyle(c.tide, 0.32);
    appG.fillRect(B.x0, B.y0 + 20, B.x1 - B.x0, B.y1 - B.y0 - 20);
    // salt cubes outside (8·s, cosmetic, seeded), bouncing off the membrane: they never cross
    const cubes = Math.min(40, Math.round(8 * s * 0.5));
    for (let i = 0; i < cubes; i++) {
      let x = B.x0 + 16 + hash01(seed, i, 3) * (B.x1 - B.x0 - 32) + (reduced ? 0 : 10 * Math.sin(tSec() * 1.7 + i));
      let y = B.y0 + 34 + hash01(seed, i, 4) * (B.y1 - B.y0 - 48) + (reduced ? 0 : 10 * Math.cos(tSec() * 1.3 + i * 2));
      const dx = x - cell.x;
      const dy = y - cell.y;
      const dd = Math.hypot(dx, dy);
      if (dd < r + 12) {
        x = cell.x + (dx / (dd || 1)) * (r + 12);
        y = cell.y + (dy / (dd || 1)) * (r + 12);
      }
      const flash = dyn.fail && i < 3 && dyn.now - dyn.fail.start < 900 && Math.floor((dyn.now - dyn.fail.start) / 120) % 2 === 0;
      appG.fillStyle(flash ? c.goldHi : 0xffffff, 0.85);
      appG.fillRect(x - 5, y - 5, 10, 10);
      appG.fillStyle(0xdce8ea, 0.9);
      appG.fillRect(x - 5, y + 2, 10, 3);
    }
    // the Test Cell: peach cytoplasm, a membrane ring of tiny heads, crenation below V 0.8, a strain sheen above 1.3
    const outline: XY[] = [];
    for (let k = 0; k <= 56; k++) {
      const a = (k / 56) * 2 * Math.PI;
      const rr = r - cren * Math.abs(Math.sin(7 * a));
      outline.push({ x: cell.x + Math.cos(a) * rr, y: cell.y + Math.sin(a) * rr });
    }
    appG.fillStyle(c.cyto, 0.95);
    fillPoly(appG, outline);
    for (let k = 0; k < 40; k++) {
      const pt = outline[Math.floor((k / 40) * 56)]!;
      appG.fillStyle(c.head, 1);
      appG.fillCircle(pt.x, pt.y, 5);
    }
    if (apparatus(p, "stretch", 0) > 0.5) {
      appG.lineStyle(4, 0xffffff, 0.7);
      appG.strokeCircle(cell.x, cell.y, r + 8);
    }
    appG.fillStyle(0xd98a6a, 1);
    appG.fillCircle(cell.x + r * 0.2, cell.y - r * 0.15, Math.max(10, r * 0.22));
    for (let k = 0; k < 4; k++) {
      appG.fillStyle(0xffffff, 0.9);
      appG.fillRect(cell.x - r * 0.4 + k * 14, cell.y + r * 0.3 - (k % 2) * 10, 9, 9);
    }
    // water droplets crossing the membrane: outward when s > C_in, inward below it
    if (Math.abs(flux) > 0.2) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * 2 * Math.PI + 0.4;
        const u = reduced ? 0.5 : (tSec() * clamp(Math.abs(flux) / 12, 0.2, 1.2) + k / 6) % 1;
        const rr = flux > 0 ? lerp(r - 20, r + 40, u) : lerp(r + 40, r - 20, u);
        appG.fillStyle(c.water, 0.9);
        appG.fillCircle(cell.x + Math.cos(a) * rr, cell.y + Math.sin(a) * rr, 6);
      }
    }
    appG.lineStyle(5, c.stoneLit, 1);
    appG.strokeRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
    // ghosts (only inside the claims' scenario, s > scenarioMin)
    if (gAlpha > 0.01 && ghost && scenarioOkOf(config, p.probeU)) {
      if (ghost === "water_out_arrows") {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * 2 * Math.PI;
          const from = { x: cell.x + Math.cos(a) * (r - 10), y: cell.y + Math.sin(a) * (r - 10) };
          const to = { x: cell.x + Math.cos(a) * (r + 50), y: cell.y + Math.sin(a) * (r + 50) };
          ghostG.lineStyle(5, 0x9fd0ff, gAlpha);
          strokePoly(ghostG, [from, to]);
          ghostG.fillStyle(0x9fd0ff, gAlpha);
          ghostG.fillCircle(to.x, to.y, 7);
        }
      } else if (ghost === "salt_inflow") {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * 2 * Math.PI + 0.2;
          const u = (tSec() * 0.6 + k / 8) % 1;
          const rr = lerp(r + 70, r * 0.3, u);
          ghostG.fillStyle(GHOST, gAlpha);
          ghostG.fillRect(cell.x + Math.cos(a) * rr - 5, cell.y + Math.sin(a) * rr - 5, 10, 10);
        }
        ghostG.fillStyle(GHOST, 0.4 * gAlpha);
        ghostG.fillRect(cell.x - r * 0.6, cell.y + r * 0.1 - 40 * ((tSec() * 0.3) % 1), r * 1.2, 16);
      } else if (ghost === "shrink_outline") {
        const vT = osmoticVolume(s, config.referenceSim?.params.cIn ?? 2, config.referenceSim?.params.b ?? 0.3);
        ghostG.lineStyle(4, GHOST, gAlpha);
        ghostG.strokeCircle(cell.x, cell.y, 92 * Math.sqrt(vT));
      }
    }
  };

  // e7 · the Uphill Flume and the hall's lanterns
  const fillY = (tank: { y0: number; y1: number }, conc: number) => tank.y1 - clamp01(conc / 10) * (tank.y1 - tank.y0 - 10);
  const drawFlume = (p: ClaimHoldersPose, ghost: string | null, gAlpha: number) => {
    const L = A.low!;
    const H = A.high!;
    const P = A.pump!;
    const cHigh = apparatus(p, "sim_cHigh", 5);
    const cLow = apparatus(p, "sim_cLow", 5);
    const stroke = apparatus(p, "sim_stroke", 0);
    const r = probeNow(p);
    const stall = dyn.fail && dyn.fail.apparatus === "stall" && dyn.now - dyn.fail.start < 800;
    // the hall's lanterns (12, dark until the quarantine lights them)
    LANTERNS.forEach((ln, i) => {
      const s = dyn.success?.lanterns;
      const on = s && dyn.success ? clamp01((dyn.now - dyn.success.start - s.at - i * s.stagger) / 160) : dyn.payoff;
      appG.fillStyle(c.bronze, 1);
      appG.fillRect(ln.x - 3, ln.y - 40, 6, 20);
      appG.fillStyle(mix(0x3e3240, c.atp, on), 1);
      appG.fillRoundedRect(ln.x - 14, ln.y - 22, 28, 38, 8);
      appG.lineStyle(3, c.goldDeep, 1);
      appG.strokeRoundedRect(ln.x - 14, ln.y - 22, 28, 38, 8);
      if (on > 0.02) {
        appG.fillStyle(c.atp, 0.25 * on);
        appG.fillCircle(ln.x, ln.y, 60);
      }
    });
    // the ATP pipe from the ceiling rail: glow 0.15 + 0.08·r, light packets flowing down at a speed ∝ r
    const pipeGlow = apparatus(p, "pipeGlow", 0.15 + 0.08 * r);
    appG.lineStyle(18, c.goldDeep, 1);
    strokePoly(appG, [{ x: 0, y: g - 720 }, { x: 0, y: P.y0 }]);
    appG.lineStyle(10, mix(c.goldDeep, c.atp, clamp01(pipeGlow)), 1);
    strokePoly(appG, [{ x: 0, y: g - 720 }, { x: 0, y: P.y0 }]);
    if (r > 0.1 && !reduced) {
      for (let k = 0; k < 4; k++) {
        const u = (tSec() * 0.08 * r + k / 4) % 1;
        appG.fillStyle(c.atpCore, 0.9);
        appG.fillCircle(0, lerp(g - 720, P.y0, u), 6);
      }
    }
    // tanks with their fill lines and Na⁺ motes (8·C each)
    const tank = (T: { x0: number; x1: number; y0: number; y1: number }, conc: number, salt: number) => {
      appG.fillStyle(c.tideDeep, 0.25);
      appG.fillRect(T.x0, T.y0, T.x1 - T.x0, T.y1 - T.y0);
      const fy = fillY(T, conc);
      appG.fillStyle(c.tide, 0.45);
      appG.fillRect(T.x0 + 4, fy, T.x1 - T.x0 - 8, T.y1 - fy - 4);
      const motes = Math.min(80, Math.round(8 * conc));
      for (let i = 0; i < motes; i++) {
        const x = T.x0 + 12 + hash01(seed, i, salt) * (T.x1 - T.x0 - 24) + (reduced ? 0 : 4 * Math.sin(tSec() * 2 + i));
        const y = fy + 10 + hash01(seed, i, salt + 1) * Math.max(4, T.y1 - fy - 22);
        appG.fillStyle(moleculeColor(props.palette, "na"), 0.95);
        appG.fillCircle(x, y, 4.5);
      }
      appG.lineStyle(3, 0xffffff, 0.8);
      strokePoly(appG, [{ x: T.x0 + 4, y: fy }, { x: T.x1 - 4, y: fy }]);
      appG.lineStyle(5, c.stoneLit, 1);
      appG.strokeRect(T.x0, T.y0, T.x1 - T.x0, T.y1 - T.y0);
    };
    tank(L, cLow, 11);
    tank(H, cHigh, 21);
    // the pump: gold-trimmed body, a piston stroking at 0.4·r Hz, a gold spark per stroke
    appG.fillStyle(c.stoneShade, 1);
    appG.fillRoundedRect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0, 14);
    appG.fillStyle(c.stone, 1);
    appG.fillRoundedRect(P.x0, P.y0, (P.x1 - P.x0) * 0.55, P.y1 - P.y0, 14);
    appG.lineStyle(4, c.gold, 1);
    appG.strokeRoundedRect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0, 14);
    const piston = stall ? 0.5 : 0.5 + 0.5 * Math.sin(2 * Math.PI * stroke);
    appG.fillStyle(c.navy, 1);
    appG.fillRect(-26, P.y0 + 40 + piston * 90, 52, 22);
    appG.fillStyle(c.goldDeep, 1);
    appG.fillRect(-6, P.y0 + 10, 12, 30 + piston * 90);
    if (!stall && r > 0.1 && stroke < 0.15) drawAtpSpark(appG, 0, P.y0 + 30, 14, c, 1 - stroke / 0.15);
    // the uphill channel from the Low Tank through the pump to the High Tank
    appG.lineStyle(10, c.goldDeep, 1);
    strokePoly(appG, [{ x: L.x1, y: L.y1 - 30 }, { x: P.x0, y: P.y1 - 60 }]);
    strokePoly(appG, [{ x: P.x1, y: P.y0 + 60 }, { x: H.x0, y: H.y1 - 40 }]);
    // ghosts
    if (gAlpha > 0.01 && ghost) {
      if (ghost === "uphill_arrow") {
        ghostG.lineStyle(9, GHOST, gAlpha);
        const pts = [{ x: L.x1 - 40, y: L.y0 + 40 }, { x: 0, y: P.y0 - 60 }, { x: H.x0 + 40, y: H.y0 - 20 }];
        strokePoly(ghostG, pts);
        ghostG.fillStyle(GHOST, gAlpha);
        ghostG.fillTriangle(H.x0 + 40, H.y0 - 36, H.x0 + 40, H.y0 - 4, H.x0 + 66, H.y0 - 20);
      } else if (ghost === "atp_sparks") {
        const k = (tSec() * Math.max(0.3, 0.4 * r)) % 1;
        drawAtpSpark(ghostG, 40 * Math.cos(k * 6.28), P.y0 - 30 - 20 * k, 16, { ...c, atp: GHOST, atpCore: 0xffffff }, gAlpha * (1 - k));
      } else if (ghost === "downhill_boost") {
        // ghost motes pushed from High to Low, faster as r rises
        for (let k = 0; k < 6; k++) {
          const u = (tSec() * (0.2 + 0.12 * r) + k / 6) % 1;
          const at = lerpXY({ x: H.x0 + 20, y: H.y1 - 30 }, { x: L.x1 - 20, y: L.y0 + 50 }, u);
          ghostG.fillStyle(GHOST, gAlpha);
          ghostG.fillCircle(at.x, at.y - 40, 10);
          ghostG.fillTriangle(at.x - 18, at.y - 30, at.x - 18, at.y - 50, at.x - 34, at.y - 40);
        }
      }
    }
  };

  const lerpXY = (a: XY, b: XY, u: number): XY => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });

  // ---------------------------------------------------------------- emitter, beam, ghost projection
  const drawFront = (p: ClaimHoldersPose, slotF: number, aimed: number | null, ghost: string | null, ghostAlpha: number) => {
    frontG.clear();
    const dim = dyn.fail && dyn.now - dyn.fail.start < 700 ? (Math.floor((dyn.now - dyn.fail.start) / 90) % 2 === 0 ? 0.2 : 0.6) : 1;
    const beamAlpha = (dyn.success ? 1 : aimed === null ? 0 : p.beam) * dim * (dyn.state === "dormant" ? 0 : 1);
    // the beam lands on the (continuously eased) aim point along the pod row
    const s0 = Math.floor(clamp(slotF, 0, n - 1));
    const s1 = Math.min(n - 1, s0 + 1);
    const f = clamp01(slotF - s0);
    const target = lerpXY(capsuleCenter(cx, g, n, s0), capsuleCenter(cx, g, n, s1), f);
    if (beamAlpha > 0.02) drawBeamLine(frontG, emitter, target, BEAM, beamAlpha, dyn.now);
    // the orb
    frontG.fillStyle(0x6ed2f2, 0.35 * (0.6 + 0.4 * beamAlpha));
    frontG.fillCircle(emitter.x, emitter.y, 26);
    frontG.fillStyle(0x8fe0ea, 1);
    frontG.fillCircle(emitter.x, emitter.y, 14);
    frontG.fillStyle(0xffffff, 0.8);
    frontG.fillCircle(emitter.x - 4, emitter.y - 4, 5);
    // the projection cone from the aimed pod's capsule top to where its ghost lands
    if (aimed !== null && ghost && ghostAlpha > 0.01) {
      const cc = capsuleCenter(cx, g, n, aimed);
      const top = { x: cc.x, y: cc.y - POD.capsule / 2 };
      frontG.fillStyle(GHOST, 0.12 * ghostAlpha * shimmer());
      frontG.fillTriangle(top.x - 6, top.y, top.x + 6, top.y, A.ghost.x, A.ghost.y);
      frontG.lineStyle(2, GHOST, 0.4 * ghostAlpha);
      strokePoly(frontG, [top, A.ghost]);
    }
    // the failure's register flash: the honest ghost snaps into perfect register (45 → 80 %) and fades over 1.2 s
    if (dyn.fail?.ghost) {
      const u = clamp01((dyn.now - dyn.fail.start - 100) / 1200);
      if (u > 0 && u < 1) {
        frontG.lineStyle(4, 0xffffff, 0.8 * (1 - u));
        frontG.strokeCircle(A.ghost.x, A.ghost.y, 40 + 30 * u);
      }
    }
    if (dyn.success && dyn.success.quarantine === "ridge_thaw" && sim === "bilayer_probe") {
      const e = dyn.now - dyn.success.start;
      if (e > 400 && e < 900) drawSpark(frontG, capsuleCenter(cx, g, n, dyn.success.slot ?? 0), 1 - (e - 400) / 500, 0xffffff);
    }
  };

  // ---------------------------------------------------------------- the cosmetic tracer (e3), seeded
  const stepTracer = (p: ClaimHoldersPose, dtMs: number) => {
    if (sim !== "diffusion_tank" || !A.tank) return;
    const T = A.tank;
    const load = Math.round(probeNow(p) * 2) / 2;
    if (load !== dyn.tracerLoad) {
      dyn.tracerLoad = load;
      dyn.tracer = [{ x: T.x0 + 40 + hash01(seed, load * 10) * (-T.x0 - 80), y: T.y0 + 60 + hash01(seed, load * 10 + 1) * (T.y1 - T.y0 - 90) }];
    }
    if (reduced) return;
    dyn.simAcc += dtMs;
    let k = 0;
    while (dyn.simAcc >= 33 && k < 4) {
      dyn.simAcc -= 33;
      k++;
      const last = dyn.tracer[dyn.tracer.length - 1]!;
      const i = Math.floor(dyn.now / 33) + k;
      const gx = (hash01(seed, i, 91) + hash01(seed, i, 92) + hash01(seed, i, 93) - 1.5) * 2 * 9;
      const gy = (hash01(seed, i, 94) + hash01(seed, i, 95) + hash01(seed, i, 96) - 1.5) * 2 * 9;
      let x = last.x + gx;
      const y = clamp(last.y + gy, T.y0 + 40, T.y1 - 12);
      if (Math.sign(last.x) !== Math.sign(x) && hash01(seed, i, 97) >= 0.3) x = last.x - gx; // the window lets 30 % through
      x = clamp(x, T.x0 + 12, T.x1 - 12);
      dyn.tracer.push({ x, y });
      if (dyn.tracer.length > 60) dyn.tracer.shift();
    }
    if (k === 4) dyn.simAcc = 0;
  };

  // ---------------------------------------------------------------- the frame
  const redraw = () => {
    if (!pose) return;
    const p = pose;
    const settled = !dyn.success && (p.solved || dyn.payoff >= 1); // quarantined: the emitter rests, no ghost projects
    const aimed = dyn.success ? dyn.success.slot : settled ? null : aimedSlotOf(p);
    const slotF = dyn.success?.slot ?? slotFromAim(p.aimAngle, n);
    const ghost = ghostOf(config, view, aimed);
    const ghostAlpha = dyn.success ? 0 : ghost && scenarioOkOf(config, p.probeU) ? Math.max(p.ghostAlpha, aimed !== null ? 0.45 * clamp01(p.beam) : 0) : 0;
    const failGhost = dyn.fail?.ghost && dyn.fail.slot !== null ? ghostOf(config, view, dyn.fail.slot) : null;
    const failAlpha = failGhost ? 0.8 * clamp01(1 - (dyn.now - dyn.fail!.start - 100) / 1200) : 0;
    drawApparatus(p, failAlpha > ghostAlpha ? failGhost : ghost, Math.max(ghostAlpha, failAlpha));
    drawPods(p, aimed);
    drawFront(p, slotF, aimed, ghost, ghostAlpha);
  };

  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    emitter: { ...emitter },
    apparatus: { ...A.apparatus },
    ghost_origin: { ...A.ghost },
  };
  for (let i = 0; i < Math.max(3, n); i++) anchors[`pod_${i}`] = capsuleCenter(cx, g, n, Math.min(i, n - 1));

  const pv: PoseView<ClaimHoldersPose> = {
    root,
    anchors,
    applyPose(p: ClaimHoldersPose) {
      pose = p;
      if (p.solved) dyn.payoff = 1;
    },
    setState(state: ContraptionState) {
      dyn.state = state;
      try {
        props.fx.dormancy(root, state === "dormant");
      } catch {
        root.setAlpha(state === "dormant" ? 0.75 : 1);
      }
    },
    async playSucceed(plan: SuccessPlan, solved: ClaimHoldersPose) {
      const s = readSuccess(plan);
      dyn.success = { start: dyn.now, slot: s.slot, quarantine: s.quarantine, honest: s.honest, payoffAt: s.payoffAtMs, lanterns: s.lanterns };
      await timers.wait(reduced ? 0 : Math.min(2500, plan.durationMs));
      if (!alive) return;
      dyn.success = null;
      dyn.payoff = 1;
      pv.applyPose(solved);
    },
    async playFail(plan: FailurePlan) {
      const f = readFailure(plan);
      dyn.fail = { start: dyn.now, slot: f.slot, ghost: f.ghostRegister, apparatus: f.apparatus };
      await timers.wait(reduced ? 300 : Math.min(1600, plan.durationMs));
      if (!alive) return;
      // the honest pod keeps holding bright for its 2 s while the player reads the margin note
      timers.later(900, () => (dyn.fail = null));
    },
    update(dtMs: number) {
      if (!alive) return;
      dyn.now += Math.max(0, dtMs);
      if (pose) stepTracer(pose, dtMs);
      redraw();
    },
    destroy() {
      alive = false;
      timers.clear();
      root.destroy(true);
    },
  };
  return pv;
}

export const skin: SkinPrefab<ClaimHoldersConfig, ClaimHoldersPose> = {
  skinId: "specimen_pods",
  create(scene, _phaser, props) {
    return createPodsView(scene, props);
  },
};
export default skin;
