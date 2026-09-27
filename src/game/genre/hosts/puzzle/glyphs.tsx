"use client";

/**
 * Socket glyphs for seal medallions, drawn in a 44×44 box centred on (0, 0). One per puzzle socket (SOCKETS.puzzle);
 * anything else (a spec re-genred from another genre) falls back to a faceted gem.
 */
export function SocketGlyph({ socket, color, size = 1 }: { socket: string; color: string; size?: number }) {
  const common = { fill: "none", stroke: color, strokeWidth: 3.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <g transform={`scale(${size})`} aria-hidden>
      {glyph(socket, color, common)}
    </g>
  );
}

function glyph(socket: string, color: string, common: Record<string, unknown>) {
  switch (socket) {
    case "tile_board":
      return (
        <g {...common}>
          <rect x={-17} y={-17} width={14} height={14} rx={2.5} />
          <rect x={3} y={-17} width={14} height={14} rx={2.5} fill={color} />
          <rect x={-17} y={3} width={14} height={14} rx={2.5} fill={color} />
          <rect x={3} y={3} width={14} height={14} rx={2.5} />
        </g>
      );
    case "pipe_board":
      return (
        <g {...common}>
          <path d="M-18 -8 H0 A10 10 0 0 1 10 2 V18" strokeWidth={9} />
          <path d="M-18 -8 H0 A10 10 0 0 1 10 2 V18" stroke="#0d1216" strokeWidth={3} />
          <path d="M-18 -15 V-1 M3 18 H17" />
        </g>
      );
    case "beam_board":
      return (
        <g {...common}>
          <path d="M-4 -16 L12 12 H-20 Z" />
          <path d="M-22 -4 L-8 -2" />
          <path d="M4 2 L20 -6 M4 4 L20 4 M4 6 L20 14" strokeWidth={2.6} />
        </g>
      );
    case "conveyor":
      return (
        <g {...common}>
          <rect x={-20} y={2} width={40} height={14} rx={7} />
          <circle cx={-13} cy={9} r={3} fill={color} />
          <circle cx={13} cy={9} r={3} fill={color} />
          <path d="M-14 -14 L-6 -7 L-14 0 M-2 -14 L6 -7 L-2 0 M10 -14 L18 -7 L10 0" />
        </g>
      );
    case "lock":
      return (
        <g {...common}>
          <circle r={17} />
          <circle r={6} fill={color} />
          <path d="M0 -17 V-11 M17 0 H11 M0 17 V11 M-17 0 H-11 M12 -12 L8.5 -8.5 M-12 12 L-8.5 8.5 M12 12 L8.5 8.5 M-12 -12 L-8.5 -8.5" strokeWidth={2.6} />
          <path d="M-5 -25 L5 -25 L0 -19 Z" fill={color} strokeWidth={1.5} />
        </g>
      );
    case "goal_pad":
      return (
        <g {...common}>
          <circle r={18} />
          <circle r={11} />
          <circle r={4} fill={color} />
        </g>
      );
    case "boss":
      return (
        <g {...common}>
          <circle r={9} fill={color} />
          <path d="M0 -20 V-13 M0 13 V20 M-20 0 H-13 M13 0 H20 M-14 -14 L-9 -9 M9 9 L14 14 M14 -14 L9 -9 M-9 9 L-14 14" />
        </g>
      );
    default:
      return (
        <g {...common}>
          <path d="M0 -18 L16 0 L0 18 L-16 0 Z" />
          <path d="M-16 0 H16 M0 -18 L-6 0 L0 18 L6 0 Z" strokeWidth={2.2} />
        </g>
      );
  }
}

/** Human names for the puzzle sockets (side column, aria labels). */
export function socketName(socket: string): string {
  switch (socket) {
    case "tile_board":
      return "tile seal";
    case "pipe_board":
      return "pipe seal";
    case "beam_board":
      return "beam seal";
    case "conveyor":
      return "conveyor seal";
    case "lock":
      return "lock seal";
    case "goal_pad":
      return "goal seal";
    case "boss":
      return "core";
    default:
      return "seal";
  }
}

/** Points of a regular hexagon (pointy top) of radius r around (cx, cy). */
export function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}
