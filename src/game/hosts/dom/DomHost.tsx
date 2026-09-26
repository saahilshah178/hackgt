"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { HostHandle, HostProps } from "../types";

/**
 * WebGL fallback host (LIBRARY §3 / MEGAPROMPT P3.6): a simple keyboard-navigable map of the room
 * sequence, driving the same runner/widgets/systems/debug hook as the Phaser Dungeon host. Used
 * whenever Phaser fails to boot or the canvas has no WebGL context (common in headless Chromium).
 */
/** Small per-family glyph mirroring DungeonScene's tinted-shape skins (LIBRARY §5), for the DOM fallback host. */
function iconForMode(mode: string | undefined): string {
  switch (mode) {
    case "bins":
    case "type_match":
      return "▣"; // sorter
    case "pairs":
    case "chain":
      return "⚡"; // linker
    case "elimination":
      return "?"; // investigator
    case "plane":
      return "⠿"; // mapper
    case "cycle":
      return "◯"; // sequencer.cycle
    case "formula":
      return "◔"; // tuner
    case "predict_reveal":
      return "◆"; // truth_finder
    case "limit":
      return "〜"; // function_world
    default:
      return "";
  }
}

export const DomHost = forwardRef<HostHandle, HostProps>(function DomHost({ rooms, palette, frozen, onReachSocket }, ref) {
  const [roomIndex, setRoomIndex] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    warpTo(encounterId) {
      if (encounterId === null) return setRoomIndex(0);
      const i = rooms.findIndex((r) => r.encounter?.id === encounterId);
      if (i !== -1) setRoomIndex(i);
    },
    celebrate() {
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 300);
    },
  }));

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    const room = rooms[roomIndex];
    if (room?.encounter) onReachSocket(room.encounter.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIndex]);

  const move = (delta: number) => {
    if (frozen) return;
    setRoomIndex((i) => Math.max(0, Math.min(rooms.length - 1, i + delta)));
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Dungeon map (fallback view; use arrow keys or A/D to move)"
      data-testid="dom-host"
      className="flex flex-col gap-4 rounded-xl p-4 outline-none"
      style={{ background: palette.css.background, color: palette.css.text }}
      onKeyDown={(e) => {
        if (["ArrowRight", "d", "D"].includes(e.key)) move(1);
        else if (["ArrowLeft", "a", "A"].includes(e.key)) move(-1);
      }}
    >
      <p className="text-sm opacity-80" style={{ fontSize: 15 }}>
        WebGL unavailable: showing the map view. Arrow keys or A/D to walk between rooms.
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {rooms.map((r, i) => {
          const isPlayer = i === roomIndex;
          const kind = r.def.kind;
          const label = r.def.socket ? r.def.socket : kind === "start" ? "Start" : "Hall";
          return (
            <div
              key={i}
              data-testid={`room-${i}`}
              className="flex h-24 min-w-28 flex-col items-center justify-center gap-1 rounded-lg border-2 text-center"
              style={{
                background: palette.css.floor,
                borderColor: r.encounter ? palette.css.accent : palette.css.wall,
              }}
            >
              <span className="text-xs uppercase tracking-wide opacity-80" style={{ fontSize: 12 }}>
                {label}
              </span>
              {r.encounter && (
                <span aria-hidden className="text-lg" style={{ fontSize: 18 }}>
                  {iconForMode(r.encounter.mode)}
                </span>
              )}
              {isPlayer && (
                <span
                  aria-label="Player"
                  className="h-5 w-5 rounded-full transition-transform"
                  style={{ background: palette.css.player, transform: celebrating ? "scale(1.6)" : "scale(1)" }}
                  data-testid="player-marker"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
