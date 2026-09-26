/** scene/zone-input.ts (H1) — the Zone schema and its input type, re-exported for fixtures and tests. */
import { Zone } from "../../../../contracts/world";
import type { z } from "zod";
export { Zone };
export type ZoneInput = z.input<typeof Zone>;
