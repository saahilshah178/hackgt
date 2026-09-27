"use client";
/**
 * src/game/expedition/dialogue/DialogueBar.tsx (S1) — the dialogue bar (bible §3.9, docs/design/20 §2.7).
 *
 * - Bottom band in the panel material with a hex texture; the top frame line ends in "• • ◉" terminals.
 * - Emblem (64 px, concentric broken rings + the speaker's glyph) on the left edge, half over the seam; the speaker's
 *   name above the text in caps. Narrator lines use the caption style: the game's title emblem, italic text.
 * - Text at clamp(22px, 1.6vw, 32px) (≈ 31 px at 1920 w), two lines at most, typing on at 45 cps. The typing span is
 *   aria-hidden; a visually hidden live region receives the FULL line when it starts (assertive for critical, taunt
 *   and feedback lines).
 * - I opens a hint while the panel is open; Shift+I opens the brief. The Hint button itself sits with the top controls.
 * - Space / Enter advance the line on screen: they finish typing, then dismiss it. That includes walk-up lines and
 *   toasts, which do not freeze movement. A puzzle control or text field keeps the key. Clicking the bar advances too.
 * - While the panel is open, spoken lines and feedback stay in the bar. Instruction, tutorial, insight and
 *   success are the station directions and render in the panel instead. In explore, non-blocking lines and
 *   toasts show as a strip bottom-centre.
 * - Reduced motion: lines appear complete.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import type { Emblem as EmblemSpec } from "../../../contracts/world";
import type { SpeakerDirectory, SpeakerInfo } from "../../../world/types";
import styles from "./dialogue.module.css";
import { Emblem } from "./Emblem";
import { ariaPolitenessFor } from "./engine";
import type { DialogueEngineApi, DialogueKind } from "./types";
import { useDialogueClock, useDialogueSnapshot } from "./useDialogue";

export type DialogueBarLayout = "explore" | "scrub" | "board" | "vault" | "sandbox" | "cutscene";

export interface DialogueBarProps {
  engine: DialogueEngineApi & { setInstant?(on: boolean): void };
  speakers: SpeakerDirectory;
  /** cast.guide.characterId: the default emblem */
  guideId: string;
  /** the game's title emblem (narrator caption style) */
  titleEmblem?: EmblemSpec | null;
  layout: DialogueBarLayout;
  onHint?: () => void;
  onBrief?: () => void;
  hintDisabled?: boolean;
  /** accessible name for the Hint button, e.g. "Hint (1 of 3 used)" */
  hintLabel?: string;
  reducedMotion?: boolean;
  /** run the typewriter clock here (default true); false when the client ticks the engine itself */
  drivesClock?: boolean;
  /** listen for Space/Enter globally while a line is on screen (default true) */
  globalAdvance?: boolean;
  /**
   * I = hint rung, Shift+I = brief, while the panel is open (default true). The client must not bind I itself
   * (one press = one rung).
   */
  hintHotkey?: boolean;
}

export const DIALOGUE_PIN_PRIMARY_ID = "dialogue-pin-primary";
export const DIALOGUE_PIN_SECONDARY_ID = "dialogue-pin-secondary";

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  const role = el.getAttribute("role");
  if (role === "slider" || role === "textbox" || role === "spinbutton") return true;
  return (el as HTMLElement).isContentEditable === true;
}

/**
 * Space and Enter dismiss the line on screen. Space still counts after the game captures it (Phaser calls
 * preventDefault so the page does not scroll). Puzzle controls and text fields keep the key. Enter on a focused
 * button stays with that button; Space skips the line instead of clicking a HUD button.
 */
export function dialogueAdvanceKey(input: {
  key: string;
  repeat: boolean;
  defaultPrevented: boolean;
  typingTarget: boolean;
  inPanel: boolean;
  inBar: boolean;
  focusedButton: boolean;
}): boolean {
  if (input.key !== " " && input.key !== "Enter") return false;
  if (input.repeat) return false;
  if (input.defaultPrevented && input.key !== " ") return false;
  if (input.typingTarget || input.inPanel || input.inBar) return false;
  if (input.key === "Enter" && input.focusedButton) return false;
  return true;
}

function speakerOf(speakers: SpeakerDirectory, id: string): SpeakerInfo | null {
  return speakers.get(id) ?? null;
}

function HexTexture() {
  return (
    <svg className={styles.hex} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="dialogue-hex" width="42" height="36.4" patternUnits="userSpaceOnUse">
          <path
            d="M10.5 0h21l10.5 18.2-10.5 18.2h-21L0 18.2z"
            fill="none"
            stroke="var(--db-hex)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dialogue-hex)" />
    </svg>
  );
}

function kindClass(kind: DialogueKind): string {
  if (kind === "feedback") return `${styles.pinSecondary} ${styles.pinFeedback}`;
  return styles.pinSecondary;
}

export function DialogueBar({
  engine,
  speakers,
  guideId,
  titleEmblem = null,
  layout,
  onHint,
  onBrief,
  hintDisabled = false,
  reducedMotion = false,
  drivesClock = true,
  globalAdvance = true,
  hintHotkey = true,
}: DialogueBarProps) {
  const snap = useDialogueSnapshot(engine);
  useDialogueClock(engine, drivesClock);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    engine.setInstant?.(reducedMotion);
  }, [engine, reducedMotion]);

  // Space / Enter dismiss whatever line is up, including walk-up lines and toasts (those do not freeze movement).
  const showing = snap.active !== null;
  useEffect(() => {
    if (!globalAdvance || !showing || typeof window === "undefined") return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const focus = document.activeElement;
      const target = e.target instanceof Element ? e.target : focus;
      if (
        !dialogueAdvanceKey({
          key: e.key,
          repeat: e.repeat,
          defaultPrevented: e.defaultPrevented,
          typingTarget: isTypingTarget(target),
          inPanel: !!target?.closest?.("[data-panel]"),
          inBar: !!(target && barRef.current?.contains(target)),
          focusedButton: focus instanceof HTMLButtonElement,
        })
      ) {
        return;
      }
      e.preventDefault();
      engine.advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, showing, globalAdvance]);

  const active = snap.active;
  const pins = snap.pinned;
  const panelOpen = layout === "scrub" || layout === "board" || layout === "vault" || layout === "sandbox";
  /* Instruction, tutorial, insight and success are the station directions. They render in the panel, not here. */
  const directionKind = (kind: string) => kind === "instruction" || kind === "tutorial" || kind === "insight" || kind === "success";
  const primary = pins.primary && !directionKind(pins.primary.kind) ? pins.primary : null;
  const secondary = pins.secondary && !directionKind(pins.secondary.kind) ? pins.secondary : null;

  // I / Shift+I while the panel is open (§3.5).
  useEffect(() => {
    if (!hintHotkey || !panelOpen || (!onHint && !onBrief) || typeof window === "undefined") return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "i" && e.key !== "I") return;
      if (e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(document.activeElement)) return;
      e.preventDefault();
      if (e.shiftKey) onBrief?.();
      else if (!hintDisabled) onHint?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hintHotkey, panelOpen, onHint, onBrief, hintDisabled]);
  const hasPins = panelOpen && (primary !== null || secondary !== null);
  const controlsOnly = panelOpen && !hasPins && active === null;
  const isToast = active !== null && active.request.channel === "toast";

  const speaker = active ? speakerOf(speakers, active.line.speakerId) : null;
  const guide = speakerOf(speakers, guideId);
  const narrator = active?.line.speakerId === "narrator" || speaker?.kind === "narrator";
  const lineEmblem: EmblemSpec | null = narrator ? titleEmblem : (speaker?.emblem ?? guide?.emblem ?? titleEmblem);
  const desaturate = !narrator && speaker !== null && speaker.emblem === null && speaker.kind !== "player";
  const speakerName = narrator ? null : (speaker?.name ?? (active?.line.speakerId === "player" ? "You" : active?.line.speakerId ?? null));

  const pinSpeaker = primary ? speakerOf(speakers, primary.speakerId) : null;
  const pinEmblem = pinSpeaker?.emblem ?? guide?.emblem ?? titleEmblem;

  // Live regions: the FULL line the moment it starts (derived from the snapshot; no effect, no state).
  const politeness = active ? ariaPolitenessFor(active.line, active.request.priority) : "polite";
  const liveText = active ? `${speakerName ? `${speakerName}: ` : ""}${active.line.text}` : "";
  const feedbackText = panelOpen && secondary?.kind === "feedback" ? secondary.text : "";

  const onBarKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      engine.advance();
    }
  };

  const geometry = useMemo(() => {
    switch (layout) {
      case "scrub":
      case "sandbox":
        return styles.scrub;
      case "board":
        return styles.board;
      case "vault":
        return styles.vault;
      case "cutscene":
        return styles.band;
      default:
        return styles.band;
    }
  }, [layout]);

  const liveRegions = (
    <>
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true" data-testid="dialogue-live">
        {politeness === "polite" ? liveText : ""}
      </div>
      <div className={styles.srOnly} aria-live="assertive" aria-atomic="true" data-testid="dialogue-live-assertive">
        {politeness === "assertive" ? liveText : feedbackText}
      </div>
    </>
  );

  // ---- explore: a toast strip (or nothing)
  if (!panelOpen && (active === null || isToast)) {
    return (
      <div className={`${styles.root} ${styles.toastStrip}`} data-testid="dialogue-bar" data-state={active ? "toast" : "idle"}>
        {liveRegions}
        {active && (
          <div className={styles.toast} onClick={() => engine.advance()} data-testid="dialogue-toast">
            <Emblem emblem={lineEmblem} size={48} desaturate={desaturate} />
            <div className={styles.body}>
              {speakerName && <span className={styles.speaker}>{speakerName}</span>}
              <p className={`${styles.toastText} ${narrator ? styles.caption : ""}`} aria-hidden="true" data-testid="dialogue-text">
                <TypedText text={active.line.text} visible={active.visibleChars} />
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- the bar
  return (
    <div className={`${styles.root} ${geometry}${controlsOnly ? ` ${styles.controlsOnly}` : ""}`} data-testid="dialogue-bar" data-state={active ? (active.typing ? "typing" : "shown") : hasPins ? "pinned" : "controls"}>
      {liveRegions}
      <div
        ref={barRef}
        className={styles.panel}
        role="group"
        aria-label="Dialogue"
        tabIndex={0}
        onKeyDown={onBarKey}
        onClick={() => engine.advance()}
      >
        <HexTexture />
        <span className={styles.leftTerminal} aria-hidden="true" />
        <span className={styles.terminals} aria-hidden="true">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.ring} />
        </span>
        <div className={styles.emblemSlot}>
          <Emblem emblem={active ? lineEmblem : pinEmblem} size={64} desaturate={active ? desaturate : false} />
        </div>
        <div className={styles.body}>
          {active && (
            <div className={hasPins ? styles.above : undefined}>
              {speakerName && (
                <span className={styles.speaker} data-testid="dialogue-speaker">
                  {speakerName}
                </span>
              )}
              <p className={`${styles.text} ${narrator ? styles.caption : ""}`} aria-hidden="true" data-testid="dialogue-text" data-kind={active.line.kind}>
                <TypedText text={active.line.text} visible={active.visibleChars} />
              </p>
              {!active.typing && snap.blocking && (
                <span className={styles.more} aria-hidden="true">
                  ▾
                </span>
              )}
            </div>
          )}
          {hasPins && primary && (
            <p
              id={DIALOGUE_PIN_PRIMARY_ID}
              className={`${styles.pinPrimary} ${primary.kind === "success" ? styles.pinSuccess : ""}`}
              data-testid="dialogue-pin-primary"
              data-kind={primary.kind}
            >
              {primary.text}
            </p>
          )}
          {hasPins && secondary && (
            <p id={DIALOGUE_PIN_SECONDARY_ID} className={kindClass(secondary.kind)} data-testid="dialogue-pin-secondary" data-kind={secondary.kind}>
              {secondary.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** The typed prefix followed by the invisible rest, so the box never grows while typing (no layout shift). */
function TypedText({ text, visible }: { text: string; visible: number }) {
  if (visible >= text.length) return <>{text}</>;
  return (
    <>
      {text.slice(0, visible)}
      <span className={styles.ghost}>{text.slice(visible)}</span>
    </>
  );
}
