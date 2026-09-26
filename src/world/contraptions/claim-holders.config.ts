/** claim_holders config — truth_finder.mimic (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { Id } from "../../contracts/common";
import { ClaimTrace, Expr, FileDate, Footprint, HintPin, ProbeSpec, Tier } from "./config-parts";

export const RefSimId = z.enum(["bilayer_probe", "diffusion_tank", "osmotic_cell", "pump_flume"]);
export type RefSimId = z.infer<typeof RefSimId>;
export const Aimer = z.enum(["tuning_lens", "probe_emitter", "arc_lamp", "pendant_lamp"]);
export type Aimer = z.infer<typeof Aimer>;
export const QuarantineAnim = z.enum(["mimic_crab", "ridge_thaw", "tank_dilate", "raft_lock_flood", "lanterns_ignite", "retract_stamp"]);
export type QuarantineAnim = z.infer<typeof QuarantineAnim>;
export const ClaimHoldersConfig = z.strictObject({
  holders: z
    .array(
      z.strictObject({
        statementIndex: z.number().int().min(0).max(5),
        trace: ClaimTrace.nullable().default(null), // math: the claim drawn literally (trig claimTraces)
        ghost: Id.nullable().default(null), // science: a ghost id from the referenceSim's registry
        footprint: Footprint.nullable().default(null), // history: all holders or none
      }),
    )
    .min(2)
    .max(6),
  reference: z
    .strictObject({
      expr: Expr,
      xMin: Expr,
      xMax: Expr,
      yMin: z.number(),
      yMax: z.number(),
      xUnit: z.enum(["pi", "number"]),
    })
    .nullable()
    .default(null),
  referenceSim: z.strictObject({ id: RefSimId, params: z.record(z.string(), z.number()).default({}) }).nullable().default(null),
  probe: ProbeSpec.nullable().default(null),
  probeWorld: z.enum(["none", "trace_slate", "needle", "dye_load", "bath_salt", "atp_feed", "record_lens"]).default("none"),
  scenarioMin: z.number().nullable().default(null), // ghosts project only when probe > scenarioMin
  hintPins: z.array(HintPin).max(3).default([]),
  fileDates: z.array(FileDate).max(4).default([]),
  aimer: Aimer,
  quarantineAnim: QuarantineAnim, // success-only
  secondaryTier: Tier.default(1), // midline labels, second card
  overlayTier: Tier.default(2), // |y| card, period markers
});
export type ClaimHoldersConfig = z.infer<typeof ClaimHoldersConfig>;
/** Fields only successPlan may read (the no-leak test permutes them, §8.1). */
export const CLAIM_HOLDERS_SUCCESS_ONLY = ["quarantineAnim"] as const;
