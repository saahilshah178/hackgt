"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Character, Encounter, GameSpec } from "../../../contracts/gamespec";
import type { RoomPlacement } from "../types";
import type { HostHandle, HostProps } from "../types";
import type { Palette } from "../../engine/palettes";

/**
 * DOM-only genre host for `mystery` (LIBRARY §1: "mostly UI; shows off voice"). Implements the same
 * HostProps/HostHandle contract as DomHost so GameClient drives it unchanged: it owns only the
 * in-world scene (arrival / street / room-per-encounter with a socket-specific frame) and the
 * player's position in it. The widget + hint panel + consequence overlay are rendered by GameClient
 * beneath whatever this component renders, same as with DomHost.
 */

/** Small per-family glyph, mirroring DomHost's iconForMode (LIBRARY §5 skins), kept local so the two
 * hosts stay independent. */
function iconForMode(mode: string | undefined): string {
  switch (mode) {
    case "bins":
    case "type_match":
      return "🗂";
    case "pairs":
    case "chain":
    case "network":
    case "path":
      return "🧵";
    case "elimination":
    case "argument":
    case "source_eval":
    case "perspective":
    case "weigh":
      return "🔎";
    case "linear":
    case "cycle":
    case "rank":
    case "timeline":
      return "📋";
    case "mimic":
    case "predict_reveal":
    case "error_hunt":
    case "counterexample":
      return "❓";
    case "equation":
    case "chem_equation":
    case "ledger":
      return "⚖️";
    case "encode":
    case "function_machine":
    case "trace":
      return "🧬";
    case "rapid":
    case "cloze":
      return "🗣️";
    case "riemann":
    case "area":
    case "signed":
    case "rate_total":
    case "average_value":
      return "📦";
    case "intervene":
    case "reach_state":
    case "predict":
    case "sample":
      return "💉";
    case "limit":
    case "slope":
      return "📈";
    default:
      return "•";
  }
}

/** What kind of scene frame a room gets: the chunk's socket, or "arrival"/"street" for start/connector. */
function sceneKind(room: RoomPlacement | undefined): string {
  if (!room) return "street";
  if (room.def.kind === "start") return "arrival";
  if (room.def.kind === "connector") return "street";
  return room.def.socket ?? "street";
}

function beatsFor(spec: GameSpec, encounterId: string, when: "before" | "after") {
  return spec.narrative.beats.filter((b) => b.encounterId === encounterId && b.when === when);
}

/** The NPC who "asks" the conversation prompt: the first character named in the before-beat, else the
 * first non-narrator character (falls back to the first character of any role). */
function speakerFor(spec: GameSpec, encounter: Encounter | null): Character | undefined {
  if (!encounter) return spec.characters[0];
  const before = beatsFor(spec, encounter.id, "before");
  const named = before[0] && spec.characters.find((c) => c.id === before[0].speakerId);
  if (named) return named;
  return spec.characters.find((c) => c.role.toLowerCase() !== "narrator") ?? spec.characters[0];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** The `lineKey` (src/pipeline/audio/index.ts `narrativeLines`) for a room's spoken line, or null when
 * the room has no encounter (arrival/street get no voice line tonight). */
function lineKeyFor(room: RoomPlacement | undefined): string | null {
  if (!room?.encounter) return null;
  return `beat:${room.encounter.id}:before`;
}

function findVoiceUrl(spec: GameSpec, lineKey: string | null): string | null {
  if (!lineKey) return null;
  return spec.audio.voice.find((v) => v.lineKey === lineKey)?.url ?? null;
}

interface FrameProps {
  spec: GameSpec;
  room: RoomPlacement | undefined;
  palette: Palette;
  flourish: "case_closed" | "generic" | null;
}

/** The socket-specific "frame" LIBRARY §1 describes for the mystery genre. Purely decorative CSS; the
 * actual encounter prompt/widget is rendered by GameClient right below whatever this returns. */
function SceneFrame({ spec, room, palette, flourish }: FrameProps) {
  const kind = sceneKind(room);
  const encounter = room?.encounter ?? null;
  const cardStyle = {
    backgroundColor: palette.css.floor,
    borderColor: palette.css.accent,
    color: palette.css.text,
  };

  if (kind === "arrival") {
    return (
      <div data-testid="scene-arrival" className="flex flex-col gap-2 rounded-xl border-2 p-6" style={cardStyle}>
        <h2 className="text-2xl font-bold" style={{ fontSize: 24 }}>
          {spec.title}
        </h2>
        <p className="text-lg" style={{ fontSize: 18 }}>
          {spec.premise}
        </p>
      </div>
    );
  }

  if (kind === "street") {
    return (
      <div data-testid="scene-street" className="flex items-center justify-center rounded-xl border-2 border-dashed p-6" style={cardStyle}>
        <p className="text-lg opacity-80" style={{ fontSize: 18 }}>
          You walk on, notebook in hand&hellip;
        </p>
      </div>
    );
  }

  if (kind === "conversation") {
    const speaker = speakerFor(spec, encounter);
    return (
      <div data-testid="scene-conversation" className="flex flex-col gap-3 rounded-xl border-2 p-6" style={cardStyle}>
        <p className="text-sm uppercase tracking-wide opacity-70" style={{ fontSize: 14 }}>
          The parlor
        </p>
        <div className="flex items-start gap-4">
          <div
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 text-xl font-bold"
            style={{ borderColor: palette.css.accent, background: palette.css.wall }}
          >
            {speaker ? initials(speaker.name) : "?"}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold" style={{ fontSize: 16 }}>
              {speaker?.name ?? "A stranger"}
            </p>
            {encounter && (
              <div className="rounded-lg border-2 px-4 py-2" style={{ borderColor: palette.css.accent }}>
                <p className="text-lg" style={{ fontSize: 18 }} data-testid="scene-dialogue">
                  &ldquo;{encounter.prompt}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (kind === "evidence") {
    return (
      <div data-testid="scene-evidence" className="flex flex-col gap-3 rounded-xl border-2 p-6" style={cardStyle}>
        <p className="text-sm uppercase tracking-wide opacity-70" style={{ fontSize: 14 }}>
          The study
        </p>
        <div className="flex gap-3">
          {["A", "B", "C", "D"].map((label) => (
            <div
              key={label}
              aria-hidden
              className="flex h-16 w-20 items-end justify-center rounded-t-md border-2 pb-1 text-xs font-semibold"
              style={{ borderColor: palette.css.accent }}
            >
              {label}
            </div>
          ))}
        </div>
        {encounter && (
          <p className="text-lg" style={{ fontSize: 18 }}>
            File each claim into the folder it belongs in.
          </p>
        )}
      </div>
    );
  }

  if (kind === "corkboard") {
    return (
      <div
        data-testid="scene-corkboard"
        className="flex flex-col gap-3 rounded-xl border-2 p-6"
        style={{ ...cardStyle, backgroundImage: `radial-gradient(${palette.css.accent} 1px, transparent 1px)`, backgroundSize: "16px 16px" }}
      >
        <p className="text-sm uppercase tracking-wide opacity-70" style={{ fontSize: 14 }}>
          The office corkboard
        </p>
        <div className="flex flex-wrap gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} aria-hidden className="h-20 w-28 rotate-[-2deg] rounded border-2 bg-current/5 p-2" style={{ borderColor: palette.css.accent }} />
          ))}
        </div>
        {encounter && (
          <p className="text-lg" style={{ fontSize: 18 }}>
            String the clues into the right order.
          </p>
        )}
      </div>
    );
  }

  if (kind === "cross_exam") {
    return (
      <div data-testid="scene-cross_exam" className="flex flex-col gap-3 rounded-xl border-2 p-6" style={cardStyle}>
        <p className="text-sm uppercase tracking-wide opacity-70" style={{ fontSize: 14 }}>
          The witness stand
        </p>
        <div className="flex items-center gap-4">
          <span aria-hidden className="text-3xl">
            ⚖️
          </span>
          <p className="text-lg" style={{ fontSize: 18 }} data-testid="scene-dialogue">
            {encounter ? encounter.prompt : "The witness takes the stand."}
          </p>
        </div>
        <p className="text-base font-semibold uppercase tracking-wide opacity-70" style={{ fontSize: 15 }}>
          Objection: expose the false statement.
        </p>
      </div>
    );
  }

  if (kind === "archive") {
    return (
      <div data-testid="scene-archive" className="flex flex-col gap-3 rounded-xl border-2 p-6" style={cardStyle}>
        <p className="text-sm uppercase tracking-wide opacity-70" style={{ fontSize: 14 }}>
          The archive shelves
        </p>
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-16 w-4 rounded-sm border" style={{ borderColor: palette.css.accent }} />
          ))}
        </div>
        {encounter && (
          <p className="text-lg" style={{ fontSize: 18 }}>
            {encounter.prompt}
          </p>
        )}
      </div>
    );
  }

  if (kind === "lab") {
    return (
      <div data-testid="scene-lab" className="flex flex-col gap-3 rounded-xl border-2 p-6" style={cardStyle}>
        <p className="text-sm uppercase tracking-wide opacity-70" style={{ fontSize: 14 }}>
          The lab bench
        </p>
        <span aria-hidden className="text-3xl">
          🧪
        </span>
        {encounter && (
          <p className="text-lg" style={{ fontSize: 18 }}>
            {encounter.prompt}
          </p>
        )}
      </div>
    );
  }

  // accusation (boss)
  return (
    <div data-testid="scene-accusation" className="flex flex-col gap-3 rounded-xl border-2 p-6" style={cardStyle}>
      <p className="text-sm uppercase tracking-wide opacity-70" style={{ fontSize: 14 }}>
        The final accusation
      </p>
      <div className="flex flex-wrap gap-2">
        {spec.characters.map((c) => (
          <span key={c.id} className="rounded-full border-2 px-3 py-1 text-sm" style={{ borderColor: palette.css.accent, fontSize: 14 }}>
            {c.name}
          </span>
        ))}
      </div>
      {encounter && (
        <p className="text-lg font-semibold" style={{ fontSize: 20 }} data-testid="scene-dialogue">
          {encounter.prompt}
        </p>
      )}
      {flourish === "case_closed" && (
        <p className="text-2xl font-bold" style={{ fontSize: 26 }} data-testid="case-closed-flourish">
          CASE CLOSED
        </p>
      )}
    </div>
  );
}

export const MysteryHost = forwardRef<HostHandle, HostProps>(function MysteryHost({ spec, rooms, palette, frozen, onReachSocket }, ref) {
  const [roomIndex, setRoomIndex] = useState(0);
  const [flourish, setFlourish] = useState<"case_closed" | "generic" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const flourishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    warpTo(encounterId) {
      if (encounterId === null) return setRoomIndex(0);
      const i = rooms.findIndex((r) => r.encounter?.id === encounterId);
      if (i !== -1) setRoomIndex(i);
    },
    celebrate() {
      const room = rooms[roomIndex];
      setFlourish(room?.def.socket === "accusation" ? "case_closed" : "generic");
      if (flourishTimer.current) clearTimeout(flourishTimer.current);
      flourishTimer.current = setTimeout(() => setFlourish(null), 900);
    },
  }));

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (flourishTimer.current) clearTimeout(flourishTimer.current);
    };
  }, []);

  useEffect(() => {
    const room = rooms[roomIndex];
    if (room?.encounter) onReachSocket(room.encounter.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIndex]);

  const room = rooms[roomIndex];
  const voiceUrl = findVoiceUrl(spec, lineKeyFor(room));

  // Voice (LIBRARY / MEGAPROMPT P10): plays the line for the room just entered. Every fixture tonight
  // has an empty `audio.voice`, so `voiceUrl` is always null and this is a silent no-op; the plumbing
  // is here for whenever the audio pipeline is turned on.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !voiceUrl) return;
    el.src = voiceUrl;
    el.play().catch(() => {
      // Autoplay can be blocked outside a user gesture; the speaker button below replays manually.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceUrl]);

  const move = (delta: number) => {
    if (frozen) return;
    setRoomIndex((i) => Math.max(0, Math.min(rooms.length - 1, i + delta)));
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Investigation map (use ArrowRight/Enter or the Next location button to move)"
      data-testid="mystery-host"
      className="flex flex-col gap-4 rounded-xl p-4 outline-none"
      style={{ background: palette.css.background, color: palette.css.text, fontSize: 18 }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "Enter") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      <nav aria-label="Visited locations" data-testid="mystery-breadcrumbs" className="flex flex-wrap gap-2">
        {rooms.map((r, i) => {
          const kind = sceneKind(r);
          const status = i < roomIndex ? "visited" : i === roomIndex ? "current" : "locked";
          return (
            <button
              key={i}
              type="button"
              data-testid={`room-${i}`}
              disabled={status === "locked"}
              aria-current={status === "current" ? "step" : undefined}
              onClick={() => status !== "locked" && setRoomIndex(i)}
              className="rounded-full border-2 px-3 py-1 text-sm disabled:opacity-40"
              style={{
                fontSize: 14,
                borderColor: status === "current" ? palette.css.accent : palette.css.wall,
                background: status === "current" ? "color-mix(in oklab, currentColor 15%, transparent)" : "transparent",
              }}
            >
              {r.encounter ? `${iconForMode(r.encounter.mode)} ${kind}` : kind === "arrival" ? "Start" : "Street"}
            </button>
          );
        })}
      </nav>

      <SceneFrame spec={spec} room={room} palette={palette} flourish={flourish} />

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          data-testid="next-location"
          disabled={frozen || roomIndex >= rooms.length - 1}
          onClick={() => move(1)}
          className="rounded-lg border-2 px-4 py-2 text-lg disabled:opacity-40"
          style={{ fontSize: 18, borderColor: palette.css.accent }}
        >
          Next location →
        </button>
        {voiceUrl && (
          <button
            type="button"
            aria-label="Replay this line"
            onClick={() => audioRef.current?.play().catch(() => {})}
            className="rounded-full border-2 px-3 py-2 text-lg"
            style={{ fontSize: 18, borderColor: palette.css.accent }}
          >
            🔊
          </button>
        )}
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- narration is decorative flavor audio, never the only channel for required content (the prompt is always shown as text). */}
      <audio ref={audioRef} data-testid="voice-audio" />
    </div>
  );
});
