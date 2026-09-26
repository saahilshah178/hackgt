"use client";

import type { CardModel } from "@/world/types";
import { CardFrame } from "./CardFrame";

export type DocumentCardModel = Extract<CardModel, { kind: "document" }>;

/** DocumentCard (§3.2): a typed document with an optional stamp (civil FILE documents, the e7 program). */
export function DocumentCard({ model, lit = [] }: { model: DocumentCardModel; lit?: readonly number[] }) {
  const lines = model.body.split(/\n+/);
  return (
    <CardFrame kind="document" tab={model.title}>
      <div className="xp-card-html" role="document" aria-label={model.sr}>
        <div
          style={{
            position: "relative",
            padding: "16px 18px",
            background: "#f2e9d8",
            color: "#1b2a30",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "var(--xp-fs-body)",
            lineHeight: 1.45,
            boxShadow: "0 2px 8px rgba(0,0,0,.4)",
            paddingBottom: model.stamp ? 48 : 16,
          }}
        >
          {lines.map((l, i) => (
            <p key={i} style={{ margin: "0 0 6px", opacity: lit.length === 0 || lit.includes(i) ? 1 : 0.35 }}>
              {l}
            </p>
          ))}
          {model.stamp ? (
            <div
              aria-hidden
              style={{
                position: "absolute",
                right: 14,
                bottom: 10,
                transform: "rotate(-7deg)",
                padding: "2px 10px",
                border: "3px solid #9c2f25",
                color: "#9c2f25",
                fontFamily: "var(--font-sans, sans-serif)",
                fontWeight: 800,
                fontSize: "var(--xp-fs-small)",
                letterSpacing: "0.14em",
              }}
            >
              {model.stamp}
            </div>
          ) : null}
        </div>
      </div>
    </CardFrame>
  );
}
