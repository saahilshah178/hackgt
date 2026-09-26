/**
 * ExpeditionScene.ts (H1) — `createExpeditionScene(Phaser)` (docs/design/20 §2.2, §2.3). `create` loads `all` + the
 * entry zone through the zone loader (per-zone residency, A4), builds the zone, the actors and one ContraptionController
 * per station of the zone, then reports ready with the SceneApi. `update(dt)` runs input → traversal → actors →
 * triggers and proximity → contraption controllers (sim step, ease, apply) → camera → label publish.
 * It also implements the CutsceneStage verbs S1's CutsceneRunner drives.
 *
 * Phaser arrives as an argument (client-only, dynamically imported by ExpeditionHost); this module imports it as a
 * TYPE only, so it is safe to reference from server code paths.
 */
import type Phaser from "phaser";
import type { CameraShot, Cutscene, InteractRef, Point, Requirement, StateTarget, Zone } from "../../../contracts/world";
import { successPoseFor } from "../../../world/biomes";
import type { AidTier, AudioParam, Diagnosis, Draft, HintRung, HintsUsed, ReqCtx, ResolvedStation, SandboxDraft, WorldState } from "../../../world/types";
import type { ExpeditionHostDebug, ExpeditionProgress, InteractTarget, LayoutState } from "../types";
import type { CameraEase, CutsceneEndState, CutsceneStage, EmoteGlyph, ExpeditionSceneData, HubState, SceneApi, StationAnim } from "./bridge";
import type { ZoneArtLoader } from "./art/zone-loader";
import { Companion } from "./actors/companion";
import { puppetFor } from "./actors/puppet-shim";
import type { ArtCatalog } from "../../art/manifest-loader";
import { NpcActor } from "./actors/npc";
import { Protagonist } from "./actors/protagonist";
import { ContraptionController } from "./contraptions/controller";
import { SandboxController } from "./contraptions/sandbox-controller";
import { CutsceneRunner } from "./cutscene/runner";
import { makeFxKit } from "./fx";
import { FinishStack } from "./fx/finish";
import { ParticleField } from "./fx/particles";
import { ensureFxTextures } from "./fx/textures";
import { InputController } from "./input/controller";
import type { HostAction } from "./input/keymap";
import type { LabelStore } from "./labels/label-store";
import { CameraDirector } from "./scene/camera-director";
import { inputToward, linkForKey, NO_INPUT, planChoice, spawn, startPath, stepCharacter, type CharCtx, type CharInput, type CharState } from "./scene/character";
import { defaultSafeRect, unionRect, type ZoneFrame } from "./scene/framing";
import { interactLabel, nearest, targetKey, type Interactable } from "./scene/proximity";
import { activeNpcState, reqCtxOf, requirementMet } from "./scene/requirements";
import { planRoute, type RouteStep } from "./scene/route";
import { resolveSegmentLook } from "./scene/segments";
import { buildSurfaces, heightAt, type SurfaceModel } from "./scene/surfaces";
import { blockers as blockersOf, sheerEdges, type Blocker, type SheerEdge } from "./scene/terrain";
import { linkPrompt, linksInRange, planLink, ridePath, timedHopOpen, type LinkChoice } from "./scene/traversal";
import { emptyTriggerTracker, stepTriggers, type TriggerTracker } from "./scene/triggers";
import { stationSeed, viewsFor } from "./scene/views";
import { BuiltZone } from "./scene/zone-builder";

export const SCENE_KEY = "ExpeditionScene";

export interface HostSceneData extends ExpeditionSceneData {
  loader: ZoneArtLoader & { ensure?: (scene: Phaser.Scene, key: string) => string; catalog?: ArtCatalog | null };
  labels: LabelStore;
  palette: Readonly<Record<string, string>>;
  /** a sandbox goal held for the first time (the client records `sandbox_goal` and applies the reward) */
  onSandboxGoal?: (sandboxId: string, goal: string) => void;
  /** a cutscene `set_state {kind: "flag"}` (the client's world-state reducer owns flags) */
  onFlag?: (id: string, on: boolean) => void;
  /** the async boot (zone load, first build) failed: the host falls back to the DOM renderer */
  onBootError?: (err: unknown) => void;
  /** a cutscene `sfx` step: the client's audio bus plays the cue (§2.12) */
  onCue?: (cue: string) => void;
  /** a cutscene `music` step: the client's audio bus sets the pad */
  onMusic?: (cue: string | null) => void;
  warn: (msg: string, err?: unknown) => void;
}

/** SceneApi plus the host-only debug hooks ExpeditionHost exposes on `__GAME_DEBUG__.expedition`. */
export interface ExpeditionSceneApi extends SceneApi {
  interact(): void;
  freezeFx(on: boolean): void;
  resize(w: number, h: number): void;
  layers(): { set: string; alpha: number; scrollFactor: number }[];
  facadeAlpha(interiorId: string): number | null;
  capturing(): boolean;
  playerPos(): { x: number; y: number; surface: string; zoneId: string };
  /** H2: a station controller's live clock, sim state, near-miss key and loop params (panel getLive, diagnose, audio) */
  stationLive(encounterId: string): StationLive | null;
}

/** What the client reads from a station's controller (the panel's `getLive`, `diagnose`'s near-miss, audio loops). */
export interface StationLive {
  t: number;
  sim: unknown;
  nearMiss: string | null;
  audio: readonly AudioParam[];
}

type Transition = "walk" | "film_seam" | "fade" | "vertical_up" | "vertical_down" | "instant";

interface WalkDriver {
  steps: RouteStep[];
  i: number;
  resolve: () => void;
  stuckMs: number;
  lastX: number;
  scale: number;
}

const HIDDEN_NEAR = new Set<InteractTarget["kind"]>(["exit", "link"]);

export function createExpeditionScene(P: typeof Phaser): typeof Phaser.Scene {
  return class ExpeditionScene extends P.Scene {
    private d!: HostSceneData;
    private ready = false;
    private zone!: Zone;
    private built: BuiltZone | null = null;
    private model!: SurfaceModel;
    private edges: SheerEdge[] = [];
    private blockerList: Blocker[] = [];
    private char!: CharState;
    private player!: Protagonist;
    private companion!: Companion;
    private npcs = new Map<string, NpcActor>();
    private controllers = new Map<string, ContraptionController>();
    private sandboxes = new Map<string, SandboxController>();
    private keys!: InputController;
    private cam!: CameraDirector;
    private finish!: FinishStack;
    private particles!: ParticleField;
    private runner!: CutsceneRunner;
    private views!: (id: string) => unknown;
    private progress: ExpeditionProgress = { solvedIds: [], currentId: null };
    private solved = new Set<string>();
    private layout!: LayoutState;
    private worldState!: WorldState;
    private meterValue: number | null = null;
    private express = false;
    private frozen = false;
    private flagsLocal = new Map<string, boolean>();
    private firedLocal = new Set<string>();
    private tracker: TriggerTracker = emptyTriggerTracker();
    private near: Interactable | null = null;
    private approached = new Set<string>();
    private arenaFired = new Set<string>();
    private tSec = 0;
    private clockMs = 0;
    private walk: WalkDriver | null = null;
    private linkWaiters: { resolve: () => void }[] = [];
    private awaiting: { target: InteractRef; prompt: string; resolve: () => void } | null = null;
    private control: { x: number; surface: string; prompt: string | null; resolve: () => void; deadline: number; auto: boolean } | null = null;
    private transitioning = false;
    private fade!: Phaser.GameObjects.Rectangle;
    private vistaImg: Phaser.GameObjects.Image | null = null;
    private fxFrozen = false;
    private fps = 60;
    private emotes: { actor: string; glyph: string; until: number }[] = [];
    private hubStates = new Map<string, HubState>();
    private stationAnims = new Map<string, StationAnim>();
    private openStation: string | null = null;
    private openSandboxId: string | null = null;
    private segmentId = "";
    private destroyed = false;
    private rideVehicle: Phaser.GameObjects.Image | null = null;

    constructor() {
      super(SCENE_KEY);
    }

    init(data: HostSceneData) {
      this.d = data;
      this.progress = data.progress;
      this.solved = new Set(data.progress.solvedIds);
      this.layout = data.layout;
      this.worldState = data.worldState;
      this.meterValue = data.meterValue;
      this.express = data.express;
      this.views = viewsFor(data.spec);
    }

    create() {
      this.api.stage = this.stage;
      ensureFxTextures(this);
      const w = this.d.world;
      const entryZone = this.startZone();
      const sky = entryZone.segments[0]?.sky.stops[0]?.color ?? "#20303a";
      this.cameras.main.setBackgroundColor(sky);
      this.cam = new CameraDirector(this.cameras.main, this.zoneFrame(entryZone), { w: this.scale.width, h: this.scale.height });
      this.finish = new FinishStack(this, P);
      this.particles = new ParticleField(this, P);
      this.fade = this.add.rectangle(0, 0, 10, 10, 0x000000, 1).setScrollFactor(0).setDepth(100).setOrigin(0.5);
      this.keys = new InputController(this, (a, ev) => this.onAction(a, ev), () => this.clockMs);
      this.runner = new CutsceneRunner({
        stage: this.stage,
        say: (req) => this.d.events.say(req),
        onFlag: (id, on) => {
          this.flagsLocal.set(id, on);
          this.d.onFlag?.(id, on);
        },
        guideId: w.overlay.cast.guide.characterId,
      });
      this.scale.on("resize", (size: Phaser.Structs.Size) => this.api.resize(size.width, size.height));
      this.events.once("shutdown", () => this.teardown());
      this.events.once("destroy", () => this.teardown());
      void this.boot(entryZone);
    }

    private startZone(): Zone {
      const w = this.d.world;
      const cur = this.progress.currentId ? w.stationByEncounter.get(this.progress.currentId) : undefined;
      if (cur && this.progress.solvedIds.length > 0) return w.zones.find((z) => z.id === cur.zoneId) ?? w.zones[0];
      return w.zones[0];
    }

    private async boot(zone: Zone) {
      try {
        await this.d.loader.loadZone(this, this.d.world.overlay, zone.id, (f) => this.d.events.onEvent({ type: "load_progress", fraction: f }));
        if (this.destroyed) return;
        const look = this.d.world.overlay.cast.protagonist.look;
        this.player = new Protagonist(this, P, look, this.d.loader);
        const comp = this.d.world.overlay.cast.guide.companion;
        this.companion = new Companion(puppetFor(this, P, comp.asset, this.tex(comp.asset), this.d.loader.catalog ?? null, { bobPx: comp.bobPx, glowColor: 0x9fe6f2 }), comp);
        const start = this.progress.solvedIds.length > 0 && this.progress.currentId ? this.consoleSpot(this.progress.currentId) : null;
        this.buildZone(zone, start?.x ?? zone.entry.x, start?.surface ?? zone.entry.surface);
        this.fade.setAlpha(0);
        this.ready = true;
        this.d.onReady(this.api);
        this.d.events.onEvent({ type: "ready" });
        this.d.events.onEvent({ type: "zone_entered", zoneId: zone.id });
      } catch (err) {
        this.d.warn("the scene failed to boot", err);
        this.d.onBootError?.(err);
      }
    }

    // ------------------------------------------------------------------ helpers

    private tex(key: string): string {
      return this.d.loader.texture(key) ?? this.d.loader.ensure?.(this, key) ?? "__MISSING";
    }
    private zoneFrame(z: Zone): ZoneFrame {
      return { width: z.width, height: z.height, camera: z.camera };
    }
    private reqCtx(): ReqCtx {
      const flags = new Set(this.worldState.flags);
      for (const [id, on] of this.flagsLocal) {
        if (on) flags.add(id);
        else flags.delete(id);
      }
      return reqCtxOf(this.solved, { ...this.worldState, flags });
    }
    private reqOk = (r: Requirement | null): boolean => requirementMet(r, this.reqCtx());
    private groundAt(x: number, surface = "ground"): number {
      return heightAt(this.model, surface, x) ?? heightAt(this.model, "ground", x) ?? this.zone.height;
    }
    private stationsHere(): ResolvedStation[] {
      return this.d.world.stations.filter((s) => s.zoneId === this.zone.id);
    }
    private consoleSpot(encounterId: string): { x: number; surface: string; zoneId: string } | null {
      const st = this.d.world.stationByEncounter.get(encounterId);
      if (!st) return null;
      return { x: Math.max(40, st.consoleX - 70), surface: st.consoleSurface, zoneId: st.zoneId };
    }
    private charCtx(frozen: boolean, speedScale = 1): CharCtx {
      const seg = this.zone.segments.find((s) => s.id === this.segmentId) ?? this.zone.segments[0];
      return {
        model: this.model,
        edges: this.edges,
        blockers: this.blockerList,
        links: this.zone.links,
        reqOk: this.reqOk,
        tSec: this.tSec,
        runEnabled: seg.runEnabled,
        speedScale,
        driverTop: (id) => this.built?.driverTop(id, this.tSec + 0.35) ?? null,
        frozen,
      };
    }
    private rebuildSurfaces(animate: boolean) {
      const ctx = this.reqCtx();
      this.model = buildSurfaces(this.zone, ctx, this.d.world.stations);
      this.edges = sheerEdges(this.model.ground.points, this.model.maxStepUp);
      this.blockerList = blockersOf(this.d.world.stations, this.solved, this.zone.id);
      this.built?.applySurfaces(this.model, animate);
      // keep the player on its surface (a merged bridge can move the ground under it)
      if (this.char && !this.char.path) {
        const y = heightAt(this.model, this.char.surface, this.char.x);
        if (y === null) this.char = spawn(this.model, this.char.x, "ground");
        else this.char = { ...this.char, y };
      }
    }

    // ------------------------------------------------------------------ zones

    private buildZone(zone: Zone, x: number, surface: string) {
      this.zone = zone;
      this.tSec = 0;
      const ctx = this.reqCtx();
      this.model = buildSurfaces(zone, ctx, this.d.world.stations);
      this.edges = sheerEdges(this.model.ground.points, this.model.maxStepUp);
      this.blockerList = blockersOf(this.d.world.stations, this.solved, zone.id);
      this.built = new BuiltZone({ scene: this, P, world: this.d.world, loader: this.d.loader, palette: this.d.palette, reducedMotion: this.d.reducedMotion }, zone, this.model);
      this.built.applySurfaces(this.model, false);
      this.built.applyProgress(this.solved, false, this.reqOk, this.worldState.collected);
      const hub = this.hubStates.get(zone.id);
      if (hub) this.built.setHub(hub, false);
      this.char = spawn(this.model, x, surface);
      this.player.sync(this.char, 0);
      this.companion.place(this.char.x - 60, this.char.y - 150);
      // NPCs with a state in this zone
      for (const npc of this.d.world.overlay.npcs) {
        if (!npc.states.some((s) => s.zoneId === zone.id)) continue;
        this.npcs.set(npc.id, new NpcActor(this, P, npc, this.d.loader));
      }
      this.refreshNpcs();
      // stations and sandboxes
      for (const st of this.stationsHere()) this.makeController(st);
      for (const sb of this.d.world.sandboxes.filter((s) => s.zoneId === zone.id)) {
        const seed = stationSeed(this.d.spec.seed, sb.id);
        const ctl = new SandboxController({
          scene: this,
          P,
          sandbox: sb,
          groundY: this.groundAt(sb.consoleX, sb.surface),
          palette: this.d.palette,
          fx: makeFxKit(this, P, { sensitiveSafe: true, seed }),
          tex: (k) => this.tex(k),
          anchorsOf: (k) => this.d.loader.info(k)?.anchors ?? {},
          labels: this.d.labels,
          seed,
          reducedMotion: this.d.reducedMotion,
          onGoal: (id, goal) => this.d.onSandboxGoal?.(id, goal),
          warn: this.d.warn,
        });
        this.sandboxes.set(sb.id, ctl);
      }
      this.approached = new Set([...this.approached].filter((id) => this.d.world.stationByEncounter.get(id)?.zoneId === zone.id));
      this.cam.setViewport({ w: this.scale.width, h: this.scale.height });
      this.segmentId = zone.segments[0].id;
    }

    private makeController(st: ResolvedStation) {
      const encounter = this.d.spec.encounters.find((e) => e.id === st.encounterId);
      if (!encounter) return;
      const seed = stationSeed(this.d.spec.seed, st.encounterId);
      const skin = st.meta.skins.find((s) => s.id === st.skin);
      const ctl = new ContraptionController({
        scene: this,
        P,
        station: st,
        encounter,
        view: this.views(st.encounterId),
        groundY: this.groundAt(st.consoleX, st.consoleSurface),
        palette: this.d.palette,
        fx: makeFxKit(this, P, { sensitiveSafe: skin?.sensitiveSafe ?? false, seed, dormancyStrength: this.d.world.overlay.biome === "archive_of_voices" ? 0.6 : 0.4 }),
        tex: (k) => this.tex(k),
        anchorsOf: (k) => this.d.loader.info(k)?.anchors ?? {},
        labels: this.d.labels,
        seed,
        reducedMotion: this.d.reducedMotion,
        record: !!this.d.world.overlay.story.recordStrip && st.layout !== "vault",
        warn: this.d.warn,
      });
      if (this.solved.has(st.encounterId)) ctl.settleSolved();
      else if (st.encounterId === this.progress.currentId || this.stationAnims.get(st.encounterId) === "wake") ctl.setState("awake");
      this.controllers.set(st.encounterId, ctl);
    }

    private destroyZone() {
      for (const c of this.controllers.values()) c.destroy();
      this.controllers.clear();
      for (const s of this.sandboxes.values()) s.destroy();
      this.sandboxes.clear();
      for (const n of this.npcs.values()) n.destroy();
      this.npcs.clear();
      this.built?.destroy();
      this.built = null;
      this.near = null;
      this.d.labels.clear();
    }

    /**
     * Zone swaps run one at a time (H2): a warp that arrives mid-transition (autoSolve loops, express) waits for the
     * running swap instead of interleaving two builds and unloading textures the newer zone uses.
     */
    private zoneChain: Promise<void> = Promise.resolve();
    private enterZone(zoneId: string, x: number, surface: string, transition: Transition = "fade"): Promise<void> {
      const run = this.zoneChain.then(() => (this.destroyed ? undefined : this.enterZoneNow(zoneId, x, surface, transition)));
      this.zoneChain = run.catch((err) => this.d.warn("a zone swap failed", err));
      return run;
    }

    /** Wipe → load the next zone behind it → rebuild → reveal → unload the previous zone's textures (A4). */
    private async enterZoneNow(zoneId: string, x: number, surface: string, transition: Transition = "fade"): Promise<void> {
      const next = this.d.world.zones.find((z) => z.id === zoneId);
      if (!next) return;
      const prevId = this.zone.id;
      if (prevId === zoneId) {
        this.char = spawn(this.model, x, surface);
        this.cam.snapTo(this.char);
        return;
      }
      this.transitioning = true;
      this.cancelWalk();
      const wipeMs = transition === "instant" ? 0 : 280;
      await this.fadeTo(1, wipeMs, 0x000000);
      await this.d.loader.loadZone(this, this.d.world.overlay, zoneId, (f) => this.d.events.onEvent({ type: "load_progress", fraction: f }));
      if (this.destroyed) return;
      this.destroyZone();
      this.buildZone(next, x, surface);
      const vertical = transition === "vertical_down" ? "above" : transition === "vertical_up" ? "below" : null;
      const cameraIn = this.cam.enterZone(this.zoneFrame(next), this.char, vertical);
      await this.fadeTo(0, wipeMs, 0x000000);
      await cameraIn;
      this.d.loader.unloadZone(this, this.d.world.overlay, prevId, zoneId);
      this.transitioning = false;
      this.d.events.onEvent({ type: "zone_entered", zoneId });
    }

    private fadeTo(alpha: number, ms: number, color: number): Promise<void> {
      this.fade.setFillStyle(color, 1);
      if (ms <= 0 || this.fxFrozen) {
        this.fade.setAlpha(alpha);
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        this.tweens.add({ targets: this.fade, alpha, duration: ms, onComplete: () => resolve() });
      });
    }

    // ------------------------------------------------------------------ progress, NPCs

    private applyProgress(p: ExpeditionProgress) {
      const prev = this.solved;
      this.progress = p;
      this.solved = new Set(p.solvedIds);
      if (!this.ready) return;
      const fresh = p.solvedIds.filter((id) => !prev.has(id));
      this.rebuildSurfaces(fresh.length > 0);
      this.built?.applyProgress(this.solved, fresh.length > 0, this.reqOk, this.worldState.collected);
      for (const [id, c] of this.controllers) {
        if (this.solved.has(id)) {
          if (!c.solved) c.settleSolved();
        } else if (id === p.currentId && c.state === "dormant") c.setState("awake");
      }
      const boss = this.stationsHere().find((s) => s.boss);
      if (boss && this.solved.has(boss.encounterId)) this.cam.arena = null;
      this.refreshNpcs();
    }

    private refreshNpcs() {
      const ctx = this.reqCtx();
      for (const [id, actor] of this.npcs) {
        const npc = this.d.world.overlay.npcs.find((n) => n.id === id);
        if (!npc) continue;
        const st = activeNpcState(npc, ctx);
        actor.setState(st && st.zoneId === this.zone.id ? st : null, (x, s) => this.groundAt(x, s));
      }
    }

    // ------------------------------------------------------------------ input and interaction

    private onAction(a: HostAction, ev: KeyboardEvent) {
      if (!this.ready) return;
      if (a === "back") this.d.events.onEvent({ type: "back" });
      if (a === "skip" && this.runner.running) this.runner.skip();
      if (a === "interact" && this.awaiting) {
        const w = this.awaiting;
        this.awaiting = null;
        w.resolve();
        this.keys.consumeInteract();
      }
      void ev;
    }

    private interactables(): Interactable[] {
      const out: Interactable[] = [];
      const push = (target: InteractTarget, x: number, y: number, surface: string | null, label: string) => out.push({ key: targetKey(target), target, x, y, surface, label });
      for (const st of this.stationsHere()) {
        push({ kind: "station", encounterId: st.encounterId }, st.consoleX, this.groundAt(st.consoleX, st.consoleSurface) - 190, st.consoleSurface, interactLabel("station", st.objectNoun));
        if (st.payoff.kind === "ride" && this.solved.has(st.encounterId)) {
          const vx = st.payoff.blocker?.x ?? st.consoleX + 220;
          push({ kind: "vehicle", encounterId: st.encounterId }, vx, this.groundAt(vx) - 160, null, interactLabel("vehicle", st.payoff.noun));
        }
      }
      for (const sb of this.d.world.sandboxes) {
        if (sb.zoneId !== this.zone.id || !this.reqOk(sb.requires)) continue;
        push({ kind: "sandbox", sandboxId: sb.id }, sb.consoleX, this.groundAt(sb.consoleX, sb.surface) - 190, sb.surface, interactLabel("sandbox", sb.objectNoun));
      }
      for (const [id, actor] of this.npcs) {
        if (!actor.visible || !actor.state) continue;
        const npc = this.d.world.overlay.npcs.find((n) => n.id === id);
        push({ kind: "npc", npcId: id, stateId: actor.state.id }, actor.x, actor.nameAnchor().y + 40, null, interactLabel("npc", npc?.name ?? id));
      }
      for (const pq of this.d.world.overlay.plaques) {
        if (pq.zoneId !== this.zone.id || !this.reqOk(pq.requires)) continue;
        push({ kind: "plaque", plaqueId: pq.id }, pq.x, this.groundAt(pq.x, pq.surface) - 170, pq.surface, interactLabel("plaque", pq.title));
      }
      for (const c of this.d.world.overlay.collectibles) {
        if (c.zoneId !== this.zone.id || this.worldState.collected.has(c.id) || !this.reqOk(c.requires)) continue;
        push({ kind: "collectible", collectibleId: c.id }, c.x, (c.y ?? this.groundAt(c.x, c.surface)) - 90, c.surface, interactLabel("collectible", c.title.toLowerCase()));
      }
      for (const p of this.d.world.overlay.props) {
        if (p.zoneId !== this.zone.id || !p.id || !p.touch || this.worldState.touched.has(p.id) || !this.reqOk(p.touch.requires)) continue;
        push({ kind: "touch", propId: p.id }, p.x, (p.y ?? this.groundAt(p.x, p.surface)) - 120, p.surface, interactLabel("touch", "Light it"));
      }
      return out.filter((i) => !HIDDEN_NEAR.has(i.target.kind));
    }

    private awaitTargetPos(t: InteractRef): { x: number; y: number } | null {
      switch (t.kind) {
        case "station": {
          const st = this.d.world.stationByEncounter.get(t.id);
          return st && st.zoneId === this.zone.id ? { x: st.consoleX, y: this.groundAt(st.consoleX, st.consoleSurface) - 190 } : null;
        }
        case "npc": {
          const a = this.npcs.get(t.id);
          return a ? a.nameAnchor() : null;
        }
        case "sandbox": {
          const sb = this.d.world.sandboxes.find((s) => s.id === t.id);
          return sb ? { x: sb.consoleX, y: this.groundAt(sb.consoleX, sb.surface) - 190 } : null;
        }
        case "prop": {
          const img = this.built?.propObj(t.id);
          return img ? { x: img.x, y: img.y - img.displayHeight - 20 } : null;
        }
      }
    }

    // ------------------------------------------------------------------ the frame

    update(_time: number, delta: number) {
      if (!this.ready || this.destroyed) return;
      // real elapsed time (Phaser's `delta` is smoothed toward 60 fps, which slows the world when frames drop)
      const raw = this.game.loop.rawDelta > 0 ? this.game.loop.rawDelta : delta;
      const dtMs = this.fxFrozen ? 0 : Math.min(100, Math.max(0, raw));
      if (raw > 0) this.fps = this.fps * 0.9 + (1000 / raw) * 0.1;
      this.clockMs += dtMs;
      this.tSec += dtMs / 1000;
      const dt = dtMs / 1000;
      const cutscene = this.runner.running !== null;
      this.keys.setMode(this.frozen || cutscene, cutscene ? "cutscene" : this.frozen ? "panel" : "explore");
      this.keys.syncCapture();

      // ---- input → character
      const controlOpen = this.control !== null;
      const allowMove = !this.transitioning && (controlOpen || (!this.frozen && !cutscene));
      let inp: CharInput = this.keys.charInput(allowMove && !this.walk);
      let speedScale = 1;
      if (this.walk && !this.char.path && !this.transitioning) {
        inp = this.driveWalk(dtMs);
        speedScale = this.walk?.scale ?? 1;
      }
      if (controlOpen && this.control?.auto && !this.walk) inp = inputToward(this.char, this.control.x) ?? NO_INPUT;
      const interactPressed = this.keys.consumeInteract();
      const r = stepCharacter(this.char, inp, this.charCtx(!allowMove && !this.walk, speedScale), dt);
      this.char = r.state;
      for (const e of r.events) {
        if (e.type === "link_used") {
          this.d.events.onEvent({ type: "link_used", linkId: e.linkId, landed: e.landed });
          if (e.landed === "missTo") this.emote("player", "!");
          const ws = this.linkWaiters;
          this.linkWaiters = [];
          ws.forEach((w) => w.resolve());
        }
      }
      if (this.char.path?.kind === "ride" && this.char.path.linkId) {
        this.rideVehicle = this.built?.vehicle(this.char.path.linkId) ?? null;
        this.rideVehicle?.setPosition(this.char.x, this.char.y + 4);
      }

      // ---- actors
      this.player.sync(this.char, dtMs);
      const awake = this.companionAwake();
      this.companion.setAwake(awake, { x: this.zone.entry.x + 160, y: this.groundAt(this.zone.entry.x + 160) - 30 });
      this.companion.update(dtMs, { x: this.char.x, y: this.char.y, facing: this.char.facing }, this.fxFrozen);
      const back = this.player.anchorWorld("back");
      for (const n of this.npcs.values()) n.update(dtMs, { x: this.char.x, y: this.char.y, facing: this.char.facing, back }, (x) => this.groundAt(x), false);

      // ---- world reactions (explore only)
      if (!this.transitioning) {
        this.updateTriggers(cutscene);
        this.updateStationsProximity();
        this.updateExits(cutscene);
      }

      // ---- proximity + E
      const items = this.interactables();
      const prevKey = this.near?.key ?? null;
      this.near = this.char.path ? null : nearest(items, { x: this.char.x, surface: this.char.surface }, prevKey);
      if ((this.near?.key ?? null) !== prevKey) this.d.events.onEvent({ type: "near", target: this.near?.target ?? null });
      if (interactPressed && !this.awaiting && allowMove && !this.char.path) {
        if (this.near) {
          this.player.play("interact", 400);
          this.d.events.onInteract(this.near.target);
        } else {
          const ride = linkForKey(this.char, "interact", this.charCtx(false));
          if (ride) this.char = startPath(this.char, planChoice(ride, this.charCtx(false)));
        }
      }

      // ---- contraptions, sandboxes
      for (const c of this.controllers.values()) c.update(this.fxFrozen ? 0 : dtMs);
      for (const s of this.sandboxes.values()) s.update(this.fxFrozen ? 0 : dtMs);

      // ---- camera, zone, finish
      this.cam.update(dtMs, this.char);
      const vp = this.cam.viewport;
      const v = this.cam.view;
      const zf = this.built?.update({ viewX: v.viewX, viewY: v.viewY, zoom: v.zoom, vpW: vp.w, vpH: vp.h, playerX: this.char.x, tSec: this.tSec, dtMs, reqOk: this.reqOk });
      if (zf) {
        this.segmentId = zf.segmentId;
        this.finish.apply([...zf.weights].map(([id, weight]) => ({ weight, ambient: (this.zone.segments.find((s) => s.id === id) ?? this.zone.segments[0]).ambient })));
        const seg = this.zone.segments.find((s) => s.id === zf.segmentId) ?? this.zone.segments[0];
        const look = resolveSegmentLook(seg, this.reqOk);
        const meter = this.d.world.overlay.story.meter;
        const scale = meter?.drives.includes("ambient_particles") ? (this.meterValue ?? meter.start) / 100 : 1;
        const kind = look.weather === "rain_heavy" || look.weather === "rain_light" ? "rain" : seg.ambient.particles;
        this.particles.set(kind, kind === "rain" && seg.ambient.particles !== "rain" ? 60 : seg.ambient.particleCount, kind === "rain" ? 1 : Math.max(0.15, scale));
      }
      this.particles.update(dtMs, vp.w, vp.h, v.zoom, this.clockMs);
      this.finish.update(vp.w, vp.h, v.zoom, this.clockMs);
      this.fade.setPosition(vp.w / 2, vp.h / 2).setSize(vp.w / v.zoom + 8, vp.h / v.zoom + 8);
      this.vistaImg?.setPosition(vp.w / 2, vp.h / 2);

      // ---- labels (DOM, projected by WorldLabelLayer)
      this.publishLabels();

      // ---- control_until
      if (this.control) {
        const c = this.control;
        const reached = this.char.surface === c.surface && Math.abs(this.char.x - c.x) <= 24;
        if (reached) {
          this.control = null;
          c.resolve();
        } else if (!c.auto && this.clockMs >= c.deadline) c.auto = true;
      }
    }

    private companionAwake(): boolean {
      const flag = this.d.world.overlay.cast.guide.companion.awakeFlag;
      if (!flag) return true;
      return this.reqCtx().state.flags.has(flag);
    }

    private driveWalk(dtMs: number): CharInput {
      const w = this.walk;
      if (!w) return NO_INPUT;
      const step = w.steps[w.i];
      const finish = () => {
        this.walk = null;
        w.resolve();
      };
      if (!step) {
        finish();
        return NO_INPUT;
      }
      if (step.kind === "walk") {
        const inp = inputToward(this.char, step.x, 3);
        if (!inp || this.char.surface !== step.surface) {
          w.i++;
          w.stuckMs = 0;
          return NO_INPUT;
        }
        if (Math.abs(this.char.x - w.lastX) < 0.25) w.stuckMs += dtMs;
        else w.stuckMs = 0;
        w.lastX = this.char.x;
        if (w.stuckMs > 500) finish();
        // ease in near the target so we never overshoot
        return { ...inp, run: false, stopAt: step.x }; // express walks at 2× walk speed (speedScale), never runs
      }
      if (step.kind === "walk_off") {
        if (this.char.surface !== step.surface) {
          w.i++;
          return NO_INPUT;
        }
        return inputToward(this.char, step.x + step.facing * 80) ?? NO_INPUT;
      }
      // link
      const choice = linksInRange(this.zone.links, { x: this.char.x, surface: this.char.surface }, { model: this.model, reqOk: this.reqOk }).find((c) => c.link.id === step.linkId && c.dir === step.dir);
      if (!choice) {
        w.stuckMs += dtMs;
        if (w.stuckMs > 1500) finish();
        return inputToward(this.char, step.startX, 3) ?? NO_INPUT;
      }
      if (choice.link.kind === "timed_hop" && !timedHopOpen(choice.link, this.tSec)) return NO_INPUT; // wait for the window
      this.char = startPath(this.char, planChoice(choice, this.charCtx(false)));
      w.i++;
      w.stuckMs = 0;
      return NO_INPUT;
    }

    private cancelWalk() {
      const w = this.walk;
      this.walk = null;
      w?.resolve();
    }

    private updateTriggers(cutscene: boolean) {
      const fired = new Set([...this.worldState.fired, ...this.firedLocal]);
      const ws: WorldState = { ...this.reqCtx().state, fired };
      const idleMs = this.clockMs - this.keys.lastInputAt;
      const res = stepTriggers(this.tracker, this.d.world.overlay.triggers, { zoneId: this.zone.id, x: this.char.x, surface: this.char.surface }, ws, this.solved, { idleMs, express: this.express });
      this.tracker = res.tracker;
      if (cutscene) return;
      for (const t of res.fire) {
        if (t.once) this.firedLocal.add(t.id);
        this.d.events.onEvent({ type: "trigger", triggerId: t.id });
      }
    }

    private updateStationsProximity() {
      for (const st of this.stationsHere()) {
        if (!this.approached.has(st.encounterId) && Math.abs(this.char.x - st.consoleX) <= st.approachRadius && this.char.surface === st.consoleSurface) {
          this.approached.add(st.encounterId);
          this.d.events.onEvent({ type: "approach", encounterId: st.encounterId });
        }
        const boss = st.boss;
        if (boss && !this.arenaFired.has(st.encounterId) && !this.solved.has(st.encounterId) && this.char.x >= boss.arenaTriggerX) {
          this.arenaFired.add(st.encounterId);
          this.cam.arena = boss.arenaBounds;
          this.controllers.get(st.encounterId)?.arena();
          this.d.events.onEvent({ type: "arena", encounterId: st.encounterId });
        }
      }
    }

    private updateExits(cutscene: boolean) {
      if (cutscene || this.char.path) return;
      for (const ex of this.zone.exits) {
        if (this.char.surface !== ex.surface || this.char.x < ex.x - 1 || !this.reqOk(ex.requires)) continue;
        void this.runExit(ex.toZoneId, ex.toX, ex.toSurface, ex.transition, ex.cutsceneId);
        return;
      }
    }

    private async runExit(zoneId: string, x: number, surface: string, transition: Transition, cutsceneId: string | null) {
      if (this.transitioning) return;
      this.transitioning = true;
      if (cutsceneId) await this.api.playCutscene(cutsceneId);
      this.transitioning = false;
      await this.enterZone(zoneId, x, surface, transition);
    }

    private emote(actor: string, glyph: string) {
      this.emotes.push({ actor, glyph, until: this.clockMs + 1200 });
    }

    private publishLabels() {
      const L = this.d.labels;
      const v = this.cam.view;
      L.beginFrame({ viewX: v.viewX, viewY: v.viewY, zoom: v.zoom });
      const cutscene = this.runner.running !== null;
      // interact glyph (or the await_interact prompt, or a link verb)
      if (this.awaiting) {
        const at = this.awaitTargetPos(this.awaiting.target) ?? { x: this.char.x, y: this.char.y - 240 };
        L.set({ id: "interact", kind: "interact", x: at.x, y: at.y, text: `E · ${this.awaiting.prompt}` });
      } else if (this.control?.prompt) {
        L.set({ id: "prompt", kind: "prompt", x: this.char.x, y: this.char.y - 250, text: this.control.prompt });
      } else if (!cutscene && !this.frozen && !this.char.path) {
        if (this.near) {
          L.set({ id: "interact", kind: "interact", x: this.near.x, y: this.near.y, text: this.near.label });
        } else {
          const choices = linksInRange(this.zone.links, { x: this.char.x, surface: this.char.surface }, { model: this.model, reqOk: this.reqOk });
          const c: LinkChoice | undefined = choices[0];
          if (c) L.set({ id: "interact", kind: "interact", x: c.start.x, y: this.groundAt(c.start.x, c.start.surface) - 200, text: linkPrompt(c) });
        }
      }
      // NPC names near the player, plaque titles when near
      for (const [id, a] of this.npcs) {
        if (!a.visible || Math.abs(a.x - this.char.x) > 260) continue;
        const npc = this.d.world.overlay.npcs.find((n) => n.id === id);
        const at = a.nameAnchor();
        L.set({ id: `npc:${id}`, kind: "npc_name", x: at.x, y: at.y, text: npc?.name ?? id });
      }
      if (this.near?.target.kind === "plaque") {
        const id = this.near.target.plaqueId;
        const pq = this.d.world.overlay.plaques.find((p) => p.id === id);
        if (pq) L.set({ id: `plaque:${id}`, kind: "plaque_title", x: pq.x, y: this.near.y - 44, text: pq.title });
      }
      // label_swap progress effects on props
      for (const eff of this.d.world.overlay.story.progressEffects) {
        if (eff.kind !== "label_swap") continue;
        const img = this.built?.propObj(eff.propId);
        if (!img) continue;
        const text = this.solved.has(eff.encounterId) ? (eff.after ?? this.d.spec.encounters.find((e) => e.id === eff.encounterId)?.debriefLine ?? eff.before) : eff.before;
        L.set({ id: `swap:${eff.propId}:${eff.anchor}`, kind: "label_swap", x: img.x, y: img.y - img.displayHeight * 0.6, text });
      }
      // emotes
      this.emotes = this.emotes.filter((e) => e.until > this.clockMs);
      this.emotes.forEach((e, i) => {
        const at = e.actor === "player" ? this.player.headTop() : e.actor === "companion" ? { x: this.companion.x, y: this.companion.y - 50 } : (this.npcs.get(e.actor)?.nameAnchor() ?? this.player.headTop());
        L.set({ id: `emote:${i}`, kind: "emote", x: at.x, y: at.y - 20, text: e.glyph });
      });
      L.endFrame();
    }

    // ------------------------------------------------------------------ SceneApi

    readonly api: ExpeditionSceneApi = {
      setFrozen: (frozen) => {
        this.frozen = frozen;
      },
      setProgress: (p) => this.applyProgress(p),
      setLayout: (layout) => {
        this.layout = layout;
        if (!this.ready) return;
        const f = layout.focus;
        const vp = this.cam.viewport;
        const safe = layout.safeRect.w > 0 && layout.safeRect.h > 0 ? layout.safeRect : defaultSafeRect(layout.mode, vp);
        const playerRect = { x: this.char.x - 70, y: this.char.y - 240, w: 140, h: 240 };
        if (layout.mode !== "explore" && f?.kind === "station") {
          const ctl = this.controllers.get(f.encounterId);
          this.openStation = f.encounterId;
          for (const [id, c] of this.controllers) c.setOpen(id === f.encounterId);
          if (ctl) {
            const st = this.d.world.stationByEncounter.get(f.encounterId);
            void this.cam.frame(unionRect(ctl.frameBounds(), playerRect), safe, st?.frameZoom ?? null);
          }
        } else if (layout.mode !== "explore" && f?.kind === "sandbox") {
          this.openSandboxId = f.sandboxId;
          const sb = this.sandboxes.get(f.sandboxId);
          sb?.setOpen(true);
          const def = this.d.world.sandboxes.find((s) => s.id === f.sandboxId);
          if (sb) void this.cam.frame(unionRect(sb.frameBounds(), playerRect), safe, def?.frameZoom ?? null);
        } else {
          this.openStation = null;
          for (const c of this.controllers.values()) c.setOpen(false);
          if (this.openSandboxId) this.sandboxes.get(this.openSandboxId)?.setOpen(false);
          this.openSandboxId = null;
          this.cam.follow();
        }
      },
      setWorldState: (s) => {
        this.worldState = s;
        for (const id of s.fired) this.firedLocal.delete(id);
        for (const id of s.flags) if (this.flagsLocal.get(id) === true) this.flagsLocal.delete(id);
        if (!this.ready) return;
        this.rebuildSurfaces(false);
        this.built?.applyProgress(this.solved, false, this.reqOk, s.collected);
        for (const id of s.touched) this.built?.setTouched(id);
        this.refreshNpcs();
      },
      setMeterValue: (v) => {
        this.meterValue = v;
      },
      setExpress: (on) => {
        this.express = on;
      },
      warpTo: (encounterId) => {
        this.runner.cancel();
        this.cancelWalk();
        this.awaiting = null;
        this.control = null;
        this.companion?.cancelFlight();
        const spot = encounterId ? this.consoleSpot(encounterId) : null;
        const zone = spot ? this.d.world.zones.find((z) => z.id === spot.zoneId) : this.d.world.zones[0];
        if (!zone || !this.ready) return;
        const x = spot?.x ?? zone.entry.x;
        const surface = spot?.surface ?? zone.entry.surface;
        // through the zone chain, so a warp queued behind a running swap lands where the LAST warp asked
        void this.enterZone(zone.id, x, surface, "fade").then(() => {
          if (!this.destroyed && this.zone.id === zone.id) this.player.sync(this.char, 0);
        });
      },
      bindDraft: (id, draft: Draft | null) => this.controllers.get(id)?.bind(draft),
      setAidTier: (id, tier: AidTier, hints: HintsUsed) => this.controllers.get(id)?.setAidTier(tier, hints),
      onHint: (id, rung: HintRung) => {
        const c = this.controllers.get(id);
        if (!c) return;
        const targets = c.hint(rung).map((t) => ({ ...c.anchorWorld(t.anchor), action: t.action, holdMs: t.holdMs }));
        void this.companion.fly(targets);
      },
      resolveEncounter: async (id, diagnosis: Diagnosis) => {
        const c = this.controllers.get(id);
        if (!c) return;
        if (diagnosis.correct) {
          this.stationAnims.set(id, "succeed");
          await c.succeed();
          this.player.successPose(successPoseFor(this.d.world.overlay.biome));
        } else {
          await c.fail(diagnosis);
        }
      },
      openSandbox: (id) => {
        this.openSandboxId = id;
        this.sandboxes.get(id)?.setOpen(true);
      },
      bindSandboxDraft: (id, draft: SandboxDraft | null) => this.sandboxes.get(id)?.bind(draft),
      closeSandbox: () => {
        for (const s of this.sandboxes.values()) s.setOpen(false);
        this.openSandboxId = null;
      },
      playCutscene: async (id) => {
        const c: Cutscene | undefined = this.d.world.overlay.cutscenes.find((x) => x.id === id);
        if (!c || !this.ready) return;
        this.d.events.onEvent({ type: "cutscene", id, state: "start" });
        const trim = this.express && id !== this.d.world.overlay.story.finaleCutsceneId;
        try {
          await this.runner.run(c, { start: { zoneId: this.zone.id, x: this.char.x, surface: this.char.surface }, trim });
        } finally {
          this.awaiting = null;
          this.control = null;
          this.hideVista();
          this.cam.follow();
          this.d.events.onEvent({ type: "cutscene", id, state: "end" });
        }
      },
      skipCutscene: () => this.runner.skip(),
      walkTo: (x, surface) =>
        new Promise<void>((resolve) => {
          if (!this.ready) return resolve();
          this.cancelWalk();
          const route = planRoute(
            { model: this.model, links: this.zone.links, edges: this.edges, blockers: this.blockerList, reqOk: this.reqOk },
            { surface: this.char.surface, x: this.char.x },
            { x, surface },
          ) ?? [{ kind: "walk", surface: this.char.surface, x }];
          this.walk = { steps: route, i: 0, resolve, stuckMs: 0, lastX: this.char.x, scale: this.express ? 2 : 1 };
        }),
      useLink: async (linkId) => {
        const link = this.zone.links.find((l) => l.id === linkId);
        if (!link || !this.ready) return;
        const ctx = { model: this.model, reqOk: this.reqOk };
        const pick = () => linksInRange(this.zone.links, { x: this.char.x, surface: this.char.surface }, ctx, 1e6).filter((c) => c.link.id === linkId).sort((a, b) => a.distance - b.distance)[0];
        let choice = pick();
        if (!choice || choice.distance > 70) {
          const ends = [link.from, ...("twoWay" in link && link.twoWay ? [link.to] : [])];
          const best = ends.map((e) => ({ e, d: Math.abs(e.x - this.char.x) })).sort((a, b) => a.d - b.d)[0];
          await this.api.walkTo(best.e.x, best.e.surface ?? "ground");
          choice = pick();
        }
        if (!choice || choice.distance > 70 || this.char.path) return;
        const landed = new Promise<void>((resolve) => this.linkWaiters.push({ resolve }));
        this.char = startPath(this.char, planLink(choice, this.model, { tSec: this.tSec, driverTop: this.built?.driverTop(linkId, this.tSec + 0.35) ?? null }));
        await landed;
      },
      debug: (): ExpeditionHostDebug => this.debugState(),
      stage: undefined as unknown as CutsceneStage, // set below (needs `this`)
      destroy: () => this.teardown(),
      interact: () => this.keys.press("interact"),
      freezeFx: (on) => {
        this.fxFrozen = on;
        if (on) this.tweens.pauseAll();
        else this.tweens.resumeAll();
      },
      resize: (w, h) => {
        this.cam?.setViewport({ w, h });
        if (this.layout && this.layout.mode !== "explore") this.api.setLayout(this.layout);
      },
      layers: () => this.built?.layerAlphas() ?? [],
      facadeAlpha: (id) => this.built?.facadeAlpha(id) ?? null,
      capturing: () => this.keys.capturing,
      playerPos: () => ({ x: this.char.x, y: this.char.y, surface: this.char.surface, zoneId: this.zone.id }),
      stationLive: (id) => {
        const c = this.controllers.get(id);
        if (!c) return null;
        return { t: c.core.t, sim: c.core.sim, nearMiss: c.core.described.nearMiss, audio: c.core.audio() };
      },
    };

    private debugState(): ExpeditionHostDebug {
      const ready = this.ready && !!this.char;
      const v = this.cam?.view ?? { viewX: 0, viewY: 0, zoom: 1 };
      const inRange = ready ? linksInRange(this.zone.links, { x: this.char.x, surface: this.char.surface }, { model: this.model, reqOk: this.reqOk }) : [];
      return {
        ready,
        zoneId: this.zone?.id ?? "",
        segmentId: this.segmentId,
        playerX: ready ? this.char.x : 0,
        playerY: ready ? this.char.y : 0,
        surface: ready ? this.char.surface : "ground",
        cameraX: v.viewX,
        cameraY: v.viewY,
        zoom: v.zoom,
        textures: this.textures.getTextureKeys().length,
        near: this.near?.target ?? null,
        links: (this.zone?.links ?? []).map((l) => ({ id: l.id, kind: l.kind, inRange: inRange.some((c) => c.link.id === l.id), open: l.kind === "timed_hop" ? timedHopOpen(l, this.tSec) : null })),
        contraption: (id?: string) => {
          const key = id ?? this.openStation ?? this.progress.currentId ?? [...this.controllers.keys()][0];
          const c = key ? this.controllers.get(key) : undefined;
          if (c) return c.debugState();
          const s = key ? this.sandboxes.get(key) : undefined;
          return s ? s.debugState() : null;
        },
        cutscene: this.runner?.running ?? null,
        fps: Math.round(this.fps),
        drawObjects: this.children?.list.filter((o) => (o as unknown as { visible?: boolean }).visible !== false).length ?? 0,
      };
    }

    // ------------------------------------------------------------------ CutsceneStage (S1's runner drives these)

    private hideVista() {
      this.vistaImg?.destroy();
      this.vistaImg = null;
    }

    readonly stage: CutsceneStage = {
      fade: (to, ms) => this.fadeTo(to === "clear" ? 0 : 1, ms, to === "white" ? 0xffffff : 0x000000),
      title: (text, sub, ms) =>
        new Promise<void>((resolve) => {
          this.d.events.onTitle({ text, sub, ms });
          this.time.delayedCall(ms, () => {
            this.d.events.onTitle(null);
            resolve();
          });
        }),
      enterZone: (zoneId, x, surface) => this.enterZone(zoneId, x, surface, "fade"),
      pan: (x, y, zoom, ms) => this.cam.shot(x, y ?? null, zoom, ms, "out_cubic"),
      camera: (x, y, zoom, ms, ease: CameraEase) => this.cam.shot(x, y, zoom, ms, ease),
      walk: async (actor, toX) => {
        if (actor === "player") return this.api.walkTo(toX);
        if (actor === "companion") return this.companion.fly([{ x: toX, y: this.groundAt(toX) - 150, action: "hover", holdMs: 200 }]);
        const npc = this.npcs.get(actor);
        if (!npc) return;
        const from = npc.x;
        const ms = (Math.abs(toX - from) / 300) * 1000;
        const o = { x: from };
        await new Promise<void>((resolve) => this.tweens.add({ targets: o, x: toX, duration: Math.max(1, ms), onUpdate: () => (npc.x = o.x), onComplete: () => resolve() }));
      },
      emote: (actor, glyph: EmoteGlyph) => this.emote(actor, glyph),
      station: async (encounterId, anim) => {
        this.stationAnims.set(encounterId, anim);
        const c = this.controllers.get(encounterId);
        if (!c) return;
        if (anim === "wake") {
          if (!c.solved) c.setState("awake");
          await new Promise<void>((r) => this.time.delayedCall(this.fxFrozen ? 0 : 600, () => r()));
        } else if (anim === "succeed") {
          await c.succeed();
          this.player.successPose(successPoseFor(this.d.world.overlay.biome));
        } else c.settleSolved();
      },
      hub: async (zoneId, state) => {
        this.hubStates.set(zoneId, state);
        if (zoneId === this.zone.id) this.built?.setHub(state, true);
        await new Promise<void>((r) => this.time.delayedCall(this.fxFrozen ? 0 : 800, () => r()));
      },
      ride: async ({ vehicle, toZoneId, toX, toSurface, ms, path }) => {
        const pts: Point[] = path.length >= 2 ? [...path] : [[this.char.x, this.char.y], [this.char.x, this.char.y - 200]];
        const img = this.add.image(pts[0][0], pts[0][1], this.tex(vehicle)).setOrigin(0.5, 0).setDepth(56);
        const rp = ridePath(pts, ms);
        await new Promise<void>((resolve) => {
          const o = { u: 0 };
          this.tweens.add({
            targets: o,
            u: 1,
            duration: Math.max(1, ms),
            onUpdate: () => {
              const p = rp.at(o.u);
              img.setPosition(p.x, p.y + 4);
              this.char = { ...this.char, x: p.x, y: p.y, motion: "ride" };
            },
            onComplete: () => resolve(),
          });
        });
        img.destroy();
        await this.enterZone(toZoneId, toX, toSurface, "fade");
      },
      sfx: (cue) => {
        // cues play on the client's audio bus (§2.12); the scene has nothing to draw for them
        this.d.onCue?.(cue);
      },
      music: (cue) => {
        // segment and cutscene music is the client's audio bus
        this.d.onMusic?.(cue);
      },
      awaitInteract: (target, prompt, timeoutMs) =>
        new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            this.awaiting = null;
            resolve();
          };
          this.awaiting = { target, prompt, resolve: finish };
          if (timeoutMs !== null) this.time.delayedCall(timeoutMs, finish);
        }),
      controlUntil: (x, surface, prompt, timeoutMs) =>
        new Promise<void>((resolve) => {
          this.control = { x, surface, prompt, resolve, deadline: this.clockMs + timeoutMs, auto: false };
        }),
      vista: async (asset, from: CameraShot, to: CameraShot, ms, holdMs) => {
        this.hideVista();
        const vp = this.cam.viewport;
        const img = this.add.image(vp.w / 2, vp.h / 2, this.tex(asset)).setScrollFactor(0).setDepth(99).setAlpha(0);
        this.vistaImg = img;
        const base = Math.max(vp.w / Math.max(1, img.width), vp.h / Math.max(1, img.height)) / this.cam.view.zoom;
        img.setScale(base * from.zoom).setOrigin(0.5 + from.x / Math.max(1, img.width * 4), 0.5 + from.y / Math.max(1, img.height * 4));
        await new Promise<void>((resolve) => this.tweens.add({ targets: img, alpha: 1, duration: 400, onComplete: () => resolve() }));
        await new Promise<void>((resolve) =>
          this.tweens.add({ targets: img, scale: base * to.zoom, originX: 0.5 + to.x / Math.max(1, img.width * 4), originY: 0.5 + to.y / Math.max(1, img.height * 4), duration: Math.max(1, ms), ease: "Sine.easeInOut", onComplete: () => resolve() }),
        );
        await new Promise<void>((r) => this.time.delayedCall(holdMs, () => r()));
      },
      setState: (target: StateTarget, state: string) => {
        switch (target.kind) {
          case "flag":
            this.flagsLocal.set(target.id, state === "on");
            break;
          case "prop":
            this.built?.setPropState(target.id, state);
            break;
          case "hub":
            this.hubStates.set(target.id, state as HubState);
            if (target.id === this.zone.id) this.built?.setHub(state as HubState, true);
            break;
          case "station": {
            const c = this.controllers.get(target.id);
            if (c && (state === "dormant" || state === "awake" || state === "active" || state === "solved")) {
              if (state === "solved") c.settleSolved();
              else c.setState(state);
            }
            break;
          }
          case "npc":
            // NPC states follow requirements (§2.4.4); a cutscene changes them through flags
            break;
        }
      },
      applyEndState: (end: CutsceneEndState) => {
        this.awaiting = null;
        this.control = null;
        if (end.zone) {
          const z = end.zone;
          if (z.zoneId !== this.zone.id) void this.enterZone(z.zoneId, z.x, z.surface, "instant");
          else {
            this.char = spawn(this.model, z.x, z.surface);
            this.cam.snapTo(this.char);
          }
        }
        for (const [id, x] of Object.entries(end.actors)) {
          const n = this.npcs.get(id);
          if (n) n.x = x;
        }
        for (const [id, anim] of Object.entries(end.stationAnims)) {
          this.stationAnims.set(id, anim);
          const c = this.controllers.get(id);
          if (!c) continue;
          if (anim === "wake" && !c.solved) c.setState("awake");
          else if (anim !== "wake") c.settleSolved();
        }
        for (const [zoneId, state] of Object.entries(end.hubs)) {
          this.hubStates.set(zoneId, state);
          if (zoneId === this.zone.id) this.built?.setHub(state, false);
        }
        for (const [id, on] of Object.entries(end.flags)) this.flagsLocal.set(id, on);
        for (const s of end.states) this.stage.setState(s.target, s.state);
        this.hideVista();
        this.fade.setAlpha(0);
      },
    };

    private teardown() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.runner?.cancel();
      this.keys?.destroy();
      this.destroyZone();
      this.particles?.destroy();
      this.finish?.destroy();
      this.companion?.destroy();
      this.player?.destroy();
    }
  };
}
