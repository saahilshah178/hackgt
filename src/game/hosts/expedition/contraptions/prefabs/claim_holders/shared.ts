/**
 * claim_holders prefab shared helpers (docs/design/20 §2.5.5, §7). Owned by KA (L6) with the prefab core; skin files
 * import it read-only (KB's specimen_pods and KC's witness_projector may reuse the pure helpers and the aim mapping).
 *
 * Two halves:
 *  - PURE helpers (node-testable): the aim mapping from the meta's standard rig to a skin's own holder row, the slate
 *    trace projection (trace_slate probe world), the holder row layout and the success/failure beat readers.
 *  - The ORRERY SINGER STATION (trig §5.3 Echo Choir / §5.5 Chime Treasury): Echo Automata with bell heads, navy
 *    faceplates, chest slates, brass plaques on plinths, the Tuning Lens and its beam, the Mimic crab. The two trig
 *    skins (resonance_pillars, treasury_pillars) call `createSingerStation` with their payoff object (the Echo Lift, the
 *    Treasury Chest and rim stair). Code-drawn stand-ins in the biome palette (kit art, §0.1.6 fallback ladder step 1)
 *    until KA4's hero parts land; world text is DOM (describe() chips, station pins).
 *
 * Live-reveal rule (§2.5.6): the station only shows what the aim DOES (the lens swings, the beam lands, the slate
 * draws that claim literally); every singer uses the same body, idle and colours. `quarantineAnim` is read only
 * through the success plan's beats.
 */
import type Phaser from "phaser";
import type { ClaimHoldersConfig } from "@/world/contraptions/claim-holders.config";
import { AIM_RIGS, chestsOf, evalExpr, type AimRig, type ClaimHoldersPose } from "@/world/contraptions/claim-holders.meta";
import { exprValue } from "@/world/contraptions/config-parts";
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import type { ContraptionState, PoseView, PrefabProps, XY } from "../../types";
import {
  Anims,
  dashedLine,
  drawLectern,
  easeInOutSine,
  easeOutCubic,
  fillPoly,
  linear,
  mix,
  orreryColors,
  setAnchor,
  waitMs,
  type OrreryColors,
} from "../emitter_rail/shared";

/** W0 seam (tests/world-contract.test.ts checks every prefab shared.ts keeps it); other lanes' stub skins still use it. */
export { stubBox, type StubBoxOptions } from "../_stub";
export { Anims, easeInOutSine, easeOutCubic, fillPoly, linear, mix, orreryColors, setAnchor, waitMs, type OrreryColors };

export const ARCHETYPE_ID = "claim_holders";
/** Placeholder tint for the W0 labelled box (other lanes' skins until they land). */
export const STUB_COLOR = 0x5a4a78;

const PI = Math.PI;

// ================================================================ pure: aim mapping

/**
 * Where the meta's standard rig ray (from `rig.aimer` at `angle`) meets the rig's holder row, as an x offset from the
 * row's centre. The pose's aimAngle is eased by the controller, so this keeps the eased motion when a skin puts its
 * lens and holders somewhere else.
 */
export function rowXFromAngle(rig: Pick<AimRig, "aimer" | "holderY" | "cx" | "cord">, angle: number): number {
  if (rig.cord !== null) return rig.aimer.x + rig.cord * Math.sin(angle) - rig.cx; // pendant lamps swing on a cord
  const s = Math.sin(angle);
  const dy = rig.holderY - rig.aimer.y;
  if (Math.abs(s) < 1e-3 || Math.sign(s) !== Math.sign(dy)) return Math.cos(angle) >= 0 ? 4000 : -4000; // parallel or away
  return rig.aimer.x + (dy * Math.cos(angle)) / s - rig.cx;
}
/** The same aim re-expressed for a skin row with its own spacing: the rig's row x scaled by spacing ratio. */
export function skinRowX(rig: Pick<AimRig, "aimer" | "holderY" | "cx" | "cord" | "spacing">, angle: number, spacing: number): number {
  return (rowXFromAngle(rig, angle) * spacing) / rig.spacing;
}
/** The skin lens's own angle (screen, atan2 with y down) toward a point on its row. */
export function lensAngleTo(lens: XY, target: XY): number {
  return Math.atan2(target.y - lens.y, target.x - lens.x);
}
/** Holder x for display slot `slot` of `n` at `spacing` (centred on 0). */
export function holderX(n: number, slot: number, spacing: number): number {
  return (slot - (n - 1) / 2) * spacing;
}

// ================================================================ pure: slate traces (trace_slate, trig §5.3/§5.5)

export interface SlateBox {
  w: number; // inner drawing width
  h: number; // inner drawing height
}
export interface SlateTrace {
  /** one polyline set per claim function, slate-local (0,0 = the slate's centre), split at gaps */
  fns: { style: "solid" | "dashed" | "ghost"; color: "f" | "g" | "h"; segments: XY[][] }[];
  /** bracket end caps (slate-local) with the claim x of each cap, for the playhead flash */
  brackets: { a: XY; b: XY; xs: readonly number[] }[];
}
/** The reference domain [x0, x1] and y range of a trig claim station. */
export function slateDomain(config: Pick<ClaimHoldersConfig, "reference">): { x0: number; x1: number; y0: number; y1: number } {
  const ref = config.reference;
  const lo = ref ? exprValue(ref.xMin) : null;
  const hi = ref ? exprValue(ref.xMax) : null;
  const x0 = lo !== null && hi !== null && lo < hi ? lo : 0;
  const x1 = lo !== null && hi !== null && lo < hi ? hi : 2 * PI;
  return { x0, x1, y0: ref?.yMin ?? -4, y1: ref?.yMax ?? 4 };
}
/** Maps claim coordinates into the slate (x right, y DOWN, centred). */
export function toSlate(x: number, y: number, dom: ReturnType<typeof slateDomain>, box: SlateBox): XY {
  const u = (x - dom.x0) / (dom.x1 - dom.x0 || 1);
  const v = (y - dom.y0) / (dom.y1 - dom.y0 || 1);
  return { x: -box.w / 2 + u * box.w, y: box.h / 2 - v * box.h };
}
/**
 * The aimed claim drawn literally on a slate: every function of its trace (same styles as the claim card) and its
 * brackets, sampled over the reference domain and clipped to the slate.
 */
export function slateTraceOf(trace: NonNullable<ClaimHoldersConfig["holders"][number]["trace"]>, config: Pick<ClaimHoldersConfig, "reference">, box: SlateBox, samples = 96): SlateTrace {
  const dom = slateDomain(config);
  const fns = trace.fns.map((f) => {
    const segments: XY[][] = [];
    let seg: XY[] = [];
    for (let i = 0; i <= samples; i++) {
      const x = dom.x0 + ((dom.x1 - dom.x0) * i) / samples;
      const y = evalExpr(f.expr, x);
      if (y === null || !Number.isFinite(y) || y < dom.y0 - 1e-9 || y > dom.y1 + 1e-9) {
        if (seg.length > 1) segments.push(seg);
        seg = [];
        continue;
      }
      seg.push(toSlate(x, y, dom, box));
    }
    if (seg.length > 1) segments.push(seg);
    return { style: f.style, color: f.color, segments };
  });
  const brackets = trace.brackets.flatMap((b) => {
    const [x0, y0, x1, y1] = [b.x0, b.y0, b.x1, b.y1].map((e) => exprValue(e));
    if (x0 === null || y0 === null || x1 === null || y1 === null) return [];
    return [{ a: toSlate(x0, y0, dom, box), b: toSlate(x1, y1, dom, box), xs: [x0, x1] }];
  });
  return { fns, brackets };
}
/** Bracket caps within half a probe step of the playhead flash (trig §5.3: "that bracket's end caps flash"). */
export function capsFlashing(trace: SlateTrace, playheadX: number | null, halfStep: number): boolean[] {
  return trace.brackets.map((b) => playheadX !== null && b.xs.some((x) => Math.abs(x - playheadX) <= halfStep + 1e-9));
}

// ================================================================ pure: plan readers

/** Display slots that the failure plan holds bright (the honest pick, `wrongKeys[0]`). */
export function heldSlots(plan: FailurePlan): number[] {
  return plan.beats.filter((b) => b.action === "hold_bright" && typeof b.params?.slot === "number").map((b) => b.params!.slot as number);
}
/** The exposed mimic's display slot from the success plan (the `open`/`dissolve` beats on `holder_k`), else null. */
export function mimicSlotOf(plan: SuccessPlan, holderAnchor = "holder_"): number | null {
  const b = plan.beats.find((x) => (x.action === "open" || x.action === "dissolve") && x.anchor.startsWith(holderAnchor));
  if (!b) return null;
  const k = Number(b.anchor.slice(holderAnchor.length));
  return Number.isInteger(k) ? k : null;
}
/** The payoff beat (anim-tagged) of a success plan. */
export function payoffBeatOf(plan: SuccessPlan): SuccessBeat | null {
  return plan.beats.find((b) => typeof b.params?.anim === "string") ?? null;
}

// ================================================================ the Orrery singer station (Phaser)

/** Automaton geometry (2.5 H = 425 tall; bible §5.1 scale ladder), container-local, feet on y = 0. */
export const SINGER = {
  plinthW: 190,
  plinthH: 60,
  columnW: 64,
  torsoTop: -330,
  torsoBottom: -130,
  torsoW: 176,
  slateY: -232, // the slate's centre (anchor slate_i)
  slateW: 150,
  slateH: 100,
  headY: -382, // the bell head's centre
  headR: 50,
  top: -432,
} as const;
/** The Tuning Lens head (pedestal ~0.9 H, in front of the plinths; the beam rises to the slates). */
export const LENS = { y: -150, r: 34 } as const;
/**
 * The lens stands in the gap left of the middle singer (odd n) or in the centre gap (even n), so the beam to every
 * slate has length: straight below a slate it would be a stub. Where it stands says nothing about any claim.
 */
export function lensXFor(n: number, spacing: number): number {
  return n % 2 === 1 ? -spacing / 2 : 0;
}

/**
 * Where the singer row starts so the first plinth clears the console by 60 (side view has no depth to hide it), capped
 * at 0.3 × spacing so the row stays inside the meta's frame when a console stands inside the row (the dev world).
 */
export function rowShiftFor(consoleX: number, n: number, spacing: number): number {
  const firstLeft = holderX(n, 0, spacing) - SINGER.plinthW / 2;
  return consoleX < firstLeft ? 0 : Math.min(0.3 * spacing, Math.max(0, consoleX + 60 - firstLeft));
}

export interface SingerPayoff {
  /** extra anchors (lift / chest_hinge and friends) */
  anchors: Readonly<Record<string, XY>>;
  /** draws the payoff object at progress p (0 rest … 1 done); `lit` 0…1 from the station state */
  render(p: number, lit: number, t: number): void;
  /** how long the payoff beat animates (ms) */
  ms: number;
  destroy(): void;
}
export interface SingerSpec {
  spacing: number;
  /** bell tint (treasury: gold.hi) */
  bell: (c: OrreryColors) => number;
  /** plaque tint (treasury: navy) */
  plaque: (c: OrreryColors) => number;
  /** builds the payoff object; `rowRight` is the right edge of the last plinth (container-local) */
  payoff: (scene: Phaser.Scene, root: Phaser.GameObjects.Container, c: OrreryColors, rowRight: number) => SingerPayoff;
}

interface SingerParts {
  x: number;
  body: Phaser.GameObjects.Container;
  shell: Phaser.GameObjects.Graphics; // plinth, column, torso, collar (static)
  bellG: Phaser.GameObjects.Graphics; // bell head + faceplate halves (redrawn on change)
  slateG: Phaser.GameObjects.Graphics; // slate screen (redrawn on change)
  ring: Phaser.GameObjects.Graphics; // hum pulse ring + honest bell mark
  glow: Phaser.GameObjects.Image;
  trace: SlateTrace | null;
}

interface Ov {
  gold: number; // lens beam gold 0…1
  crack: number; // the mimic's bell crack flash 0…1
  face: number; // faceplate open 0…1
  crab: number; // crab drop/scuttle 0…1 (≥ 1 gone)
  slump: number; // empty shell slump 0…1
  chord: number; // true-chord ring 0…1
  payoff: number | null; // payoff progress
  held: Map<number, number>; // failure: slot → hold brightness
  lensFlicker: number;
}

/** Draws a five-point star (engraving motif) filled. */
export function star(g: Phaser.GameObjects.Graphics, at: XY, r: number, rot = -PI / 2): void {
  const pts: XY[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push({ x: at.x + rr * Math.cos(a), y: at.y + rr * Math.sin(a) });
  }
  fillPoly(g, pts);
}

/** A small bell glyph (honest mark, bell pins). */
export function bellGlyph(g: Phaser.GameObjects.Graphics, at: XY, s: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  fillPoly(g, [
    { x: at.x - 0.55 * s, y: at.y + 0.45 * s },
    { x: at.x - 0.42 * s, y: at.y - 0.2 * s },
    { x: at.x - 0.2 * s, y: at.y - 0.5 * s },
    { x: at.x + 0.2 * s, y: at.y - 0.5 * s },
    { x: at.x + 0.42 * s, y: at.y - 0.2 * s },
    { x: at.x + 0.55 * s, y: at.y + 0.45 * s },
  ]);
  g.fillCircle(at.x, at.y + 0.58 * s, 0.14 * s);
}

/**
 * The Echo Choir / Chime Treasury station: n automata in view (display) order, the Tuning Lens, its beam, the slates'
 * claim traces, the Mimic crab, and the skin's payoff object.
 */
export function createSingerStation(scene: Phaser.Scene, P: typeof Phaser, props: PrefabProps<ClaimHoldersConfig>, spec: SingerSpec): PoseView<ClaimHoldersPose> {
  const { station, fx, reducedMotion, config } = props;
  const c = orreryColors(props.palette);
  const rig = AIM_RIGS[config.aimer] ?? AIM_RIGS.tuning_lens;
  const chests = chestsOf(props.view);
  const n = Math.max(1, chests.length);
  const box: SlateBox = { w: SINGER.slateW - 18, h: SINGER.slateH - 18 };
  const halfStep = (config.probe?.step ?? PI / 48) / 2;
  const dom = slateDomain(config);
  const midY = config.reference ? 0 : null;
  const groundLocal = props.groundY - station.anchor.y;
  const consoleLocal: XY = { x: station.consoleX - station.anchor.x, y: groundLocal };
  const anims = new Anims(reducedMotion);
  const ov: Ov = { gold: 0, crack: 0, face: 0, crab: 0, slump: 0, chord: 0, payoff: null, held: new Map(), lensFlicker: 0 };
  const honest = new Set<number>(); // singers a failed Verify proved honest (the grade already said so)
  let mimic: number | null = null;
  let pose: ClaimHoldersPose | null = null;
  let state: ContraptionState = "dormant";
  let dead = false;
  let clock = 0;

  // the station stands on the console's ground (the side-car anchors sit on the floor; the dev world's float)
  const floor = Math.max(-40, Math.min(400, groundLocal));
  const shift = rowShiftFor(consoleLocal.x, n, spec.spacing);
  const root = scene.add.container(station.anchor.x, station.anchor.y);
  const stage = scene.add.container(0, floor); // everything but the console, feet on y = 0
  const consoleG = scene.add.graphics();
  const backG = scene.add.graphics(); // drain grates, floor inlay
  root.add([consoleG, stage]);
  stage.add(backG);
  const payoff = spec.payoff(scene, stage, c, shift + holderX(n, n - 1, spec.spacing) + SINGER.plinthW / 2);

  // ---------------------------------------------------------------- the singers
  const singers: SingerParts[] = [];
  for (let i = 0; i < n; i++) {
    const x = shift + holderX(n, i, spec.spacing);
    const body = scene.add.container(x, 0);
    const shell = scene.add.graphics();
    const slateG = scene.add.graphics();
    const bellG = scene.add.graphics();
    const ring = scene.add.graphics();
    body.add([shell, slateG, bellG, ring]);
    stage.add(body);
    const glow = fx.glow(stage, { x, y: SINGER.headY }, 120, c.beam, 0);
    const chest = chests[i];
    const holder = chest ? config.holders.find((h) => h.statementIndex === chest.statementIndex) : undefined;
    singers.push({ x, body, shell, bellG, slateG, ring, glow, trace: holder?.trace ? slateTraceOf(holder.trace, config, box) : null });
    drawShell(shell, c, spec.plaque(c));
    // the floor drain the Mimic crab escapes through (every singer has one: no tell)
    backG.fillStyle(c.stoneDeep, 1);
    backG.fillRoundedRect(x + 110, -10, 60, 12, 4);
    backG.fillStyle(c.navyDark, 1);
    for (let k = 0; k < 4; k++) backG.fillRect(x + 116 + k * 13, -8, 7, 8);
  }

  // ---------------------------------------------------------------- the Tuning Lens (pedestal + turning head), beam
  const lensAt: XY = { x: shift + lensXFor(n, spec.spacing), y: LENS.y };
  const lensG = scene.add.graphics();
  const lensHead = scene.add.container(lensAt.x, lensAt.y);
  const lensHeadG = scene.add.graphics();
  lensHead.add(lensHeadG);
  stage.add([lensG, lensHead]);
  const lensGlow = fx.glow(stage, lensAt, 70, c.beam, 0);
  const beam = fx.beam(stage, lensAt, { x: lensAt.x, y: lensAt.y - 1 }, c.beam);
  beam.setAlpha(0);
  // pedestal: coiled stem (bible §5.4 "pedestal emitters with coiled stems")
  lensG.fillStyle(c.shadow, 0.25);
  lensG.fillEllipse(lensAt.x + 14, -2, 120, 16);
  lensG.fillStyle(c.stoneShade, 1);
  lensG.fillRoundedRect(lensAt.x - 46, -26, 92, 26, 6);
  lensG.fillStyle(c.stoneBase, 1);
  lensG.fillRoundedRect(lensAt.x - 46, -26, 56, 26, 6);
  lensG.fillStyle(c.goldDeep, 1);
  lensG.fillRect(lensAt.x - 46, -30, 92, 6);
  lensG.lineStyle(7, c.bronze, 1);
  lensG.beginPath();
  for (let i = 0; i <= 60; i++) {
    const y = -30 - (i / 60) * (-LENS.y - 30 - LENS.r);
    const x = lensAt.x + 11 * Math.sin((i / 60) * PI * 5);
    if (i === 0) lensG.moveTo(x, y);
    else lensG.lineTo(x, y);
  }
  lensG.strokePath();
  const drawLensHead = (lit: number, gold: number) => {
    lensHeadG.clear();
    lensHeadG.fillStyle(c.goldDeep, 1);
    lensHeadG.fillCircle(0, 0, LENS.r + 8);
    lensHeadG.fillStyle(c.gold, 1);
    lensHeadG.fillCircle(-2, -2, LENS.r + 4);
    lensHeadG.fillStyle(mix(mix(0x2a5563, c.beam, 0.25 + 0.6 * lit), c.goldHi, gold), 1);
    lensHeadG.fillCircle(0, 0, LENS.r - 4);
    lensHeadG.fillStyle(0xffffff, 0.35 + 0.3 * lit);
    lensHeadG.fillCircle(-9, -9, 9);
    // the barrel pointing along +x (the head container rotates to the aim)
    lensHeadG.fillStyle(c.bronze, 1);
    lensHeadG.fillRoundedRect(LENS.r - 6, -12, 30, 24, 6);
    lensHeadG.fillStyle(c.goldHi, 1);
    lensHeadG.fillRect(LENS.r + 18, -12, 6, 24);
  };

  // ---------------------------------------------------------------- the Mimic crab (drawn only during the success plan)
  const crabG = scene.add.graphics();
  // the beam's solid core (normal blend: the additive fx beam alone washes out on cream stone and a pale sky)
  const beamG = scene.add.graphics();
  stage.add([beamG, crabG]);

  // ---------------------------------------------------------------- anchors (container-local: the stage is offset by `floor`)
  const up = (a: XY): XY => ({ x: a.x, y: a.y + floor });
  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    lens: up(lensAt),
    // slate_i sits on the slate's top edge: its |y| chip rides above the screen instead of covering the trace
    ...Object.fromEntries(singers.flatMap((s, i) => [[`holder_${i}`, up({ x: s.x, y: SINGER.top - 6 })], [`slate_${i}`, up({ x: s.x, y: SINGER.slateY - SINGER.slateH / 2 - 4 })]])),
    ...Object.fromEntries(Object.entries(payoff.anchors).map(([k, v]) => [k, up(v)])),
  };
  for (const k of ["lift", "chest_hinge"]) if (!anchors[k]) anchors[k] = { ...(payoff.anchors.lift ?? payoff.anchors.chest_hinge ?? { x: 0, y: SINGER.top }) };

  // ---------------------------------------------------------------- drawing
  const bellColor = spec.bell(c);
  function drawShell(g: Phaser.GameObjects.Graphics, cc: OrreryColors, plaque: number): void {
    const { plinthW, plinthH, columnW, torsoTop, torsoBottom, torsoW } = SINGER;
    // contact shadow (coloured, never black; bible §5.3)
    g.fillStyle(cc.shadow, 0.28);
    g.fillEllipse(30, -2, plinthW + 90, 22);
    // plinth: stone block, gold top band, navy inlay, brass plaque
    g.fillStyle(cc.stoneShade, 1);
    g.fillRect(-plinthW / 2, -plinthH, plinthW, plinthH);
    g.fillStyle(cc.stoneBase, 1);
    g.fillRect(-plinthW / 2, -plinthH, plinthW * 0.62, plinthH);
    g.fillStyle(cc.gold, 1);
    g.fillRect(-plinthW / 2 - 6, -plinthH - 8, plinthW + 12, 10);
    g.fillStyle(cc.navy, 1);
    g.fillRect(-plinthW / 2, -plinthH + 10, plinthW, 6);
    g.fillStyle(plaque, 1);
    g.fillRoundedRect(-44, -plinthH + 22, 88, 30, 4);
    g.lineStyle(2, cc.goldHi, 1);
    g.strokeRoundedRect(-44, -plinthH + 22, 88, 30, 4);
    // fluted column
    g.fillStyle(cc.stoneShade, 1);
    g.fillRect(-columnW / 2, torsoBottom, columnW, -plinthH - 8 - torsoBottom);
    g.fillStyle(cc.stoneLit, 1);
    g.fillRect(-columnW / 2, torsoBottom, columnW * 0.45, -plinthH - 8 - torsoBottom);
    g.lineStyle(3, cc.stoneDeep, 1);
    for (const fx0 of [-14, 0, 14]) g.lineBetween(fx0, torsoBottom + 6, fx0, -plinthH - 14);
    // torso: cream shell with gold bands and rounded shoulders
    g.fillStyle(cc.stoneShade, 1);
    g.fillRoundedRect(-torsoW / 2, torsoTop, torsoW, torsoBottom - torsoTop, 40);
    g.fillStyle(cc.stoneBase, 1);
    g.fillRoundedRect(-torsoW / 2, torsoTop, torsoW * 0.7, torsoBottom - torsoTop, 40);
    g.fillStyle(cc.stoneLit, 0.8);
    g.fillRoundedRect(-torsoW / 2 + 8, torsoTop + 10, 26, torsoBottom - torsoTop - 30, 12);
    g.fillStyle(cc.gold, 1);
    g.fillRect(-torsoW / 2 + 6, torsoBottom - 16, torsoW - 12, 10);
    g.fillStyle(cc.goldDeep, 1);
    g.fillRect(-torsoW / 2 + 6, torsoBottom - 8, torsoW - 12, 4);
    // slate frame (the projection screen)
    g.fillStyle(cc.goldDeep, 1);
    g.fillRoundedRect(-SINGER.slateW / 2 - 5, SINGER.slateY - SINGER.slateH / 2 - 5, SINGER.slateW + 10, SINGER.slateH + 10, 8);
    g.fillStyle(cc.gold, 1);
    g.fillRoundedRect(-SINGER.slateW / 2 - 2, SINGER.slateY - SINGER.slateH / 2 - 2, SINGER.slateW + 4, SINGER.slateH + 4, 7);
    // collar (the neck ring under the bell head)
    g.fillStyle(cc.goldDeep, 1);
    g.fillRoundedRect(-52, torsoTop - 14, 104, 20, 8);
    g.fillStyle(cc.gold, 1);
    g.fillRoundedRect(-52, torsoTop - 14, 104, 12, 8);
    g.fillStyle(cc.navy, 1);
    for (const sx of [-34, 0, 34]) g.fillCircle(sx, torsoTop - 8, 4);
  }

  /** The bell head with its navy faceplate halves (split `open` 0…1) and cyan hum glow. */
  const drawBell = (s: SingerParts, glow: number, open: number, crack: number, slump: number, dim: number) => {
    const g = s.bellG;
    g.clear();
    const tone = mix(bellColor, c.stoneDeep, Math.min(1, (1 - dim) * 1.2));
    const y = SINGER.headY + 30 * slump;
    const r = SINGER.headR;
    const tilt = 0.25 * slump;
    const pt = (dx: number, dy: number): XY => ({ x: dx * Math.cos(tilt) - dy * Math.sin(tilt), y: y + dx * Math.sin(tilt) + dy * Math.cos(tilt) });
    // bell dome
    const dome: XY[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = PI + (PI * i) / 24;
      dome.push(pt(r * Math.cos(a), -8 + r * 0.95 * Math.sin(a)));
    }
    dome.push(pt(r + 10, 40), pt(-(r + 10), 40));
    g.fillStyle(mix(mix(tone, c.goldDeep, 0.5), c.beam, 0.55 * glow), 1);
    fillPoly(g, dome.map((p) => ({ x: p.x + 4, y: p.y + 3 })));
    g.fillStyle(mix(tone, c.beam, 0.45 * glow), 1);
    fillPoly(g, dome);
    g.fillStyle(c.goldHi, 0.6 + 0.3 * glow);
    g.fillEllipse(pt(-18, -26).x, pt(-18, -26).y, 22, 34);
    // lip band
    g.fillStyle(c.goldDeep, 1);
    fillPoly(g, [pt(-(r + 12), 34), pt(r + 12, 34), pt(r + 12, 44), pt(-(r + 12), 44)]);
    // faceplate: two navy halves that swing open about their outer edges
    const fw = 30;
    const fh = 52;
    for (const side of [-1, 1] as const) {
      const hingeX = side * fw;
      const w = fw * Math.cos((open * PI) / 2.2);
      const x0 = hingeX - side * w;
      const quad = [pt(x0, -30), pt(hingeX, -30 - 6 * open), pt(hingeX, fh - 30 + 6 * open), pt(x0, fh - 30)];
      g.fillStyle(c.navy, 1);
      fillPoly(g, quad);
      g.fillStyle(c.navyDark, 1);
      fillPoly(g, [quad[0], quad[1], pt(hingeX, -24 - 6 * open), pt(x0, -24)]);
    }
    if (open > 0.05) {
      g.fillStyle(0x0f1c26, 0.9 * open);
      fillPoly(g, [pt(-fw * (1 - Math.cos((open * PI) / 2.2)) + 2, -26), pt(fw * (1 - Math.cos((open * PI) / 2.2)) - 2, -26), pt(fw * (1 - Math.cos((open * PI) / 2.2)) - 2, fh - 34), pt(-fw * (1 - Math.cos((open * PI) / 2.2)) + 2, fh - 34)]);
    }
    // two gold eye studs on the faceplate (the same on every singer)
    if (open < 0.5) {
      g.fillStyle(mix(c.gold, c.beam, glow), 1);
      g.fillCircle(pt(-14, -12).x, pt(-14, -12).y, 5);
      g.fillCircle(pt(14, -12).x, pt(14, -12).y, 5);
    }
    // the crack flash
    if (crack > 0) {
      g.lineStyle(4, 0xffffff, crack);
      const a = pt(-6, -44);
      const b = pt(8, -22);
      const d = pt(-4, -4);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineBetween(b.x, b.y, d.x, d.y);
    }
  };

  /** The chest slate: dark screen; when aimed with a probe, the claim trace + playhead (trace_slate). */
  const drawSlate = (s: SingerParts, i: number, p: ClaimHoldersPose, bright: number, dim: number) => {
    const g = s.slateG;
    g.clear();
    const cy = SINGER.slateY;
    const aimed = p.aimed === i;
    const lit = Math.max(bright, aimed ? p.beam : 0);
    g.fillStyle(mix(mix(0x0f2a33, 0x08161c, (1 - dim) * 1.5), 0x1f4d59, lit), 1);
    g.fillRoundedRect(-SINGER.slateW / 2, cy - SINGER.slateH / 2, SINGER.slateW, SINGER.slateH, 6);
    // faint grid (the panel's graph language, bible §3.3)
    g.lineStyle(1, c.beam, 0.12 + 0.12 * lit);
    for (let k = 1; k < 4; k++) g.lineBetween(-SINGER.slateW / 2 + 4, cy - SINGER.slateH / 2 + (k * SINGER.slateH) / 4, SINGER.slateW / 2 - 4, cy - SINGER.slateH / 2 + (k * SINGER.slateH) / 4);
    for (let k = 1; k < 6; k++) g.lineBetween(-SINGER.slateW / 2 + (k * SINGER.slateW) / 6, cy - SINGER.slateH / 2 + 4, -SINGER.slateW / 2 + (k * SINGER.slateW) / 6, cy + SINGER.slateH / 2 - 4);
    if (!aimed || !s.trace || p.beam < 0.05) return;
    const a = Math.min(1, p.beam + 0.1);
    // tier ≥ secondaryTier: the midline (the honest measuring line)
    if (p.highlight && midY !== null) {
      const m = toSlate(dom.x0, midY, dom, box);
      g.lineStyle(2, c.fnH, 0.8 * a);
      dashedLine(g, { x: -box.w / 2, y: cy + m.y }, { x: box.w / 2, y: cy + m.y }, 6, 5);
    }
    for (const f of s.trace.fns) {
      const col = f.color === "f" ? c.fnF : f.color === "h" ? c.fnH : c.fnG;
      const alpha = (f.style === "ghost" ? 0.35 : 1) * a;
      g.lineStyle(f.style === "solid" ? 3 : 2, col, alpha);
      for (const seg of f.segments) {
        if (f.style === "dashed") {
          for (let k = 0; k + 1 < seg.length; k += 2) g.lineBetween(seg[k].x, cy + seg[k].y, seg[k + 1].x, cy + seg[k + 1].y);
          continue;
        }
        g.beginPath();
        seg.forEach((q, k) => (k === 0 ? g.moveTo(q.x, cy + q.y) : g.lineTo(q.x, cy + q.y)));
        g.strokePath();
      }
    }
    const flash = capsFlashing(s.trace, p.playheadX, halfStep);
    s.trace.brackets.forEach((b, k) => {
      const on = flash[k];
      g.lineStyle(on ? 4 : 2, on ? 0xffffff : c.fnG, a);
      g.lineBetween(b.a.x, cy + b.a.y, b.b.x, cy + b.b.y);
      const vertical = Math.abs(b.a.x - b.b.x) < 1;
      const cap = on ? 9 : 6;
      for (const e of [b.a, b.b]) {
        if (vertical) g.lineBetween(e.x - cap, cy + e.y, e.x + cap, cy + e.y);
        else g.lineBetween(e.x, cy + e.y - cap, e.x, cy + e.y + cap);
      }
    });
    // the playhead: a cyan line at x plus a dot on the claim's first function
    if (p.playheadX !== null) {
      const top = toSlate(p.playheadX, dom.y1, dom, box);
      g.lineStyle(2, c.beam, 0.95 * a);
      g.lineBetween(top.x, cy - box.h / 2, top.x, cy + box.h / 2);
      if (p.traceY !== null && p.traceY >= dom.y0 && p.traceY <= dom.y1) {
        const dot = toSlate(p.playheadX, p.traceY, dom, box);
        g.fillStyle(0xffffff, a);
        g.fillCircle(dot.x, cy + dot.y, 5);
        g.fillStyle(c.beam, a);
        g.fillCircle(dot.x, cy + dot.y, 3);
      }
    }
  };

  const drawCrab = (slot: number | null, t: number) => {
    crabG.clear();
    if (slot === null || t <= 0 || t >= 1) return;
    const s = singers[slot];
    if (!s) return;
    // 0–0.35 drop from the head to the floor, 0.35–0.5 stalk eyes pop, 0.5–1 scuttle right into the drain
    const drop = Math.min(1, t / 0.35);
    const eyes = Math.min(1, Math.max(0, (t - 0.35) / 0.15));
    const run = Math.max(0, (t - 0.5) / 0.5);
    const x = s.x + 140 * run;
    const y = SINGER.headY + (-22 - SINGER.headY) * easeOutCubic(drop) + (drop < 1 ? 0 : -Math.abs(Math.sin(run * PI * 6)) * 8);
    const fade = run > 0.85 ? 1 - (run - 0.85) / 0.15 : 1;
    crabG.fillStyle(c.navyDark, 0.9 * fade);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const lx = x + side * (18 + k * 6);
        const phase = Math.sin(run * PI * 16 + k + (side > 0 ? PI : 0)) * 4;
        crabG.lineStyle(4, c.navyDark, fade);
        crabG.lineBetween(x + side * (8 + k * 5), y, lx + side * 8, y + 16 + phase);
      }
    }
    crabG.fillStyle(c.bronze, fade);
    crabG.fillEllipse(x, y - 4, 58, 34);
    crabG.fillStyle(mix(c.bronze, c.goldHi, 0.4), fade);
    crabG.fillEllipse(x - 8, y - 10, 30, 12);
    if (eyes > 0) {
      crabG.lineStyle(3, c.navyDark, fade);
      for (const side of [-1, 1]) {
        crabG.lineBetween(x + side * 10, y - 18, x + side * 14, y - 18 - 18 * eyes);
        crabG.fillStyle(0xffffff, fade);
        crabG.fillCircle(x + side * 14, y - 20 - 18 * eyes, 6);
        crabG.fillStyle(c.navyDark, fade);
        crabG.fillCircle(x + side * 15, y - 20 - 18 * eyes, 3);
      }
    }
  };

  const drawConsole = (lit: number) => {
    consoleG.clear();
    drawLectern(consoleG, consoleLocal, c, lit);
  };
  drawConsole(0);

  // ---------------------------------------------------------------- per-frame render
  const lensTarget = (p: ClaimHoldersPose): XY => {
    const x = shift + skinRowX(rig, p.aimAngle, spec.spacing);
    return { x: Math.max(-4000, Math.min(4000, x)), y: SINGER.slateY };
  };
  const render = () => {
    const p = pose;
    if (!p) return;
    const lit = state === "dormant" ? 0 : 1;
    // the lens head turns toward where the (eased) aim meets this skin's row
    const target = lensTarget(p);
    const ang = lensAngleTo(lensAt, target);
    lensHead.setRotation(ang);
    const beamLit = lit * p.beam * (1 - 0.6 * ov.lensFlicker);
    drawLensHead(lit * Math.max(0.3, p.beam), ov.gold);
    lensGlow.setAlpha(0.55 * beamLit + 0.5 * ov.gold);
    beamG.clear();
    if (p.aimed !== null && beamLit > 0.01) {
      const from = { x: lensAt.x + (LENS.r + 24) * Math.cos(ang), y: lensAt.y + (LENS.r + 24) * Math.sin(ang) };
      const to = { x: target.x, y: SINGER.slateY + SINGER.slateH / 2 - 6 };
      const col = mix(c.beam, c.goldHi, ov.gold);
      const a = Math.min(1, beamLit + ov.gold);
      beam.set(from, to);
      beam.setColor(col);
      beam.setAlpha(a);
      beamG.lineStyle(12, mix(c.navy, col, 0.35), 0.35 * a);
      beamG.lineBetween(from.x, from.y, to.x, to.y);
      beamG.lineStyle(6, col, 0.9 * a);
      beamG.lineBetween(from.x, from.y, to.x, to.y);
      beamG.lineStyle(2, 0xffffff, a);
      beamG.lineBetween(from.x, from.y, to.x, to.y);
      beamG.fillStyle(0xffffff, 0.9 * a);
      beamG.fillCircle(to.x, to.y, 7);
      beamG.fillStyle(col, 0.6 * a);
      beamG.fillCircle(to.x, to.y, 13);
    } else beam.setAlpha(0);
    // singers: glow, slate, bell (dimmed when another is aimed), honest marks
    singers.forEach((s, i) => {
      const aimed = p.aimed === i;
      const held = ov.held.get(i) ?? 0;
      const glowK = lit * (p.solved ? 0.5 : aimed ? 1 : 0) * (0.55 + 0.45 * p.bell);
      const dim = lit === 0 || p.solved ? 1 : (p.holderGlow[i] ?? 0.8);
      s.body.setAlpha(i === mimic && ov.slump > 0 ? 1 - 0.35 * ov.slump : 1);
      s.glow.setAlpha(0.6 * glowK + 0.8 * held + 0.5 * ov.chord * (i === mimic ? 0 : 1));
      s.glow.setTint(held > 0 || ov.chord > 0 ? c.goldHi : c.beam);
      drawSlate(s, i, p, held, dim);
      drawBell(s, Math.max(glowK, held * 0.6, i !== mimic ? ov.chord : 0), i === mimic ? ov.face : 0, i === mimic ? ov.crack : 0, i === mimic ? ov.slump : 0, dim);
    });
    drawRings();
    drawCrab(mimic, ov.crab);
    const pay = ov.payoff ?? (p.solved ? 1 : 0);
    payoff.render(pay, lit, clock);
    drawConsole(state === "dormant" ? 0 : state === "solved" ? 0.6 : 1);
  };
  /** The hum pulse ring (muted-friendly: its size follows |f(x)|), the honest-bell marks and the true-chord rings. */
  const drawRings = () => {
    const p = pose;
    if (!p) return;
    const lit = state === "dormant" ? 0 : 1;
    singers.forEach((s, i) => {
      s.ring.clear();
      if (p.aimed === i && lit > 0 && !p.solved) {
        const pulse = 0.5 + 0.5 * Math.sin(clock / 90);
        s.ring.lineStyle(3, c.beam, 0.25 + 0.5 * p.bell * pulse);
        s.ring.strokeCircle(0, SINGER.headY - 4, SINGER.headR + 16 + 26 * p.bell * (0.7 + 0.3 * pulse));
      }
      // a failed Verify proved this singer honest: its plaque glows gold while held, and a small gold bell stays on
      // its plinth (only what the grade already said)
      const held = ov.held.get(i) ?? 0;
      if (held > 0) {
        s.ring.fillStyle(c.goldHi, 0.7 * held);
        s.ring.fillRoundedRect(-48, -SINGER.plinthH + 18, 96, 38, 6);
      }
      if (honest.has(i) && !p.solved) {
        s.ring.fillStyle(c.goldDeep, 0.95);
        s.ring.fillCircle(SINGER.plinthW / 2 - 22, -SINGER.plinthH + 36, 17);
        bellGlyph(s.ring, { x: SINGER.plinthW / 2 - 22, y: -SINGER.plinthH + 34 }, 22, c.goldHi, 1);
      }
      if (ov.chord > 0 && i !== mimic) {
        s.ring.lineStyle(4, c.goldHi, 0.8 * (1 - ov.chord));
        s.ring.strokeCircle(0, SINGER.headY - 4, SINGER.headR + 20 + 90 * ov.chord);
      }
    });
  };

  const later = (ms: number, fn: () => void) => anims.add(ms, 1, () => undefined, linear, fn);

  const view: PoseView<ClaimHoldersPose> = {
    root,
    anchors,
    applyPose(p: ClaimHoldersPose) {
      pose = p;
      if (p.solved && p.quarantined !== null) mimic = p.quarantined;
      render();
    },
    setState(s: ContraptionState) {
      if (s === state) return;
      state = s;
      try {
        fx.dormancy(root, s === "dormant", reducedMotion ? 0 : 600);
      } catch {
        root.setAlpha(s === "dormant" ? 0.8 : 1);
      }
      render();
    },
    async playSucceed(plan: SuccessPlan, solved: ClaimHoldersPose) {
      mimic = mimicSlotOf(plan) ?? solved.quarantined ?? pose?.committed ?? null;
      ov.held.clear();
      for (const b of plan.beats) {
        const ms = typeof b.params?.ms === "number" ? b.params.ms : 400;
        const onMimic = mimic !== null && b.anchor === `holder_${mimic}`;
        if (b.anchor === "lens" && b.action === "ignite") anims.add(b.atMs, 300, (t) => (ov.gold = t), easeOutCubic);
        else if (onMimic && b.action === "ignite") {
          anims.add(b.atMs, 260, (t) => (ov.crack = Math.sin(t * PI)), linear);
          later(b.atMs + 120, () => {
            if (!reducedMotion && mimic !== null) fx.burst(stage, { x: singers[mimic].x, y: SINGER.headY }, "sparks");
          });
        } else if (onMimic && b.action === "open") {
          anims.add(b.atMs, 400, (t) => (ov.face = t), easeOutCubic);
          later(b.atMs + 150, () => {
            if (!reducedMotion && mimic !== null) fx.burst(stage, { x: singers[mimic].x, y: SINGER.headY - 10 }, "dust");
          });
        } else if (onMimic && b.action === "dissolve") {
          anims.add(b.atMs, 800, (t) => (ov.crab = t), linear, () => (ov.crab = 1));
          anims.add(b.atMs + 250, 500, (t) => (ov.slump = t), easeInOutSine);
        } else if (b.action === "cycle") anims.add(b.atMs, 900, (t) => (ov.chord = t), easeOutCubic, () => (ov.chord = 0));
        else if (typeof b.params?.anim === "string") anims.add(b.atMs, payoff.ms, (t) => (ov.payoff = t), easeInOutSine);
        void ms;
      }
      await waitMs(scene, reducedMotion ? Math.min(400, plan.durationMs) : plan.durationMs, () => dead);
      if (dead) return;
      anims.clear();
      Object.assign(ov, { gold: 0, crack: 0, face: 1, crab: 1, slump: 1, chord: 0, payoff: null, lensFlicker: 0 });
      honest.clear();
      view.applyPose(solved);
    },
    async playFail(plan: FailurePlan, current: ClaimHoldersPose) {
      void current;
      for (const b of plan.beats as readonly FailBeat[]) {
        const slot = typeof b.params?.slot === "number" ? b.params.slot : null;
        if (b.action === "hold_bright" && slot !== null) {
          const hold = typeof b.params?.holdMs === "number" ? Math.min(b.params.holdMs, 1500) : 1200;
          honest.add(slot);
          anims.add(b.atMs, 180, (t) => ov.held.set(slot, t), easeOutCubic);
          anims.add(b.atMs + hold - 300, 300, (t) => ov.held.set(slot, 1 - t), linear, () => ov.held.delete(slot));
        } else if (b.action === "flash" && slot !== null) {
          later(b.atMs, () => {
            if (!reducedMotion && singers[slot]) fx.burst(stage, { x: singers[slot].x, y: SINGER.headY - 20 }, "motes");
          });
        } else if (b.action === "dim") anims.add(b.atMs, 700, (t) => (ov.lensFlicker = Math.abs(Math.sin(t * PI * 3)) * (1 - t)), linear, () => (ov.lensFlicker = 0));
      }
      await waitMs(scene, Math.min(1600, plan.durationMs), () => dead);
      if (dead) return;
      ov.held.clear();
      ov.lensFlicker = 0;
      render();
    },
    update(dtMs: number) {
      if (dead) return;
      clock += dtMs;
      const busy = anims.busy;
      anims.update(dtMs);
      if (busy || anims.busy) render(); // plans animate between applyPose calls
      else if (pose && pose.aimed !== null) drawRings(); // the hum pulse only
    },
    destroy() {
      dead = true;
      anims.clear();
      beam.destroy();
      payoff.destroy();
      root.destroy(true);
    },
  };
  // anchors that move (none yet: the lens pivots in place); keep setAnchor in the kit for skins
  void setAnchor;
  void P;
  return view;
}
