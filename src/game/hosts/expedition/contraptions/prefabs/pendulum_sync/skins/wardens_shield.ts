/**
 * pendulum_sync · skin wardens_shield (trig e6 "The Warden's Shield"; trig §5.6, docs/design/20 §4.3 slots warden_body,
 * warden_arm, shield, visor, star_door_l, star_door_r, counter_pylon, pendulum_arm, bob, span_tile, console). The Star
 * Door's two cream leaves with gold star inlays stand in the dome's back wall; the 5.5 H Warden stands right of it on
 * its stepped plinth, arm out, and swings its great shield from the gauntlet like a pendulum across the door, A spans
 * either way over the numbered span tiles; the player's small counter-pendulum hangs from a gold pylon by the console,
 * joined to the shield's boss by the sync thread.
 *
 * Live (τ = the station clock): the shield sweeps in real time (the controller's pose); the counter-pendulum swings 14°
 * at the dialled period (the pendulum-beat sim); the thread's width and alpha follow B = ½(1 + cos Δ), it sags and
 * sparks when B < 0.3. Common-start reset on open and settle (the controller). Success: the thread turns gold and
 * thickens, the swings decay together, the Warden lowers the shield to the floor and kneels (−120, head bowed 15°), the
 * Star Door's leaves slide apart and starlight spills out. Failure: the thread snaps with a spark, the visor flares,
 * the shield deflects the broken end; `reach` flashes the span tiles, `half` flashes the bob; the pendulum resumes.
 *
 * The world keeps its own time while a plan plays (the controller stops feeding poses): `freeRun` continues both swings.
 * Code-drawn stand-ins in the biome palette (kit art, §0.1.6 fallback ladder step 1); world text is DOM.
 */
import type Phaser from "phaser";
import type { PendulumSyncConfig } from "@/world/contraptions/pendulum-sync.config";
import {
  bobAt,
  DOOR_H,
  KNEEL_DROP,
  LEAF_W,
  PYLON_H,
  PYLON_PIVOT,
  PYLON_X,
  SHIELD_R,
  SHOULDER,
  shieldGeometry,
  spanAnchor,
  WARDEN_X,
  type PendulumSyncPose,
} from "@/world/contraptions/pendulum-sync.meta";
import type { FailBeat, FailurePlan, SuccessBeat, SuccessPlan } from "@/world/types";
import type { ContraptionState, PoseView, PrefabProps, SkinPrefab, XY } from "../../../types";
import {
  Anims,
  drawLectern,
  easeInOutSine,
  easeOutCubic,
  fillPoly,
  freeRun,
  linear,
  mix,
  orreryColors,
  setAnchor,
  snappedHalves,
  spanTileXs,
  threadPoints,
  threadStyle,
  waitMs,
  type FreeRunStart,
  type OrreryColors,
} from "../shared";

const PI = Math.PI;
const DEG = PI / 180;
const FRAME_W = 50; // the door surround's pilasters
const ARCH_H = 110;

/** A five-point star. */
function star(g: Phaser.GameObjects.Graphics, at: XY, r: number, rot = -PI / 2): void {
  const pts: XY[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push({ x: at.x + rr * Math.cos(a), y: at.y + rr * Math.sin(a) });
  }
  fillPoly(g, pts);
}
/** A thick segment (limb) from a to b with rounded joints. */
function limb(g: Phaser.GameObjects.Graphics, a: XY, b: XY, w: number, col: number, hi: number): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  g.fillStyle(col, 1);
  fillPoly(g, [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ]);
  g.fillCircle(a.x, a.y, w / 2);
  g.fillCircle(b.x, b.y, w / 2);
  g.fillStyle(hi, 1);
  fillPoly(g, [
    { x: a.x + nx * 0.8, y: a.y + ny * 0.8 },
    { x: b.x + nx * 0.8, y: b.y + ny * 0.8 },
    { x: b.x + nx * 0.3, y: b.y + ny * 0.3 },
    { x: a.x + nx * 0.3, y: a.y + ny * 0.3 },
  ]);
}

interface Ov {
  run: { start: FreeRunStart; ms: number; decay: number; kneel: number; lower: number; door: number; B: number | null } | null;
  gold: number; // thread gold 0…1
  snap: number; // thread snapped: recoil 0…1 (≥ 0 while snapped), −1 whole
  visor: number; // visor flare 0…1
  tiles: number; // span tile flash 0…1
  bobFlash: number;
  wobble: number;
  light: number; // starlight spill 0…1
}

function createWardensShield(scene: Phaser.Scene, P: typeof Phaser, props: PrefabProps<PendulumSyncConfig>): PoseView<PendulumSyncPose> {
  const { station, fx, reducedMotion, config } = props;
  const c = orreryColors(props.palette);
  const groundLocal = props.groundY - station.anchor.y;
  const floor = Math.max(-40, Math.min(300, groundLocal));
  const consoleLocal: XY = { x: station.consoleX - station.anchor.x, y: groundLocal };
  const anims = new Anims(reducedMotion);
  const ov: Ov = { run: null, gold: 0, snap: -1, visor: 0, tiles: 0, bobFlash: 0, wobble: 0, light: 0 };
  let pose: PendulumSyncPose | null = null;
  let state: ContraptionState = "dormant";
  let dead = false;
  let clock = 0;
  let lastSpark = -1e9;

  const root = scene.add.container(station.anchor.x, station.anchor.y);
  const stage = scene.add.container(0, floor);
  const consoleG = scene.add.graphics();
  root.add([stage, consoleG]);
  const doorwayG = scene.add.graphics(); // starlight behind the leaves
  const leafL = scene.add.graphics();
  const leafR = scene.add.graphics();
  const surroundG = scene.add.graphics();
  const tilesG = scene.add.graphics();
  const wardenLegsG = scene.add.graphics();
  const wardenBody = scene.add.container(0, 0);
  const wardenBodyG = scene.add.graphics();
  const head = scene.add.container(WARDEN_X, -760);
  const headG = scene.add.graphics();
  head.add(headG);
  wardenBody.add([wardenBodyG, head]);
  const pylonG = scene.add.graphics();
  const pendG = scene.add.graphics();
  const threadG = scene.add.graphics();
  const armG = scene.add.graphics();
  const shield = scene.add.container(0, 0);
  const shieldG = scene.add.graphics();
  shield.add(shieldG);
  stage.add([doorwayG, leafL, leafR, surroundG, tilesG, pylonG, wardenLegsG, wardenBody, pendG, threadG, armG, shield]);
  const starlight = fx.glow(stage, { x: 0, y: -DOOR_H / 2 }, 320, c.starGlow, 0);
  stage.remove(starlight);
  stage.addAt(starlight, 1); // between the starry doorway and the leaves
  const visorGlow = fx.glow(wardenBody, { x: WARDEN_X - 30, y: -840 }, 70, c.goldHi, 0);
  const bobGlow = fx.glow(stage, bobAt(0, config), 60, c.beam, 0);

  // ---------------------------------------------------------------- static drawing
  // the doorway behind the leaves: deep navy with a constellation
  doorwayG.fillStyle(c.navyDark, 1);
  doorwayG.fillRect(-LEAF_W, -DOOR_H, 2 * LEAF_W, DOOR_H);
  doorwayG.fillStyle(c.star, 0.9);
  for (const [sx, sy, r] of [[-150, -560, 6], [-60, -470, 4], [40, -610, 7], [120, -420, 5], [-110, -300, 4], [60, -250, 6], [170, -180, 4]] as const) star(doorwayG, { x: sx, y: sy }, r * 1.6);
  // the surround: cream pilasters, a gold-trimmed arch with a navy inlay band and a star medallion
  const drawSurround = (g: Phaser.GameObjects.Graphics, cc: OrreryColors) => {
    const x0 = -LEAF_W - FRAME_W;
    const x1 = LEAF_W + FRAME_W;
    g.fillStyle(cc.stoneShade, 1);
    g.fillRect(x0, -DOOR_H, FRAME_W, DOOR_H);
    g.fillRect(LEAF_W, -DOOR_H, FRAME_W, DOOR_H);
    g.fillStyle(cc.stoneLit, 1);
    g.fillRect(x0, -DOOR_H, FRAME_W * 0.55, DOOR_H);
    g.fillRect(LEAF_W, -DOOR_H, FRAME_W * 0.55, DOOR_H);
    g.fillStyle(cc.navy, 1);
    g.fillRect(x0 + FRAME_W * 0.6, -DOOR_H, 8, DOOR_H);
    g.fillRect(LEAF_W + FRAME_W * 0.6, -DOOR_H, 8, DOOR_H);
    // the arch band
    const band: XY[] = [];
    for (let i = 0; i <= 32; i++) {
      const a = PI + (PI * i) / 32;
      band.push({ x: (x1 + 6) * Math.cos(a), y: -DOOR_H + ARCH_H * Math.sin(a) });
    }
    for (let i = 32; i >= 0; i--) {
      const a = PI + (PI * i) / 32;
      band.push({ x: (LEAF_W - 4) * Math.cos(a), y: -DOOR_H + (ARCH_H - 44) * Math.sin(a) });
    }
    g.fillStyle(cc.stoneBase, 1);
    fillPoly(g, band);
    g.lineStyle(8, cc.gold, 1);
    g.beginPath();
    for (let i = 0; i <= 32; i++) {
      const a = PI + (PI * i) / 32;
      const px = (x1 + 6) * Math.cos(a);
      const py = -DOOR_H + ARCH_H * Math.sin(a);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
    g.lineStyle(6, cc.navy, 1);
    g.beginPath();
    for (let i = 0; i <= 32; i++) {
      const a = PI + (PI * i) / 32;
      const px = (LEAF_W + 16) * Math.cos(a);
      const py = -DOOR_H + (ARCH_H - 26) * Math.sin(a);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
    g.fillStyle(cc.goldDeep, 1);
    g.fillCircle(0, -DOOR_H - ARCH_H + 20, 34);
    g.fillStyle(cc.gold, 1);
    g.fillCircle(0, -DOOR_H - ARCH_H + 20, 28);
    g.fillStyle(cc.navy, 1);
    star(g, { x: 0, y: -DOOR_H - ARCH_H + 20 }, 20);
    // the threshold
    g.fillStyle(cc.stoneDeep, 1);
    g.fillRect(x0 - 10, -10, x1 - x0 + 20, 10);
  };
  drawSurround(surroundG, c);
  // a leaf: cream with gold edges and a scatter of gold stars (a constellation motif), local x 0…LEAF_W
  const drawLeaf = (g: Phaser.GameObjects.Graphics, side: -1 | 1) => {
    g.clear();
    const x0 = side < 0 ? -LEAF_W : 0;
    g.fillStyle(c.stoneShade, 1);
    g.fillRect(x0, -DOOR_H, LEAF_W, DOOR_H);
    g.fillStyle(c.stoneBase, 1);
    g.fillRect(x0 + (side < 0 ? 0 : 10), -DOOR_H, LEAF_W - 10, DOOR_H);
    g.fillStyle(c.gold, 1);
    g.fillRect(x0, -DOOR_H, LEAF_W, 12);
    g.fillRect(x0, -14, LEAF_W, 14);
    g.fillRect(side < 0 ? -10 : 0, -DOOR_H, 10, DOOR_H); // the meeting stiles
    g.lineStyle(4, c.navy, 1);
    g.strokeRect(x0 + 30, -DOOR_H + 50, LEAF_W - 60, DOOR_H - 110);
    g.fillStyle(c.gold, 1);
    const pts = side < 0 ? [[-200, -560], [-120, -470], [-80, -600], [-170, -330], [-90, -240]] : [[70, -520], [150, -620], [200, -420], [110, -300], [180, -200]];
    for (const [sx, sy] of pts) star(g, { x: sx, y: sy }, 16);
    g.lineStyle(2, c.goldDeep, 0.8);
    for (let k = 0; k + 1 < pts.length; k++) g.lineBetween(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
  };
  drawLeaf(leafL, -1);
  drawLeaf(leafR, 1);

  // span tiles under the door
  const tiles = spanTileXs(config);
  const drawTiles = (flash: number, lit: number) => {
    const g = tilesG;
    g.clear();
    const w = Math.min(config.spanUnitPx - 10, 84);
    for (const { k, x } of tiles) {
      g.fillStyle(mix(c.stoneShade, c.goldHi, flash), 1);
      g.fillRect(x - w / 2, -8, w, 12);
      g.fillStyle(mix(c.stoneLit, c.goldHi, flash), 1);
      g.fillRect(x - w / 2, -8, w, 4);
      g.fillStyle(mix(c.goldDeep, c.beam, flash * lit), 1);
      if (k === 0) star(g, { x, y: -2 }, 7);
      else for (let d = 0; d < Math.abs(k); d++) g.fillCircle(x + (d - (Math.abs(k) - 1) / 2) * 10, -2, 3);
    }
  };

  // the counter-pendulum pylon (3 H gold column, pivot on top)
  pylonG.fillStyle(c.shadow, 0.25);
  pylonG.fillEllipse(PYLON_X + 18, -2, 150, 16);
  pylonG.fillStyle(c.goldDeep, 1);
  pylonG.fillRect(PYLON_X - 30, -PYLON_H + 30, 60, PYLON_H - 30);
  pylonG.fillStyle(c.gold, 1);
  pylonG.fillRect(PYLON_X - 30, -PYLON_H + 30, 34, PYLON_H - 30);
  pylonG.fillStyle(c.goldHi, 0.8);
  pylonG.fillRect(PYLON_X - 24, -PYLON_H + 40, 8, PYLON_H - 60);
  pylonG.fillStyle(c.navy, 1);
  for (const y of [-PYLON_H + 90, -110]) pylonG.fillRect(PYLON_X - 30, y, 60, 10);
  pylonG.fillStyle(c.stoneShade, 1);
  pylonG.fillRect(PYLON_X - 52, -40, 104, 40);
  pylonG.fillStyle(c.goldDeep, 1);
  pylonG.fillRoundedRect(PYLON_X - 46, -PYLON_H + 8, 92, 30, 8);
  pylonG.fillStyle(c.bronze, 1);
  pylonG.fillCircle(PYLON_PIVOT.x, PYLON_PIVOT.y, 16);
  pylonG.fillStyle(c.goldHi, 1);
  pylonG.fillCircle(PYLON_PIVOT.x, PYLON_PIVOT.y, 7);

  const drawConsole = (lit: number) => {
    consoleG.clear();
    drawLectern(consoleG, consoleLocal, c, lit);
  };
  drawConsole(0);

  // ---------------------------------------------------------------- the Warden
  const drawWarden = (kneel: number, lit: number) => {
    // legs (the plinth stays; the legs fold as the body drops)
    const g = wardenLegsG;
    g.clear();
    g.fillStyle(c.shadow, 0.3);
    g.fillEllipse(WARDEN_X + 30, -2, 360, 26);
    g.fillStyle(c.stoneDeep, 1);
    g.fillRect(WARDEN_X - 150, -44, 300, 44);
    g.fillStyle(c.stoneShade, 1);
    g.fillRect(WARDEN_X - 120, -84, 240, 42);
    g.fillStyle(c.gold, 1);
    g.fillRect(WARDEN_X - 156, -50, 312, 8);
    g.fillRect(WARDEN_X - 126, -90, 252, 8);
    const hip = -400 + KNEEL_DROP * kneel;
    for (const [lx, front] of [[WARDEN_X - 55, true], [WARDEN_X + 50, false]] as const) {
      const knee: XY = { x: lx - (front ? 70 : 20) * kneel, y: (hip + -90) / 2 + 20 * kneel };
      limb(g, { x: lx, y: hip }, knee, 64, c.stoneShade, c.stoneBase);
      limb(g, knee, { x: lx + (front ? 10 : 30) * kneel, y: -96 }, 56, c.stoneShade, c.stoneBase);
      g.fillStyle(c.gold, 1);
      g.fillRoundedRect(knee.x - 36, knee.y - 20, 72, 40, 12);
      g.fillStyle(c.navy, 1);
      g.fillCircle(knee.x, knee.y, 9);
    }
    // torso, pauldron, collar (in the body container, which drops by kneel)
    wardenBody.setY(KNEEL_DROP * kneel);
    const b = wardenBodyG;
    b.clear();
    const torso: XY[] = [
      { x: WARDEN_X - 100, y: -400 },
      { x: WARDEN_X + 100, y: -400 },
      { x: WARDEN_X + 150, y: -760 },
      { x: WARDEN_X - 150, y: -760 },
    ];
    b.fillStyle(c.stoneShade, 1);
    fillPoly(b, torso);
    b.fillStyle(c.stoneBase, 1);
    fillPoly(b, [torso[0], { x: WARDEN_X + 20, y: -400 }, { x: WARDEN_X + 30, y: -760 }, torso[3]]);
    b.fillStyle(c.gold, 1);
    b.fillRect(WARDEN_X - 104, -420, 208, 16);
    b.fillRect(WARDEN_X - 150, -770, 300, 18);
    b.lineStyle(6, c.navy, 1);
    b.strokeCircle(WARDEN_X, -600, 62);
    b.strokeCircle(WARDEN_X, -600, 36);
    b.fillStyle(mix(c.navyDark, c.beam, 0.5 * lit), 1);
    b.fillCircle(WARDEN_X, -600, 16);
    // the back arm (resting)
    limb(b, { x: WARDEN_X + 130, y: -720 }, { x: WARDEN_X + 170, y: -470 }, 56, c.stoneShade, c.stoneBase);
    b.fillStyle(c.gold, 1);
    b.fillCircle(WARDEN_X + 170, -470, 30);
    // pauldron over the shield shoulder
    b.fillStyle(c.goldDeep, 1);
    b.fillCircle(SHOULDER.x, SHOULDER.y, 64);
    b.fillStyle(c.gold, 1);
    b.fillCircle(SHOULDER.x - 4, SHOULDER.y - 4, 56);
    b.lineStyle(5, c.navy, 1);
    b.strokeCircle(SHOULDER.x - 4, SHOULDER.y - 4, 38);
    // head: a domed helm facing left with the visor slit; bows 15° when kneeling
    head.setRotation(-15 * DEG * kneel);
    const h = headG;
    h.clear();
    h.fillStyle(c.stoneShade, 1);
    h.fillRoundedRect(-80, -175, 160, 180, { tl: 80, tr: 80, bl: 14, br: 14 });
    h.fillStyle(c.stoneBase, 1);
    h.fillRoundedRect(-80, -175, 100, 180, { tl: 80, tr: 40, bl: 14, br: 6 });
    h.fillStyle(c.gold, 1);
    h.fillRect(-10, -178, 20, 150);
    h.fillRect(-84, -12, 168, 14);
    h.fillStyle(c.navyDark, 1);
    h.fillRoundedRect(-78, -92, 92, 18, 8);
  };

  // ---------------------------------------------------------------- the moving parts
  const drawShield = (g: Phaser.GameObjects.Graphics, lit: number) => {
    g.clear();
    g.fillStyle(c.shadow, 0.3);
    g.fillCircle(10, 12, SHIELD_R);
    g.fillStyle(c.goldDeep, 1);
    g.fillCircle(0, 0, SHIELD_R);
    g.fillStyle(c.gold, 1);
    g.fillCircle(-3, -3, SHIELD_R - 8);
    g.fillStyle(c.navy, 1);
    g.fillCircle(0, 0, SHIELD_R - 24);
    g.fillStyle(c.stoneBase, 1);
    g.fillCircle(0, 0, SHIELD_R - 38);
    g.lineStyle(8, c.navy, 1);
    g.strokeCircle(0, 0, 130);
    g.lineStyle(4, c.goldDeep, 1);
    g.strokeCircle(0, 0, 100);
    for (let k = 0; k < 12; k++) {
      const a = (k * PI) / 6;
      g.fillStyle(c.goldDeep, 1);
      g.fillCircle(152 * Math.cos(a), 152 * Math.sin(a), 6);
    }
    g.fillStyle(c.goldDeep, 1);
    g.fillCircle(0, 0, 56);
    g.fillStyle(c.gold, 1);
    g.fillCircle(-2, -2, 50);
    g.fillStyle(c.navy, 1);
    star(g, { x: 0, y: 0 }, 38);
    g.fillStyle(mix(c.bronze, c.beam, 0.6 * lit), 1);
    g.fillCircle(0, 0, 14);
  };
  drawShield(shieldG, 0);

  // ---------------------------------------------------------------- anchors
  const anchors: Record<string, XY> & { console: XY } = {
    console: consoleLocal,
    shoulder: { x: SHOULDER.x, y: SHOULDER.y + floor },
    shield_boss: { x: 0, y: floor - 272 },
    shield_rim: { x: 0, y: floor - 272 - SHIELD_R - 12 }, // the equation chip rides the shield's top rim
    bob: { ...bobAt(0, config), y: bobAt(0, config).y + floor },
    pylon_pivot: { x: PYLON_PIVOT.x, y: PYLON_PIVOT.y + floor },
    door_center: { x: 0, y: floor - DOOR_H / 2 },
    visor: { x: WARDEN_X - 30, y: floor - 840 },
    thread: { x: (PYLON_X + 0) / 2, y: floor - 250 },
    payoff: { x: 0, y: floor - DOOR_H / 2 },
  };
  // span numerals sit on the tiles' front face, below the walk line (the shield sweeps just above it)
  for (const { k, x } of tiles) anchors[spanAnchor(k)] = { x, y: floor + 52 };

  // ---------------------------------------------------------------- per-frame render
  let shieldLit = -1;
  const render = () => {
    const base = pose;
    if (!base) return;
    const lit = state === "dormant" ? 0 : 1;
    // the animated fields: the controller's pose, or the free run while a plan plays; dormant = at rest
    let f: Pick<PendulumSyncPose, "shieldAngle" | "pendAngle" | "B" | "kneel" | "lower" | "door"> = base;
    if (ov.run) f = freeRun(props.view, config, ov.run.start, ov.run);
    if (state === "dormant") f = { ...f, shieldAngle: 0, pendAngle: 0 };
    const geo = shieldGeometry(f, config);
    const thread = lit * base.lit;
    // Warden
    drawWarden(f.kneel, lit);
    visorGlow.setAlpha(lit * (0.55 + 0.45 * ov.visor) * (1 - 0.6 * f.kneel));
    visorGlow.setScale(((70 + 50 * ov.visor) * 2) / 128);
    // door leaves and starlight
    leafL.setX(-LEAF_W * f.door);
    leafR.setX(LEAF_W * f.door);
    starlight.setAlpha(0.9 * Math.max(f.door, ov.light) * lit);
    // span tiles
    drawTiles(ov.tiles, lit);
    // the arm: shoulder → elbow → gauntlet (the pivot), the haft, the shield
    const a = armG;
    a.clear();
    const sh = { x: SHOULDER.x, y: SHOULDER.y + KNEEL_DROP * f.kneel };
    const elbow = { x: (sh.x + geo.pivot.x) / 2 + 10, y: (sh.y + geo.pivot.y) / 2 + 46 };
    limb(a, sh, elbow, 60, c.stoneShade, c.stoneBase);
    limb(a, elbow, geo.pivot, 50, c.stoneShade, c.stoneBase);
    a.fillStyle(c.gold, 1);
    a.fillCircle(elbow.x, elbow.y, 26);
    a.fillStyle(c.goldDeep, 1);
    a.fillRoundedRect(geo.pivot.x - 38, geo.pivot.y - 34, 76, 68, 16);
    a.fillStyle(c.gold, 1);
    a.fillRoundedRect(geo.pivot.x - 34, geo.pivot.y - 34, 60, 58, 14);
    a.lineStyle(18, c.bronze, 1);
    a.lineBetween(geo.pivot.x, geo.pivot.y, geo.boss.x, geo.boss.y);
    a.lineStyle(6, c.brassHi, 1);
    a.lineBetween(geo.pivot.x - 4, geo.pivot.y, geo.boss.x - 4, geo.boss.y);
    shield.setPosition(geo.boss.x, geo.boss.y);
    shield.setRotation(-geo.angle);
    if (Math.abs(shieldLit - lit) > 0.01) {
      shieldLit = lit;
      drawShield(shieldG, lit);
    }
    setAnchor(anchors, "shield_boss", geo.boss.x, geo.boss.y + floor);
    setAnchor(anchors, "shield_rim", geo.boss.x, geo.boss.y - SHIELD_R - 12 + floor);
    setAnchor(anchors, "visor", WARDEN_X - 30, -840 + KNEEL_DROP * f.kneel + floor);
    // the counter-pendulum
    const bob = bobAt(f.pendAngle + ov.wobble, config);
    const p = pendG;
    p.clear();
    p.lineStyle(10, c.brassDeep, 1);
    p.lineBetween(PYLON_PIVOT.x, PYLON_PIVOT.y, bob.x, bob.y);
    p.lineStyle(4, c.brassHi, 1);
    p.lineBetween(PYLON_PIVOT.x - 2, PYLON_PIVOT.y, bob.x - 2, bob.y);
    p.fillStyle(c.bronze, 1);
    p.fillCircle(bob.x, bob.y, 36);
    p.fillStyle(c.goldDeep, 1);
    p.lineStyle(4, c.gold, 1);
    p.strokeCircle(bob.x, bob.y, 30);
    p.fillStyle(mix(0x2a5563, c.beam, lit * (0.35 + 0.65 * Math.max(f.B * base.lit, ov.bobFlash))), 1);
    p.fillCircle(bob.x, bob.y, 16);
    bobGlow.setPosition(bob.x, bob.y);
    bobGlow.setAlpha(lit * (0.25 + 0.5 * f.B * base.lit + 0.6 * ov.bobFlash));
    setAnchor(anchors, "bob", bob.x, bob.y + floor);
    // the sync thread: bob → shield boss
    const t = threadG;
    t.clear();
    const Bv = ov.gold > 0 ? 1 : f.B;
    const sag = ov.gold > 0 ? 0 : Bv < 0.3 ? (1 - Bv) * 60 : 0;
    const pts = threadPoints({ x: bob.x, y: bob.y }, { x: geo.boss.x, y: geo.boss.y }, sag);
    const mid = pts[Math.floor(pts.length / 2)];
    setAnchor(anchors, "thread", mid.x, mid.y + floor);
    if (thread > 0.01 || ov.gold > 0) {
      const style = threadStyle(Bv, ov.gold);
      const col = mix(c.beam, c.goldHi, ov.gold);
      const strokes = ov.snap >= 0 ? snappedHalves(pts, ov.snap) : [pts];
      for (const seg of strokes) {
        for (const [w, al] of [[style.width + 10, 0.18], [style.width, 0.9]] as const) {
          t.lineStyle(w, col, al * style.alpha * Math.max(thread, ov.gold));
          t.beginPath();
          seg.forEach((q, i) => (i === 0 ? t.moveTo(q.x, q.y) : t.lineTo(q.x, q.y)));
          t.strokePath();
        }
      }
      // a dim, sagging thread throws a spark every half second
      if (ov.snap < 0 && !ov.run && Bv < 0.3 && clock - lastSpark > 500 && !reducedMotion && lit) {
        lastSpark = clock;
        fx.burst(stage, mid, "sparks");
      }
    }
    drawConsole(state === "dormant" ? 0 : state === "solved" ? 0.6 : 1);
  };

  const later = (ms: number, fn: () => void) => anims.add(ms, 1, () => undefined, linear, fn);
  const startRun = (): FreeRunStart | null => (pose ? { pose: { tau: pose.tau, phiP: pose.phiP, T: pose.T, touched: pose.touched, B: pose.B, kneel: pose.kneel, lower: pose.lower, door: pose.door } } : null);

  const view: PoseView<PendulumSyncPose> = {
    root,
    anchors,
    applyPose(p: PendulumSyncPose) {
      pose = p;
      render();
    },
    setState(s: ContraptionState) {
      if (s === state) return;
      state = s;
      try {
        fx.dormancy(root, s === "dormant", reducedMotion ? 0 : 1200);
      } catch {
        root.setAlpha(s === "dormant" ? 0.8 : 1);
      }
      render();
    },
    async playSucceed(plan: SuccessPlan, solved: PendulumSyncPose) {
      const start = startRun();
      if (start) ov.run = { start, ms: 0, decay: 1, kneel: 0, lower: 0, door: 0, B: 1 };
      for (const b of plan.beats as readonly SuccessBeat[]) {
        const ms = typeof b.params?.ms === "number" ? b.params.ms : 800;
        if (b.anchor === "thread" && b.action === "lock") anims.add(b.atMs, 250, (t) => (ov.gold = t), easeOutCubic);
        else if (b.anchor === "shield_boss" && b.action === "cycle") anims.add(b.atMs, ms, (t) => ov.run && (ov.run.decay = 1 - t), easeOutCubic);
        else if (b.anchor === "shoulder" && b.action === "lower") {
          anims.add(b.atMs, ms, (t) => ov.run && ((ov.run.kneel = t), (ov.run.lower = t)), easeInOutSine);
          later(b.atMs + ms * 0.8, () => {
            if (!reducedMotion) fx.burst(stage, { x: WARDEN_X, y: -20 }, "dust");
          });
        } else if (b.anchor === "door_center" && (b.action === "open" || b.action === "rise")) anims.add(b.atMs, ms, (t) => ov.run && (ov.run.door = t), easeInOutSine);
        else if (b.anchor === "door_center" && b.action === "ignite") anims.add(b.atMs, ms, (t) => (ov.light = t), easeOutCubic);
      }
      await waitMs(scene, reducedMotion ? Math.min(400, plan.durationMs) : plan.durationMs, () => dead);
      if (dead) return;
      anims.clear();
      ov.run = null;
      ov.light = 0;
      ov.gold = 1; // the thread stays gold once locked
      view.applyPose(solved);
    },
    async playFail(plan: FailurePlan, current: PendulumSyncPose) {
      void current;
      const start = startRun();
      if (start) ov.run = { start, ms: 0, decay: 1, kneel: start.pose.kneel, lower: start.pose.lower, door: start.pose.door, B: null };
      for (const b of plan.beats as readonly FailBeat[]) {
        if (b.anchor === "thread" && b.action === "snap") {
          anims.add(b.atMs, 420, (t) => (ov.snap = t), easeOutCubic);
          later(b.atMs, () => {
            if (!reducedMotion) fx.burst(stage, { x: anchors.thread.x, y: anchors.thread.y - floor }, "sparks");
          });
        } else if (b.anchor === "visor" && b.action === "flash") anims.add(b.atMs, 700, (t) => (ov.visor = Math.sin(t * PI)), linear);
        else if (b.anchor === "shield_boss" && b.action === "spark")
          later(b.atMs, () => {
            if (!reducedMotion) fx.burst(stage, { x: anchors.shield_boss.x, y: anchors.shield_boss.y - floor }, "sparks");
          });
        else if (b.anchor.startsWith("span_") && b.action === "flash") anims.add(b.atMs, 700, (t) => (ov.tiles = Math.abs(Math.sin(t * PI * 2))), linear, () => (ov.tiles = 0));
        else if (b.anchor === "bob" && b.action === "flash") anims.add(b.atMs, 700, (t) => (ov.bobFlash = Math.abs(Math.sin(t * PI * 2))), linear, () => (ov.bobFlash = 0));
        else if (b.anchor === "bob" && b.action === "wobble") {
          const dir = typeof b.params?.dir === "number" ? b.params.dir : 1;
          anims.add(b.atMs, 420, (t) => (ov.wobble = dir * 0.12 * Math.sin(t * PI * 3) * (1 - t)), linear, () => (ov.wobble = 0));
        } else if (b.anchor === "thread" && b.action === "flash") anims.add(b.atMs, 300, () => (ov.snap = -1), linear);
      }
      await waitMs(scene, Math.min(1600, plan.durationMs), () => dead);
      if (dead) return;
      anims.clear();
      Object.assign(ov, { run: null, snap: -1, visor: 0, tiles: 0, bobFlash: 0, wobble: 0 });
      render();
    },
    update(dtMs: number) {
      if (dead) return;
      clock += dtMs;
      if (ov.run) ov.run.ms += dtMs;
      anims.update(dtMs);
      if (ov.run || anims.busy) render(); // the controller does not feed poses while a plan plays
    },
    destroy() {
      dead = true;
      anims.clear();
      root.destroy(true);
    },
  };
  void P;
  return view;
}

export const skin: SkinPrefab<PendulumSyncConfig, PendulumSyncPose> = {
  skinId: "wardens_shield",
  create(scene, phaser, props) {
    return createWardensShield(scene, phaser, props);
  },
};
export default skin;
