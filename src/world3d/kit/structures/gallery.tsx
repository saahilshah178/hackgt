"use client";

import { useContext } from "react";
import { ARCH_STYLES, STRUCTURE_KINDS, type ArchStyle, type Material, type StructureKind } from "../../../contracts/world3d";
import { STRUCTURES } from "../../core/catalog";
import type { Placed } from "../../core/compose";
import { WorldKitContext } from "../context";
import { SpecialPiece, Structure } from "./index";

/*
 * <StructureGallery>: every StructureKind on the stage, in rows, for /dev/kit3d?view=structures. `style` and
 * `material` override every piece so one style can be reviewed across all kinds. `kind` shows a single kind: with a
 * `style` it stands alone at the camera target (0, 0, 60) so zooming in gives a close-up; without one it is repeated in
 * every style, the Egyptian one in the middle. `kind=fields` or `kind=quarry` shows the composer's special pieces.
 * Pieces sit on the stage terrain and are spaced by their footprints.
 */

export interface StructureGalleryProps {
  style?: ArchStyle | null;
  material?: Material | null;
  kind?: string | null;
}

const TARGET = { x: 0, z: 60 };

function defaultMaterial(k: StructureKind, style: ArchStyle): Material {
  if (k === "boat" || k === "dock") return "wood";
  if (k === "bridge") return style === "nordic" || style === "rustic" ? "wood" : "limestone";
  if (style === "ancient_egypt") {
    if (k === "house" || k === "hut" || k === "workshop" || k === "market_stall" || k === "tent") return "adobe";
    if (k === "obelisk" || k === "statue") return "granite";
    if (k === "pyramid" || k === "library" || k === "tomb" || k === "temple") return "limestone";
    return "sandstone";
  }
  if (style === "classical") return "marble";
  if (style === "medieval") return k === "house" ? "plaster" : "granite";
  if (style === "east_asian") return k === "house" || k === "temple" ? "wood" : "granite";
  if (style === "mesoamerican") return "limestone";
  if (style === "nordic" || style === "rustic") return k === "stone_circle" || k === "monolith" || k === "tomb" || k === "cave_mouth" ? "granite" : "wood";
  if (style === "industrial") return "brick";
  if (style === "modern") return "plaster";
  return "metal";
}

function piece(k: StructureKind, i: number, x: number, z: number, scale: number, style: ArchStyle, material: Material | null | undefined): Placed {
  const info = STRUCTURES[k];
  return {
    id: `${k}_${style}_${i}`,
    kind: k,
    x,
    y: 0,
    z,
    rotation: 0,
    scale,
    radius: info.radius * scale,
    height: info.height * scale,
    material: material ?? defaultMaterial(k, style),
    style,
    role: k === "pyramid" ? "goal" : "decor",
    name: k,
    clusterId: null,
    seed: 1000 + i,
  };
}

const galleryScale = (k: StructureKind) => (k === "pyramid" ? 0.35 : k === "step_pyramid" ? 0.5 : 1);

export function galleryPlacements({ style, material, kind }: StructureGalleryProps): Placed[] {
  if (kind && (STRUCTURE_KINDS as readonly string[]).includes(kind)) {
    const k = kind as StructureKind;
    const scale = galleryScale(k);
    const r = STRUCTURES[k].radius * scale;
    if (style) return [piece(k, 0, TARGET.x, TARGET.z, scale, style, material)];
    // every style in a row, the Egyptian one in the middle
    const styles: ArchStyle[] = ARCH_STYLES.filter((s) => s !== "ancient_egypt");
    styles.splice(4, 0, "ancient_egypt");
    const gap = 2 * r + Math.max(6, r * 0.5);
    return styles.map((s, i) => piece(k, i, TARGET.x + (i - 4) * gap, TARGET.z, scale, s, material));
  }
  const out: Placed[] = [];
  let x = 0;
  let z = 0;
  let rowDepth = 0;
  const rowWidth = 260;
  STRUCTURE_KINDS.forEach((k, i) => {
    const scale = galleryScale(k);
    const r = STRUCTURES[k].radius * scale;
    if (x + 2 * r > rowWidth) {
      x = 0;
      z += rowDepth + 14;
      rowDepth = 0;
    }
    out.push(piece(k, i, x + r - rowWidth / 2, z + r, scale, style ?? "ancient_egypt", material));
    x += 2 * r + 10;
    rowDepth = Math.max(rowDepth, 2 * r);
  });
  return out;
}

export function StructureGallery(props: StructureGalleryProps) {
  const kit = useContext(WorldKitContext);
  const hf = kit?.composed.hf;
  if (props.kind === "fields" || props.kind === "quarry") {
    const special = { kind: props.kind, id: `gallery_${props.kind}`, x: TARGET.x, y: hf ? hf.height(TARGET.x, TARGET.z) : 0, z: TARGET.z, halfW: props.kind === "fields" ? 12 : 24, halfD: props.kind === "fields" ? 8 : 24, rotation: 0.2, seed: 11 } as const;
    return <SpecialPiece special={special} />;
  }
  return (
    <>
      {galleryPlacements(props).map((p) => {
        // sit on the stage: the lowest ground under the footprint so nothing floats
        let y = 0;
        if (hf) {
          y = Infinity;
          for (let k = 0; k < 9; k++) {
            const a = (k / 8) * Math.PI * 2;
            const d = k === 8 ? 0 : p.radius * 0.7;
            y = Math.min(y, hf.height(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d));
          }
        }
        return <Structure key={p.id} placed={{ ...p, y }} />;
      })}
    </>
  );
}
