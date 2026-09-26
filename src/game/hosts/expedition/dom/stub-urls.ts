/**
 * dom/stub-urls.ts (H1) — the DOM host's art: the same kit-coloured stand-ins the Phaser stub loader paints, as data
 * URLs (cached per key; a zone swap drops the previous zone's non-shared keys, mirroring texture residency, A4).
 * When A1's manifests list a key (svg or puppet), its built file URL is used instead (rest pose for puppets); the
 * character sheet stays the stand-in (the reduced host draws poses as a CSS sprite).
 */
import type { WorldOverlay } from "../../../../contracts/world";
import { assetUrl, type ArtCatalog } from "../../../art/manifest-loader";
import { assetsForZone } from "../../../../world/residency";
import { RIG_DISPLAY_H, RIG_DISPLAY_W } from "../actors/costume";
import { paintRigPose, paintStub, rigColors } from "../art/stub-paint";
import { posesFor } from "../art/stub-rig";
import { stubHintsFor, stubSpecFor, unloadKeys, type StubHints, type StubSpec } from "../art/stub-spec";

export interface RigSheet {
  url: string;
  cols: number;
  poses: readonly string[];
}

export class StubUrlCache {
  private urls = new Map<string, string>();
  private rigs = new Map<string, RigSheet>();
  private hints: StubHints;
  private npcAtlases: Set<string>;
  private catalog: ArtCatalog | null = null;

  constructor(private readonly world: WorldOverlay, private readonly palette: Readonly<Record<string, string>>) {
    this.hints = stubHintsFor(world);
    this.npcAtlases = new Set(world.npcs.flatMap((n) => (n.look ? [n.look.atlas] : [])));
  }

  setCatalog(c: ArtCatalog | null): void {
    this.catalog = c;
    this.urls.clear();
  }

  spec(key: string): StubSpec {
    const s = stubSpecFor(key, this.hints);
    const e = this.catalog?.entries.get(key);
    if (e && (e.kind === "svg" || e.kind === "puppet")) return { ...s, w: e.width, h: e.height, pivot: e.pivot };
    return s;
  }

  url(key: string): string {
    const hit = this.urls.get(key);
    if (hit) return hit;
    const e = this.catalog?.entries.get(key);
    if (e && e.kind !== "atlas" && this.catalog) {
      const u = assetUrl(this.catalog, key);
      if (u) {
        this.urls.set(key, u);
        return u;
      }
    }
    if (typeof document === "undefined") return "";
    const s = this.spec(key);
    const k = s.depth ? 0.5 : 1;
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(s.w * k));
    c.height = Math.max(2, Math.round(s.h * k));
    const ctx = c.getContext("2d");
    if (ctx) paintStub(ctx, s, this.palette, k);
    const url = c.toDataURL();
    this.urls.set(key, url);
    return url;
  }

  rig(atlasKey: string): RigSheet {
    const hit = this.rigs.get(atlasKey);
    if (hit) return hit;
    if (typeof document === "undefined") return { url: "", cols: 7, poses: [] };
    const poses = posesFor(this.npcAtlases.has(atlasKey) ? "npc" : "protagonist");
    const cols = 7;
    const c = document.createElement("canvas");
    c.width = cols * RIG_DISPLAY_W;
    c.height = Math.ceil(poses.length / cols) * RIG_DISPLAY_H;
    const ctx = c.getContext("2d");
    const colors = rigColors(this.palette, atlasKey.split(".")[2] ?? "wren");
    if (ctx) poses.forEach((p, i) => paintRigPose(ctx, p, colors, 1, (i % cols) * RIG_DISPLAY_W, Math.floor(i / cols) * RIG_DISPLAY_H));
    const sheet = { url: c.toDataURL(), cols, poses };
    this.rigs.set(atlasKey, sheet);
    return sheet;
  }

  /** Drops the previous zone's keys that the next zone does not use (shared keys stay). */
  swap(prevZoneId: string, nextZoneId: string): void {
    const prev = assetsForZone(this.world, prevZoneId);
    const next = assetsForZone(this.world, nextZoneId);
    for (const k of unloadKeys(prev, next, prev.filter((x) => x.startsWith("shared.")))) this.urls.delete(k);
  }
  get size(): number {
    return this.urls.size + this.rigs.size;
  }
}
