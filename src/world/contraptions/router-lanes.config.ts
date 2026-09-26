/** router_lanes config — sorter.bins (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";
import { Id } from "../../contracts/common";
import { DateString } from "../../contracts/world";
import { ItemKey, ItemMeta, ProbeSpec, Tier } from "./config-parts";

export const RouterLanesConfig = z.strictObject({
  items: z
    .array(
      z.strictObject({
        key: ItemKey,
        meta: ItemMeta.prefault({}),
        polar: z.boolean().nullable().default(null), // the hydration lens (aid tier ≥ lensTier)
        charged: z.boolean().nullable().default(null),
        from: z.number().min(0).max(10).nullable().default(null), // gradient-ramp crowding at the start, as the item text states
        to: z.number().min(0).max(10).nullable().default(null),
        vehicle: z.enum(["carrier", "channel", "pump", "none"]).default("none"), // success-only
      }),
    )
    .min(1)
    .max(12),
  lanes: z.array(z.strictObject({ binId: Id, laneId: Id, year: z.number().nullable().default(null) })).min(2).max(4),
  lens: z.enum(["hydration", "none"]).default("none"),
  lensTier: Tier.default(1),
  energy: z.strictObject({ reserve: z.number().int().min(1).max(20) }).nullable().default(null),
  shutters: z.boolean().default(false), // feature plates: open at aid tier ≥ 1, or for the disclosed bin on a miss
  stamp: z.enum(["made_year", "none"]).default("none"),
  eventsBand: z.strictObject({ from: DateString, to: DateString, label: z.string().min(1).max(32) }).nullable().default(null),
  eventsBandTier: Tier.default(1),
  probe: ProbeSpec.nullable().default(null),
  probeWorld: z.enum(["none", "record_lens"]).default("none"),
});
export type RouterLanesConfig = z.infer<typeof RouterLanesConfig>;
/** items[].vehicle is success-only (the no-leak test permutes it). */
export const ROUTER_LANES_SUCCESS_ONLY = ["items.vehicle"] as const;
