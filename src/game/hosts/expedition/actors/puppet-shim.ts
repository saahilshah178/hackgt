/**
 * actors/puppet-shim.ts (H1) — the puppet the host drives until the art lane's runtime lands.
 * `puppetFor` uses A1's runtime (src/game/expedition/puppets/Puppet.ts) whenever the manifest provides the entry;
 * otherwise (a stub-painted stand-in) the asset plays as a ONE-PART puppet with the procedural idle / talk / cue the doc
 * specifies for svg entries (bob, glow pulse, 1.05 scale), which is also how a kit fallback moves (docs/design/20 §5.5).
 */
import type Phaser from "phaser";
import { textureK, type ArtCatalog } from "../../../art/manifest-loader";
import { createPuppet } from "../../../expedition/puppets/Puppet";
import { setDormancy } from "../fx/dormancy";
import { makeGlow } from "../fx/glow";

export interface PuppetLike {
  readonly container: Phaser.GameObjects.Container;
  readonly anim: string | null;
  play(animId: string, opts?: { loop?: boolean }): void;
  stop(): void;
  setDormant(on: boolean): void;
  update(dtMs: number): void;
  destroy(): void;
}

export function makePuppet(scene: Phaser.Scene, P: typeof Phaser, textureKey: string, opts: { glowColor?: number; bobPx?: number; origin?: readonly [number, number]; scale?: number } = {}): PuppetLike {
  const container = scene.add.container(0, 0);
  const glow = makeGlow(scene, P, container, { x: 0, y: 0 }, 44, opts.glowColor ?? 0x9fe6f2, 0);
  const img = scene.add.image(0, 0, textureKey).setOrigin(opts.origin?.[0] ?? 0.5, opts.origin?.[1] ?? 0.5);
  if (opts.scale) img.setScale(opts.scale);
  container.add(img);
  const baseScale = img.scaleX;
  const bob = opts.bobPx ?? 4;
  let anim: string | null = "idle";
  let loop = true;
  let t = 0;
  let dormant = false;
  return {
    container,
    get anim() {
      return anim;
    },
    play(id, o) {
      if (anim !== id) t = 0;
      anim = id;
      loop = o?.loop ?? true;
    },
    stop() {
      anim = null;
      img.setPosition(0, 0).setScale(baseScale).setRotation(0);
      glow.setAlpha(0);
    },
    setDormant(on) {
      if (on === dormant) return;
      dormant = on;
      setDormancy(scene, img, on, 400);
    },
    update(dtMs) {
      t += dtMs;
      if (!anim || dormant) {
        glow.setAlpha(0);
        return;
      }
      const s = t / 1000;
      if (!loop && s > 1.2) {
        anim = "idle";
        loop = true;
      }
      switch (anim) {
        case "talk":
          img.setPosition(0, Math.sin(s * Math.PI * 2 * 1.6) * bob);
          img.setScale(baseScale * (1 + 0.03 * Math.abs(Math.sin(s * Math.PI * 7))));
          glow.setAlpha(0.35 + 0.25 * Math.abs(Math.sin(s * Math.PI * 4)));
          break;
        case "cue":
          img.setPosition(0, Math.sin(s * Math.PI * 2 * 3) * bob * 0.6);
          img.setScale(baseScale * (1.05 + 0.02 * Math.sin(s * Math.PI * 8)));
          img.setRotation(0.12 * Math.sin(s * Math.PI * 6));
          glow.setAlpha(0.6 + 0.3 * Math.sin(s * Math.PI * 5));
          break;
        default:
          img.setPosition(0, Math.sin(s * Math.PI * 2 * 0.8) * bob);
          img.setScale(baseScale).setRotation(0);
          glow.setAlpha(0.12);
      }
    },
    destroy() {
      container.destroy(true);
    },
  };
}

/** A manifest puppet (A1's Puppet, driven by the host's update) when the catalog has it resident, else the shim. */
export function puppetFor(
  scene: Phaser.Scene,
  P: typeof Phaser,
  key: string,
  textureKey: string,
  catalog: ArtCatalog | null,
  opts: { glowColor?: number; bobPx?: number; origin?: readonly [number, number]; scale?: number } = {},
): PuppetLike {
  const e = catalog?.entries.get(key);
  if (e && (e.kind === "puppet" || e.kind === "svg") && scene.textures.exists(key)) {
    try {
      return createPuppet(scene, e, { x: 0, y: 0, k: textureK(scene, key), ns: key.split(".")[0], autoUpdate: false, autoplay: "idle" });
    } catch {
      // fall through to the one-part stand-in
    }
  }
  return makePuppet(scene, P, textureKey, opts);
}
