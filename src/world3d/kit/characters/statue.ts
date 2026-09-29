import type { ArchStyle, HeldProp, Headwear, Outfit } from "../../../contracts/world3d";
import type { GeoBuilder, Slot } from "../structures/geom";
import { humanoidModel } from "./body";
import { bakeGeometry, newPose, type Pose } from "./poses";
import { B } from "./skeleton";

/*
 * Statues are the humanoid carved in stone: the character body for a style-appropriate figure (an Egyptian king in the
 * nemes and shendyt, striding with the left foot forward; a classical figure in a toga with a laurel wreath, in
 * contrapposto; a medieval knight with his spear; ...), posed and baked on the CPU (no skeleton), scaled to the
 * statue's height and merged into the structure's stone slot.
 */

interface Figure {
  outfit: Outfit;
  headwear: Headwear;
  held: HeldProp;
  pose: (p: Pose) => void;
}

const set = (p: Pose, bone: number, x: number, y = 0, z = 0) => {
  p.r[bone * 3] = x;
  p.r[bone * 3 + 1] = y;
  p.r[bone * 3 + 2] = z;
};

const stride = (p: Pose) => {
  set(p, B.thighL, -0.28, 0, 0.02);
  set(p, B.shinL, 0.04);
  set(p, B.footL, 0.24);
  set(p, B.thighR, 0.12, 0, -0.02);
  set(p, B.footR, -0.12);
  set(p, B.upperArmL, 0.02, 0, 0.04);
  set(p, B.upperArmR, 0.02, 0, -0.04);
  set(p, B.forearmL, -0.05);
  set(p, B.forearmR, -0.05);
  p.y = -0.035;
};

const contrapposto = (p: Pose) => {
  set(p, B.hips, 0, 0.05, 0.06);
  set(p, B.chest, 0, -0.08, -0.07);
  set(p, B.head, 0.05, 0.25, 0.04);
  set(p, B.thighL, -0.12, 0, 0.1);
  set(p, B.shinL, 0.22);
  set(p, B.footL, -0.1, 0, -0.06);
  set(p, B.thighR, 0.02, 0, -0.06);
  set(p, B.upperArmR, -0.6, 0, -0.3);
  set(p, B.forearmR, -1.2, 0.2);
  set(p, B.upperArmL, 0.05, 0, 0.1);
  set(p, B.forearmL, -0.3);
  p.y = -0.012;
};

const standGuard = (p: Pose) => {
  set(p, B.thighL, 0, 0, 0.06);
  set(p, B.thighR, 0, 0, -0.06);
  set(p, B.footL, 0, 0, -0.06);
  set(p, B.footR, 0, 0, 0.06);
  set(p, B.upperArmR, -0.12, 0, -0.12);
  set(p, B.forearmR, -1.42, 0.1);
  set(p, B.upperArmL, 0.1, 0, 0.35);
  set(p, B.forearmL, -1.1, -0.5);
};

const reader = (p: Pose) => {
  set(p, B.upperArmL, -0.2, 0, 0.02);
  set(p, B.forearmL, -1.35, -0.55);
  set(p, B.upperArmR, -0.1, 0, -0.08);
  set(p, B.forearmR, -0.4);
  set(p, B.head, 0.2);
};

function figureFor(style: ArchStyle): Figure {
  switch (style) {
    case "ancient_egypt":
      return { outfit: "kilt", headwear: "headdress", held: "none", pose: stride };
    case "classical":
      return { outfit: "toga", headwear: "wreath", held: "none", pose: contrapposto };
    case "medieval":
      return { outfit: "armor", headwear: "helmet", held: "spear", pose: standGuard };
    case "east_asian":
      return { outfit: "robe", headwear: "crown", held: "scroll", pose: reader };
    case "mesoamerican":
      return { outfit: "kilt", headwear: "crown", held: "staff", pose: standGuard };
    case "nordic":
      return { outfit: "cloak", headwear: "helmet", held: "spear", pose: standGuard };
    case "rustic":
      return { outfit: "work_clothes", headwear: "wide_hat", held: "tool", pose: stride };
    case "industrial":
      return { outfit: "coat", headwear: "cap", held: "book", pose: reader };
    case "modern":
      return { outfit: "coat", headwear: "none", held: "book", pose: reader };
    case "futuristic":
      return { outfit: "uniform", headwear: "helmet", held: "tablet", pose: reader };
  }
}

/** Add a stone figure `height` metres tall, standing at the builder's current origin and facing +z. */
export function statueFigure(b: GeoBuilder, style: ArchStyle, height: number, slot: Slot) {
  const f = figureFor(style);
  const model = humanoidModel({ outfit: f.outfit, headwear: f.headwear, held: f.held, build: 1, hair: 0, egypt: style === "ancient_egypt" });
  const pose = newPose();
  f.pose(pose);
  const k = height / 1.8;
  for (const part of model.parts) {
    if (part.slot === "glow") continue;
    const g = bakeGeometry(part.geometry, pose);
    g.scale(k, k, k);
    b.add(slot, g);
  }
}
