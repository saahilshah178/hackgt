/**
 * claim_holders · skin resonance_pillars (trig e3 "The Echo Choir"; trig §5.3, docs/design/20 §4.3 slots automaton_a/b/c,
 * faceplate, bell, slate, plaque, lens_pedestal, lens_head, echo_lift, lift_chain, mimic_crab, console). Three Echo
 * Automata on plinths in view (display) order, each with a bell head behind a two-half navy faceplate and a chest
 * slate the Tuning Lens projects onto; the Echo Lift waits at the right with its resonator fork silent.
 *
 * Live: the lens swings to the aimed singer (hover previews at 70 %), its bell glows and hums, the others dim; with the
 * probe x the aimed slate draws that claim's trace literally with a playhead (trace_slate). Success (mimic_crab): the
 * beam turns gold, the mimic's bell cracks, its faceplate swings open, the Mimic crab drops out and scuttles into the
 * drain, the honest singers ring a true chord and the lift's fork glows, its chains snap taut and the platform rises
 * 40 and hovers, powered. Failure: the honest pick holds bright under a small gold bell (only what the grade said).
 *
 * Code-drawn stand-ins in the biome palette (kit art, §0.1.6 fallback ladder step 1); world text is DOM.
 */
import type Phaser from "phaser";
import type { ClaimHoldersConfig } from "@/world/contraptions/claim-holders.config";
import type { ClaimHoldersPose } from "@/world/contraptions/claim-holders.meta";
import type { SkinPrefab, XY } from "../../../types";
import { createSingerStation, fillPoly, mix, type OrreryColors, type SingerPayoff } from "../shared";

const PI = Math.PI;
/** The Echo Lift: platform 220 wide, gantry 620 tall (the ride rises 500). */
const LIFT = { w: 220, h: 26, post: 130, top: -640 } as const;

function echoLift(scene: Phaser.Scene, stage: Phaser.GameObjects.Container, c: OrreryColors, rowRight: number): SingerPayoff {
  const x = Math.max(800, rowRight + LIFT.post + 80);
  const frameG = scene.add.graphics();
  const liveG = scene.add.graphics();
  stage.addAt(frameG, 0);
  stage.add(liveG);
  // the gantry: two cream posts with gold caps and a navy-inlaid top beam
  for (const side of [-1, 1]) {
    const px = x + side * LIFT.post;
    frameG.fillStyle(c.stoneShade, 1);
    frameG.fillRect(px - 16, LIFT.top, 32, -LIFT.top);
    frameG.fillStyle(c.stoneBase, 1);
    frameG.fillRect(px - 16, LIFT.top, 18, -LIFT.top);
    frameG.fillStyle(c.gold, 1);
    frameG.fillRect(px - 22, -24, 44, 24);
    frameG.fillStyle(c.goldDeep, 1);
    frameG.fillRect(px - 22, -6, 44, 6);
  }
  frameG.fillStyle(c.goldDeep, 1);
  frameG.fillRect(x - LIFT.post - 30, LIFT.top - 28, 2 * LIFT.post + 60, 34);
  frameG.fillStyle(c.gold, 1);
  frameG.fillRect(x - LIFT.post - 30, LIFT.top - 28, 2 * LIFT.post + 60, 22);
  frameG.fillStyle(c.navy, 1);
  frameG.fillRect(x - LIFT.post - 30, LIFT.top - 14, 2 * LIFT.post + 60, 6);
  // the floor well the platform rests in
  frameG.fillStyle(c.stoneDeep, 1);
  frameG.fillRect(x - LIFT.w / 2 - 10, -8, LIFT.w + 20, 8);
  const forkAt: XY = { x, y: LIFT.top - 70 };
  return {
    anchors: { lift: forkAt, lift_platform: { x, y: -LIFT.h } },
    ms: 1000,
    render(p: number, lit: number, t: number) {
      const g = liveG;
      g.clear();
      const rise = 40 * p;
      const hover = p >= 1 ? 3 * Math.sin(t / 320) : 0;
      const py = -LIFT.h - rise - hover;
      // chains: slack arcs at rest, taut once powered
      const slack = 26 * (1 - Math.min(1, p * 1.4));
      g.lineStyle(5, c.brassDeep, 1);
      for (const side of [-1, 1]) {
        const cx = x + side * (LIFT.w / 2 - 14);
        g.beginPath();
        for (let i = 0; i <= 16; i++) {
          const u = i / 16;
          const yy = LIFT.top + (py - LIFT.top) * u;
          const xx = cx + side * slack * Math.sin(PI * u);
          if (i === 0) g.moveTo(xx, yy);
          else g.lineTo(xx, yy);
        }
        g.strokePath();
        for (let i = 1; i < 12; i++) {
          const u = i / 12;
          g.fillStyle(c.brass, 1);
          g.fillCircle(cx + side * slack * Math.sin(PI * u), LIFT.top + (py - LIFT.top) * u, 3.5);
        }
      }
      // the platform
      g.fillStyle(c.shadow, 0.25 * (1 - p * 0.5));
      g.fillEllipse(x + 10, -2, LIFT.w + 30, 14);
      g.fillStyle(c.bronze, 1);
      g.fillRoundedRect(x - LIFT.w / 2, py, LIFT.w, LIFT.h, 6);
      g.fillStyle(c.gold, 1);
      g.fillRect(x - LIFT.w / 2 + 6, py, LIFT.w - 12, 7);
      g.fillStyle(mix(c.navy, c.beam, p * lit), 1);
      for (const k of [-1, 0, 1]) g.fillCircle(x + k * 60, py + 16, 5);
      // the resonator fork: silent navy, glowing gold-cyan when the true chord powers it
      const glow = p * lit;
      const col = mix(c.goldDeep, c.goldHi, glow);
      g.fillStyle(col, 1);
      g.fillRect(forkAt.x - 5, LIFT.top - 30, 10, 26);
      fillPoly(g, [
        { x: forkAt.x - 26, y: forkAt.y - 20 },
        { x: forkAt.x - 16, y: forkAt.y - 20 },
        { x: forkAt.x - 16, y: forkAt.y + 30 },
        { x: forkAt.x + 16, y: forkAt.y + 30 },
        { x: forkAt.x + 16, y: forkAt.y - 20 },
        { x: forkAt.x + 26, y: forkAt.y - 20 },
        { x: forkAt.x + 26, y: forkAt.y + 40 },
        { x: forkAt.x - 26, y: forkAt.y + 40 },
      ]);
      if (glow > 0.01) {
        g.lineStyle(3, c.beam, 0.6 * glow * (0.7 + 0.3 * Math.sin(t / 110)));
        g.strokeCircle(forkAt.x, forkAt.y + 6, 40 + 8 * Math.sin(t / 160));
        g.fillStyle(c.goldHi, 0.35 * glow);
        g.fillCircle(forkAt.x, forkAt.y + 6, 30);
      }
    },
    destroy() {
      frameG.destroy();
      liveG.destroy();
    },
  };
}

export const skin: SkinPrefab<ClaimHoldersConfig, ClaimHoldersPose> = {
  skinId: "resonance_pillars",
  create(scene, phaser, props) {
    return createSingerStation(scene, phaser, props, {
      spacing: 420,
      bell: (c) => c.gold,
      plaque: (c) => c.brass,
      payoff: echoLift,
    });
  },
};
export default skin;
