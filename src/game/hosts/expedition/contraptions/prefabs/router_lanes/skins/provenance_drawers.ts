/**
 * router_lanes · skin provenance_drawers (civil e10, the Provenance Drawers in the Morgue Stacks; §4.3 slots document
 * (one hero sheet of six icons), compact_shelving, crank, meter and shutter (shared with filing_cabinets), console).
 * KC3. It plugs into the civil drawers view of ./filing_cabinets.ts.
 *
 *  - six distinct documents lie spilled on the floor (the `table`), each drawn as what it IS (items[].meta.glyph):
 *    a 1963 photograph print (a framed silhouette), a yellowed cracked-spine textbook painted deliberately older than
 *    anything else (`paper.trap`, the visible trap), the typed text of a law with its seal, a modern film case, a typed
 *    interview transcript, a hardcover biography; never where it belongs;
 *  - a low provenance cabinet with two drawers side by side (PRIMARY / SECONDARY: the words are DOM chips) and, on its
 *    back plate, a meter and a brass feature shutter per drawer;
 *  - filing stamps the document's MADE year on its corner as it enters the drawer (stamp: made_year; the year is the
 *    one printed in its own text);
 *  - the closed compact shelving beyond: on success its cranks spin one unit at a time (150 ms apart) and the units
 *    roll apart, opening the aisle to the rolling ladder.
 * sensitiveSafe: no shake, no bursts. Stand-in art until KC4's hero documents sheet lands.
 */
import type Phaser from "phaser";
import type { RouterLanesConfig } from "@/world/contraptions/router-lanes.config";
import type { RouterItemPose, RouterLanesPose } from "@/world/contraptions/router-lanes.meta";
import { clamp01 } from "@/world/ease";
import type { SkinPrefab, XY } from "../../../types";
import { drawBrassPlate, drawPaper, drawShadow, drawWoodBody, fillPoly, mix, rotRect, type CivilColors } from "../../oracle_ticker/civil-kit";
import { createCivilDrawersView, drawMeter, drawShutter, type DrawersSkin, type DrawerSlot } from "./filing_cabinets";

type G = Phaser.GameObjects.Graphics;

const CABINET = { x0: 10, w: 320, h: 230 } as const;
const SHELVING = { x0: 380, unitW: 92, units: 6, h: 640, spread: 64 } as const;
const FLOOR = { x0: -480, spacing: 64 } as const;

/** Six document icons, ~56 × 70, drawn at `at` (what each document IS; civil §5.10). */
function drawDocument(g: G, glyph: string | null, at: XY, rot: number, alpha: number, s: number, c: CivilColors): void {
  const W = 56 * s;
  const H = 70 * s;
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const P = (dx: number, dy: number): XY => ({ x: at.x + dx * s * cs - dy * s * sn, y: at.y + dx * s * sn + dy * s * cs });
  const rect = (dx: number, dy: number, w: number, h: number, color: number, a = 1) => {
    g.fillStyle(color, a * alpha);
    fillPoly(g, rotRect(P(dx, dy).x, P(dx, dy).y, w * s, h * s, rot));
  };
  switch (glyph) {
    case "photo_print": // a framed print: a silhouette landscape, never a figure
      rect(0, 0, 60, 48, c.brassDeep);
      rect(0, 0, 50, 38, c.paper);
      rect(0, 6, 44, 20, mix(c.steelShade, c.ink, 0.4));
      rect(-8, -4, 20, 12, mix(c.steel, c.paper, 0.4));
      break;
    case "aged_textbook": // yellowed, cracked spine: deliberately the oldest-LOOKING thing (paper.trap)
      rect(0, 0, 60, 70, mix(c.paperTrap, c.brickShade, 0.25));
      rect(4, 0, 50, 64, c.paperTrap);
      rect(-26, 0, 8, 70, mix(c.brickShade, c.ink, 0.2));
      g.lineStyle(2 * s, c.ink, 0.6 * alpha);
      g.beginPath();
      g.moveTo(P(-26, -20).x, P(-26, -20).y);
      g.lineTo(P(-22, -8).x, P(-22, -8).y);
      g.lineTo(P(-28, 4).x, P(-28, 4).y);
      g.lineTo(P(-23, 18).x, P(-23, 18).y);
      g.strokePath();
      rect(6, -14, 30, 6, mix(c.bronze, c.paperTrap, 0.3));
      break;
    case "law_text": // typed pages with a round seal
      drawPaper(g, at.x, at.y, W, H, c, { rot, lines: 5, alpha });
      g.fillStyle(c.brass, alpha);
      g.fillCircle(P(14, 22).x, P(14, 22).y, 9 * s);
      g.fillStyle(c.brassDeep, alpha);
      g.fillCircle(P(14, 22).x, P(14, 22).y, 5 * s);
      break;
    case "film_case": // a modern round film case (2019)
      g.fillStyle(c.steelShade, alpha);
      g.fillCircle(at.x, at.y, 30 * s);
      g.fillStyle(c.steel, alpha);
      g.fillCircle(at.x, at.y, 25 * s);
      g.fillStyle(c.ink, alpha);
      g.fillCircle(at.x, at.y, 8 * s);
      g.lineStyle(2 * s, c.cyanHi, 0.7 * alpha);
      g.strokeCircle(at.x, at.y, 17 * s);
      break;
    case "transcript": // typed interview pages with a paper clip
      drawPaper(g, at.x + 4 * s, at.y + 4 * s, W, H, c, { rot, alpha, fill: c.paperAged });
      drawPaper(g, at.x, at.y, W, H, c, { rot, lines: 6, alpha });
      rect(-14, -34, 8, 22, c.steel);
      break;
    case "hardcover": // a thick 1988 hardcover with a dust jacket
      rect(0, 0, 62, 72, c.navyDark);
      rect(3, 0, 54, 66, c.navy);
      rect(3, -16, 54, 10, c.brass);
      rect(-27, 0, 6, 72, c.brassDeep);
      break;
    default:
      drawPaper(g, at.x, at.y, W, H, c, { rot, lines: 4, alpha });
  }
}

function drawShelving(g: G, ground: (x: number) => number, roll: number, crankSpin: readonly number[], c: CivilColors): void {
  for (let u = 0; u < SHELVING.units; u++) {
    const x0 = SHELVING.x0 + u * SHELVING.unitW + u * SHELVING.spread * clamp01(roll);
    const base = ground(x0 + SHELVING.unitW / 2);
    drawShadow(g, x0 + SHELVING.unitW / 2, base, SHELVING.unitW, c, 0.2);
    drawWoodBody(g, x0, base - SHELVING.h, SHELVING.unitW - 6, SHELVING.h, c);
    // shelf edges with rows of boxes
    for (let r = 1; r < 6; r++) {
      const y = base - SHELVING.h + r * (SHELVING.h / 6);
      g.fillStyle(mix(c.paperAged, c.bronze, 0.35), 1);
      g.fillRect(x0 + 10, y - 44, SHELVING.unitW - 26, 40);
      g.fillStyle(c.brassDeep, 1);
      g.fillRect(x0 + 4, y, SHELVING.unitW - 14, 6);
    }
    // the crank wheel on the end panel
    const hub = { x: x0 + SHELVING.unitW / 2 - 3, y: base - SHELVING.h / 2 };
    const a0 = crankSpin[u] ?? 0;
    g.lineStyle(5, c.brassDeep, 1);
    g.strokeCircle(hub.x, hub.y, 20);
    for (let k = 0; k < 3; k++) {
      const a = a0 + (k * 2 * Math.PI) / 3;
      g.beginPath();
      g.moveTo(hub.x, hub.y);
      g.lineTo(hub.x + Math.cos(a) * 20, hub.y + Math.sin(a) * 20);
      g.strokePath();
    }
    g.fillStyle(c.brass, 1);
    g.fillCircle(hub.x, hub.y, 6);
  }
}

const provenanceSkin: DrawersSkin = {
  skinId: "provenance_drawers",
  itemW: 60,
  itemH: 74,
  build(ctx, g) {
    const { c } = ctx;
    const lanes = Math.max(2, ctx.props.config.lanes.length);
    const base = ctx.ground(CABINET.x0 + CABINET.w / 2);
    // the provenance cabinet (low, two drawers side by side) and its back plate
    drawShadow(g, CABINET.x0 + CABINET.w / 2, base, CABINET.w + 30, c);
    g.fillStyle(mix(c.bronze, c.ink, 0.45), 1);
    g.fillRect(CABINET.x0 + 10, base - CABINET.h - 220, CABINET.w - 20, 220);
    g.fillStyle(c.brassDeep, 1);
    g.fillRect(CABINET.x0 + 4, base - CABINET.h - 228, CABINET.w - 8, 10);
    drawWoodBody(g, CABINET.x0, base - CABINET.h, CABINET.w, CABINET.h, c);
    const drawers: DrawerSlot[] = [];
    const meters: XY[] = [];
    const shutters: XY[] = [];
    const dw = (CABINET.w - 30) / lanes;
    for (let i = 0; i < lanes; i++) {
      const cx = CABINET.x0 + 15 + dw * (i + 0.5);
      drawers.push({ mouth: { x: cx, y: base - CABINET.h + 30 }, w: dw - 14 });
      shutters.push({ x: cx, y: base - CABINET.h - 104 });
      meters.push({ x: cx, y: base - CABINET.h - 188 });
      // the lower drawer fronts (closed)
      g.fillStyle(mix(c.bronze, c.ink, 0.15), 1);
      g.fillRect(cx - dw / 2 + 8, base - 110, dw - 16, 74);
      g.fillStyle(c.brass, 1);
      g.fillRoundedRect(cx - 18, base - 80, 36, 9, 4);
    }
    const floorY = ctx.ground(FLOOR.x0 + 160);
    return {
      table: { x: FLOOR.x0 + 160, y: floorY - 40 },
      rest(display) {
        return { x: FLOOR.x0 + display * FLOOR.spacing, y: floorY - 34 - (display % 2) * 18, rot: ((display * 41) % 13 - 6) * 0.045 };
      },
      drawers,
      meters,
      shutters,
      payoff: { x: SHELVING.x0 + SHELVING.unitW, y: ctx.ground(SHELVING.x0) - SHELVING.h / 2 },
      stairwell: null,
    };
  },
  drawBack(g, _glow, pose, dyn, ctx, L) {
    const { c } = ctx;
    const roll = pose.solved ? 1 : (dyn.payoff ?? 0);
    const spin = Array.from({ length: SHELVING.units }, (_, u) => {
      const k = clamp01(roll * 1.6 - u * 0.12); // one unit at a time (150 ms apart at the 700 ms payoff)
      return k * 4 * Math.PI;
    });
    drawShelving(g, ctx.ground, roll, spin, c);
    L.drawers.forEach((d, i) => {
      const slam = pose.solved ? 1 : (dyn.slam[i] ?? 0);
      g.fillStyle(c.navyDark, 1 - slam);
      g.fillRect(d.mouth.x - d.w / 2, d.mouth.y - 12, d.w, 26);
    });
  },
  drawFront(g, glow, pose, dyn, ctx, L) {
    const { c } = ctx;
    L.drawers.forEach((d, i) => {
      const lane = pose.lanes[i];
      const slam = pose.solved ? 1 : (dyn.slam[i] ?? 0);
      const out = 14 * (1 - slam);
      drawBrassPlate(g, d.mouth.x - d.w / 2, d.mouth.y + 12 + out * 0.3, d.w, 46, c, 6);
      g.fillStyle(c.paper, 1);
      g.fillRect(d.mouth.x - 30, d.mouth.y + 22 + out * 0.3, 60, 14); // the drawer's label card (the words are DOM)
      if (lane && lane.open > 0.05) {
        glow.fillStyle(c.cyan, 0.2 * lane.open);
        glow.fillRect(d.mouth.x - d.w / 2 - 6, d.mouth.y - 20, d.w + 12, 80);
      }
      const m = L.meters[i];
      if (m) drawMeter(g, m, lane?.meter ?? -50, c, (lane?.count ?? 0) > 0);
      const s = L.shutters[i];
      if (s) drawShutter(g, glow, s, Math.min(140, d.w), 100, Math.max(lane?.shutter ?? 0, dyn.shutter[i] ?? 0), c);
    });
  },
  drawItem(g, item: RouterItemPose, at, rot, alpha, scale, ctx) {
    drawDocument(g, item.glyph, at, rot, alpha, scale, ctx.c);
  },
};

export const skin: SkinPrefab<RouterLanesConfig, RouterLanesPose> = {
  skinId: "provenance_drawers",
  create(scene, _phaser, props) {
    return createCivilDrawersView(scene, props, provenanceSkin);
  },
};
export default skin;
