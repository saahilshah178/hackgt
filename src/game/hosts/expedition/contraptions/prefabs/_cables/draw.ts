/**
 * prefabs/_cables/draw.ts — the Phaser half of the shared cord and cable drawing (KB (L7) owns it; KC imports it
 * read-only: switchboard patch cords, cause_tubes wires and tubes; KB: pump_rewiring cables).
 *
 * `createCable(scene, parent, opts)` returns a CableHandle: one Graphics object that redraws only when something
 * changed (ends, shape, style, grow, slack, packet) or while a Verlet cord is still moving. Everything it draws is
 * cosmetic (F6): the metas decide WHAT is linked; the cable only shows it. Phaser is a TYPE import only; the runtime
 * object comes from `scene.add`.
 *
 * Shapes: straight · sag (hanging, parabolic catenary) · catenary (true catenary of a given length) · vertical (bowed
 * mast wire) · manhattan (≤ 2 bends, rounded corners) · verlet (a pinned 12-point chain, gravity 900, settles ≈ 0.5 s).
 * Style: a core stroke plus an optional dark outline under it, an optional additive-looking glow over it, plugs (brass
 * rings) at the seated ends, and an optional dash pattern (draft / slack wires).
 */
import type Phaser from "phaser";
import {
  bowPath,
  catenaryPath,
  createRope,
  manhattanPath,
  pathLength,
  pinRope,
  pointAt,
  roundCorners,
  ropePath,
  sagPath,
  stepRope,
  subPath,
  tangentAt,
  trimPath,
  type ManhattanOptions,
  type Rope,
  type XY,
} from "./geometry";

export interface CableStyle {
  color: number;
  width: number;
  alpha: number;
  /** a darker stroke under the core (reads on busy backgrounds) */
  outline: { color: number; width: number; alpha: number } | null;
  /** a wide faint stroke over the core (live current, seated cyan) */
  glow: { color: number; width: number; alpha: number } | null;
  /** brass plugs / jack caps at the ends that are seated */
  plug: { radius: number; color: number; rim: number } | null;
  /** [on, off] dash lengths in units, or null for a solid line */
  dash: readonly [number, number] | null;
}
export const DEFAULT_CABLE_STYLE: CableStyle = {
  color: 0xf3e6c8, // cream patch cord
  width: 5,
  alpha: 1,
  outline: { color: 0x2b2233, width: 8, alpha: 0.55 },
  glow: null,
  plug: { radius: 7, color: 0xc8a24a, rim: 0x6b4f1d },
  dash: null,
};

export type CableShape =
  | { kind: "straight" }
  | { kind: "sag"; sag: number; segments?: number }
  | { kind: "catenary"; length: number; segments?: number }
  | { kind: "vertical"; bow: number; segments?: number }
  | ({ kind: "manhattan"; radius?: number } & ManhattanOptions)
  | { kind: "verlet"; segments?: number; slack?: number; gravity?: number; floorY?: number | null };

export interface PacketStyle {
  radius: number;
  color: number;
  alpha: number;
  /** a capsule (civil big_board) is drawn as a rounded bar along the tangent, else a dot */
  capsule: boolean;
}

export interface CableOptions {
  from: XY;
  to: XY;
  shape: CableShape;
  style?: Partial<CableStyle>;
  /** Graphics depth inside the parent (default: added on top) */
  depth?: number;
  reducedMotion?: boolean;
}

export interface CableHandle {
  readonly graphics: Phaser.GameObjects.Graphics;
  setEnds(from: XY, to: XY): void;
  setShape(shape: CableShape): void;
  setStyle(style: Partial<CableStyle>): void;
  /** draw only the first u ∈ [0, 1] of the cable (a tube or wire growing from its source) */
  setGrow(u: number): void;
  /** extra droop in units (failure: the outgoing wire goes slack); 0 = normal */
  setSlack(extra: number): void;
  /** a current packet / capsule at arc-length fraction u (null hides it) */
  setPacket(u: number | null, style?: Partial<PacketStyle>): void;
  /** which ends show plugs (a cord being dragged has one) */
  setSeated(a: boolean, b: boolean): void;
  /** Verlet cords: release an end so the cord drops (the switchboard failure "unseats and drops"); null re-pins both */
  unseat(end: "from" | "to" | null): void;
  /** the current polyline (after grow and slack), container-local */
  points(): readonly XY[];
  pointAt(u: number): XY;
  setVisible(visible: boolean): void;
  /** call every frame: steps a Verlet cord and redraws when dirty */
  update(dtMs: number): void;
  destroy(): void;
}

const DEFAULT_PACKET: PacketStyle = { radius: 6, color: 0x8fe0ea, alpha: 1, capsule: false };

function shapePath(from: XY, to: XY, shape: CableShape, slack: number, rope: Rope | null): XY[] {
  switch (shape.kind) {
    case "straight":
      return slack > 0 ? sagPath(from, to, slack, 12) : [{ ...from }, { ...to }];
    case "sag":
      return sagPath(from, to, shape.sag + slack, shape.segments ?? 16);
    case "catenary":
      return catenaryPath(from, to, shape.length + slack * 2, shape.segments ?? 16);
    case "vertical":
      return bowPath(from, to, shape.bow + Math.sign(shape.bow || 1) * slack, shape.segments ?? 16);
    case "manhattan": {
      const corners = manhattanPath(from, to, shape);
      const path = roundCorners(corners, shape.radius ?? 18);
      return slack > 0 ? path.map((p, i) => (i === 0 || i === path.length - 1 ? p : { x: p.x, y: p.y + slack })) : path;
    }
    case "verlet":
      return rope ? ropePath(rope) : sagPath(from, to, 0, shape.segments ?? 12);
  }
}

/** Strokes a polyline with the given style on a Graphics object (no clear). Exported for prefabs with their own Graphics. */
export function strokeCable(g: Phaser.GameObjects.Graphics, pts: readonly XY[], style: CableStyle): void {
  if (pts.length < 2) return;
  const stroke = (width: number, color: number, alpha: number) => {
    g.lineStyle(width, color, alpha);
    if (style.dash) {
      strokeDashed(g, pts, style.dash[0], style.dash[1]);
      return;
    }
    g.beginPath();
    g.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
    g.strokePath();
  };
  if (style.outline) stroke(style.outline.width, style.outline.color, style.outline.alpha * style.alpha);
  stroke(style.width, style.color, style.alpha);
  if (style.glow) stroke(style.glow.width, style.glow.color, style.glow.alpha * style.alpha);
}

function strokeDashed(g: Phaser.GameObjects.Graphics, pts: readonly XY[], on: number, off: number): void {
  const total = pathLength(pts);
  if (!(total > 0)) return;
  const period = Math.max(1, on + off);
  for (let d = 0; d < total; d += period) {
    const dash = subPath(pts, d / total, Math.min(1, (d + on) / total));
    if (dash.length < 2) continue;
    g.beginPath();
    g.moveTo(dash[0]!.x, dash[0]!.y);
    for (let i = 1; i < dash.length; i++) g.lineTo(dash[i]!.x, dash[i]!.y);
    g.strokePath();
  }
}

export function createCable(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, opts: CableOptions): CableHandle {
  const g = scene.add.graphics();
  if (parent) parent.add(g);
  if (opts.depth !== undefined) g.setDepth(opts.depth);
  let from = { ...opts.from };
  let to = { ...opts.to };
  let shape: CableShape = opts.shape;
  let style: CableStyle = { ...DEFAULT_CABLE_STYLE, ...opts.style };
  let grow = 1;
  let slack = 0;
  let packet: number | null = null;
  let packetStyle: PacketStyle = DEFAULT_PACKET;
  let seated: [boolean, boolean] = [true, true];
  let released: "from" | "to" | null = null;
  let rope: Rope | null = null;
  let settleMs = 0;
  let dirty = true;
  let cached: XY[] = [];
  const reduced = opts.reducedMotion ?? false;

  const initRope = () => {
    if (shape.kind !== "verlet") {
      rope = null;
      return;
    }
    rope = createRope(from, to, { segments: shape.segments ?? 12, slack: (shape.slack ?? 1.08) + slack / Math.max(1, Math.hypot(to.x - from.x, to.y - from.y)) });
    settleMs = 900;
    if (reduced) {
      for (let i = 0; i < 54; i++) rope = stepRope(rope, 1 / 60, { gravity: shape.gravity ?? 900, floorY: shape.floorY ?? null });
      settleMs = 0;
    }
  };
  initRope();

  const compute = (): XY[] => {
    const path = shapePath(from, to, shape, slack, rope);
    return grow >= 1 ? path : trimPath(path, grow);
  };

  const redraw = () => {
    cached = compute();
    g.clear();
    strokeCable(g, cached, style);
    if (style.plug && cached.length >= 2) {
      const ends: [XY, boolean][] = [
        [cached[0]!, seated[0] && released !== "from"],
        [cached[cached.length - 1]!, seated[1] && released !== "to" && grow >= 1],
      ];
      for (const [p, show] of ends) {
        if (!show) continue;
        g.fillStyle(style.plug.rim, style.alpha);
        g.fillCircle(p.x, p.y, style.plug.radius + 2);
        g.fillStyle(style.plug.color, style.alpha);
        g.fillCircle(p.x, p.y, style.plug.radius);
      }
    }
    if (packet !== null && cached.length >= 2) {
      const p = pointAt(cached, packet);
      g.fillStyle(packetStyle.color, packetStyle.alpha);
      if (packetStyle.capsule) {
        const t = tangentAt(cached, packet);
        const r = packetStyle.radius;
        g.fillCircle(p.x - t.x * r, p.y - t.y * r, r);
        g.fillCircle(p.x + t.x * r, p.y + t.y * r, r);
        g.lineStyle(2 * r, packetStyle.color, packetStyle.alpha);
        g.beginPath();
        g.moveTo(p.x - t.x * r, p.y - t.y * r);
        g.lineTo(p.x + t.x * r, p.y + t.y * r);
        g.strokePath();
      } else {
        g.fillCircle(p.x, p.y, packetStyle.radius);
      }
    }
    dirty = false;
  };
  redraw();

  const handle: CableHandle = {
    graphics: g,
    setEnds(a: XY, b: XY) {
      if (a.x === from.x && a.y === from.y && b.x === to.x && b.y === to.y) return;
      from = { ...a };
      to = { ...b };
      if (rope) {
        rope = pinRope(rope, released === "from" ? null : from, released === "to" ? null : to);
        settleMs = Math.max(settleMs, 600);
      }
      dirty = true;
    },
    setShape(next: CableShape) {
      shape = next;
      initRope();
      dirty = true;
    },
    setStyle(next: Partial<CableStyle>) {
      style = { ...style, ...next };
      dirty = true;
    },
    setGrow(u: number) {
      const v = Math.min(1, Math.max(0, Number.isFinite(u) ? u : 0));
      if (v !== grow) {
        grow = v;
        dirty = true;
      }
    },
    setSlack(extra: number) {
      const v = Math.max(0, extra);
      if (v !== slack) {
        slack = v;
        if (shape.kind === "verlet") initRope();
        dirty = true;
      }
    },
    setPacket(u: number | null, ps?: Partial<PacketStyle>) {
      packet = u === null ? null : Math.min(1, Math.max(0, u));
      if (ps) packetStyle = { ...packetStyle, ...ps };
      dirty = true;
    },
    setSeated(a: boolean, b: boolean) {
      seated = [a, b];
      dirty = true;
    },
    unseat(end: "from" | "to" | null) {
      released = end;
      if (rope) {
        rope = pinRope(rope, end === "from" ? null : from, end === "to" ? null : to);
        settleMs = 1400;
      }
      dirty = true;
    },
    points: () => (dirty ? compute() : cached),
    pointAt: (u: number) => pointAt(dirty ? compute() : cached, u),
    setVisible(visible: boolean) {
      g.setVisible(visible);
    },
    update(dtMs: number) {
      if (rope && settleMs > 0 && shape.kind === "verlet") {
        const steps = Math.min(4, Math.max(1, Math.round(dtMs / (1000 / 60))));
        for (let i = 0; i < steps; i++) rope = stepRope(rope, 1 / 60, { gravity: shape.gravity ?? 900, floorY: shape.floorY ?? null });
        settleMs -= dtMs;
        dirty = true;
      }
      if (dirty) redraw();
    },
    destroy() {
      g.destroy();
    },
  };
  return handle;
}
