/* Station glyphs for the explorer host: one simple line icon per socket, drawn in a 24x24 box. */

export function SocketGlyph({ socket, color, stroke = 2 }: { socket: string; color: string; stroke?: number }) {
  const p = { fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (socket) {
    case "locked_gate":
      return (
        <g {...p}>
          <path d="M6 20V10.5a6 6 0 0 1 12 0V20z" />
          <circle cx="12" cy="12.5" r="1.6" fill={color} />
          <path d="M12 14v3" />
          <path d="M4.5 20h15" />
        </g>
      );
    case "terminal":
      return (
        <g {...p}>
          <rect x="4" y="4.5" width="16" height="11" rx="2" />
          <path d="M7.5 8.5l2.5 2-2.5 2M12 12.5h4" />
          <path d="M9 19.5h6M12 15.5v4" />
        </g>
      );
    case "shrine":
      return (
        <g {...p}>
          <path d="M12 3.5c2.8 3.2 5.5 5.6 5.5 9.2a5.5 5.5 0 0 1-11 0c0-2.4 1.5-3.8 2.6-5.4.6 1.5 1.5 2.4 2.6 2.7-.6-2.2-.4-4.3.3-6.5z" />
          <path d="M5.5 21h13" />
        </g>
      );
    case "bridge":
      return (
        <g {...p}>
          <path d="M2.5 15.5h19" />
          <path d="M4 15.5c1.5-5 14.5-5 16 0" />
          <path d="M8 12.2v3.3M12 11v4.5M16 12.2v3.3" />
          <path d="M3 19c2 1 4 1 6 0s4-1 6 0 4 1 6 0" />
        </g>
      );
    case "sentry":
      return (
        <g {...p}>
          <path d="M2.5 12s3.8-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.8 6.5-9.5 6.5S2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.8" fill={color} />
        </g>
      );
    case "cache":
      return (
        <g {...p}>
          <path d="M4 10.5h16V19H4z" />
          <path d="M4 10.5c0-3.5 2.5-5 8-5s8 1.5 8 5" />
          <rect x="10.5" y="9" width="3" height="4" rx="0.6" fill={color} />
        </g>
      );
    case "heart":
      return (
        <g {...p}>
          <path d="M12 2.5l2.3 6.1 6.2.3-4.8 4 1.6 6.3L12 15.7l-5.3 3.5 1.6-6.3-4.8-4 6.2-.3z" />
          <circle cx="12" cy="11.6" r="2" fill={color} />
        </g>
      );
    default:
      return (
        <g {...p}>
          <path d="M12 3.5l7.5 8.5-7.5 8.5L4.5 12z" />
          <circle cx="12" cy="12" r="2" fill={color} />
        </g>
      );
  }
}

export function PadlockGlyph({ color }: { color: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
      <rect x="5" y="10.5" width="14" height="10" rx="2" fill={color} stroke="none" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </g>
  );
}

export function CheckGlyph({ color }: { color: string }) {
  return <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
}
