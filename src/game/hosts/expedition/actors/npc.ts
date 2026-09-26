/**
 * actors/npc.ts (H1) — an NPC on an NPC atlas (the rig) or a puppet (docs/design/20 §2.2, §2.4.4): the active
 * NpcState decides position, pose and visibility (rig poses map work → interact, wave/cheer → cheer0, sit → duck);
 * follow modes: `player` walks 120 units behind on the player's surface, `satchel` rides the protagonist's back anchor;
 * `anim` plays a named animation of the NPC's puppet.
 */
import type Phaser from "phaser";
import type { Npc, NpcState } from "../../../../contracts/world";
import type { RigInfo, ZoneArtLoader } from "../art/zone-loader";
import { placeCostume, RIG_DISPLAY_H } from "./costume";
import { frameFor, locomotion, npcMotion } from "./pose-animator";
import { puppetFor, type PuppetLike } from "./puppet-shim";
import type { ArtCatalog } from "../../../art/manifest-loader";

export const NPC_DEPTH = 70;
export const FOLLOW_GAP = 120;

export class NpcActor {
  readonly id: string;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private puppet: PuppetLike | null = null;
  private costumes: { item: NonNullable<Npc["look"]>["costume"][number]; img: Phaser.GameObjects.Image }[] = [];
  private rig: RigInfo | null = null;
  state: NpcState | null = null;
  x = 0;
  y = 0;
  facing: 1 | -1 = -1;
  private t = 0;
  private vx = 0;

  constructor(scene: Phaser.Scene, P: typeof Phaser, readonly npc: Npc, loader: ZoneArtLoader & { ensure?: (s: Phaser.Scene, k: string) => string; catalog?: ArtCatalog | null }) {
    this.id = npc.id;
    if (npc.look) {
      this.rig = loader.rig(npc.look.atlas);
      const key = this.rig?.texture ?? loader.texture(npc.look.atlas) ?? npc.look.atlas;
      this.sprite = scene.add.sprite(0, 0, key, this.rig?.poses.has("idle") ? "idle" : undefined).setOrigin(0.5, 1).setDepth(NPC_DEPTH).setScale(npc.look.scale * (this.rig?.scale ?? 1));
      for (const item of npc.look.costume) {
        const k = loader.texture(item.asset) ?? loader.ensure?.(scene, item.asset) ?? item.asset;
        this.costumes.push({ item, img: scene.add.image(0, 0, k).setDepth(NPC_DEPTH + 1).setScale(0.8) });
      }
    } else if (npc.asset) {
      const k = loader.texture(npc.asset) ?? loader.ensure?.(scene, npc.asset) ?? npc.asset;
      this.puppet = puppetFor(scene, P, npc.asset, k, loader.catalog ?? null, { origin: [0.5, 1], bobPx: 2 });
      this.puppet.container.setDepth(NPC_DEPTH);
    }
  }

  /** Applies the active state (null or `hidden` hides the NPC). Positions snap unless the NPC follows. */
  setState(state: NpcState | null, groundY: (x: number, surface: string) => number): void {
    const changed = state?.id !== this.state?.id;
    this.state = state;
    const visible = !!state && state.pose !== "hidden";
    this.sprite?.setVisible(visible);
    this.puppet?.container.setVisible(visible);
    for (const c of this.costumes) c.img.setVisible(visible);
    if (!state || !visible) return;
    if (changed && state.follow === "none") {
      this.x = state.x;
      this.y = groundY(state.x, state.surface);
    }
    if (this.puppet) this.puppet.play(state.anim ?? (state.pose === "talk" ? "talk" : "idle"));
  }

  get visible(): boolean {
    return !!this.state && this.state.pose !== "hidden";
  }

  update(dtMs: number, player: { x: number; y: number; facing: 1 | -1; back: { x: number; y: number } }, groundY: (x: number) => number, talking: boolean): void {
    this.t += dtMs;
    const st = this.state;
    if (!st || !this.visible) return;
    if (st.follow === "player") {
      const tx = player.x - FOLLOW_GAP * player.facing;
      const nx = this.x + Math.max(-6, Math.min(6, (tx - this.x) * 0.1)) * (dtMs / 16.7);
      this.vx = (nx - this.x) / Math.max(1, dtMs / 1000);
      this.facing = nx > this.x ? 1 : nx < this.x ? -1 : this.facing;
      this.x = nx;
      this.y = groundY(this.x);
    } else if (st.follow === "satchel") {
      this.x = player.back.x;
      this.y = player.back.y + 40;
      this.facing = player.facing;
      this.vx = 0;
    } else {
      this.vx = 0;
      this.facing = player.x < this.x ? -1 : 1;
    }
    if (this.sprite) {
      const motion = this.vx !== 0 && Math.abs(this.vx) > 12 ? locomotion(this.vx) : talking ? "talk" : npcMotion(st.pose);
      const frame = frameFor(motion, this.t / 1000, this.rig?.poses ?? new Set(["idle"]));
      if (this.rig && this.sprite.frame.name !== frame) this.sprite.setFrame(frame);
      this.sprite.setPosition(this.x, this.y).setFlipX(this.facing < 0);
      const anchors = this.rig?.anchors(frame) ?? null;
      const sc = this.sprite.scaleX;
      for (const c of this.costumes) {
        const p = placeCostume(c.item, anchors, this.facing < 0);
        c.img.setVisible(p.visible).setPosition(this.x + p.x * sc, this.y + p.y * sc).setAngle(p.angle).setDepth(NPC_DEPTH + (p.front ? 1 : -1));
      }
    }
    if (this.puppet) {
      this.puppet.container.setPosition(this.x, this.y);
      if (talking && this.puppet.anim !== "talk") this.puppet.play("talk");
      this.puppet.update(dtMs);
    }
  }

  /** Where the name label sits. */
  nameAnchor(): { x: number; y: number } {
    return { x: this.x, y: this.y - (this.sprite ? RIG_DISPLAY_H * this.sprite.scaleY : 230) - 16 };
  }
  destroy(): void {
    this.sprite?.destroy();
    this.puppet?.destroy();
    for (const c of this.costumes) c.img.destroy();
  }
}
