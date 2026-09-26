/** console_slate config — the universal fallback (docs/design/20 §4.2). */
// W0, main-owned and frozen (docs/design/20 §4.2, §7.0): the stored config schema. The meta, the prefab core and the
// skins import it; a change is a main-reviewed diff.
import { z } from "zod";

export const ConsoleSlateConfig = z.strictObject({ slateTitle: z.string().min(1).max(32).nullable().default(null) });
export type ConsoleSlateConfig = z.infer<typeof ConsoleSlateConfig>;
