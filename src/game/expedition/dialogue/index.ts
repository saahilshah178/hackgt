/** src/game/expedition/dialogue (S1): engine, slot flow, bar (docs/design/20 §2.7). types.ts is main-owned. */
export * from "./types";
export * from "./engine";
export * from "./lines";
export * from "./station-dialogue";
export * from "./emblem-glyphs";
export { DialogueBar, DIALOGUE_PIN_PRIMARY_ID, DIALOGUE_PIN_SECONDARY_ID, type DialogueBarLayout, type DialogueBarProps } from "./DialogueBar";
export { Emblem, InfoGlyph } from "./Emblem";
export { useDialogueClock, useDialogueSnapshot } from "./useDialogue";
