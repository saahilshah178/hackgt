/**
 * claim_holders · skin specimen_pods (cell e1 / e3 / e4 / e7; §4.3 slots pod, letter_plate, probe_emitter, mimic_mote,
 * probe_well, needle, ion, dye_tank, balance_beam, basin, test_cell, raft_lock, low_tank, high_tank, flume_pump,
 * lantern, console). Code-drawn stand-ins until the hero parts land (KB owns this skin's hero fragments):
 *   - a row of glass specimen pods on pedestals, one per claim, with pip letter plates (A = 1 pip …);
 *   - a probe emitter on a mast beside the console; its beam picks the aimed pod (preview 0.7, committed 1);
 *   - a gantry-mounted reference chamber above the pods that plays the station's probe world live (the needle in the
 *     bilayer, the dye tank with its balance beam, the osmometer basin, the uphill flume) with the aimed claim's ghost
 *     projected over it (ghost_origin), the aid-tier key-feature ring, and the console kiosk.
 * Success frosts and cracks the quarantined pod (its Mimic Mote shows) while the emitter flares gold; failure rattles
 * the accused pod and dims the emitter. No Phaser text: letters are pips, readouts are chips on the anchors.
 */
import type Phaser from "phaser";
import type { ClaimHoldersConfig } from "@/world/contraptions/claim-holders.config";
import { bilayerPolar, type ClaimHoldersPose } from "@/world/contraptions/claim-holders.meta";
import type { FailurePlan, SuccessPlan } from "@/world/types";
import type { BeamHandle, BiomePalette, ContraptionState, PoseView, PrefabProps, SkinPrefab, XY } from "../../../types";

// ---------------------------------------------------------------- palette

interface Colors {
  stone: number;
  stoneShade: number;
  stoneDeep: number;
  gold: number;
  goldHi: number;
  goldDeep: number;
  navy: number;
  bronze: number;
  head: number;
  headLit: number;
  tail: number;
  tide: number;
  tideDeep: number;
  water: number;
  salmon: number;
  cyto: number;
  atp: number;
  ink: number;
  frost: number;
}
function hexOf(palette: BiomePalette, token: string, fallback: number): number {
  const v = palette[token];
  if (typeof v !== "string") return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  return m ? parseInt(m[1]!, 16) : fallback;
}
function colorsOf(p: BiomePalette): Colors {
  return {
    stone: hexOf(p, "stone.base", 0xf2e3c6),
    stoneShade: hexOf(p, "stone.shade", 0xd9c3a0),
    stoneDeep: hexOf(p, "stone.deep", 0xb89c78),
    gold: hexOf(p, "gold.base", 0xd9a441),
    goldHi: hexOf(p, "gold.hi", 0xf6d27a),
    goldDeep: hexOf(p, "gold.deep", 0xa8782e),
    navy: hexOf(p, "inlay.navy", 0x27466a),
    bronze: hexOf(p, "protein.ring", 0x6e4a2e),
    head: hexOf(p, "lipid.head", 0xf2e3c6),
    headLit: hexOf(p, "lipid.head.lit", 0xfbf1de),
    tail: hexOf(p, "lipid.tail", 0xd9a441),
    tide: hexOf(p, "tide.shallow", 0x8fe0ea),
    tideDeep: hexOf(p, "tide.deep", 0x4cb6d0),
    water: hexOf(p, "mol.water", 0x4f92e6),
    salmon: hexOf(p, "glycan.salmon", 0xe48c5e),
    cyto: hexOf(p, "cyto.glow", 0xf6c48e),
    atp: hexOf(p, "atp.gold", 0xf6d27a),
    ink: hexOf(p, "oil.seam.dark", 0x27405f),
    frost: hexOf(p, "gel.frost", 0xe8f6f8),
  };
}

// ---------------------------------------------------------------- layout (container-local; the anchor is on the ground)

const POD = { w: 76, glassH: 108, pedH: 26, plateH: 18 };
const CHAMBER = { w: 240, h: 140, top: -336 };
const EMITTER_Y = -214;

interface Layout {
  pods: XY[]; // glass centres
  emitter: XY; // lens pivot
  chamber: { x: number; y: number; w: number; h: number; cx: number; cy: number };
}
/** Everything sits between the console (left of the anchor) and the anchor, so the payoff blocker to the right stays clear. */
function layoutFor(n: number, consoleX: number): Layout {
  const span = Math.max(180, -consoleX);
  const mid = Math.min(-90, consoleX / 2);
  const spacing = Math.min(130, Math.max(80, (span - POD.w) / Math.max(1, n - 1)));
  const pods = Array.from({ length: n }, (_, i) => ({ x: mid + (i - (n - 1) / 2) * spacing, y: -POD.pedH - POD.plateH - POD.glassH / 2 }));
  const emitter = { x: Math.min(consoleX, mid - (n * spacing) / 2) - 70, y: EMITTER_Y };
  const chamber = { x: mid - CHAMBER.w / 2, y: CHAMBER.top, w: CHAMBER.w, h: CHAMBER.h, cx: mid, cy: CHAMBER.top + CHAMBER.h / 2 };
  return { pods, emitter, chamber };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Deterministic scatter (dye grains, salt cubes) that never jitters between frames. */
function scatter(seed: number, n: number): { x: number; y: number }[] {
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
  return Array.from({ length: n }, () => ({ x: rnd(), y: rnd() }));
}
function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    scene.time.delayedCall(Math.max(0, ms), () => resolve());
  });
}
function slotOfPlan(plan: { beats: readonly { params?: unknown }[] }): number | null {
  for (const b of plan.beats) {
    const slot = (b.params as { slot?: unknown } | undefined)?.slot;
    if (typeof slot === "number") return slot;
  }
  return null;
}

type Anim = { kind: "succeed" | "fail"; start: number; ms: number; slot: number | null };

// ---------------------------------------------------------------- the skin

export const skin: SkinPrefab<ClaimHoldersConfig, ClaimHoldersPose> = {
  skinId: "specimen_pods",
  create(scene, _phaser, props) {
    return createSpecimenPods(scene, props);
  },
};
export default skin;

function createSpecimenPods(scene: Phaser.Scene, props: PrefabProps<ClaimHoldersConfig>): PoseView<ClaimHoldersPose> {
  const { station, config, fx, reducedMotion } = props;
  const c = colorsOf(props.palette);
  const consoleLocal = { x: station.consoleX - station.anchor.x, y: props.groundY - station.anchor.y };
  const n0 = Math.max(1, Math.min(4, config.holders.length || 3));
  const L = layoutFor(n0, consoleLocal.x);
  const world = config.probeWorld;
  const grains = scatter(props.seed, 48);

  const root = scene.add.container(station.anchor.x, station.anchor.y);
  const back = scene.add.graphics();
  const dyn = scene.add.graphics();
  root.add([back, dyn]);
  const lensGlow = fx.glow(root, L.emitter, 34, c.tide, 0);
  const chamberGlow = fx.glow(root, { x: L.chamber.cx, y: L.chamber.cy }, 150, c.goldHi, 0);
  const beam: BeamHandle = fx.beam(root, L.emitter, L.pods[0] ?? L.emitter, c.tide);
  beam.setAlpha(0);

  // ---- static: console kiosk, emitter mast, gantry + chamber shell, pedestals and letter plates
  {
    const g = back;
    const k = consoleLocal;
    g.fillStyle(c.stoneShade, 1);
    g.fillRect(k.x - 7, k.y - 68, 14, 68);
    g.fillStyle(c.bronze, 1);
    g.fillRect(k.x - 30, k.y - 84, 60, 14);
    g.fillStyle(c.navy, 1);
    g.fillRect(k.x - 24, k.y - 82, 48, 8);
    g.fillStyle(c.stoneDeep, 1);
    g.fillRect(k.x - 22, k.y - 6, 44, 6);
    // mast
    g.fillStyle(c.bronze, 1);
    g.fillRect(L.emitter.x - 5, L.emitter.y, 10, -L.emitter.y);
    g.fillStyle(c.stoneDeep, 1);
    g.fillRect(L.emitter.x - 26, -8, 52, 8);
    // gantry uprights + crossbar
    const ch = L.chamber;
    g.fillStyle(c.stoneShade, 1);
    g.fillRect(ch.x + 18, ch.y + ch.h - 6, 10, -(ch.y + ch.h - 6));
    g.fillRect(ch.x + ch.w - 28, ch.y + ch.h - 6, 10, -(ch.y + ch.h - 6));
    g.fillStyle(c.stoneDeep, 1);
    g.fillRect(ch.x + 8, ch.y + ch.h - 6, ch.w - 16, 8);
    // chamber shell
    g.fillStyle(c.navy, 0.9);
    g.fillRoundedRect(ch.x, ch.y, ch.w, ch.h, 14);
    g.lineStyle(4, c.goldDeep, 1);
    g.strokeRoundedRect(ch.x, ch.y, ch.w, ch.h, 14);
    g.fillStyle(c.tide, 0.14);
    g.fillRoundedRect(ch.x + 10, ch.y + 10, ch.w - 20, ch.h - 20, 10);
    // pedestals and plates
    for (let i = 0; i < n0; i++) {
      const p = L.pods[i]!;
      g.fillStyle(c.stoneShade, 1);
      g.fillRect(p.x - POD.w / 2 - 8, -POD.pedH, POD.w + 16, POD.pedH);
      g.fillStyle(c.stoneDeep, 1);
      g.fillRect(p.x - POD.w / 2 - 8, -4, POD.w + 16, 4);
      g.fillStyle(c.bronze, 1);
      g.fillRect(p.x - POD.w / 2, -POD.pedH - POD.plateH, POD.w, POD.plateH);
      g.fillStyle(c.goldHi, 1);
      for (let d = 0; d <= i; d++) g.fillCircle(p.x + (d - i / 2) * 14, -POD.pedH - POD.plateH / 2, 4);
      g.lineStyle(3, c.navy, 1);
      g.strokeRoundedRect(p.x - POD.w / 2, p.y - POD.glassH / 2, POD.w, POD.glassH, 22);
    }
  }

  let clock = 0;
  let state: ContraptionState = "dormant";
  let anim: Anim | null = null;
  let last: ClaimHoldersPose | null = null;
  let sweep = 0;

  const anchors: Record<string, XY> & { console: XY } = { console: consoleLocal, emitter: { ...L.emitter }, apparatus: { x: L.chamber.cx, y: L.chamber.cy }, ghost_origin: { x: L.chamber.cx, y: L.chamber.cy - 16 } };
  L.pods.forEach((p, i) => (anchors[`pod_${i}`] = { x: p.x, y: p.y }));

  // ---- dynamic drawing --------------------------------------------------------------------------------------------
  function drawPods(g: Phaser.GameObjects.Graphics, pose: ClaimHoldersPose, u: number): void {
    const n = Math.min(n0, Math.max(1, pose.n || n0));
    for (let i = 0; i < n; i++) {
      const p = L.pods[i]!;
      const glow = pose.holderGlow[i] ?? 0.8;
      const rattle = anim?.kind === "fail" && anim.slot === i ? 6 * Math.sin(u * Math.PI * 9) * (1 - u) : 0;
      const x = p.x + rattle;
      const frost = pose.quarantined === i ? 1 : anim?.kind === "succeed" && anim.slot === i ? u : 0;
      g.fillStyle(c.tide, 0.1 + 0.28 * glow);
      g.fillRoundedRect(x - POD.w / 2, p.y - POD.glassH / 2, POD.w, POD.glassH, 22);
      // the specimen: three drifting motes; the quarantined pod's Mimic Mote turns salmon and holds still
      const bob = reducedMotion ? 0 : Math.sin(clock / 700 + i) * 4;
      for (let m = 0; m < 3; m++) {
        const mx = x + (m - 1) * 14;
        const my = p.y + 8 + (m % 2 ? -10 : 8) + bob * (m % 2 ? -1 : 1);
        g.fillStyle(frost > 0 && m === 1 ? c.salmon : c.headLit, 0.55 + 0.4 * glow);
        g.fillCircle(mx, frost > 0 && m === 1 ? p.y + 6 : my, m === 1 ? 9 : 6);
      }
      if (frost > 0) {
        g.fillStyle(c.frost, 0.5 * frost);
        g.fillRoundedRect(x - POD.w / 2, p.y - POD.glassH / 2, POD.w, POD.glassH, 22);
        g.lineStyle(2, c.ink, 0.8 * frost);
        const cy = p.y - POD.glassH / 2 + 18;
        g.lineBetween(x - 6, cy, x + 4, cy + 22 * frost);
        g.lineBetween(x + 4, cy + 22 * frost, x - 8, cy + 46 * frost);
        g.lineBetween(x + 4, cy + 22 * frost, x + 18, cy + 34 * frost);
      }
      if (pose.aimed === i) {
        g.lineStyle(3, pose.preview ? c.tide : c.goldHi, Math.max(0.2, pose.beam));
        g.strokeRoundedRect(x - POD.w / 2 - 5, p.y - POD.glassH / 2 - 5, POD.w + 10, POD.glassH + 10, 26);
      }
      if (pose.committed === i) {
        g.fillStyle(c.gold, 1);
        g.fillRect(x - POD.w / 2 - 8, p.y - POD.glassH / 2 - 12, POD.w + 16, 8);
      }
      // the rim over the glass
      g.lineStyle(2, c.headLit, 0.35 + 0.3 * glow);
      g.strokeRoundedRect(x - POD.w / 2 + 6, p.y - POD.glassH / 2 + 6, POD.w - 12, POD.glassH - 12, 18);
    }
  }

  function drawEmitter(g: Phaser.GameObjects.Graphics, pose: ClaimHoldersPose, u: number): void {
    const e = L.emitter;
    const target = pose.aimed !== null ? L.pods[Math.min(pose.aimed, n0 - 1)] : null;
    const centre = L.pods[Math.floor((n0 - 1) / 2)] ?? e;
    const base = Math.atan2(centre.y - e.y, centre.x - e.x);
    const ang = target ? Math.atan2(target.y - e.y, target.x - e.x) : base + (reducedMotion ? 0 : ((6 * Math.PI) / 180) * Math.sin(sweep));
    const flare = anim?.kind === "succeed" ? 1 - u : 0;
    const dim = anim?.kind === "fail" ? 0.45 + 0.35 * Math.abs(Math.sin(u * 40)) : 1;
    // yoke + head
    g.fillStyle(c.stoneDeep, 1);
    g.fillCircle(e.x, e.y, 16);
    g.fillStyle(flare > 0 ? c.goldHi : c.bronze, 1);
    g.fillCircle(e.x, e.y, 12);
    const bx = e.x + Math.cos(ang) * 26;
    const by = e.y + Math.sin(ang) * 26;
    g.lineStyle(10, c.bronze, 1);
    g.lineBetween(e.x, e.y, bx, by);
    g.fillStyle(state === "dormant" ? c.stoneShade : c.tide, dim);
    g.fillCircle(bx, by, 7);
    const lit = state === "dormant" ? 0 : (0.35 + 0.65 * pose.beam) * dim + flare;
    lensGlow.setPosition(bx, by).setAlpha(Math.min(1, lit));
    if (target && pose.beam > 0.01 && state !== "dormant") {
      beam.set({ x: bx, y: by }, { x: target.x, y: target.y });
      beam.setColor(pose.preview ? c.tide : c.goldHi);
      beam.setAlpha(pose.beam * dim);
    } else beam.setAlpha(0);
  }

  function drawChamber(g: Phaser.GameObjects.Graphics, pose: ClaimHoldersPose): void {
    const ch = L.chamber;
    const a = pose.apparatus;
    const ok = pose.scenarioOk ? 1 : 0.45;
    const x0 = ch.x + 16;
    const x1 = ch.x + ch.w - 16;
    const cy = ch.cy;
    switch (world) {
      case "needle": {
        // the bilayer: two rows of heads with tails between; the needle drives in from the well and the heads part
        const tipY = ch.y + 12 + Math.min(1, (a.needleTipY ?? 0) / 208) * 116;
        const part = a.part ?? 0;
        g.fillStyle(c.tail, 0.75 * ok);
        g.fillRect(x0, cy - 12, x1 - x0, 24);
        for (let x = x0 + 8; x <= x1 - 8; x += 16) {
          const d = x - ch.cx;
          const push = part * 16 * Math.exp(-(d * d) / (2 * 26 * 26)) * Math.sign(d || 1);
          for (const row of [-1, 1]) {
            g.fillStyle(c.head, ok);
            g.fillCircle(x + push, cy + row * 20, 7);
            g.fillStyle(c.stoneShade, 0.7 * ok);
            g.fillCircle(x + push + 2, cy + row * 20 + 2, 3);
          }
        }
        // the well at the top, the needle, the tip glow tinted by the local polarity (blue polar, amber oily)
        g.fillStyle(c.bronze, 1);
        g.fillRect(ch.cx - 18, ch.y - 6, 36, 14);
        g.lineStyle(3, c.stone, 1);
        g.lineBetween(ch.cx, ch.y + 8, ch.cx, tipY);
        const depth = a.depth ?? 0;
        const polar = typeof a.sim_polar === "number" ? clamp01(a.sim_polar) : clamp01(bilayerPolar(depth));
        g.fillStyle(polar > 0.5 ? c.water : c.tail, 0.35 + 0.5 * Math.abs(polar - 0.5) * 2);
        g.fillCircle(ch.cx, tipY, 6 + 4 * (1 - polar));
        if ((a.ionHeld ?? 0) > 0.5) {
          g.fillStyle(c.salmon, 1);
          g.fillCircle(ch.cx + 12, tipY - 8, 6);
          g.lineStyle(2, c.ink, 1);
          g.lineBetween(ch.cx + 9, tipY - 8, ch.cx + 15, tipY - 8);
          g.lineBetween(ch.cx + 12, tipY - 11, ch.cx + 12, tipY - 5);
        }
        break;
      }
      case "dye_load": {
        // the dye tank: a pored membrane down the middle, grains on each side by concentration, the balance beam above
        const tankY = cy - 30;
        const tankH = 84;
        g.fillStyle(c.water, 0.35 * ok);
        g.fillRect(x0, tankY, x1 - x0, tankH);
        g.fillStyle(c.bronze, 1);
        g.fillRect(ch.cx - 4, tankY, 8, tankH);
        g.fillStyle(c.navy, 1);
        for (let p = 0; p < 3; p++) g.fillRect(ch.cx - 4, tankY + 14 + p * 26, 8, 10);
        const nL = Math.min(24, Math.round((a.floatL ?? 0) / 2.5));
        const nR = Math.min(24, Math.round((a.floatR ?? 0) / 2.5));
        grains.forEach((gr, i) => {
          const left = i % 2 === 0;
          if (left ? i / 2 >= nL : (i - 1) / 2 >= nR) return;
          const half = (x1 - x0) / 2 - 12;
          const gx = left ? x0 + 6 + gr.x * half : ch.cx + 8 + gr.x * half;
          const drift = reducedMotion ? 0 : Math.sin(clock / 900 + i) * 3;
          g.fillStyle(c.salmon, 0.9 * ok);
          g.fillCircle(gx, tankY + 8 + gr.y * (tankH - 16) + drift, 3.5);
        });
        const tilt = a.beamTilt ?? 0;
        const bl = 92;
        g.fillStyle(c.stoneDeep, 1);
        g.fillTriangle(ch.cx - 10, tankY - 6, ch.cx + 10, tankY - 6, ch.cx, tankY - 22);
        g.lineStyle(6, c.gold, 1);
        g.lineBetween(ch.cx - Math.cos(tilt) * bl, tankY - 22 - Math.sin(tilt) * bl, ch.cx + Math.cos(tilt) * bl, tankY - 22 + Math.sin(tilt) * bl);
        break;
      }
      case "bath_salt": {
        // the osmometer basin: a bath with salt cubes by the probe, the test cell swelling or crenating by volume
        g.fillStyle(c.tideDeep, 0.4 * ok);
        g.fillEllipse(ch.cx, cy + 22, x1 - x0, 90);
        const cubes = Math.min(30, a.saltCubes ?? 0);
        grains.forEach((gr, i) => {
          if (i >= cubes) return;
          g.fillStyle(c.stone, 0.9 * ok);
          g.fillRect(x0 + 10 + gr.x * (x1 - x0 - 20) - 2, cy - 10 + gr.y * 50, 4, 4);
        });
        const vol = a.volume ?? 1;
        const r = 30 * Math.sqrt(Math.max(0.3, vol));
        const cren = a.crenation ?? 0;
        g.fillStyle(c.cyto, 0.85 * ok);
        g.beginPath();
        for (let i = 0; i <= 40; i++) {
          const t = (i / 40) * Math.PI * 2;
          const rr = r + (cren > 0 ? cren * 1.2 * Math.sin(t * 9) : 0) + ((a.stretch ?? 0) > 0 ? 2 * Math.sin(t * 2) : 0);
          const px = ch.cx + Math.cos(t) * rr;
          const py = cy + 10 + Math.sin(t) * rr * 0.85;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fillPath();
        g.lineStyle(3, c.salmon, 0.9 * ok);
        g.strokeCircle(ch.cx, cy + 10, r * 0.4);
        const flux = a.waterFlux ?? 0;
        const fa = clamp01(Math.abs(flux) / 12);
        if (fa > 0.05) {
          g.lineStyle(3, c.water, fa);
          for (let k = 0; k < 4; k++) {
            const t = (k / 4) * Math.PI * 2 + Math.PI / 4;
            const inner = r + 6;
            const outer = r + 22;
            const [ra, rb] = flux > 0 ? [inner, outer] : [outer, inner];
            g.lineBetween(ch.cx + Math.cos(t) * ra, cy + 10 + Math.sin(t) * ra * 0.85, ch.cx + Math.cos(t) * rb, cy + 10 + Math.sin(t) * rb * 0.85);
          }
        }
        break;
      }
      case "atp_feed": {
        // the uphill flume: low and high tanks, the pump wheel between them turning with the ATP feed, two lanterns
        const tankW = 60;
        const tankH = 90;
        const ty = cy + 44;
        const low = clamp01((a.cLowTarget ?? 5) / 10);
        const high = clamp01((a.cHighTarget ?? 5) / 10);
        for (const [tx, lvl] of [
          [x0 + 6, low],
          [x1 - 6 - tankW, high],
        ] as const) {
          g.fillStyle(c.navy, 0.8);
          g.fillRect(tx, ty - tankH, tankW, tankH);
          g.fillStyle(c.water, 0.7 * ok);
          g.fillRect(tx + 4, ty - 4 - (tankH - 8) * lvl, tankW - 8, (tankH - 8) * lvl);
          g.lineStyle(3, c.goldDeep, 1);
          g.strokeRect(tx, ty - tankH, tankW, tankH);
        }
        g.lineStyle(8, c.bronze, 1);
        g.lineBetween(x0 + 6 + tankW, ty - 30, x1 - 6 - tankW, ty - 70);
        const hz = a.strokeHz ?? 0;
        const rot = reducedMotion ? 0 : (clock / 1000) * hz * Math.PI * 2;
        g.fillStyle(c.stoneDeep, 1);
        g.fillCircle(ch.cx, cy - 6, 20);
        g.lineStyle(4, c.atp, 0.6 + 0.4 * clamp01(hz / 4));
        for (let s = 0; s < 4; s++) {
          const t = rot + (s * Math.PI) / 2;
          g.lineBetween(ch.cx, cy - 6, ch.cx + Math.cos(t) * 18, cy - 6 + Math.sin(t) * 18);
        }
        const glow = a.pipeGlow ?? 0.15;
        g.fillStyle(c.atp, glow * 2);
        g.fillCircle(x0 + 6 + tankW / 2, ty - tankH - 14, 8);
        g.fillCircle(x1 - 6 - tankW / 2, ty - tankH - 14, 8);
        break;
      }
      default: {
        // no probe world: a resting specimen stage
        g.fillStyle(c.tideDeep, 0.3);
        g.fillEllipse(ch.cx, cy + 20, x1 - x0, 60);
        g.fillStyle(c.headLit, 0.8);
        g.fillCircle(ch.cx, cy, 14);
      }
    }
  }

  function drawGhost(g: Phaser.GameObjects.Graphics, id: string, alpha: number): void {
    const o = anchors.ghost_origin!;
    const col = c.tideDeep;
    g.lineStyle(3, col, alpha);
    g.fillStyle(col, alpha);
    const arrow = (x0: number, y0: number, x1: number, y1: number) => {
      g.lineBetween(x0, y0, x1, y1);
      const t = Math.atan2(y1 - y0, x1 - x0);
      g.lineBetween(x1, y1, x1 - Math.cos(t - 0.5) * 9, y1 - Math.sin(t - 0.5) * 9);
      g.lineBetween(x1, y1, x1 - Math.cos(t + 0.5) * 9, y1 - Math.sin(t + 0.5) * 9);
    };
    switch (id) {
      case "bilayer_outline":
        for (const row of [-14, 14]) for (let x = -60; x <= 60; x += 15) g.strokeCircle(o.x + x, o.y + row, 5);
        break;
      case "rigid_holed_slab":
        g.strokeRect(o.x - 70, o.y - 18, 140, 36);
        for (const x of [-40, 0, 40]) g.strokeCircle(o.x + x, o.y, 7);
        break;
      case "core_blocks_ion":
        g.strokeRect(o.x - 70, o.y - 18, 140, 36);
        g.strokeCircle(o.x, o.y - 34, 8);
        g.lineBetween(o.x - 8, o.y - 26, o.x + 8, o.y - 42);
        break;
      case "random_walk": {
        let x = o.x - 60;
        let y = o.y;
        g.beginPath();
        g.moveTo(x, y);
        for (let i = 0; i < 9; i++) {
          x += 14;
          y += (i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : -0.4) * 16;
          g.lineTo(x, y);
        }
        g.strokePath();
        break;
      }
      case "purposeful_march":
      case "net_flux_arrow":
        arrow(o.x - 60, o.y, o.x + 60, o.y);
        break;
      case "water_out_arrows":
        g.strokeCircle(o.x, o.y, 22);
        for (let k = 0; k < 4; k++) {
          const t = (k / 4) * Math.PI * 2;
          arrow(o.x + Math.cos(t) * 26, o.y + Math.sin(t) * 26, o.x + Math.cos(t) * 48, o.y + Math.sin(t) * 48);
        }
        break;
      case "salt_inflow":
        g.strokeCircle(o.x, o.y, 22);
        for (let k = 0; k < 4; k++) {
          const t = (k / 4) * Math.PI * 2 + Math.PI / 4;
          arrow(o.x + Math.cos(t) * 50, o.y + Math.sin(t) * 50, o.x + Math.cos(t) * 26, o.y + Math.sin(t) * 26);
        }
        break;
      case "shrink_outline":
        g.strokeCircle(o.x, o.y, 30);
        g.strokeCircle(o.x, o.y, 16);
        break;
      case "uphill_arrow":
        g.lineBetween(o.x - 70, o.y + 24, o.x + 70, o.y - 24);
        arrow(o.x - 40, o.y + 6, o.x + 40, o.y - 22);
        break;
      case "downhill_boost":
        g.lineBetween(o.x - 70, o.y - 24, o.x + 70, o.y + 24);
        arrow(o.x - 40, o.y - 6, o.x + 40, o.y + 22);
        break;
      case "atp_sparks":
        for (const [dx, dy] of [
          [-40, -10],
          [0, 14],
          [38, -16],
        ] as const) {
          g.lineBetween(o.x + dx - 8, o.y + dy, o.x + dx + 8, o.y + dy);
          g.lineBetween(o.x + dx, o.y + dy - 8, o.x + dx, o.y + dy + 8);
          g.lineBetween(o.x + dx - 5, o.y + dy - 5, o.x + dx + 5, o.y + dy + 5);
        }
        break;
      default:
        g.strokeCircle(o.x, o.y, 26);
    }
  }

  function draw(pose: ClaimHoldersPose): void {
    const g = dyn;
    g.clear();
    const u = anim ? clamp01((clock - anim.start) / anim.ms) : 0;
    // the payoff warmth (the ridge thaw / the raft lock) spreads out from the anchor as the gate opens
    if (pose.gate > 0.01) {
      g.fillStyle(c.cyto, 0.3 * pose.gate);
      g.fillEllipse(0, -6, 260 * pose.gate + 40, 40);
    }
    drawChamber(g, pose);
    if (pose.ghost && pose.ghostAlpha > 0.01) drawGhost(g, pose.ghost, pose.ghostAlpha);
    drawPods(g, pose, u);
    drawEmitter(g, pose, u);
    const ring = pose.highlight ? 0.35 + (reducedMotion ? 0.2 : 0.25 * Math.sin(clock / 260)) : 0;
    chamberGlow.setAlpha(ring * 0.5);
    if (ring > 0) {
      g.lineStyle(3, c.goldHi, ring);
      g.strokeRoundedRect(L.chamber.x - 8, L.chamber.y - 8, L.chamber.w + 16, L.chamber.h + 16, 18);
    }
  }

  const view: PoseView<ClaimHoldersPose> = {
    root,
    anchors,
    applyPose(pose) {
      last = pose;
      draw(pose);
    },
    setState(next) {
      const wasDormant = state === "dormant";
      state = next;
      if (next === "dormant" && !wasDormant) fx.dormancy(root, true);
      if (next !== "dormant" && wasDormant) fx.dormancy(root, false);
      if (last) draw(last);
    },
    async playSucceed(plan: SuccessPlan, pose) {
      const slot = pose.quarantined ?? slotOfPlan(plan);
      anim = { kind: "succeed", start: clock, ms: Math.max(600, plan.durationMs), slot };
      const at = slot !== null ? L.pods[Math.min(slot, n0 - 1)] : null;
      if (at) fx.burst(root, { x: at.x, y: at.y }, "sparks");
      await wait(scene, plan.durationMs);
      anim = null;
      view.applyPose(pose);
    },
    async playFail(plan: FailurePlan, pose) {
      const ms = Math.min(plan.durationMs, 1600);
      anim = { kind: "fail", start: clock, ms, slot: slotOfPlan(plan) ?? pose.aimed };
      await wait(scene, ms);
      anim = null;
      view.applyPose(pose);
    },
    update(dtMs) {
      clock += dtMs;
      if (!reducedMotion) sweep += (dtMs / 1000) * Math.PI * 2 * 0.2;
      // the controller stops applying poses while a payoff or failure plays; keep animating from the last pose
      if (last && (anim || !reducedMotion)) draw(last);
    },
    destroy() {
      beam.destroy();
      root.destroy(true);
    },
  };
  return view;
}
