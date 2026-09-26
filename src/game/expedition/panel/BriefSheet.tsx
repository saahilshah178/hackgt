"use client";

import { useId, useState } from "react";

export interface Brief {
  /** the fixture prompt, verbatim */
  prompt: string;
  /** the console plaque text, when the station has one */
  plaque: string | null;
  /** the guide-voiced rungs unlocked so far, then the fixture hints verbatim (§2.6) */
  hints: readonly string[];
}

/**
 * The brief sheet (§2.6): two tabs, Brief (the prompt + the plaque) and Hints (what has been unlocked). It fills the
 * vault layout's left column and backs the (i) sheet. `data-testid="brief-sheet"`; arrow keys switch tabs.
 */
export function BriefSheet({ brief, title = "Brief", warm = false, initialTab = "brief" }: { brief: Brief; title?: string; warm?: boolean; initialTab?: "brief" | "hints" }) {
  const [tab, setTab] = useState<"brief" | "hints">(initialTab);
  const id = useId();
  const tabs: ("brief" | "hints")[] = ["brief", "hints"];
  return (
    <section className="xp-brief" data-testid="brief-sheet" aria-label={title} data-warm={warm || undefined}>
      <div
        role="tablist"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            setTab((t) => (t === "brief" ? "hints" : "brief"));
          }
        }}
      >
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`${id}-${t}`}
            aria-selected={tab === t}
            aria-controls={`${id}-${t}-panel`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
          >
            {t === "brief" ? "Brief" : `Hints${brief.hints.length ? ` · ${brief.hints.length}` : ""}`}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-${tab}-panel`} aria-labelledby={`${id}-${tab}`} tabIndex={0}>
        {tab === "brief" ? (
          <>
            <p style={{ margin: "0 0 12px" }}>{brief.prompt}</p>
            {brief.plaque ? (
              <p style={{ margin: 0, paddingLeft: 12, borderLeft: "2px solid var(--ui-line)", color: "var(--ui-text-dim)" }}>{brief.plaque}</p>
            ) : null}
          </>
        ) : brief.hints.length ? (
          <ol style={{ margin: 0, paddingLeft: "1.3em", display: "grid", gap: 10 }}>
            {brief.hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        ) : (
          <p style={{ margin: 0, color: "var(--ui-text-dim)" }}>No hints yet. Press I (or the ⓘ button) to ask the guide.</p>
        )}
      </div>
    </section>
  );
}
