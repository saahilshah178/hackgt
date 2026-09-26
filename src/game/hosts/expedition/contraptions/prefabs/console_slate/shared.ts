/**
 * console_slate prefab shared helpers (docs/design/20 §2.5.5, §7). Owned by H1 (L2) with the prefab core; skin files
 * import it read-only. W0 stub: the labelled-box drawing every skin uses until it is drawn for real.
 */
export { stubBox, type StubBoxOptions } from "../_stub";

export const ARCHETYPE_ID = "console_slate";
/** Placeholder tint for the W0 labelled box. */
export const STUB_COLOR = 0x1f4b57;
