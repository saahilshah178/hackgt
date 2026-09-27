"use client";

import type { GameSpec } from "../../../../contracts/gamespec";
import type { Progression } from "../../../runner/progression";
import { missingRequirements, shortConcept, type Casefile } from "./casefile.logic";

/*
 * The case board: a corkboard with every encounter as a pinned card, one lane per scene (track) and the accusation at
 * the right. Solved cards are DEDUCTIONS; formed-but-unsolved leads can be opened from here (node-<id> when
 * available); everything else is "???". Red string runs between deductions along progression.requires; strings not
 * yet earned are faint dashes. In the finale every string is red.
 */

export interface CaseBoardProps {
  spec: GameSpec;
  cf: Casefile;
  progression: Progression;
  solved: ReadonlySet<string>;
  available: ReadonlySet<string>;
  leads: ReadonlySet<string>;
  activeId: string | null;
  finished: boolean;
  /** edge keys `${from}>${to}` that just turned red (animated) */
  newStrings: ReadonlySet<string>;
  selected: string | null;
  nameOf(id: string): string;
  onInspect(id: string): void;
  onOpen(id: string): void;
}

const W = 1000;
const H = 620;

export function CaseBoard(props: CaseBoardProps) {
  const { spec, cf, progression, solved, available, leads, finished } = props;
  // lanes run from 3% to 80% of the board (97% without a boss); a card is a little narrower than its column
  const laneCols = Math.max(1, ...progression.tracks.map((t) => t.length));
  const span = (cf.bossId ? 0.77 : 0.94) * W;
  const cardW = Math.max(70, Math.min(172, span / laneCols - 14));
  const compact = cardW < 120;
  const lanes = Math.max(1, progression.tracks.length);
  const cardH = Math.max(96, Math.min(128, H / lanes - 44));
  const pos = (id: string) => {
    const p = cf.boardPos.get(id) ?? { x: 0.5, y: 0.5 };
    return { x: p.x * W, y: p.y * H + 12 };
  };
  /** the pin at the top centre of a card, in board units */
  const pin = (id: string) => {
    const p = pos(id);
    return { x: p.x, y: p.y - cardH / 2 + 9 };
  };

  return (
    <div className="cf-board" data-testid="case-board">
      <svg className="cf-board-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <defs>
          <pattern id="cf-cork" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill="#7a5130" />
            <circle cx="4" cy="5" r="1.4" fill="#5e3b20" />
            <circle cx="13" cy="11" r="1.1" fill="#946440" />
            <circle cx="8" cy="15" r="0.9" fill="#5e3b20" />
          </pattern>
          <radialGradient id="cf-cork-light" cx="0.45" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#ffcf7a" stopOpacity="0.22" />
            <stop offset="1" stopColor="#000" stopOpacity="0.45" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#cf-cork)" />
        <rect width={W} height={H} fill="url(#cf-cork-light)" />
        {cf.edges.map((e) => {
          const a = pin(e.from);
          const b = pin(e.to);
          const red = finished || (solved.has(e.from) && solved.has(e.to));
          const sameLane = Math.abs(a.y - b.y) < 4;
          // same lane: a shallow arc over the gap above the cards; across lanes: a gentle sag
          const bend = sameLane ? -Math.min(40, 12 + Math.abs(b.x - a.x) * 0.08) : Math.min(50, Math.abs(b.x - a.x) * 0.1 + 12);
          const d = `M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + bend} ${b.x} ${b.y}`;
          const key = `${e.from}>${e.to}`;
          return <path key={key} d={d} className={red ? `cf-str${props.newStrings.has(key) ? " cf-str-new" : ""}` : "cf-str-faint"} />;
        })}
      </svg>
      {progression.tracks.map((ids, lane) => {
        const locIndex = cf.locationOf.get(ids[0] ?? "") ?? lane;
        const y = ((lane + 0.5) / lanes) * H + 12 - cardH / 2 - 30;
        return (
          <span key={lane} className="cf-lane-label" style={{ top: `${(Math.max(14, y) / H) * 100}%` }}>
            {cf.locations[locIndex]?.title ?? `Scene ${lane + 1}`}
          </span>
        );
      })}
      {spec.encounters.map((e) => {
        const p = pos(e.id);
        const isBoss = e.id === cf.bossId;
        const isSolved = solved.has(e.id);
        const isAvail = available.has(e.id);
        const known = isSolved || leads.has(e.id) || (isBoss && isAvail);
        const openable = !isSolved && isAvail && (isBoss || leads.has(e.id)) && props.activeId !== e.id;
        const state = isSolved ? "solved" : isAvail ? "available" : "locked";
        const need = missingRequirements(progression, e.id, solved);
        const kicker = isSolved ? (isBoss ? "Case closed" : "Deduction") : isBoss ? (isAvail ? "The accusation" : "The culprit") : known ? (isAvail ? "Open lead" : "Pinned lead") : "Unknown";
        return (
          <button
            key={e.id}
            type="button"
            className={`cf-pin-card${isBoss ? " cf-pin-boss" : ""}${compact && !isBoss ? " cf-pin-compact" : ""}`}
            style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, width: `${((isBoss ? Math.max(cardW, 130) : cardW) / W) * 100}%`, height: `${(cardH / H) * 100}%`, rotate: `${((e.id.length * 7) % 5) - 2}deg` }}
            data-testid={openable ? `node-${e.id}` : `board-card-${e.id}`}
            data-state={state}
            data-known={known ? "true" : "false"}
            data-open={openable ? "true" : "false"}
            data-selected={props.selected === e.id ? "true" : "false"}
            aria-label={`${kicker}: ${known ? props.nameOf(e.id) : "unknown"}${openable ? ". Press Enter to open it." : ""}${!isSolved && need.length > 0 && known ? `. Waiting on ${need.length}.` : ""}`}
            onFocus={() => props.onInspect(e.id)}
            onMouseEnter={() => props.onInspect(e.id)}
            onClick={() => (openable ? props.onOpen(e.id) : props.onInspect(e.id))}
          >
            {isSolved ? <span className="cf-pin-stamp">{isBoss ? "GUILTY" : "DEDUCED"}</span> : <span className="cf-pin-kicker">{kicker}</span>}
            <span className="cf-pin-name">{known ? shortConcept(props.nameOf(e.id), 40) : "???"}</span>
            {openable && <span className="cf-pin-cta">{isBoss ? "Make your accusation" : "Open lead"}</span>}
          </button>
        );
      })}
      <svg className="cf-board-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ zIndex: 3, pointerEvents: "none" }}>
        {spec.encounters.map((e) => {
          const p = pin(e.id);
          return <circle key={e.id} cx={p.x} cy={p.y} r={6} fill="#d4333f" stroke="#7a1a22" strokeWidth={1.5} />;
        })}
      </svg>
    </div>
  );
}
