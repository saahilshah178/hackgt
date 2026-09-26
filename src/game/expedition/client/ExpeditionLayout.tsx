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
}

export function ExpeditionLayout({ phase, stage, hud, panel, dialogue, overlays, stageRef, label }: ExpeditionLayoutProps) {
  return (
    <div className={styles.layout} data-testid="expedition-layout" data-phase={phase}>
      <div ref={stageRef} className={styles.stage} tabIndex={-1} role="region" aria-label={label} data-testid="expedition-stage">
        {stage}
      </div>
      {hud}
      {panel}
      {dialogue}
      {overlays}
    </div>
  );
}

export { styles as layoutStyles };
