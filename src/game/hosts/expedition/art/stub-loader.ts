/**
 * art/stub-loader.ts (H1) — the STUB ZoneArtLoader: paints kit-coloured stand-ins for every asset key a zone
 * references (src/world/residency.ts assetsForZone) into canvas textures, plus a 28-pose stand-in atlas per
 * `shared.char.<id>` with computed rig anchors. It honours residency exactly like the manifest loader: `shared.*`
 * keys stay resident ("all"), everything else is removed after a zone swap when the next zone does not use it.
 */
import type Phaser from "phaser";
import type { WorldOverlay } from "../../../../contracts/world";
import { assetsForZone } from "../../../../world/residency";
import { RIG_DISPLAY_H, RIG_DISPLAY_W } from "../actors/costume";
import { paintRigPose, paintStub, rigColors } from "./stub-paint";
import { posesFor, stubAnchors } from "./stub-rig";
import type { StubHints, StubSpec } from "./stub-spec";
import { stubHintsFor, stubSpecFor, unloadKeys } from "./stub-spec";
import type { AssetInfo, RigInfo, ZoneArtLoader } from "./zone-loader";

const RIG_COLS = 7;

export class StubZoneLoader implements ZoneArtLoader {
  readonly name = "stub";
  private hints: StubHints | null = null;
  private specs = new Map<string, StubSpec>();
  private rigs = new Map<string, RigInfo>();
  private owned = new Set<string>();
  private npcAtlases = new Set<string>();

  constructor(private readonly palette: Readonly<Record<string, string>>) {}

  private ensureHints(world: WorldOverlay) {
    if (this.hints) return this.hints;
    this.hints = stubHintsFor(world);
    for (const npc of world.npcs) if (npc.look) this.npcAtlases.add(npc.look.atlas);
    return this.hints;
  }

  async loadZone(scene: Phaser.Scene, world: WorldOverlay, zoneId: string, onProgress?: (f: number) => void): Promise<void> {
    this.ensureHints(world);
    const keys = assetsForZone(world, zoneId).filter((k) => !scene.textures.exists(k) || this.owned.has(k));
    let done = 0;
    for (const key of keys) {
      this.ensure(scene, key);
      done++;
      // yield every few textures so the progress bar can paint
      if (done % 6 === 0) {
        onProgress?.(done / keys.length);
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
    onProgress?.(1);
  }

  unloadZone(scene: Phaser.Scene, world: WorldOverlay, prevZoneId: string, nextZoneId: string): void {
    const prev = assetsForZone(world, prevZoneId);
    const next = assetsForZone(world, nextZoneId);
    const all = prev.filter((k) => k.startsWith("shared."));
    for (const key of unloadKeys(prev, next, all)) {
      if (scene.textures.exists(key)) scene.textures.remove(key);
      this.owned.delete(key);
      this.rigs.delete(key);
    }
  }

  /** Paints (once) the texture of an asset key; returns the Phaser texture key. */
  ensure(scene: Phaser.Scene, key: string): string {
    // a texture someone else loaded (the manifest loader) is used as is and never owned (or removed) here
    if (scene.textures.exists(key)) return key;
    if (key.includes(".char.")) {
      this.paintRig(scene, key);
      return key;
    }
    const spec = this.specFor(key);
    const k = spec.depth ? 0.5 : 1; // layers are hazed and large: half resolution
    const tex = scene.textures.createCanvas(key, Math.max(2, Math.round(spec.w * k)), Math.max(2, Math.round(spec.h * k)));
    const ctx = tex?.getContext();
    if (tex && ctx) {
      paintStub(ctx, spec, this.palette, k);
      tex.refresh();
    }
    this.owned.add(key);
    return key;
  }

  private specFor(key: string): StubSpec {
    let s = this.specs.get(key);
    if (!s) {
      s = stubSpecFor(key, this.hints ?? { layers: new Map(), hubs: new Set(), consoles: new Set(), blockers: new Set(), facades: new Set(), vehicles: new Set() });
      this.specs.set(key, s);
    }
    return s;
  }

  private paintRig(scene: Phaser.Scene, key: string): void {
    const id = key.split(".")[2] ?? "wren";
    const poses = posesFor(this.npcAtlases.has(key) ? "npc" : "protagonist");
    const rows = Math.ceil(poses.length / RIG_COLS);
    const tex = scene.textures.createCanvas(key, RIG_COLS * RIG_DISPLAY_W, rows * RIG_DISPLAY_H);
    const ctx = tex?.getContext();
    if (!tex || !ctx) return;
    const colors = rigColors(this.palette, id);
    poses.forEach((pose, i) => {
      const x = (i % RIG_COLS) * RIG_DISPLAY_W;
      const y = Math.floor(i / RIG_COLS) * RIG_DISPLAY_H;
      paintRigPose(ctx, pose, colors, 1, x, y);
      tex.add(pose, 0, x, y, RIG_DISPLAY_W, RIG_DISPLAY_H);
    });
    tex.refresh();
    this.owned.add(key);
    this.rigs.set(key, {
      key,
      texture: key,
      poses: new Set(poses),
      anchors: (pose) => (poses.includes(pose) ? stubAnchors(pose) : null),
      displayW: RIG_DISPLAY_W,
      displayH: RIG_DISPLAY_H,
      scale: 1,
    });
  }

  texture(key: string): string | null {
    return this.owned.has(key) ? key : null;
  }
  info(key: string): AssetInfo | null {
    if (key.includes(".char.")) return { key, kind: "atlas", w: RIG_DISPLAY_W, h: RIG_DISPLAY_H, pivot: [0.5, 1], anchors: {}, scale: 1 };
    const s = this.specFor(key);
    return { key, kind: "svg", w: s.w, h: s.h, pivot: s.pivot, anchors: {}, scale: s.depth ? 2 : 1 };
  }
  rig(key: string): RigInfo | null {
    return this.rigs.get(key) ?? null;
  }
  resident(): number {
    return this.owned.size;
  }
  destroy(scene: Phaser.Scene): void {
    for (const key of this.owned) if (scene.textures?.exists(key)) scene.textures.remove(key);
    this.owned.clear();
    this.rigs.clear();
  }
}
