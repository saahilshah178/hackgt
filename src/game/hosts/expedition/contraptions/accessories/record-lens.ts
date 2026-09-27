/**
 * The `record_lens` accessory (docs/design/20 §2.2, §4.3; civil §5.0.2). KC3 (L8).
 *
 * A brass carriage (`archive_of_voices.part.lens_carriage`, 160 × 140) hangs from a riveted rail
 * (`archive_of_voices.part.record_rail`) drawn along `station.accessories[i].rail` (zone coordinates; rails may bend:
 * e3 follows the telegraph wire, e9 the arch). The carriage is driven by the station's year probe:
 *
 *   u        = clamp((probe − window.start) / (window.end − window.start), 0, 1)
 *   target   = pointAtArcLength(rail, u · length(rail))
 *   carriage = ease toward target (1 − e^(−dt / 110 ms))   — only for poses whose u is not already eased
 *
 * and throws a projector cone (`archive_of_voices.fx.projector_cone`, ADD, recordlight 35 %) at `cone.target`.
 *
 * Mounting: the civil prefabs mount it themselves through `withRecordLens(view, …)` (the prefab cores KC owns wrap
 * every skin; KC's claim_holders / step_bridge / router_lanes skins wrap themselves), so the host needs no accessory
 * code. The view gains the anchors `lens` (the carriage's lens) and `lens_cone` (the cone's target), which the hint
 * table (`arch_rail` ride) and a lens chip can use. Stations without a record_lens accessory are returned unchanged.
 *
 * Code-drawn stand-in art in the civil palette until KC4/C3 deliver the hero carriage.
 */
import type Phaser from "phaser";
import type { ProbeSpec } from "@/contracts/world";
import { approach, clamp01 } from "@/world/ease";
import { pointAlong, type PolyPoint } from "@/world/geom";
import { lensU, probeWindowOf, yearReadout } from "@/world/record-strip";
import { BLEND_ADD, civilColors, drawCone, drawRivets, mix, type CivilColors } from "../prefabs/oracle_ticker/civil-kit";
import type { ContraptionState, PoseView, PrefabProps, XY } from "../types";

// ================================================================ pure half (record-lens.test.ts)

export interface RecordLensSpec {
  rail: readonly PolyPoint[];
  carriage: string;
  cone: { target: PolyPoint; asset: string } | null;
}

/** The station's record_lens accessory, or null. */
export function recordLensOf(station: { accessories?: readonly unknown[] }): RecordLensSpec | null {
  for (const a of station.accessories ?? []) {
    const acc = a as Partial<RecordLensSpec> & { kind?: unknown };
    if (acc.kind !== "record_lens" || !Array.isArray(acc.rail) || acc.rail.length < 2) continue;
    return { rail: acc.rail, carriage: typeof acc.carriage === "string" ? acc.carriage : "", cone: acc.cone ?? null };
  }
  return null;
}

/** Zone-space rail → container-local (the prefab root sits at station.anchor). */
export function railLocal(rail: readonly PolyPoint[], anchor: XY): PolyPoint[] {
  return rail.map(([x, y]) => [x - anchor.x, y - anchor.y] as PolyPoint);
}

/** Total polyline length. */
export function railLength(rail: readonly PolyPoint[]): number {
  let total = 0;
  for (let i = 1; i < rail.length; i++) total += Math.hypot(rail[i]![0] - rail[i - 1]![0], rail[i]![1] - rail[i - 1]![1]);
  return total;
}

/** The rail's tangent angle (radians, y down) at arc fraction u: the carriage's wheels sit along it. */
export function railTangentAt(rail: readonly PolyPoint[], u: number): number {
  if (rail.length < 2) return 0;
  const total = railLength(rail);
  if (total === 0) return 0;
  let d = clamp01(u) * total;
  for (let i = 1; i < rail.length; i++) {
    const [x0, y0] = rail[i - 1]!;
    const [x1, y1] = rail[i]!;
    const l = Math.hypot(x1 - x0, y1 - y0);
    if (d <= l || i === rail.length - 1) return Math.atan2(y1 - y0, x1 - x0);
    d -= l;
  }
  return 0;
}

/** The carriage's point on the (local) rail for a u. */
export function carriageAt(rail: readonly PolyPoint[], u: number): XY {
  return pointAlong(rail, clamp01(u)) ?? { x: rail[0]?.[0] ?? 0, y: rail[0]?.[1] ?? 0 };
}

/** u for a raw probe value in the station's probe window (null without a probe or a value). */
export function lensUFor(spec: Pick<ProbeSpec, "min" | "max" | "window"> | null, probe: number | null): number | null {
  const w = probeWindowOf(spec);
  return w && probe !== null && Number.isFinite(probe) ? lensU(w, probe) : null;
}

/** The lens chip ("MAR 1965" / "1965"): the probe formatted like the panel readout; null for non-year probes. */
export function lensChipText(spec: Pick<ProbeSpec, "format"> | null, probe: number | null): string | null {
  return spec ? yearReadout(spec.format, probe) : null;
}

/** Cone alpha per contraption state: glow is live only (bible §5.3). */
export function coneAlphaFor(state: ContraptionState): number {
  return state === "active" ? 0.35 : state === "awake" ? 0.14 : state === "solved" ? 0.1 : 0;
}

/** The carriage's lens tip: CARRIAGE_DROP below the rail point (the body hangs plumb from its trolley). */
export const CARRIAGE_DROP = 78;

// ================================================================ Phaser half

export interface RecordLensHandle {
  readonly container: Phaser.GameObjects.Container;
  /** the lens tip and the cone target, container-local (updated every frame) */
  readonly lens: XY;
  readonly coneTarget: XY | null;
  setU(u: number | null): void;
  setState(state: ContraptionState): void;
  /** a short cyan flash along the rail (the success sweep) */
  flash(): void;
  update(dtMs: number): void;
  debug(): Record<string, number>;
  destroy(): void;
}

function drawRail(g: Phaser.GameObjects.Graphics, rail: readonly PolyPoint[], c: CivilColors): void {
  const line = (w: number, color: number, alpha: number, dy = 0) => {
    g.lineStyle(w, color, alpha);
    g.beginPath();
    g.moveTo(rail[0]![0], rail[0]![1] + dy);
    for (let i = 1; i < rail.length; i++) g.lineTo(rail[i]![0], rail[i]![1] + dy);
    g.strokePath();
  };
  // hangers at both ends and every ~420 units (the rail runs like a lintel over the station)
  const total = railLength(rail);
  const hangers = Math.max(2, Math.round(total / 420) + 1);
  for (let i = 0; i < hangers; i++) {
    const p = carriageAt(rail, i / (hangers - 1));
    g.fillStyle(c.brassDeep, 0.9);
    g.fillRect(p.x - 3, p.y - 46, 6, 40);
    g.fillStyle(c.brass, 1);
    g.fillCircle(p.x, p.y - 48, 7);
  }
  line(16, c.ink, 0.55, 3);
  line(12, c.brassDeep, 1);
  line(7, c.brass, 1, -1);
  line(2, c.brassHi, 0.9, -3);
  for (let i = 1; i < rail.length; i++) {
    const a = { x: rail[i - 1]![0], y: rail[i - 1]![1] };
    const b = { x: rail[i]![0], y: rail[i]![1] };
    drawRivets(g, a, b, 56, 2.5, c.brassDeep, 1);
  }
}

function drawCarriage(g: Phaser.GameObjects.Graphics, tangent: number, aim: number, c: CivilColors, live: number, flash: number): void {
  // trolley: two wheels on the rail along its tangent
  const cs = Math.cos(tangent);
  const sn = Math.sin(tangent);
  for (const d of [-26, 26]) {
    g.fillStyle(c.ink, 1);
    g.fillCircle(d * cs, d * sn, 10);
    g.fillStyle(c.brass, 1);
    g.fillCircle(d * cs, d * sn, 6);
  }
  g.fillStyle(c.brassDeep, 1);
  g.fillRect(-30, 4, 60, 10);
  // the hanger and the body (plumb)
  g.fillStyle(c.brassDeep, 1);
  g.fillRect(-5, 10, 10, 22);
  g.fillStyle(mix(c.bronze, c.ink, 0.35), 1);
  g.fillRoundedRect(-48, 30, 96, 40, 10);
  g.fillStyle(c.bronze, 1);
  g.fillRoundedRect(-44, 33, 88, 32, 8);
  g.fillStyle(c.brassHi, 0.9);
  g.fillRect(-38, 36, 76, 3);
  // the lens barrel aims at the cone target
  const bx = Math.cos(aim);
  const by = Math.sin(aim);
  const px = -by;
  const py = bx;
  const base = { x: 0, y: 52 };
  const tip = { x: base.x + bx * 30, y: base.y + by * 30 };
  g.fillStyle(c.brassDeep, 1);
  g.beginPath();
  g.moveTo(base.x + px * 14, base.y + py * 14);
  g.lineTo(tip.x + px * 17, tip.y + py * 17);
  g.lineTo(tip.x - px * 17, tip.y - py * 17);
  g.lineTo(base.x - px * 14, base.y - py * 14);
  g.closePath();
  g.fillPath();
  const glass = mix(c.lensDormant, c.cyan, clamp01(live + flash));
  g.fillStyle(glass, 1);
  g.fillCircle(tip.x, tip.y, 12);
  g.fillStyle(0xffffff, 0.35 + 0.4 * clamp01(live + flash));
  g.fillCircle(tip.x - 3, tip.y - 3, 4);
}

export function createRecordLens(
  scene: Phaser.Scene,
  props: Pick<PrefabProps<unknown>, "station" | "palette" | "reducedMotion">,
  spec: RecordLensSpec,
  opts: { ease: boolean },
): RecordLensHandle {
  const c = civilColors(props.palette);
  const anchor = props.station.anchor;
  const rail = railLocal(spec.rail, anchor);
  const coneTarget: XY | null = spec.cone ? { x: spec.cone.target[0] - anchor.x, y: spec.cone.target[1] - anchor.y } : null;
  const container = scene.add.container(0, 0);
  const railG = scene.add.graphics();
  const coneG = scene.add.graphics();
  coneG.setBlendMode(BLEND_ADD);
  const carriageG = scene.add.graphics();
  container.add([coneG, railG, carriageG]);
  drawRail(railG, rail, c);

  let target = 0;
  let u = 0;
  let started = false;
  let state: ContraptionState = "dormant";
  let coneAlpha = 0;
  let flash = 0;
  const lens: XY = { x: rail[0]![0], y: rail[0]![1] + CARRIAGE_DROP };

  const redraw = () => {
    const p = carriageAt(rail, u);
    const tangent = railTangentAt(rail, u);
    carriageG.setPosition(p.x, p.y);
    const lensBase = { x: p.x, y: p.y + 52 };
    const aim = coneTarget ? Math.atan2(coneTarget.y - lensBase.y, coneTarget.x - lensBase.x) : Math.PI / 2;
    lens.x = lensBase.x + Math.cos(aim) * 30;
    lens.y = lensBase.y + Math.sin(aim) * 30;
    carriageG.clear();
    drawCarriage(carriageG, tangent, aim, c, state === "active" ? 1 : state === "awake" ? 0.4 : 0, flash);
    coneG.clear();
    if (coneTarget && coneAlpha > 0.01) drawCone(coneG, lens, coneTarget, 10, 120, c.cyan, coneAlpha + 0.4 * flash);
  };
  redraw();

  return {
    container,
    lens,
    coneTarget,
    setU(next: number | null) {
      if (next === null || !Number.isFinite(next)) return;
      target = clamp01(next);
      if (!started || !opts.ease || props.reducedMotion) u = target;
      started = true;
    },
    setState(s: ContraptionState) {
      state = s;
    },
    flash() {
      flash = 1;
    },
    update(dtMs: number) {
      const dt = Math.max(0, dtMs);
      if (opts.ease && !props.reducedMotion) u = approach(u, target, dt);
      coneAlpha = props.reducedMotion ? coneAlphaFor(state) : approach(coneAlpha, coneAlphaFor(state), dt, 200);
      flash = Math.max(0, flash - dt / 900);
      redraw();
    },
    debug: () => ({ lensU: Math.round(u * 1000) / 1000, lensTarget: Math.round(target * 1000) / 1000 }),
    destroy() {
      container.destroy(true);
    },
  };
}

/**
 * Wraps a prefab view with the station's record lens (no-op without the accessory). `uOf` reads the lens fraction
 * from the archetype's pose; `ease` = true when that value is not already eased by the controller (router_lanes'
 * raw `probe`).
 */
export function withRecordLens<Pose>(
  view: PoseView<Pose>,
  scene: Phaser.Scene,
  props: Pick<PrefabProps<unknown>, "station" | "palette" | "reducedMotion">,
  uOf: (pose: Pose) => number | null,
  opts: { ease?: boolean } = {},
): PoseView<Pose> {
  const spec = recordLensOf(props.station);
  if (!spec) return view;
  const lens = createRecordLens(scene, props, spec, { ease: opts.ease ?? false });
  view.root.add(lens.container);
  const anchors = view.anchors as Record<string, XY>;
  const syncAnchors = () => {
    anchors.lens = { x: lens.lens.x, y: lens.lens.y };
    if (lens.coneTarget) anchors.lens_cone = lens.coneTarget;
  };
  syncAnchors();
  return {
    ...view,
    applyPose(pose: Pose) {
      view.applyPose(pose);
      lens.setU(uOf(pose));
    },
    setState(state: ContraptionState) {
      view.setState(state);
      lens.setState(state);
    },
    async playSucceed(plan, pose) {
      lens.flash();
      await view.playSucceed(plan, pose);
      lens.setU(uOf(pose));
    },
    playFail: (plan, pose) => view.playFail(plan, pose),
    update(dtMs: number) {
      view.update?.(dtMs);
      lens.update(dtMs);
      syncAnchors();
    },
    destroy() {
      lens.destroy();
      view.destroy();
    },
  };
}
