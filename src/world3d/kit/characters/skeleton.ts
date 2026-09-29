/*
 * The humanoid skeleton: bone order, parents and bind-pose joint positions (metres, for a 1.75 m adult; the renderer
 * scales the whole rig by look.height). Proportions follow the classic 7.5-heads canon: crown 1.75, chin 1.52,
 * shoulders 1.42, elbow 1.12 (the waist), wrist 0.87 (the crotch), fingertips 0.70, hip joints 0.92, knees 0.50,
 * ankles 0.085. The model faces +z; its LEFT side is +x. Pure data, shared by the geometry builder, the pose solver,
 * the statue baker and the tests.
 *
 * Rotation conventions (Euler XYZ on each bone, radians): for bones that hang down (limbs) +x swings the limb BACK
 * (so hip flexion and elbow flexion are negative, knee flexion positive); for bones that point up (spine, neck, head)
 * +x leans FORWARD; +y turns toward the model's left; the left arm abducts with +z, the right arm with -z.
 */

export const BONES = [
  "root",
  "hips",
  "spine",
  "chest",
  "neck",
  "head",
  "clavL",
  "upperArmL",
  "forearmL",
  "handL",
  "clavR",
  "upperArmR",
  "forearmR",
  "handR",
  "thighL",
  "shinL",
  "footL",
  "thighR",
  "shinR",
  "footR",
] as const;
export type BoneName = (typeof BONES)[number];
export const BONE_COUNT = BONES.length;
export const B = Object.fromEntries(BONES.map((n, i) => [n, i])) as Record<BoneName, number>;

export const PARENT: readonly number[] = [-1, 0, 1, 2, 3, 4, 3, 6, 7, 8, 3, 10, 11, 12, 1, 14, 15, 1, 17, 18];

/** Bind-pose joint positions in model space (the arms hang at the sides, palms facing the thighs). */
export const JOINT: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [0, 0.95, 0],
  [0, 1.06, -0.01],
  [0, 1.24, -0.015],
  [0, 1.45, -0.025],
  [0, 1.54, -0.01],
  [0.03, 1.42, -0.02],
  [0.185, 1.415, -0.025],
  [0.2, 1.125, -0.04],
  [0.21, 0.87, -0.012],
  [-0.03, 1.42, -0.02],
  [-0.185, 1.415, -0.025],
  [-0.2, 1.125, -0.04],
  [-0.21, 0.87, -0.012],
  [0.092, 0.92, 0],
  [0.098, 0.505, 0.006],
  [0.102, 0.085, -0.012],
  [-0.092, 0.92, 0],
  [-0.098, 0.505, 0.006],
  [-0.102, 0.085, -0.012],
];

/** Leg length (hip joint to sole) at height 1: drives stride and cadence. */
export const LEG_LENGTH = 0.92;
