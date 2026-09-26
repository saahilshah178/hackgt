/**
 * switchboard · skin switchboard (civil e7, the Program Switchboard at the pool's edge; §4.3 slots switchboard_cabinet,
 * jack, plug, program_sheet, step_lamp, steps (new), console). A wooden cord switchboard: name jacks left (view
 * order), role jacks right (display order, decoys included), a lamp above each jack. Each link seats a cream patch cord
 * with brass plugs (Verlet, settles ≈ 0.5 s); both jack lamps and the name's step lamp light WHITE (seated, never
 * correctness); the program sheet's line for that name fills (the words are DOM: the panel's document card and the
 * sheet chip). Rung 3 with `decoyDimRung: 3`: the decoy role jack's lamp dims to 30 %. Success: lamps turn cyan in
 * sequence, the program prints from the outfeed, the memorial steps sweep solid and the step lamps glow. Failure: the
 * named cord unseats and drops, its jack flickers amber, the sheet glows where the margin note prints. Stand-ins.
 */
import type Phaser from "phaser";
import type { SwitchboardConfig } from "@/world/contraptions/switchboard.config";
import {
  CABINET,
  JACK_FIELD,
  SHEET_AT,
  stepLampAt,
  STEPS_FROM,
  STEPS_TO,
  type SwitchboardPose,
  type SwitchJack,
} from "@/world/contraptions/switchboard.meta";
import type { SkinPrefab } from "../../../types";
import { createSwitchboardView, type JackFx, type SwitchboardSkin, type SwitchCtx, type SwitchDyn } from "../shared";

const SHEET = { w: 260, h: 340 };
const STEP_COUNT = 8;

function stepRects(): { x: number; y: number; w: number; h: number }[] {
  const dx = (STEPS_TO.x - STEPS_FROM.x) / STEP_COUNT;
  const dy = (STEPS_TO.y - STEPS_FROM.y) / STEP_COUNT;
  return Array.from({ length: STEP_COUNT }, (_, i) => {
    const top = STEPS_FROM.y + dy * (i + 1);
    return { x: STEPS_FROM.x + dx * i, y: top, w: dx + 1, h: STEPS_FROM.y - top };
  });
}

const switchboardSkin: SwitchboardSkin = {
  skinId: "switchboard",
  build(ctx: SwitchCtx, g: Phaser.GameObjects.Graphics) {
    const c = ctx.colors;
    // the stand and the wooden cabinet
    g.fillStyle(c.woodDeep, 1);
    g.fillRect(CABINET.x - CABINET.w / 2 + 30, CABINET.y + CABINET.h / 2, 24, Math.max(0, ctx.groundLocal - (CABINET.y + CABINET.h / 2)));
    g.fillRect(CABINET.x + CABINET.w / 2 - 54, CABINET.y + CABINET.h / 2, 24, Math.max(0, ctx.groundLocal - (CABINET.y + CABINET.h / 2)));
    g.fillStyle(c.woodDeep, 1);
    g.fillRoundedRect(CABINET.x - CABINET.w / 2, CABINET.y - CABINET.h / 2, CABINET.w, CABINET.h, 18);
    g.fillStyle(c.wood, 1);
    g.fillRoundedRect(CABINET.x - CABINET.w / 2 + 12, CABINET.y - CABINET.h / 2 + 12, CABINET.w - 24, CABINET.h - 24, 12);
    // the brass jack field
    g.fillStyle(c.ink, 0.85);
    g.fillRoundedRect(-CABINET.w / 2 + 40, JACK_FIELD.top - 20, CABINET.w - 80, JACK_FIELD.height + 40, 10);
    g.lineStyle(3, c.brassDeep, 1);
    g.strokeRoundedRect(-CABINET.w / 2 + 40, JACK_FIELD.top - 20, CABINET.w - 80, JACK_FIELD.height + 40, 10);
    // the keyshelf and the program's paper slot
    g.fillStyle(c.brassDeep, 1);
    g.fillRect(-CABINET.w / 2 + 20, CABINET.y + CABINET.h / 2 - 90, CABINET.w - 40, 22);
    g.fillStyle(c.ink, 1);
    g.fillRect(-60, CABINET.y + CABINET.h / 2 - 60, 120, 8);
    // the program sheet on its easel
    g.fillStyle(c.woodDeep, 1);
    g.fillRect(SHEET_AT.x - 6, SHEET_AT.y + SHEET.h / 2, 12, Math.max(0, ctx.groundLocal - SHEET_AT.y - SHEET.h / 2));
    g.fillStyle(c.paper, 1);
    g.fillRect(SHEET_AT.x - SHEET.w / 2, SHEET_AT.y - SHEET.h / 2, SHEET.w, SHEET.h);
    g.lineStyle(2, c.ink, 0.25);
    g.strokeRect(SHEET_AT.x - SHEET.w / 2, SHEET_AT.y - SHEET.h / 2, SHEET.w, SHEET.h);
    // the memorial steps in wireframe (they sweep solid on success)
    g.lineStyle(2, c.marbleShade, 0.8);
    for (const r of stepRects()) g.strokeRect(r.x, r.y, r.w, r.h);
    return {
      sheet: SHEET_AT,
      steps: { x: (STEPS_FROM.x + STEPS_TO.x) / 2, y: (STEPS_FROM.y + STEPS_TO.y) / 2 },
      outfeed: { x: 0, y: CABINET.y + CABINET.h / 2 - 56 },
    };
  },
  drawJack(g: Phaser.GameObjects.Graphics, j: SwitchJack, fx: JackFx, ctx: SwitchCtx, now: number) {
    const c = ctx.colors;
    // the jack: a brass ring with a dark socket
    g.fillStyle(c.brassDeep, 1);
    g.fillCircle(j.x, j.y, 17);
    g.fillStyle(c.brass, 1);
    g.fillCircle(j.x, j.y, 13);
    g.fillStyle(c.ink, 1);
    g.fillCircle(j.x, j.y, 6);
    // the lamp above it: white = seated (not correct), cyan = solved, dim = the rung-3 decoy dim, amber flicker = a miss
    const lamp = { x: j.x + (j.side === "left" ? -46 : 46), y: j.y };
    const flickerOn = fx.flash > 0 && Math.floor(now / 90) % 2 === 0;
    const cyan = fx.cyan || j.lamp === "cyan";
    const color = flickerOn ? c.flicker : cyan ? c.cyan : j.lamp === "white" ? c.white : c.dormant;
    const on = flickerOn || cyan || j.lamp === "white";
    const alpha = j.lamp === "dim" ? j.alpha : 1;
    if (on) {
      g.fillStyle(color, 0.3 * alpha);
      g.fillCircle(lamp.x, lamp.y, 22);
    }
    g.fillStyle(c.ink, 0.9);
    g.fillCircle(lamp.x, lamp.y, 12);
    g.fillStyle(color, (on ? 1 : 0.55) * alpha);
    g.fillCircle(lamp.x, lamp.y, 9);
    if (j.focus) {
      g.lineStyle(4, c.cyanHi, 0.85);
      g.strokeCircle(j.x, j.y, 26);
    }
  },
  drawDynamic(g: Phaser.GameObjects.Graphics, pose: SwitchboardPose, dyn: SwitchDyn, ctx: SwitchCtx) {
    const c = ctx.colors;
    // program sheet: the title band and one ruled line per name, inked as its cord seats (the words are DOM)
    const top = SHEET_AT.y - SHEET.h / 2;
    const glow = dyn.sheetFlash > 0 ? Math.min(1, dyn.sheetFlash / 400) : 0;
    if (glow > 0) {
      g.fillStyle(c.brassHi, 0.35 * glow);
      g.fillRect(SHEET_AT.x - SHEET.w / 2 - 8, top - 8, SHEET.w + 16, SHEET.h + 16);
    }
    if (pose.title) {
      g.fillStyle(c.ink, 0.85);
      g.fillRect(SHEET_AT.x - SHEET.w / 2 + 20, top + 22, SHEET.w - 40, 10);
      g.fillRect(SHEET_AT.x - SHEET.w / 2 + 50, top + 40, SHEET.w - 100, 6);
    }
    const n = Math.max(1, pose.lines.length);
    pose.lines.forEach((line, i) => {
      const y = top + 80 + (i * (SHEET.h - 110)) / n;
      g.lineStyle(2, c.ink, 0.25);
      g.beginPath();
      g.moveTo(SHEET_AT.x - SHEET.w / 2 + 20, y + 14);
      g.lineTo(SHEET_AT.x + SHEET.w / 2 - 20, y + 14);
      g.strokePath();
      if (line !== null) {
        g.fillStyle(c.ink, 0.8);
        g.fillRect(SHEET_AT.x - SHEET.w / 2 + 22, y, Math.min(SHEET.w - 44, 60 + line.length * 3), 9);
      }
    });
    // the printed program from the outfeed
    const print = dyn.print ?? (pose.printed ? 1 : 0);
    if (print > 0) {
      const y0 = CABINET.y + CABINET.h / 2 - 56;
      g.fillStyle(c.paper, 1);
      g.fillRect(-55, y0, 110, 150 * print);
      g.lineStyle(2, c.ink, 0.4);
      g.strokeRect(-55, y0, 110, 150 * print);
    }
    // the memorial steps sweep solid, left to right
    const rise = Math.max(pose.steps, dyn.rise ?? 0);
    if (rise > 0) {
      const rects = stepRects();
      rects.forEach((r, i) => {
        const k = Math.max(0, Math.min(1, rise * rects.length - i));
        if (k <= 0) return;
        g.fillStyle(c.marble, k);
        g.fillRect(r.x, r.y, r.w, r.h);
        g.fillStyle(c.marbleShade, k);
        g.fillRect(r.x, r.y, r.w, 6);
      });
    }
    // one step lamp per name on the landing: white while that name is patched, cyan when solved
    pose.stepLamps.forEach((s, i) => {
      const at = stepLampAt(i, pose.stepLamps.length);
      const cyan = s === "cyan" || dyn.stepCyan.has(i);
      const color = cyan ? c.cyan : s === "white" ? c.white : c.dormant;
      g.fillStyle(c.brassDeep, 1);
      g.fillRect(at.x - 4, at.y, 8, 40);
      if (cyan || s === "white") {
        g.fillStyle(color, 0.3);
        g.fillCircle(at.x, at.y, 22);
      }
      g.fillStyle(color, cyan || s === "white" ? 1 : 0.55);
      g.fillCircle(at.x, at.y, 10);
    });
  },
  cordStyle(ctx: SwitchCtx, lit: boolean) {
    const c = ctx.colors;
    return {
      color: c.cord,
      width: 6,
      outline: { color: c.ink, width: 9, alpha: 0.5 },
      glow: lit ? { color: c.cyan, width: 14, alpha: 0.35 } : null,
      plug: { radius: 8, color: c.brass, rim: c.brassDeep },
      dash: null,
    };
  },
};

export const skin: SkinPrefab<SwitchboardConfig, SwitchboardPose> = {
  skinId: "switchboard",
  create(scene, _phaser, props) {
    return createSwitchboardView(scene, props, switchboardSkin);
  },
};
export default skin;
