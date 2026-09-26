/** stage_machine config — linker.pairs with a stage probe (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { ItemKey, ProbeSpec } from "./config-parts";

export const StageSemantic = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("count"), n: z.number().int().min(0).max(9), dir: z.enum(["in", "out"]) }),
  z.strictObject({ kind: z.literal("atp"), n: z.number().int().min(0).max(9) }),
  z.strictObject({ kind: z.literal("beacon") }),
]);
export type StageSemantic = z.infer<typeof StageSemantic>;
export const StageMachineConfig = z.strictObject({
  lefts: z
    .array(
      z.strictObject({
        key: ItemKey,
        stage: z.number().int().min(0).max(12), // the stage at which this socket acts
        socketKind: z.enum(["ion", "energy", "beacon"]), // never a direction (that is the cartridge's claim)
        ion: z.enum(["Na", "K"]).nullable().default(null),
      }),
    )
    .min(1)
    .max(6),
  rights: z
    .array(
      z.strictObject({
        key: ItemKey, // r0…, x0… (decoys included)
        semantic: StageSemantic,
      }),
    )
    .min(1)
    .max(8),
  stages: ProbeSpec, // the stage scrubber: format "stage", integer stops with names
  ledger: z.enum(["charge", "none"]).default("charge"),
});
export type StageMachineConfig = z.infer<typeof StageMachineConfig>;
