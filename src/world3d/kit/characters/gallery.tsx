"use client";

import { useContext } from "react";
import { CLOTH_COLORS, HEADWEAR, HELD_PROPS, OUTFITS, SKIN_TONES, type NpcLook } from "../../../contracts/world3d";
import { WorldKitContext } from "../context";
import { WildlifeGallery } from "../wildlife/Wildlife";
import { Humanoid, type HumanoidAnim } from "./Humanoid";

/*
 * <CharacterGallery>: a line-up of humanoids for /dev/kit3d?view=characters. `anim` = "all" gives each a different
 * clip, an anim name plays it on everyone, "cast" shows a curated Old Kingdom cast (the demo's people) and "wildlife"
 * the animal line-up. Two staggered rows around the camera target (0, 1, 0) so the middle figures are unobstructed
 * when zooming in.
 */

const ANIMS: HumanoidAnim[] = ["idle", "walk", "run", "talk", "wave", "work", "sit", "study", "jump", "guard", "celebrate"];

export type GalleryMode = HumanoidAnim | "all" | "cast" | "wildlife";

export function galleryLooks(count = 22): NpcLook[] {
  return Array.from({ length: count }, (_, i) => ({
    skin: SKIN_TONES[i % SKIN_TONES.length],
    outfit: OUTFITS[i % OUTFITS.length],
    color: CLOTH_COLORS[(i * 3) % CLOTH_COLORS.length],
    accent: CLOTH_COLORS[(i * 5 + 2) % CLOTH_COLORS.length],
    headwear: HEADWEAR[i % HEADWEAR.length],
    held: HELD_PROPS[i % HELD_PROPS.length],
    height: 0.9 + ((i * 7) % 5) * 0.05,
  }));
}

const L = (skin: NpcLook["skin"], outfit: NpcLook["outfit"], color: NpcLook["color"], accent: NpcLook["accent"], headwear: NpcLook["headwear"], held: NpcLook["held"], height = 1): NpcLook => ({ skin, outfit, color, accent, headwear, held, height });

/** The demo's people: architect, scribe, priest, farmer, stonecutter, weaver, guard, traveller, embalmer, king, runner. */
export const EGYPT_CAST: { look: NpcLook; anim: HumanoidAnim }[] = [
  { look: L("tone5", "robe", "linen", "gold", "none", "staff", 1.05), anim: "talk" },
  { look: L("tone4", "kilt", "linen", "indigo", "none", "scroll"), anim: "sit" },
  { look: L("tone6", "robe", "cream", "ochre", "none", "book"), anim: "study" },
  { look: L("tone5", "kilt", "linen", "terracotta", "none", "basket", 0.95), anim: "walk" },
  { look: L("tone6", "kilt", "linen", "brown", "none", "tool"), anim: "work" },
  { look: L("tone3", "dress", "linen", "teal", "none", "basket", 0.93), anim: "idle" },
  { look: L("tone5", "kilt", "linen", "crimson", "helmet", "spear", 1.08), anim: "guard" },
  { look: L("tone4", "tunic", "ochre", "indigo", "wide_hat", "none"), anim: "wave" },
  { look: L("tone7", "robe", "charcoal", "gold", "hood", "lantern"), anim: "idle" },
  { look: L("tone5", "kilt", "linen", "gold", "headdress", "staff", 1.06), anim: "idle" },
  { look: L("tone4", "tunic", "linen", "sky", "none", "tablet", 0.9), anim: "run" },
];

function Line({ looks, anims }: { looks: NpcLook[]; anims: HumanoidAnim[] }) {
  const hf = useContext(WorldKitContext)?.composed.hf;
  return (
    <>
      {looks.map((look, i) => {
        const back = i % 2 === 1;
        const x = (i - (looks.length - 1) / 2) * 1.1;
        const a = anims[i % anims.length];
        return (
          <group key={i} position={[x, hf ? hf.height(x, back ? -1.6 : 1.2) : 0, back ? -1.6 : 1.2]}>
            <Humanoid look={look} anim={a} speed={a === "run" ? 4.5 : 1.4} seed={i * 37 + 5} />
          </group>
        );
      })}
    </>
  );
}

export function CharacterGallery({ anim = "all" }: { anim?: GalleryMode }) {
  if (anim === "wildlife") return <WildlifeGallery />;
  if (anim === "cast") return <Line looks={EGYPT_CAST.map((c) => c.look)} anims={EGYPT_CAST.map((c) => c.anim)} />;
  return <Line looks={galleryLooks()} anims={anim === "all" ? ANIMS : [anim]} />;
}
