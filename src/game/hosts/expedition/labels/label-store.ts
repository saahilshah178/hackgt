/**
 * labels/label-store.ts (pure, H1) — the world-text channel (docs/design/20 decision 7, §2.2). The scene writes a
 * mutable {id → Label} map and the camera view every frame; WorldLabelLayer reads it in requestAnimationFrame and never
 * re-renders React. Labels not touched in a frame are removed at endFrame().
 */
import type { FnColor } from "../../../../world/types";

export type LabelKind = "chip" | "pin" | "interact" | "npc_name" | "plaque_title" | "label_swap" | "flap" | "emote" | "prompt";
export interface Label {
  id: string;
  kind: LabelKind;
  x: number; // world units (zone)
  y: number;
  text: string;
  color: FnColor | null;
  glyph: string | null;
  /** screen-space offset in CSS px (chips stack above their anchor) */
  dy: number;
}
export interface LabelView {
  viewX: number;
  viewY: number;
  zoom: number;
}

export class LabelStore {
  private labels = new Map<string, Label>();
  private touched = new Set<string>();
  private srTexts = new Map<string, string>();
  private srListeners = new Set<(key: string, text: string) => void>();
  view: LabelView = { viewX: 0, viewY: 0, zoom: 1 };
  version = 0;
  hidden = false;

  beginFrame(view: LabelView): void {
    this.view = view;
    this.touched.clear();
  }
  set(label: Omit<Label, "color" | "glyph" | "dy"> & Partial<Pick<Label, "color" | "glyph" | "dy">>): void {
    const next: Label = { color: null, glyph: null, dy: 0, ...label };
    const prev = this.labels.get(next.id);
    this.touched.add(next.id);
    if (prev && prev.x === next.x && prev.y === next.y && prev.text === next.text && prev.kind === next.kind && prev.color === next.color && prev.glyph === next.glyph && prev.dy === next.dy) return;
    this.labels.set(next.id, next);
    this.version++;
  }
  /** Drops every label not set since beginFrame(). */
  endFrame(): void {
    for (const id of [...this.labels.keys()]) {
      if (!this.touched.has(id)) {
        this.labels.delete(id);
        this.version++;
      }
    }
  }
  clear(): void {
    if (this.labels.size) this.version++;
    this.labels.clear();
    this.touched.clear();
  }
  get(id: string): Label | undefined {
    return this.labels.get(id);
  }
  all(): Label[] {
    return [...this.labels.values()];
  }
  byKind(kind: LabelKind): Label[] {
    return this.all().filter((l) => l.kind === kind);
  }
  /** Screen position (CSS px, relative to the canvas) of a label under the current view. */
  project(l: Pick<Label, "x" | "y" | "dy">): { sx: number; sy: number } {
    return { sx: (l.x - this.view.viewX) * this.view.zoom, sy: (l.y - this.view.viewY) * this.view.zoom + l.dy };
  }

  /** Throttled screen-reader text per contraption (the panel's live region subscribes, §2.5.3). */
  setSr(key: string, text: string): void {
    if (this.srTexts.get(key) === text) return;
    this.srTexts.set(key, text);
    for (const fn of this.srListeners) fn(key, text);
  }
  sr(key: string): string | null {
    return this.srTexts.get(key) ?? null;
  }
  onSr(fn: (key: string, text: string) => void): () => void {
    this.srListeners.add(fn);
    return () => this.srListeners.delete(fn);
  }
}
