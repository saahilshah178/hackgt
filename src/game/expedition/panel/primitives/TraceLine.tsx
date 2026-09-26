"use client";

/**
 * Circuit-trace frame lines (bible §3.2): 1.5 px `ui.line`, and every free end terminates in a hollow circle
 * (r = 4 px), a filled dot (r = 3 px) or a group of dots ("• • ◉"). Decorative (aria-hidden).
 */
export type Terminal = "dot" | "ring" | "dots" | "none";

function TerminalGlyph({ kind, orient, flip }: { kind: Terminal; orient: "h" | "v"; flip: boolean }) {
  if (kind === "none") return null;
  const circles =
    kind === "dot"
      ? [{ c: 5, r: 3, fill: true }]
      : kind === "ring"
        ? [{ c: 5, r: 4, fill: false }]
        : [
            { c: 4, r: 2.5, fill: true },
            { c: 13, r: 2.5, fill: true },
            { c: 23, r: 4, fill: false },
          ];
  const len = kind === "dots" ? 28 : 10;
  const ordered = flip ? circles.map((k) => ({ ...k, c: len - k.c })) : circles;
  const w = orient === "h" ? len : 10;
  const h = orient === "h" ? 10 : len;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flex: "0 0 auto", overflow: "visible" }} aria-hidden focusable="false">
      {ordered.map((k, i) => (
        <circle
          key={i}
          cx={orient === "h" ? k.c : 5}
          cy={orient === "h" ? 5 : k.c}
          r={k.r}
          fill={k.fill ? "var(--ui-line)" : "none"}
          stroke="var(--ui-line)"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

export function TraceLine({
  orient = "h",
  start = "none",
  end = "dot",
  className,
  style,
}: {
  orient?: "h" | "v";
  start?: Terminal;
  end?: Terminal;
  className?: string;
  style?: React.CSSProperties;
}) {
  const horizontal = orient === "h";
  return (
    <div
      className={className}
      aria-hidden
      style={{
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        alignItems: "center",
        ...style,
      }}
    >
      <TerminalGlyph kind={start} orient={orient} flip={false} />
      <div
        style={{
          flex: 1,
          minWidth: horizontal ? 8 : 0,
          minHeight: horizontal ? 0 : 8,
          height: horizontal ? 0 : "auto",
          width: horizontal ? "auto" : 0,
          borderTop: horizontal ? "1.5px solid var(--ui-line)" : undefined,
          borderLeft: horizontal ? undefined : "1.5px solid var(--ui-line)",
        }}
      />
      <TerminalGlyph kind={end} orient={orient} flip />
    </div>
  );
}
