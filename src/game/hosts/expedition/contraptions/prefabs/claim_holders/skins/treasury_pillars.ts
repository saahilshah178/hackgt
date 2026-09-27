/**
 * claim_holders · skin treasury_pillars (trig e5 "The Chime Treasury"; trig §5.5, docs/design/20 §4.3: the resonance
 * pillars' automata, faceplates, bells, slates, plaques, lens and mimic crab, plus chest_body, chest_lid, rim_step,
 * console). The same singers closer together (bells tinted gold.hi, plaques navy), the Tuning Lens, the Treasury Chest
 * on its dais with a gold lock-dial that only turns to a true chord, and the rim stair's five flush slots in the cliff.
 *
 * Live: identical to the Echo Choir (the aimed slate shows its claim over [0, 4π]; the bell's pulse follows |f(x)|).
 * Success: the mimic exposure beat, a true chord, the lock-dial spins, the lid swings −70° about its hinge and gold
 * light spills out, the Warden's key-stone floats up and fades, then the rim stair slides out one step at a time.
 *
 * Code-drawn stand-ins in the biome palette (kit art, §0.1.6 fallback ladder step 1); world text is DOM.
 */
import type Phaser from "phaser";
import type { ClaimHoldersConfig } from "@/world/contraptions/claim-holders.config";
import type { ClaimHoldersPose } from "@/world/contraptions/claim-holders.meta";
import type { SkinPrefab, XY } from "../../../types";
import { createSingerStation, easeOutCubic, fillPoly, mix, star, type OrreryColors, type SingerPayoff } from "../shared";

const PI = Math.PI;
const CHEST = { w: 150, h: 96, lidH: 36, dais: 26 } as const;
/** The rim stair (trig §5.5 payoff terrain, relative to K5 = (8800, 800)): step j tops at −80(j + 1). */
export const RIM_STEPS: readonly { x0: number; x1: number; top: number }[] = [
  { x0: 540, x1: 598, top: -80 },
  { x0: 600, x1: 648, top: -160 },
  { x0: 650, x1: 698, top: -240 },
  { x0: 700, x1: 748, top: -320 },
  { x0: 750, x1: 800, top: -400 },
];

function treasury(scene: Phaser.Scene, stage: Phaser.GameObjects.Container, c: OrreryColors, rowRight: number): SingerPayoff {
  const cx = Math.max(455, rowRight + CHEST.w / 2 + 12);
  const cliffG = scene.add.graphics();
  const liveG = scene.add.graphics();
  stage.addAt(cliffG, 0);
  stage.add(liveG);
  const hinge: XY = { x: cx + CHEST.w / 2, y: -CHEST.dais - CHEST.h };

  // the cliff face the rim stair slides out of (the zone's cliff art stands behind; this keeps the slots readable)
  const cx0 = RIM_STEPS[0].x0;
  const top = RIM_STEPS[RIM_STEPS.length - 1].top;
  cliffG.fillStyle(c.shadow, 0.35);
  cliffG.fillRect(cx0 - 14, top, 14, -top);
  cliffG.fillStyle(0x5f7b7a, 1); // rock.base (bible §2.1)
  cliffG.fillRect(cx0, top - 20, 300, -top + 20);
  cliffG.fillStyle(0x8fa6a0, 1); // rock.light
  cliffG.fillRect(cx0, top - 20, 60, -top + 20);
  cliffG.fillStyle(0x3f5857, 1); // rock.shade
  for (let k = 0; k < 6; k++) cliffG.fillRect(cx0 + 90 + k * 34, top + k * 60, 8, 50);
  // the dais under the chest
  cliffG.fillStyle(c.stoneShade, 1);
  cliffG.fillRect(cx - CHEST.w / 2 - 20, -CHEST.dais, CHEST.w + 40, CHEST.dais);
  cliffG.fillStyle(c.gold, 1);
  cliffG.fillRect(cx - CHEST.w / 2 - 24, -CHEST.dais - 6, CHEST.w + 48, 8);

  return {
    anchors: { chest_hinge: hinge, lift: hinge, rim: { x: RIM_STEPS[2].x0 + 20, y: RIM_STEPS[2].top - 20 } },
    ms: 1000,
    render(p: number, lit: number, t: number) {
      const g = liveG;
      g.clear();
      // phases: 0–0.25 the dial spins, 0.15–0.55 the lid opens and light spills, 0.3–0.8 the key-stone, 0.35–0.95 steps
      const dial = Math.min(1, p / 0.25);
      const lid = easeOutCubic(Math.max(0, Math.min(1, (p - 0.15) / 0.4)));
      const key = Math.max(0, Math.min(1, (p - 0.3) / 0.5));
      // rim stair: flush slots (dark grooves) → blocks slide out one by one (0.15 s stagger)
      RIM_STEPS.forEach((st, j) => {
        const u = easeOutCubic(Math.max(0, Math.min(1, (p - 0.35 - j * 0.1) / 0.2))); // the last step lands at p = 0.95
        const w = st.x1 - st.x0 + 2;
        const h = j === 0 ? -st.top : 80;
        g.fillStyle(0x2b3a44, 0.7 * (1 - u));
        g.fillRect(st.x0 + 6, st.top + 4, w - 12, 8);
        if (u <= 0) return;
        const x0 = st.x0 + 30 * (1 - u);
        g.fillStyle(c.stoneShade, u);
        g.fillRect(x0, st.top, w, h);
        g.fillStyle(c.stoneLit, u);
        g.fillRect(x0, st.top, w, 10);
        g.fillStyle(c.gold, u);
        g.fillRect(x0, st.top + 10, w, 3);
      });
      // the chest body with its gold lock-dial
      const bx = cx - CHEST.w / 2;
      const by = -CHEST.dais - CHEST.h;
      g.fillStyle(c.bronze, 1);
      g.fillRoundedRect(bx, by, CHEST.w, CHEST.h, 8);
      g.fillStyle(mix(c.bronze, c.goldDeep, 0.35), 1);
      g.fillRoundedRect(bx, by, CHEST.w * 0.6, CHEST.h, 8);
      g.fillStyle(c.gold, 1);
      for (const fx0 of [bx + 18, bx + CHEST.w - 26]) g.fillRect(fx0, by, 8, CHEST.h);
      const dialAt = { x: cx, y: by + CHEST.h / 2 + 4 };
      g.fillStyle(c.goldDeep, 1);
      g.fillCircle(dialAt.x, dialAt.y, 22);
      g.fillStyle(mix(c.gold, c.goldHi, dial * lit), 1);
      g.fillCircle(dialAt.x, dialAt.y, 17);
      const ang = -PI / 2 + dial * 2 * PI * 1.25;
      g.lineStyle(4, c.navyDark, 1);
      g.lineBetween(dialAt.x, dialAt.y, dialAt.x + 13 * Math.cos(ang), dialAt.y + 13 * Math.sin(ang));
      for (let k = 0; k < 8; k++) {
        const a = (k * PI) / 4;
        g.fillStyle(c.navy, 1);
        g.fillCircle(dialAt.x + 20 * Math.cos(a), dialAt.y + 20 * Math.sin(a), 2.5);
      }
      // light spilling out of the open chest
      if (lid > 0) {
        g.fillStyle(c.goldHi, 0.28 * lid * lit);
        fillPoly(g, [
          { x: bx + 8, y: by },
          { x: bx + CHEST.w - 8, y: by },
          { x: bx + CHEST.w + 40, y: by - 170 * lid },
          { x: bx - 40, y: by - 170 * lid },
        ]);
      }
      // the lid rotates 70° about its right-hand hinge: the free (left) edge swings up and back
      const la = (70 * PI * lid) / 180;
      const rot = (dx: number, dy: number): XY => ({ x: hinge.x + dx * Math.cos(la) - dy * Math.sin(la), y: hinge.y + dx * Math.sin(la) + dy * Math.cos(la) });
      g.fillStyle(c.goldDeep, 1);
      fillPoly(g, [rot(-CHEST.w - 6, 0), rot(4, 0), rot(4, -CHEST.lidH), rot(-CHEST.w + 10, -CHEST.lidH)]);
      g.fillStyle(c.gold, 1);
      fillPoly(g, [rot(-CHEST.w - 2, -6), rot(0, -6), rot(0, -CHEST.lidH + 4), rot(-CHEST.w + 12, -CHEST.lidH + 4)]);
      g.fillStyle(c.navy, 1);
      const sAt = rot(-CHEST.w / 2, -CHEST.lidH / 2 - 2);
      star(g, sAt, 10, -PI / 2 + la);
      // the Warden's key-stone floats up toward the path and fades
      if (key > 0 && key < 1) {
        const ky = by - 40 - 220 * key;
        g.lineStyle(6, c.goldHi, 1 - key);
        g.strokeCircle(cx, ky, 18);
        g.fillStyle(c.navy, 1 - key);
        g.fillCircle(cx, ky, 7);
      }
      void t;
    },
    destroy() {
      cliffG.destroy();
      liveG.destroy();
    },
  };
}

export const skin: SkinPrefab<ClaimHoldersConfig, ClaimHoldersPose> = {
  skinId: "treasury_pillars",
  create(scene, phaser, props) {
    return createSingerStation(scene, phaser, props, {
      spacing: 200,
      bell: (c) => c.goldHi,
      plaque: (c) => c.navy,
      payoff: treasury,
    });
  },
};
export default skin;
