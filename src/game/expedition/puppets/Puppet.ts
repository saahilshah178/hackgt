/**
 * src/game/expedition/puppets/Puppet.ts — the puppet runtime (docs/design/20 §5.5; 02 §3b.5).
 *
 * A Container of part Images at their rest offsets, the container's origin at the entry's pivot. `play(animId)`,
 * `stop()`, `setDormant(on)` (ColorMatrix −40 % saturation; −60 % and 40 % alpha in `archive_of_voices`, §5.7). An `svg`
 * entry plays as a one-part puppet (part "body") with procedural `idle` / `talk` / `cue` (bob, 1.05 scale, pulse), which
 * is how a kit fallback still moves. Sampling is the pure `anim.ts`; textures come from the manifest loader
 * (`load.svg` of the packed sheet + `Texture.add` per part frame, rasterised at k; images use setScale(1 / k)).
 *
 * Users: actors/companion.ts (`idle` following, `talk` while its speaker types, `cue` during a hint flight),
 * actors/npc.ts, hubs (`Hub.anims`), prefabs whose part is a puppet (the mimic crab).
 */
import type Phaser from "phaser";
import type { ManifestEntry, PuppetAnim } from "../../../contracts/world";
import { animDone, ONE_PART, proceduralAnims, REST_STATE, sampleAnim, type PartState } from "./anim";

type PuppetEntry = Extract<ManifestEntry, { kind: "puppet" }>;
type SvgEntry = Extract<ManifestEntry, { kind: "svg" }>;

export interface PuppetOptions {
  x: number;
  y: number;
  /** extra uniform scale on top of the design size (1 = design units) */
  scale?: number;
  depth?: number;
  /** the texture's raster factor (manifest-loader `textureK(scene, key)`); images are drawn at 1 / k */
  k: number;
  /** namespace of the entry, for the sensitive-biome dormancy look */
  ns?: string;
  /** start this anim immediately (default "idle" when present) */
  autoplay?: string | null;
  /** hook the scene's update loop (default true); set false to drive `update(dt)` yourself */
  autoUpdate?: boolean;
}

interface PartView {
  name: string;
  frames: number;
  image: Phaser.GameObjects.Image;
  restX: number;
  restY: number;
}

export class Puppet {
  readonly container: Phaser.GameObjects.Container;
  readonly key: string;
  private readonly parts: PartView[] = [];
  private readonly anims = new Map<string, PuppetAnim>();
  private readonly partList: Array<{ name: string; frames: number }>;
  private readonly k: number;
  private readonly ns: string;
  private currentId: string | null = null;
  private t = 0;
  private loop = true;
  private onDone: (() => void) | null = null;
  private dormant = false;
  private colorMatrix: { colorMatrix: { reset(): unknown; saturate(v?: number, multiply?: boolean): unknown } } | null = null;
  private readonly tick = (_time: number, delta: number) => this.update(delta);
  private readonly scene: Phaser.Scene;
  private destroyed = false;

  constructor(scene: Phaser.Scene, entry: PuppetEntry | SvgEntry, opts: PuppetOptions) {
    this.scene = scene;
    this.key = entry.key;
    this.k = opts.k > 0 ? opts.k : 1;
    this.ns = opts.ns ?? entry.key.split(".")[0];
    this.container = scene.add.container(opts.x, opts.y);
    if (opts.depth !== undefined) this.container.setDepth(opts.depth);
    if (opts.scale !== undefined) this.container.setScale(opts.scale);
    const ox = entry.pivot[0] * entry.width;
    const oy = entry.pivot[1] * entry.height;
    if (entry.kind === "puppet") {
      const sorted = entry.parts.map((p, i) => ({ p, i })).sort((a, b) => a.p.z - b.p.z || a.i - b.i);
      for (const { p } of sorted) {
        const img = scene.add.image(p.rest[0] - ox, p.rest[1] - oy, entry.key, `${p.name}#0`);
        img.setOrigin(p.pivot[0], p.pivot[1]).setScale(1 / this.k);
        this.container.add(img);
        this.parts.push({ name: p.name, frames: p.frames, image: img, restX: p.rest[0] - ox, restY: p.rest[1] - oy });
      }
      for (const a of entry.anims) this.anims.set(a.id, a);
    } else {
      const img = scene.add.image(0, 0, entry.key);
      img.setOrigin(entry.pivot[0], entry.pivot[1]).setScale(1 / this.k);
      this.container.add(img);
      this.parts.push({ name: ONE_PART, frames: 1, image: img, restX: 0, restY: 0 });
      for (const a of proceduralAnims()) this.anims.set(a.id, a);
    }
    this.partList = this.parts.map((p) => ({ name: p.name, frames: p.frames }));
    if (opts.autoUpdate !== false) scene.events.on("update", this.tick);
    scene.events.once("shutdown", () => this.destroy());
    const first = opts.autoplay === undefined ? (this.anims.has("idle") ? "idle" : null) : opts.autoplay;
    if (first) this.play(first);
  }

  /** Anim ids this puppet knows. */
  get animIds(): string[] {
    return [...this.anims.keys()];
  }
  get current(): string | null {
    return this.currentId;
  }
  /** Alias of `current` (the host's PuppetLike shape). */
  get anim(): string | null {
    return this.currentId;
  }
  has(animId: string): boolean {
    return this.anims.has(animId);
  }

  /** Play an animation (restarts it unless it is already playing and `restart` is false). Returns false if unknown. */
  play(animId: string, opts: { loop?: boolean; restart?: boolean; onComplete?: () => void } = {}): boolean {
    const anim = this.anims.get(animId);
    if (!anim) return false;
    if (this.currentId === animId && opts.restart === false) return true;
    this.currentId = animId;
    this.t = 0;
    this.loop = opts.loop ?? anim.loop;
    this.onDone = opts.onComplete ?? null;
    this.apply(sampleAnim(anim, 0, this.partList));
    return true;
  }
  /** Stop and (by default) return every part to its rest pose. */
  stop(resetToRest = true): void {
    this.currentId = null;
    this.onDone = null;
    if (resetToRest) {
      const rest: Record<string, PartState> = {};
      for (const p of this.partList) rest[p.name] = { ...REST_STATE };
      this.apply(rest);
    }
  }
  /** Advance by `dtMs` (called by the scene's update unless autoUpdate is false). */
  update(dtMs: number): void {
    if (this.destroyed || !this.currentId) return;
    const anim = this.anims.get(this.currentId);
    if (!anim) return;
    this.t += dtMs;
    const effective: PuppetAnim = this.loop === anim.loop ? anim : { ...anim, loop: this.loop };
    this.apply(sampleAnim(effective, this.t, this.partList));
    if (!this.loop && animDone(effective, this.t)) {
      const done = this.onDone;
      this.currentId = null;
      this.onDone = null;
      done?.();
    }
  }
  /** Dormant machines: desaturated (−40 %; −60 % and 40 % alpha in the sensitive biome). */
  setDormant(on: boolean): void {
    if (this.dormant === on) return;
    this.dormant = on;
    const sensitive = this.ns === "archive_of_voices";
    const c = this.container as unknown as { enableFilters?: () => unknown; filters?: { internal: { addColorMatrix(): { colorMatrix: { reset(): unknown; saturate(v?: number, multiply?: boolean): unknown } } } } | null };
    try {
      if (!this.colorMatrix && c.enableFilters) {
        c.enableFilters();
        this.colorMatrix = c.filters?.internal.addColorMatrix() ?? null;
      }
      if (this.colorMatrix) {
        this.colorMatrix.colorMatrix.reset();
        if (on) this.colorMatrix.colorMatrix.saturate(sensitive ? -0.6 : -0.4);
      }
    } catch {
      // filters unavailable (renderer without them): dormancy falls back to alpha only
    }
    this.container.setAlpha(on && sensitive ? 0.4 : 1);
  }
  setPosition(x: number, y: number): this {
    this.container.setPosition(x, y);
    return this;
  }
  setFlipX(flip: boolean): this {
    this.container.setScale(Math.abs(this.container.scaleX) * (flip ? -1 : 1), this.container.scaleY);
    return this;
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off("update", this.tick);
    this.container.destroy();
  }

  private apply(states: Record<string, PartState>): void {
    for (const p of this.parts) {
      const s = states[p.name] ?? REST_STATE;
      p.image.setPosition(p.restX + s.x, p.restY + s.y);
      p.image.setAngle(s.rot);
      p.image.setScale((s.scaleX || 0) / this.k, (s.scaleY || 0) / this.k);
      p.image.setAlpha(s.alpha);
      if (p.frames > 1) p.image.setFrame(`${p.name}#${s.frame}`);
    }
  }
}

/** Convenience: a Puppet for a manifest entry already loaded by the manifest loader. */
export function createPuppet(scene: Phaser.Scene, entry: PuppetEntry | SvgEntry, opts: PuppetOptions): Puppet {
  return new Puppet(scene, entry, opts);
}
