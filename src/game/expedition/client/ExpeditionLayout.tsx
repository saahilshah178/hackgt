"use client";
/**
 * src/game/expedition/client/ExpeditionLayout.tsx (H2) — the Expedition screen (docs/design/20 §2.1, §3.1):
 *
 *   100vw × 100vh, position relative, overflow hidden
 *   ├ stage     PlayHost (Phaser canvas or the DOM host), absolute inset 0, always full-bleed
 *   ├ hud       top-left title/ring/meter, top-right legend + mute
 *   ├ panel     InstrumentPanel (right; board 55 %; vault centred) or the sandbox panel
 *   ├ dialogue  DialogueBar (toast strip in explore, band in cutscenes, under the panel otherwise)
 *   └ overlays  cutscene Skip, Brief sheet, Journal
 *
 * Nothing here resizes the canvas on a phase change: the host frames the contraption inside `layout.safeRect`
 * instead (no layout shift). The stage is focusable (tabIndex −1) so closing the panel can hand focus back to it.
 *
 * The HUD lives in a region that spans the stage in explore and shrinks to the WORLD side while a side panel is open
 * (`hudInsetRight`, session.ts), so the top-right ? and mute controls never sit over the panel's first card label
 * (w1a fix 6). The region slides with the panel (280 ms ease-out cubic) and never catches pointer events itself.
 */
import type { ReactNode, Ref } from "react";
import styles from "./client.module.css";

export interface ExpeditionLayoutProps {
  phase: string;
  stage: ReactNode;
  hud?: ReactNode;
  panel?: ReactNode;
  dialogue?: ReactNode;
  overlays?: ReactNode;
  stageRef?: Ref<HTMLDivElement>;
  /** accessible name of the world region (the zone or the game title) */
  label: string;
  /** CSS px kept clear on the right of the HUD region (the open side panel plus its chip allowance); 0 = full stage */
  hudInsetRight?: number;
}

export function ExpeditionLayout({ phase, stage, hud, panel, dialogue, overlays, stageRef, label, hudInsetRight = 0 }: ExpeditionLayoutProps) {
  return (
    <div className={styles.layout} data-testid="expedition-layout" data-phase={phase}>
      <div ref={stageRef} className={styles.stage} tabIndex={-1} role="region" aria-label={label} data-testid="expedition-stage">
        {stage}
      </div>
      <div className={styles.hudRegion} style={{ right: Math.max(0, Math.round(hudInsetRight)) }} data-testid="hud-region" data-inset={hudInsetRight > 0 ? "panel" : "none"}>
        {hud}
      </div>
      {panel}
      {dialogue}
      {overlays}
    </div>
  );
}

export { styles as layoutStyles };
