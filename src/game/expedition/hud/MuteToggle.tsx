"use client";
/**
 * MuteToggle (N; 20 §2.6, §2.12): toggles the audio bus; the bus persists the choice in localStorage. When sound is
 * disabled outright (EXPEDITION_SFX=off, ?mute=1) the button still shows, pressed and disabled, so the HUD never shifts.
 */
import type { AudioBus } from "../audio/bus";
import { useAudioBusSnapshot } from "../audio/useAudioBus";
import styles from "./hud.module.css";

export function MuteToggle({ bus }: { bus: AudioBus | null }) {
  const snap = useAudioBusSnapshot(bus);
  const off = !snap.enabled || snap.muted;
  return (
    <button
      type="button"
      className={styles.iconButton}
      data-testid="mute-toggle"
      aria-pressed={off}
      aria-label={snap.enabled ? (snap.muted ? "Unmute sound" : "Mute sound") : "Sound is off"}
      aria-keyshortcuts="N"
      title={snap.enabled ? "Mute (N)" : "Sound is off"}
      disabled={!snap.enabled || !bus}
      onClick={() => bus?.toggleMute()}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        {off ? (
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </svg>
      <span className={styles.keycap} aria-hidden="true">
        N
      </span>
    </button>
  );
}
