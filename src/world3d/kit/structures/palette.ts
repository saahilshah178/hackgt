import type * as THREE from "three";
import type { ArchStyle, ClothColor, Material } from "../../../contracts/world3d";
import { accentMaterial, clothMaterial, getWorldMaterial } from "../materials";
import type { Slot } from "./geom";

/*
 * Slot → material: how a structure's named geometry slots ("main", "trim", "roof", "paint" ...) become the shared,
 * cached materials of ../materials. The placed `material` drives "main"; the architectural style picks the trim stone,
 * the roof, the painted accents and the awning cloth, so an Egyptian temple gets limestone trim, Egyptian-blue and
 * red-ochre bands, and a classical one marble trim and terracotta tiles. Nothing here constructs a material itself.
 */

interface StylePalette {
  trim: [Material, string?];
  roof: [Material, string?];
  /** painted accents: plaster tinted (multiplied) by these colours */
  paint: string;
  paint2: string;
  /** awnings, sails, flags: cloth colours picked by seed */
  cloth: readonly ClothColor[];
  cloth2: ClothColor;
  glow: string | null;
  woodTint?: string;
}

export const STYLE_PALETTE: Record<ArchStyle, StylePalette> = {
  ancient_egypt: { trim: ["limestone"], roof: ["thatch"], paint: "#35609e", paint2: "#b4492f", cloth: ["linen", "cream", "ochre", "terracotta", "indigo"], cloth2: "indigo", glow: null },
  classical: { trim: ["marble"], roof: ["brick", "#e79a70"], paint: "#a8452e", paint2: "#2f4f7a", cloth: ["crimson", "cream", "violet", "linen"], cloth2: "gold", glow: null },
  medieval: { trim: ["limestone", "#e8e2d6"], roof: ["granite", "#8f9aae"], paint: "#8c2f2a", paint2: "#2e4a7a", cloth: ["crimson", "indigo", "emerald", "ochre"], cloth2: "gold", glow: null, woodTint: "#7c6a5a" },
  east_asian: { trim: ["granite", "#d8d6d0"], roof: ["granite", "#7f8a90"], paint: "#c33d2c", paint2: "#2f7f6a", cloth: ["crimson", "gold", "indigo", "linen"], cloth2: "gold", glow: null, woodTint: "#8a6a50" },
  mesoamerican: { trim: ["limestone"], roof: ["thatch"], paint: "#b03a2a", paint2: "#2f8f86", cloth: ["terracotta", "teal", "ochre", "linen"], cloth2: "teal", glow: null },
  nordic: { trim: ["wood", "#6d5a48"], roof: ["thatch", "#7d8a55"], paint: "#9c2a2f", paint2: "#d4a73a", cloth: ["crimson", "indigo", "linen", "olive"], cloth2: "crimson", glow: null, woodTint: "#6f5a47" },
  rustic: { trim: ["wood"], roof: ["thatch"], paint: "#e8dcc2", paint2: "#6b4a30", cloth: ["linen", "olive", "brown", "ochre"], cloth2: "cream", glow: null },
  industrial: { trim: ["metal", "#6a6f76"], roof: ["metal", "#8d939a"], paint: "#8a3a2a", paint2: "#d9a830", cloth: ["olive", "charcoal", "ochre", "brown"], cloth2: "charcoal", glow: "#ffd28a" },
  modern: { trim: ["plaster", "#bfc3c6"], roof: ["metal", "#5c6166"], paint: "#f2f2ee", paint2: "#3a3d42", cloth: ["sky", "charcoal", "linen", "teal"], cloth2: "linen", glow: "#fff1d6" },
  futuristic: { trim: ["plaster", "#f1f4f7"], roof: ["metal", "#cfd6de"], paint: "#e9eef3", paint2: "#2c3440", cloth: ["sky", "teal", "linen", "violet"], cloth2: "sky", glow: "#6fe3ff" },
};

export interface SlotContext {
  material: Material;
  style: ArchStyle;
  seed: number;
}

/** The shared material for one slot of one structure. */
export function slotMaterial(slot: Slot, ctx: SlotContext): THREE.Material {
  const pal = STYLE_PALETTE[ctx.style];
  const v = ctx.seed % 4;
  switch (slot) {
    case "main":
      return getWorldMaterial(ctx.material, { variant: v });
    case "main2":
      // the same material, one shade off (alternate courses, weathered footings)
      return getWorldMaterial(ctx.material, { variant: (v + 2) % 4, tint: "#e4ddd2" });
    case "trim": {
      // trim in the same material as the walls reads as one blob: pick the style's trim, or a lighter shade
      const [m, tint] = pal.trim;
      if (m === ctx.material) return getWorldMaterial(m, { variant: (v + 1) % 4, tint: "#f6f1e8" });
      return getWorldMaterial(m, { tint, variant: v });
    }
    case "roof": {
      const [m, tint] = pal.roof;
      return getWorldMaterial(m, { tint, variant: v });
    }
    case "dark":
      return accentMaterial("shadow");
    case "wood":
      return getWorldMaterial("wood", { variant: v, tint: pal.woodTint });
    case "woodDark":
      return getWorldMaterial("wood", { variant: (v + 1) % 4, tint: "#7a6452" });
    case "cloth":
      return clothMaterial(pal.cloth[ctx.seed % pal.cloth.length]);
    case "cloth2":
      return clothMaterial(pal.cloth2);
    case "sail":
      return clothMaterial("linen", 1);
    case "metal":
      return getWorldMaterial("metal", { variant: v });
    case "glass":
      return getWorldMaterial("glass");
    case "gold":
      return getWorldMaterial("gold");
    case "glow":
      return pal.glow ? getWorldMaterial("plaster", { emissive: pal.glow, emissiveIntensity: 2.4 }) : accentMaterial("glow");
    case "paint":
      return getWorldMaterial("plaster", { tint: pal.paint });
    case "paint2":
      return getWorldMaterial("plaster", { tint: pal.paint2 });
    case "soil":
      return accentMaterial("soil");
    case "foliage":
      return accentMaterial("foliage");
    case "water":
      return accentMaterial("water_dark");
    case "thatch":
      return getWorldMaterial("thatch", { variant: v });
    case "rope":
      return getWorldMaterial("thatch", { tint: "#c9b48a", variant: 1 });
    case "skin":
      return getWorldMaterial(ctx.material, { variant: v });
    case "hair":
      return accentMaterial("hair");
    case "accent":
      return clothMaterial(pal.cloth2);
  }
}
