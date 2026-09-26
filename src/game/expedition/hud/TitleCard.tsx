"use client";
/**
 * TitleCard (a cutscene `title` step, 20 §2.6/§2.8): large centred serif that fades in and out over `ms`.
 * Rendered from SceneEvents.onTitle; `null` hides it. Announced politely.
 */
import type { CSSProperties } from "react";
import styles from "./hud.module.css";

export interface TitleCardData {
  text: string;
  sub: string | null;
  ms: number;
}

export function TitleCard({ title }: { title: TitleCardData | null }) {
  if (!title) return null;
  return (
    <div
      key={`${title.text}|${title.sub ?? ""}`}
      className={`${styles.titleCard} ${styles.titleAnim}`}
      data-testid="title-card"
      role="status"
      aria-live="polite"
      style={{ "--title-ms": `${Math.max(300, title.ms)}ms` } as CSSProperties}
    >
      <p className={styles.titleText}>{title.text}</p>
      {title.sub && <p className={styles.titleSub}>{title.sub}</p>}
    </div>
  );
}
