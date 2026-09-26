/**
 * scene/zone-builder.ts (H1) — builds and destroys ONE zone (docs/design/20 §2.2, §2.3): per segment its sky and layer
 * set (1 s crossfade by alpha on both), the ground (heightfield fill + surface band, payoff terrain merged with a
 * rise-in tween) and platforms, ladders, ride vehicles, props (restoredBy dormancy, `states` alternates, `touch`,
 * the timed-hop driver), the hub (sockets, dormant/partial/restored), interior façades (fade to 20 % inside), plaques,
 * collectibles, exits, blockers, beam-line progress effects and the ambient particles. Textures come from the zone
 * loader (per-zone residency, A4): the builder never assumes a previous zone's keys are loaded.
 */
import type Phaser from "phaser";
import type { Collectible, Plaque, PropPlacement, Requirement, Zone } from "../../../../contracts/world";
import type { ResolvedWorld } from "../../../../world/types";
import type { AssetInfo, ZoneArtLoader } from "../art/zone-loader";
import { tokenInt } from "../art/palette-shim";
import { makeBeam } from "../fx/beam";
import { setDormancy } from "../fx/dormancy";
import { makeGlow } from "../fx/glow";
import { FX_WHITE } from "../fx/textures";
import type { SurfaceModel, Pt } from "./surfaces";
import { heightAt } from "./surfaces";
import { driverOffset } from "./traversal";
import { layerSetWeights, crossfadeWeights, hexToInt, interiorAt, resolveSegmentLook, skyColorAt, stepFacadeAlpha, type SegmentLook } from "./segments";

export const DEPTH = { sky: 0, haze: 15, L1_far: 10, L2_midfar: 20, L3_mid: 30, L4_back: 40, facade: 45, ladder: 49, ground: 50, platform: 51, L4_play: 55, vehicle: 56, blocker: 58, L5_fore: 80, L6_light: 88 } as const;
const PROP_LAYER: Readonly<Record<PropPlacement["layer"], { depth: number; sf: number }>> = {
  L3_mid: { depth: DEPTH.L3_mid + 1, sf: 0.6 },
  L4_back: { depth: DEPTH.L4_back, sf: 1 },
  L4_play: { depth: DEPTH.L4_play, sf: 1 },
  L5_fore: { depth: DEPTH.L5_fore + 1, sf: 1.3 },
};
const TILE_PAD = 2600;

export interface BuildCtx {
  scene: Phaser.Scene;
  P: typeof Phaser;
  world: ResolvedWorld;
  loader: ZoneArtLoader & { ensure?: (s: Phaser.Scene, k: string) => string };
  palette: Readonly<Record<string, string>>;
  reducedMotion: boolean;
}
export interface ZoneFrameState {
  viewX: number;
  viewY: number;
  zoom: number;
  vpW: number;
  vpH: number;
  playerX: number;
  tSec: number;
  dtMs: number;
  reqOk: (r: Requirement | null) => boolean;
}

interface LayerObj {
  set: string;
  obj: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image;
  alpha: number;
  drift: number;
  tileScale: number;
}
interface PropObj {
  p: PropPlacement;
  img: Phaser.GameObjects.Image;
  baseX: number;
  dormant: boolean;
  state: string | null;
}

export class BuiltZone {
  readonly zone: Zone;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private skies = new Map<string, { img: Phaser.GameObjects.Image; key: string; look: SegmentLook }>();
  private haze: Phaser.GameObjects.Image;
  private layers: LayerObj[] = [];
  private ground: Phaser.GameObjects.Graphics;
  private platforms: Phaser.GameObjects.Graphics;
  private props = new Map<string, PropObj>();
  private anonProps: PropObj[] = [];
  private facades = new Map<string, { img: Phaser.GameObjects.Image; alpha: number }>();
  private hub: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; sockets: Phaser.GameObjects.Arc[]; state: "dormant" | "partial" | "restored" } | null = null;
  private blockers = new Map<string, Phaser.GameObjects.Image>();
  private vehicles = new Map<string, Phaser.GameObjects.Image>();
  private collectibles = new Map<string, Phaser.GameObjects.Image>();
  private plaques = new Map<string, Phaser.GameObjects.Image>();
  private beams = new Map<string, ReturnType<typeof makeBeam>>();
  private beamLayer: Phaser.GameObjects.Container;
  private merged: readonly string[] = [];
  private model: SurfaceModel;
  readonly surfaceColors: { top: number; body: number; plat: number };

  constructor(private readonly c: BuildCtx, zone: Zone, model: SurfaceModel) {
    this.zone = zone;
    this.model = model;
    const { scene, P, palette } = c;
    this.surfaceColors = {
      top: tokenInt(palette, "sand.path", tokenInt(palette, "stone.base")),
      body: tokenInt(palette, "rock.shade", 0x3f5857),
      plat: tokenInt(palette, "stone.shade", 0xd9c3a0),
    };
    // skies
    for (const seg of zone.segments) this.makeSky(seg.id, resolveSegmentLook(seg, () => false));
    this.haze = this.track(scene.add.image(0, 0, FX_WHITE).setScrollFactor(0).setDepth(DEPTH.haze).setAlpha(0));
    // layers
    for (const ls of zone.layerSets) {
      ls.layers.forEach((l, i) => {
        const key = this.tex(l.asset);
        const info = this.info(l.asset);
        const depth = DEPTH[l.depth] + i * 0.01;
        const sf = l.scrollFactor;
        const sfy = l.scrollFactorY ?? l.scrollFactor;
        let obj: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image;
        const h = info?.h ?? 400;
        if (l.repeatX) {
          const w = zone.width * Math.max(1, sf) + TILE_PAD * 2;
          const ts = scene.add.tileSprite(-TILE_PAD, l.y, w, h, key).setOrigin(0, 0);
          ts.setTileScale(info?.scale ?? 1, info?.scale ?? 1);
          obj = ts;
        } else {
          obj = scene.add.image(0, l.y, key).setOrigin(0, 0).setScale(info?.scale ?? 1);
        }
        obj.setScrollFactor(sf, sfy).setDepth(depth).setAlpha(0);
        if (l.blend !== "normal") obj.setBlendMode(l.blend === "add" ? P.BlendModes.ADD : l.blend === "multiply" ? P.BlendModes.MULTIPLY : P.BlendModes.SCREEN);
        this.track(obj);
        this.layers.push({ set: ls.id, obj, alpha: l.alpha, drift: l.driftPxPerSec, tileScale: info?.scale ?? 1 });
      });
    }
    // ground + platforms
    this.ground = this.track(scene.add.graphics().setDepth(DEPTH.ground));
    this.platforms = this.track(scene.add.graphics().setDepth(DEPTH.platform));
    this.drawSurfaces(model);
    // ladders
    const lad = this.track(scene.add.graphics().setDepth(DEPTH.ladder));
    for (const link of zone.links) {
      if (link.kind !== "ladder") continue;
      const y0 = heightAt(model, link.from.surface ?? "ground", link.from.x) ?? 0;
      const y1 = heightAt(model, link.to.surface ?? "ground", link.to.x) ?? 0;
      const x = (link.from.x + link.to.x) / 2;
      lad.lineStyle(6, tokenInt(palette, "bronze.ring", 0x6e4a2e), 1);
      lad.lineBetween(x - 18, Math.min(y0, y1) - 10, x - 18, Math.max(y0, y1));
      lad.lineBetween(x + 18, Math.min(y0, y1) - 10, x + 18, Math.max(y0, y1));
      for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y += 34) lad.lineBetween(x - 18, y, x + 18, y);
    }
    // ride vehicles
    for (const link of zone.links) {
      if (link.kind !== "ride") continue;
      const y = heightAt(model, link.from.surface ?? "ground", link.from.x) ?? 0;
      const img = this.track(scene.add.image(link.from.x, y + 4, this.tex(link.vehicle)).setOrigin(0.5, 0).setDepth(DEPTH.vehicle));
      this.vehicles.set(link.id, img);
    }
    // props
    for (const p of c.world.overlay.props.filter((q) => q.zoneId === zone.id)) this.makeProp(p);
    // hub
    if (zone.hub) {
      const hb = zone.hub;
      const y = hb.y ?? heightAt(model, "ground", hb.x) ?? 800;
      const sf = hb.depth === "L3_mid" ? 0.85 : 1;
      const img = this.track(scene.add.image(hb.x, y, this.tex(hb.asset)).setOrigin(0.5, 1).setDepth(hb.depth === "L3_mid" ? DEPTH.L3_mid + 2 : DEPTH.L4_back + 1).setScrollFactor(sf, 1));
      const info = this.info(hb.asset);
      const glow = this.track(makeGlow(scene, P, null, { x: hb.x, y: y - (info?.h ?? 600) * 0.5 }, 260, tokenInt(palette, "glow.gold", 0xf6d27a), 0).setScrollFactor(sf, 1).setDepth(img.depth - 0.1));
      const sockets: Phaser.GameObjects.Arc[] = [];
      for (let i = 0; i < hb.sockets; i++) {
        const a = Math.PI + (Math.PI * (i + 0.5)) / Math.max(1, hb.sockets);
        const r = (info?.w ?? 500) * 0.3;
        const s = this.track(scene.add.circle(hb.x + Math.cos(a) * r, y - (info?.h ?? 600) * 0.55 + Math.sin(a) * r, 14, 0x27466a, 0.9));
        s.setStrokeStyle(3, tokenInt(palette, "gold.base", 0xd9a441)).setScrollFactor(sf, 1).setDepth(img.depth + 0.1);
        sockets.push(s);
      }
      this.hub = { img, glow, sockets, state: "dormant" };
      setDormancy(scene, img, true, 0);
    }
    // interiors
    for (const it of zone.interiors) {
      const img = this.track(scene.add.image(it.facadeAt[0], it.facadeAt[1], this.tex(it.facade)).setOrigin(0, 0).setDepth(DEPTH.facade));
      this.facades.set(it.id, { img, alpha: 1 });
    }
    // blockers (drawn here when the station names an asset; otherwise its prefab draws the reason you can't pass)
    for (const st of c.world.stations.filter((s) => s.zoneId === zone.id)) {
      const b = st.payoff.blocker;
      if (!b?.asset) continue;
      const y = heightAt(model, b.surface ?? "ground", b.x) ?? 0;
      this.blockers.set(st.encounterId, this.track(scene.add.image(b.x, y, this.tex(b.asset)).setOrigin(0.5, 1).setDepth(DEPTH.blocker)));
    }
    // plaques and collectibles
    for (const pq of c.world.overlay.plaques.filter((p) => p.zoneId === zone.id)) this.plaques.set(pq.id, this.track(this.placeOn(pq, pq.asset)));
    for (const col of c.world.overlay.collectibles.filter((p) => p.zoneId === zone.id)) {
      const key = col.asset ?? `shared.fx.${col.kind}`;
      this.collectibles.set(col.id, this.track(this.placeOn(col, key).setDepth(DEPTH.L4_play + 1)));
    }
    // exits: a soft arrow marker
    const ex = this.track(scene.add.graphics().setDepth(DEPTH.L4_play));
    for (const e of zone.exits) {
      const y = heightAt(model, e.surface ?? "ground", e.x) ?? 0;
      ex.fillStyle(tokenInt(palette, "glow.cyan", 0x9fe6f2), 0.8);
      const dir = e.transition === "vertical_down" ? 1 : e.transition === "vertical_up" ? -1 : 0;
      if (dir === 0) ex.fillTriangle(e.x - 16, y - 90, e.x - 16, y - 50, e.x + 14, y - 70);
      else ex.fillTriangle(e.x - 20, y - 80 - dir * 20, e.x + 20, y - 80 - dir * 20, e.x, y - 80 + dir * 20);
    }
    // beam-line progress effects (far layers)
    this.beamLayer = this.track(scene.add.container(0, 0).setDepth(DEPTH.L1_far + 1).setScrollFactor(0.15));
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }
  private tex(key: string): string {
    return this.c.loader.texture(key) ?? this.c.loader.ensure?.(this.c.scene, key) ?? key;
  }
  private info(key: string): AssetInfo | null {
    return this.c.loader.info(key);
  }
  private placeOn(o: Pick<Plaque, "x" | "surface"> & Partial<Pick<Collectible, "y">>, key: string): Phaser.GameObjects.Image {
    const info = this.info(key);
    const y = o.y ?? heightAt(this.model, o.surface ?? "ground", o.x) ?? 0;
    return this.c.scene.add.image(o.x, y, this.tex(key)).setOrigin(info?.pivot[0] ?? 0.5, info?.pivot[1] ?? 1).setScale(info?.scale ?? 1).setDepth(DEPTH.L4_back + 2);
  }

  private makeSky(segId: string, look: SegmentLook): void {
    const key = `__sky_${this.zone.id}_${segId}_${hexKey(look)}`;
    const { scene } = this.c;
    if (!scene.textures.exists(key)) {
      const tex = scene.textures.createCanvas(key, 4, 256);
      const ctx = tex?.getContext();
      if (tex && ctx) {
        for (let y = 0; y < 256; y++) {
          const col = skyColorAt(look.sky, y / 255);
          ctx.fillStyle = `#${col.toString(16).padStart(6, "0")}`;
          ctx.fillRect(0, y, 4, 1);
        }
        tex.refresh();
      }
    }
    const prev = this.skies.get(segId);
    if (prev) {
      prev.img.setTexture(key);
      if (prev.key !== key && scene.textures.exists(prev.key)) scene.textures.remove(prev.key);
      this.skies.set(segId, { img: prev.img, key, look });
      return;
    }
    const img = this.track(scene.add.image(0, 0, key).setScrollFactor(0).setDepth(DEPTH.sky).setOrigin(0.5));
    this.skies.set(segId, { img, key, look });
  }

  private makeProp(p: PropPlacement): void {
    const { scene, P } = this.c;
    const L = PROP_LAYER[p.layer];
    const info = this.info(p.asset);
    const y = p.y ?? heightAt(this.model, p.surface ?? "ground", p.x) ?? 0;
    const img = this.track(scene.add.image(p.x, y, this.tex(p.asset)).setOrigin(info?.pivot[0] ?? 0.5, info?.pivot[1] ?? 1));
    img.setScale((info?.scale ?? 1) * p.scale).setFlipX(p.flipX).setDepth(L.depth).setScrollFactor(L.sf, 1);
    if (p.layer === "L5_fore") img.setAlpha(0.7);
    if (p.glow) this.track(makeGlow(scene, P, null, { x: p.x, y: y - (info?.h ?? 200) * 0.6 }, 90, tokenInt(this.c.palette, "glow.gold", 0xf6d27a), 0.5).setDepth(L.depth - 0.1).setScrollFactor(L.sf, 1));
    if (p.sway && !this.c.reducedMotion) scene.tweens.add({ targets: img, angle: { from: -2, to: 2 }, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const obj: PropObj = { p, img, baseX: p.x, dormant: false, state: null };
    if (p.restoredBy) {
      obj.dormant = true;
      setDormancy(scene, img, true, 0);
    }
    if (p.id) this.props.set(p.id, obj);
    else this.anonProps.push(obj);
  }

  /** Ground heightfield fill + surface band; platforms as walkable strips. */
  drawSurfaces(model: SurfaceModel): void {
    this.model = model;
    const g = this.ground;
    const pts = model.ground.points;
    g.clear();
    g.fillStyle(this.surfaceColors.body, 1);
    g.beginPath();
    g.moveTo(pts[0][0] - 400, this.zone.height + 600);
    g.lineTo(pts[0][0] - 400, pts[0][1]);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(pts[pts.length - 1][0] + 400, pts[pts.length - 1][1]);
    g.lineTo(pts[pts.length - 1][0] + 400, this.zone.height + 600);
    g.closePath();
    g.fillPath();
    g.lineStyle(22, this.surfaceColors.top, 1);
    g.beginPath();
    g.moveTo(pts[0][0] - 400, pts[0][1] + 10);
    for (const [x, y] of pts) g.lineTo(x, y + 10);
    g.lineTo(pts[pts.length - 1][0] + 400, pts[pts.length - 1][1] + 10);
    g.strokePath();
    const p = this.platforms;
    p.clear();
    for (const [, line] of model.platforms) {
      p.lineStyle(18, this.surfaceColors.plat, 1);
      p.beginPath();
      p.moveTo(line.points[0][0], line.points[0][1] + 9);
      for (const [x, y] of line.points) p.lineTo(x, y + 9);
      p.strokePath();
      p.lineStyle(4, this.surfaceColors.body, 0.8);
      for (const [x, y] of [line.points[0], line.points[line.points.length - 1]]) p.lineBetween(x, y + 18, x, y + 90);
    }
  }

  /** Redraws after a progress change; newly merged payoff terrain rises in (bridge_forms, stairs_rise, …). */
  applySurfaces(model: SurfaceModel, animate: boolean): void {
    const fresh = model.merged.filter((id) => !this.merged.includes(id));
    this.merged = model.merged;
    this.drawSurfaces(model);
    if (!animate || fresh.length === 0 || this.c.reducedMotion) return;
    const { scene } = this.c;
    for (const id of fresh) {
      const st = this.c.world.stationByEncounter.get(id);
      for (const t of st?.payoff.terrain ?? []) {
        const g = scene.add.graphics().setDepth(DEPTH.platform + 1);
        g.lineStyle(26, this.surfaceColors.top, 1);
        g.beginPath();
        const pts = t.points as readonly Pt[];
        g.moveTo(pts[0][0], pts[0][1] + 10);
        for (const [x, y] of pts) g.lineTo(x, y + 10);
        g.strokePath();
        g.setAlpha(0).setY(40);
        scene.tweens.add({ targets: g, alpha: 1, y: 0, duration: 700, ease: "Back.easeOut", onComplete: () => scene.time.delayedCall(400, () => g.destroy()) });
      }
    }
  }

  /** Progress-driven state: blockers, restored props, prop_state effects, hub sockets and state, beams, pickups. */
  applyProgress(solved: ReadonlySet<string>, animate: boolean, reqOk: (r: Requirement | null) => boolean, collected: ReadonlySet<string>): void {
    const { scene, P, world, palette } = this.c;
    for (const [id, img] of this.blockers) {
      const open = solved.has(id);
      if (open && img.visible && animate && !this.c.reducedMotion) {
        scene.tweens.add({ targets: img, y: img.y - 260, alpha: 0, duration: 900, ease: "Cubic.easeIn", onComplete: () => img.setVisible(false) });
      } else if (open) img.setVisible(false);
      else img.setVisible(true).setAlpha(1);
    }
    for (const obj of [...this.props.values(), ...this.anonProps]) {
      if (obj.p.restoredBy) {
        const dormant = !solved.has(obj.p.restoredBy);
        if (dormant !== obj.dormant) {
          obj.dormant = dormant;
          setDormancy(scene, obj.img, dormant, animate ? 700 : 0);
        }
      }
    }
    for (const eff of world.overlay.story.progressEffects) {
      if (!solved.has(eff.encounterId)) continue;
      if (eff.kind === "prop_state") {
        const obj = this.props.get(eff.propId);
        if (!obj || obj.state === eff.state) continue;
        obj.state = eff.state;
        const alt = obj.p.states.find((s) => s.state === eff.state);
        if (eff.state === "hidden") obj.img.setVisible(false);
        else if (alt?.asset) obj.img.setTexture(this.tex(alt.asset));
      } else if (eff.kind === "beam_line" && eff.zoneId === this.zone.id && !this.beams.has(eff.encounterId)) {
        const beam = makeBeam(scene, P, this.beamLayer, { x: eff.from[0], y: eff.from[1] }, { x: eff.to[0], y: eff.to[1] }, tokenInt(palette, "glow.cyan", 0x9fe6f2));
        this.beams.set(eff.encounterId, beam);
        if (animate) {
          beam.setAlpha(0);
          const s = { a: 0 };
          scene.tweens.add({ targets: s, a: 1, duration: 800, onUpdate: () => beam.setAlpha(s.a) });
        }
      } else if (eff.kind === "hub_socket" && eff.zoneId === this.zone.id && this.hub) {
        const sock = this.hub.sockets[eff.socket];
        sock?.setFillStyle(tokenInt(palette, "glow.cyan", 0x9fe6f2), 1);
      }
    }
    if (this.hub && this.hub.state === "dormant" && world.stations.some((s) => s.zoneId === this.zone.id && solved.has(s.encounterId))) this.setHub("partial", animate);
    for (const col of world.overlay.collectibles.filter((q) => q.zoneId === this.zone.id)) {
      this.collectibles.get(col.id)?.setVisible(!collected.has(col.id) && reqOk(col.requires));
    }
    for (const pq of world.overlay.plaques.filter((q) => q.zoneId === this.zone.id)) this.plaques.get(pq.id)?.setVisible(reqOk(pq.requires));
    // segment variants (civil S7: the rain stops after e9)
    for (const seg of this.zone.segments) {
      const look = resolveSegmentLook(seg, reqOk);
      const cur = this.skies.get(seg.id);
      if (cur && hexKey(cur.look) !== hexKey(look)) this.makeSky(seg.id, look);
      else if (cur) cur.look = look;
    }
  }

  setHub(state: "dormant" | "partial" | "restored", animate = true): void {
    if (!this.hub) return;
    const prev = this.hub.state;
    this.hub.state = state;
    const { scene } = this.c;
    if ((prev === "dormant") !== (state === "dormant")) setDormancy(scene, this.hub.img, state === "dormant", animate ? 800 : 0);
    const target = state === "restored" ? 0.55 : state === "partial" ? 0.2 : 0;
    if (animate) scene.tweens.add({ targets: this.hub.glow, alpha: target, duration: 800 });
    else this.hub.glow.setAlpha(target);
  }
  get hubState(): string | null {
    return this.hub?.state ?? null;
  }

  setPropState(propId: string, state: string): void {
    const obj = this.props.get(propId);
    if (!obj) return;
    obj.state = state;
    if (state === "hidden") return void obj.img.setVisible(false);
    obj.img.setVisible(true);
    const alt = obj.p.states.find((s) => s.state === state);
    if (alt?.asset) obj.img.setTexture(this.tex(alt.asset));
    if (obj.p.restoredBy && (state === "restored" || state === "lit")) setDormancy(this.c.scene, obj.img, false, 400);
  }
  /** A touched prop shows its lit asset. */
  setTouched(propId: string): void {
    const obj = this.props.get(propId);
    if (obj?.p.touch?.litAsset) obj.img.setTexture(this.tex(obj.p.touch.litAsset));
  }

  vehicle(linkId: string): Phaser.GameObjects.Image | null {
    return this.vehicles.get(linkId) ?? null;
  }
  propObj(propId: string): Phaser.GameObjects.Image | null {
    return this.props.get(propId)?.img ?? null;
  }
  /** The timed-hop driver's top (x-offset = amplitude · sin(2π(t / periodSec + phase))). */
  driverTop(linkId: string, tSec: number): { x: number; y: number } | null {
    const link = this.zone.links.find((l) => l.id === linkId);
    if (!link || link.kind !== "timed_hop" || !link.driverPropId) return null;
    const obj = this.props.get(link.driverPropId);
    if (!obj) return null;
    return { x: obj.baseX + driverOffset(link, tSec), y: obj.img.y - (this.info(obj.p.asset)?.h ?? 80) * obj.img.scaleY };
  }

  /** Per-frame: crossfade alphas, sky placement, façades, drift, driver props, beam shimmer. */
  update(f: ZoneFrameState): { segmentId: string; weights: Map<string, number>; inside: string | null } {
    const setW = layerSetWeights(this.zone, f.playerX);
    const segW = crossfadeWeights(this.zone, f.playerX);
    for (const L of this.layers) {
      L.obj.setAlpha(L.alpha * (setW.get(L.set) ?? 0));
      if (L.drift && "tilePositionX" in L.obj && !this.c.reducedMotion) L.obj.tilePositionX += (L.drift * f.dtMs) / 1000 / L.tileScale;
    }
    const cw = f.vpW / f.zoom + 8;
    const ch = f.vpH / f.zoom + 8;
    let hazeAlpha = 0;
    let hazeColor = 0xffffff;
    for (const [id, s] of this.skies) {
      const w = segW.get(id) ?? 0;
      s.img.setPosition(f.vpW / 2, f.vpH / 2).setDisplaySize(cw, ch).setAlpha(w).setVisible(w > 0.001);
      if (w > 0.5) {
        hazeColor = hexToInt(s.look.sky.haze.color);
      }
      hazeAlpha += w * s.look.sky.haze.alpha * 0.35;
    }
    this.haze.setPosition(f.vpW / 2, f.vpH / 2).setDisplaySize(cw, ch).setTint(hazeColor).setAlpha(hazeAlpha);
    const inside = interiorAt(this.zone, f.playerX);
    for (const [id, fc] of this.facades) {
      fc.alpha = stepFacadeAlpha(fc.alpha, inside?.id === id, f.dtMs);
      fc.img.setAlpha(fc.alpha);
    }
    for (const link of this.zone.links) {
      if (link.kind !== "timed_hop" || !link.driverPropId) continue;
      const obj = this.props.get(link.driverPropId);
      if (obj) obj.img.x = obj.baseX + driverOffset(link, f.tSec);
    }
    for (const b of this.beams.values()) b.update(f.tSec * 1000);
    for (const col of this.collectibles.values()) if (col.visible && !this.c.reducedMotion) col.y += Math.sin(f.tSec * 3) * 0.3;
    let segmentId = this.zone.segments[0].id;
    let best = -1;
    for (const [id, w] of segW) {
      if (w > best) {
        best = w;
        segmentId = id;
      }
    }
    return { segmentId, weights: segW, inside: inside?.id ?? null };
  }

  facadeAlpha(id: string): number | null {
    return this.facades.get(id)?.alpha ?? null;
  }
  layerAlphas(): { set: string; alpha: number; scrollFactor: number }[] {
    return this.layers.map((l) => ({ set: l.set, alpha: l.obj.alpha, scrollFactor: l.obj.scrollFactorX }));
  }
  get drawObjects(): number {
    return this.objs.filter((o) => (o as unknown as { visible?: boolean }).visible !== false).length;
  }

  destroy(): void {
    for (const b of this.beams.values()) b.destroy();
    for (const o of this.objs) o.destroy();
    for (const s of this.skies.values()) if (this.c.scene.textures.exists(s.key)) this.c.scene.textures.remove(s.key);
    this.objs = [];
    this.skies.clear();
  }
}

function hexKey(look: SegmentLook): string {
  return look.sky.stops.map((s) => s.color.slice(1).toLowerCase()).join("").slice(0, 36);
}
