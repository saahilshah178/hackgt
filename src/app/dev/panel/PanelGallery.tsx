"use client";

import "@/game/expedition/panel/theme.css";
import { useCallback, useMemo, useRef, useState } from "react";
import { BriefSheet } from "@/game/expedition/panel/BriefSheet";
import { CardView } from "@/game/expedition/panel/cards/CardView";
import { ColumnSliders } from "@/game/expedition/panel/ColumnSliders";
import { InstrumentPanel, type InstrumentPanelHandle } from "@/game/expedition/panel/InstrumentPanel";
import { PanelScope } from "@/game/expedition/panel/metrics";
import { OrbPalette, ORB_FILLS } from "@/game/expedition/panel/OrbPalette";
import { BackTab } from "@/game/expedition/panel/primitives/BackTab";
import { HexGrid } from "@/game/expedition/panel/primitives/HexGrid";
import { TraceLine } from "@/game/expedition/panel/primitives/TraceLine";
import { Scrubber } from "@/game/expedition/panel/Scrubber";
import { SuccessBadge } from "@/game/expedition/panel/SuccessBadge";
import type { PanelDraft, PanelStation } from "@/game/expedition/panel/types";
import { ValueChip } from "@/game/expedition/panel/ValueChip";
import { VerifyButton } from "@/game/expedition/panel/VerifyButton";
import { oscillatorCard } from "@/game/expedition/panel/default-panel";
import { rangeOfProbe } from "@/game/expedition/panel/controls/scrub.logic";
import { getMode } from "@/mechanics/registry";
import { recordCard } from "@/world/record-strip";
import { fromSubmitInput } from "@/world/draft-inputs";
import { getContraption } from "@/world/library";
import { labelOnly, niceTicks } from "@/world/graph-math";
import type { AidTier, AnyContraptionMeta, CardModel, HintsUsed, ModeKey, OscillatorView, PanelContext } from "@/world/types";
import { BINDINGS, CIVIL_RECORD_STRIP, demoPanelFor, probeOf, type GameKey } from "./demo";

export interface GalleryStation {
  encounterId: string;
  familyId: string;
  mode: string;
  modeKey: ModeKey;
  prompt: string;
  hints: string[];
  view: unknown;
  /** dev only: lets the gallery grade Verify and apply the solution through the control API */
  params: unknown;
  solution: unknown;
}
export interface GalleryGame {
  key: GameKey;
  title: string;
  specId: string;
  stations: GalleryStation[];
}
export interface GalleryQuery {
  game: GameKey;
  enc: string | null;
  view: "stage" | "cards";
  full: boolean;
  solved: boolean;
  aid: AidTier;
  value: number | null;
  /** force console_slate (WidgetControl with the existing widget) */
  slate: boolean;
}

const SKY: Record<GameKey, [string, string, string]> = {
  trig: ["#D8D4CF", "#E8DCD2", "#F4E7DA"],
  cell: ["#E9C9C0", "#F2D8C8", "#FAE9D8"],
  civil: ["#3B2F3E", "#4E3C44", "#5E4A4A"],
};

/** A painted stand-in world so the panel's translucency reads (the real world is the Phaser host). */
function WorldBackdrop({ game }: { game: GameKey }) {
  const [top, mid, hz] = SKY[game];
  return (
    <svg aria-hidden viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={hz} />
        </linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#sky)" />
      <path d="M0 380 L220 250 L420 330 L640 200 L900 310 L1180 230 L1500 300 L1920 220 V1080 H0 Z" fill="#8FA6A0" opacity="0.8" />
      <path d="M0 520 L300 430 L620 500 L980 420 L1400 490 L1920 430 V1080 H0 Z" fill="#5F7B7A" />
      <rect x="120" y="420" width="1500" height="420" fill="#F2E3C6" />
      <rect x="120" y="420" width="1500" height="26" fill="#D9A441" />
      {[260, 520, 780, 1040, 1300].map((x) => (
        <rect key={x} x={x} y="470" width="22" height="360" fill="#27466A" opacity="0.85" />
      ))}
      <circle cx="640" cy="640" r="190" fill="#FBF1DE" stroke="#D9A441" strokeWidth="18" />
      <circle cx="640" cy="640" r="120" fill="none" stroke="#B89C78" strokeWidth="14" />
      <path d="M0 830 H1920 V1080 H0 Z" fill="#6FB7A6" />
      <path d="M0 860 H1920" stroke="#9ED6C4" strokeWidth="10" />
      <g transform="translate(470 700)">
        <rect x="-26" y="40" width="52" height="96" rx="10" fill="#2E4057" />
        <circle cx="0" cy="18" r="22" fill="#C98E6B" />
        <rect x="70" y="30" width="60" height="110" rx="6" fill="#D9C3A0" stroke="#A8782E" strokeWidth="5" />
      </g>
      <text x="40" y="1050" fontSize="22" fill="#27466A" opacity="0.7" fontFamily="sans-serif">
        placeholder world (the Phaser stage draws the real one)
      </text>
    </svg>
  );
}

/** A stand-in for S1's dialogue bar (bible §3.9) so the stage reads like the reference frames. */
function DialogueBarStandIn({ text }: { text: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 0,
        height: "15%",
        background: "var(--ui-panel)",
        backdropFilter: "blur(6px)",
        borderTop: "1.5px solid var(--ui-line)",
        display: "flex",
        gap: 22,
        padding: "18px 28px 12px 0",
        zIndex: 21,
      }}
    >
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <HexGrid />
      </div>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, marginLeft: -30 }}>
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="28" fill="#0B1F27" stroke="#fff" strokeWidth="2" />
          <path d="M30 10 A20 20 0 1 1 11 26" fill="none" stroke="#fff" strokeWidth="2" />
          <path d="M30 18 A12 12 0 1 0 42 30" fill="none" stroke="#fff" strokeWidth="2" />
          <circle cx="30" cy="30" r="4" fill="#fff" />
        </svg>
        <div className="xp-info-btn" style={{ width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          i
        </div>
      </div>
      <p style={{ position: "relative", margin: 0, color: "#fff", fontSize: "clamp(22px, 1.6vw, 32px)", lineHeight: 1.3, maxWidth: "90%" }}>{text}</p>
    </div>
  );
}

function firstSentence(s: string): string {
  const m = s.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : s;
}

function Stage({ game, station, stations, query, onQuery }: { game: GalleryGame; station: GalleryStation; stations: GalleryStation[]; query: GalleryQuery; onQuery: (q: Partial<GalleryQuery>) => void }) {
  const binding = BINDINGS[game.key][station.encounterId];
  const handle = useRef<InstrumentPanelHandle | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<"success" | null>(query.solved ? "success" : null);
  const [announce, setAnnounce] = useState<string | null>(null);
  const [lastDraft, setLastDraft] = useState<PanelDraft | null>(null);

  const meta: AnyContraptionMeta = useMemo(() => {
    const slate = getContraption("console_slate")!;
    if (query.slate) return slate;
    const base = getContraption(binding?.contraption ?? "console_slate") ?? slate;
    const demo = demoPanelFor(game.key, station.encounterId, station.view);
    return demo ? { ...base, panelStatic: demo.panelStatic, panelLive: demo.panelLive } : base;
  }, [binding?.contraption, game.key, station.encounterId, station.view, query.slate]);

  const probe = binding ? probeOf(binding) : null;
  const panelStation: PanelStation = {
    encounterId: station.encounterId,
    modeKey: station.modeKey,
    layout: binding?.layout ?? "board",
    skinId: meta.skins[0]?.id ?? "lectern_slate",
    objectNoun: binding?.noun ?? station.encounterId,
    verifyLabel: binding?.verify ?? "VERIFY",
    successBadge: binding?.badge ?? "SOLVED",
    inputSymbol: binding?.symbol ?? null,
    cardOverrides: [],
    bossPhases:
      station.encounterId === "e11_boss"
        ? [
            { id: "p1", itemKeys: ["i0", "i1"] },
            { id: "p2", itemKeys: ["i2", "i3"] },
            { id: "p3", itemKeys: ["i4", "i5", "i6"] },
          ]
        : [],
    config: {},
    probe,
  };
  const idx = stations.indexOf(station);
  const context: PanelContext = {
    recordStrip: game.key === "civil" ? CIVIL_RECORD_STRIP : null,
    solvedIds: stations.slice(0, Math.max(0, idx)).map((s) => s.encounterId),
    probeWindow: probe?.window ?? null,
  };
  const mode = getMode(station.familyId, station.mode);
  const initialDraft =
    query.value !== null
      ? {
          encounterId: station.encounterId,
          modeKey: station.modeKey,
          input: { value: query.value },
          complete: true,
          focus: null,
          hover: null,
          probe: query.value,
          settled: true,
          wave: null,
          marks: null,
          seq: 1,
        }
      : null;

  const onVerify = useCallback(
    (input: unknown) => {
      if (!mode) return;
      const g = mode.grade(station.params, input);
      if (g.correct) {
        setResult("success");
        setAnnounce(null);
      } else {
        setAttempt((a) => a + 1);
        setAnnounce(g.feedback);
      }
    },
    [mode, station.params],
  );

  return (
    <div
      data-testid="gallery-stage"
      style={{
        position: "relative",
        width: "100%",
        height: query.full ? "100vh" : undefined,
        aspectRatio: query.full ? undefined : "16 / 9",
        overflow: "hidden",
        background: "#1b2a30",
      }}
    >
      <WorldBackdrop game={game.key} />
      {panelStation.layout !== "vault" ? <DialogueBarStandIn text={firstSentence(station.prompt)} /> : null}
      <InstrumentPanel
        key={`${game.key}-${station.encounterId}`}
        station={panelStation}
        meta={meta}
        view={station.view}
        context={context}
        aidTier={query.aid}
        hintsUsed={query.aid as HintsUsed}
        instruction={station.prompt}
        initialDraft={initialDraft}
        attempt={attempt}
        result={result}
        announce={announce}
        brief={{ prompt: station.prompt, plaque: null, hints: station.hints.slice(0, query.aid) }}
        onDraft={setLastDraft}
        onVerify={onVerify}
        onBack={() => setAnnounce("Back: the panel would close without grading.")}
        onBadgeDone={() => setResult(null)}
        handleRef={handle}
      />
      {!query.full ? (
        <div style={{ position: "absolute", left: 12, top: 12, zIndex: 30, display: "flex", gap: 8, flexWrap: "wrap", maxWidth: "46%" }}>
          <button
            type="button"
            className="xp-back"
            style={{ minWidth: 0 }}
            data-testid="gallery-solve"
            onClick={() => {
              if (!mode) return;
              handle.current?.applyDraftInput(fromSubmitInput(station.modeKey, mode.solutionInput(station.params, station.solution), station.view));
            }}
          >
            APPLY SOLUTION
          </button>
          <button type="button" className="xp-back" style={{ minWidth: 0 }} onClick={() => onQuery({ aid: ((query.aid + 1) % 3) as AidTier })}>
            AID {query.aid}
          </button>
          <button type="button" className="xp-back" style={{ minWidth: 0 }} aria-pressed={query.slate} onClick={() => onQuery({ slate: !query.slate })}>
            {query.slate ? "NATIVE CONTROL" : "CONSOLE SLATE"}
          </button>
          {lastDraft ? (
            <pre
              data-testid="gallery-draft"
              style={{ margin: 0, maxWidth: "100%", maxHeight: 160, overflow: "auto", padding: 8, background: "rgba(11,31,39,.85)", color: "#9DB8BE", fontSize: 12, lineHeight: 1.35 }}
            >
              {JSON.stringify(lastDraft, null, 1)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- the cards page: every card kind on fixture data

function viewOf(games: GalleryGame[], game: GameKey, enc: string): unknown {
  return games.find((g) => g.key === game)?.stations.find((s) => s.encounterId === enc)?.view ?? null;
}

function galleryCards(games: GalleryGame[]): { title: string; card: CardModel; chips?: { slot: number; value: number; text: string; color: "f" | "g" | "h" | "accent" | "gold" }[]; h?: number }[] {
  const PI = Math.PI;
  const e2 = viewOf(games, "trig", "e2_period") as OscillatorView;
  const f = oscillatorCard(e2, 0);
  const x10 = { min: 0, max: 10, unit: "number" as const, ticks: labelOnly(niceTicks(0, 10, "number", 10), (t) => t.v === 10), label: null };
  const y4 = { min: -5, max: 5, unit: "number" as const, ticks: niceTicks(-4, 4, "number", 4), label: null };
  const ivtF = (x: number) => 1.6 * Math.sin(x / 1.4) - 0.2 * x + 0.8;
  const ivt: CardModel = {
    kind: "graph",
    slot: 0,
    title: "First Solar Vault",
    tab: "f(x)",
    x: x10,
    y: { min: -3, max: 3, unit: "number", ticks: niceTicks(-3, 3, "number", 6), label: null },
    plots: [{ id: "f", color: "f", style: "solid", segments: [Array.from({ length: 101 }, (_, i) => [i / 10, ivtF(i / 10)] as const)], endpoints: [] }],
    annotations: [],
    columns: [
      { id: "c0", x0: 0.5, x1: 2.5, state: "revealed" },
      { id: "c1", x0: 3, x1: 5, state: "obscured" },
      { id: "c2", x0: 5.5, x1: 7.5, state: "chosen" },
      { id: "c3", x0: 8, x1: 9.8, state: "obscured" },
    ],
    targetLine: { y: -1, label: "y = −1" },
    empty: false,
    sr: "Four interval columns; the orange target line y = −1.",
  };
  const piecewise: CardModel = {
    kind: "graph",
    slot: 0,
    title: "g, piecewise",
    tab: "g(x)",
    x: x10,
    y: y4,
    plots: [
      {
        id: "g",
        color: "g",
        style: "solid",
        segments: [
          [
            [0, 0],
            [5, 2],
          ],
          [
            [5, 4],
            [10, 0],
          ],
        ],
        endpoints: [
          { x: 5, y: 2, open: true },
          { x: 5, y: 4, open: false },
          { x: 7.5, y: 2, open: true },
        ],
      },
    ],
    annotations: [
      { kind: "bracket", x0: 5, y0: 2, x1: 5, y1: 4, label: "jump 2", color: "accent", orient: "vertical" },
      { kind: "shade", x0: 2, x1: 4, y0: null, y1: null, color: "h", alpha: 0.18, label: null },
      { kind: "period_marker", x: 2, y: 0.8, color: "g" },
      { kind: "hline", y: -2, label: "y = −2", style: "dashed", color: "f" },
      { kind: "marker", x: 7.5, y: 2, label: "hole", focusable: true },
      { kind: "caption", text: "g(x) near x = 5" },
    ],
    columns: [],
    targetLine: null,
    empty: false,
    sr: "g rises to a hole at (5, 2), a point at (5, 4), then falls with a hole at (7.5, 2).",
  };
  const civil = games.find((g) => g.key === "civil")!;
  const solvedAt = (enc: string) => civil.stations.slice(0, civil.stations.findIndex((s) => s.encounterId === enc)).map((s) => s.encounterId);
  const record = recordCard({ recordStrip: CIVIL_RECORD_STRIP, solvedIds: solvedAt("e10_sources"), probeWindow: { start: 1953, end: 1966 } }, [{ key: "h", at: 1957.7, label: "Little Rock (hint)", style: "hint" }], 1964.5);
  const e8 = viewOf(games, "cell", "e8_pump") as { lefts: { key: string; text: string }[]; rights: { key: string; text: string }[] };
  const e3 = viewOf(games, "trig", "e3_amplitude") as { chests: { statementIndex: number; text: string }[] };
  const e9 = viewOf(games, "civil", "e9_selma") as { planks: { key: string; text: string }[] };
  const e12 = viewOf(games, "civil", "e12_boss") as { hypotheses: { id: string; text: string }[]; clues: { index: number; text: string }[] };
  const e5 = viewOf(games, "civil", "e5_freedom_rides") as { nodes: { key: string; text: string }[] };
  const e7 = viewOf(games, "civil", "e7_march") as { lefts: { key: string; text: string }[] };
  const nodePos = [
    [0.17, 0.25],
    [0.5, 0.25],
    [0.83, 0.25],
    [0.17, 0.75],
    [0.5, 0.75],
    [0.83, 0.75],
  ];
  return [
    { title: "graph · f(t) with live dot and chip (5.png)", card: { ...f, annotations: [{ kind: "live_dot", x: PI / 2, y: 0, color: "f" }] }, chips: [{ slot: 0, value: 0, text: "0.0", color: "f" }] },
    { title: "graph · endpoints, bracket, shade, period marker, focusable marker (9.png)", card: piecewise, chips: [{ slot: 0, value: 4, text: "4.0", color: "g" }] },
    { title: "graph · interval columns, hex gutters, target line (8.png)", card: ivt },
    {
      title: "graph · empty card (keeps the stack's rhythm)",
      card: { ...f, slot: 2, tab: "h(t)", plots: [], empty: true, annotations: [] },
    },
    { title: "timeline · RECORD (civil §5.0.2, e10 open: 11 earned pins, a band, a hint pin)", card: record, chips: [{ slot: -1, value: 2, text: "Civil Rights Act", color: "f" }] },
    {
      title: "timeline · FILE with axis break (civil e1)",
      card: {
        kind: "timeline",
        slot: 0,
        title: "FILE",
        tab: "FILE",
        from: 1950,
        to: 1960,
        unit: "year",
        lanes: [],
        pins: [
          { key: "p", at: 1896, label: "Plessy", lane: null, style: "dim", spanTo: null },
          { key: "b", at: 1954.33, label: "Brown v. Board", lane: null, style: "draft", spanTo: null },
          { key: "lr", at: 1957.7, label: "Little Rock", lane: null, style: "hint", spanTo: null },
        ],
        bands: [{ from: 1954.33, to: 1955.4, label: "claimed", color: "g" }],
        arrows: [{ fromKey: "p", toKey: "b" }],
        axisBreak: { from: 1896, to: 1949 },
        sr: "The file card for Brown v. Board.",
      },
    },
    {
      title: "unit circle · point, arc, sin/cos drops, level y = 1/2, upper shade, mirror",
      card: {
        kind: "unit_circle",
        slot: 0,
        title: "UNIT CIRCLE",
        landmarks: [0, PI / 2, PI, (3 * PI) / 2].map((a, i) => ({ angle: a, label: ["0", "π/2", "π", "3π/2"][i] })),
        hairlineStep: PI / 12,
        point: { angle: (2 * PI) / 3 },
        arc: { from: 0, to: (2 * PI) / 3, color: "accent" },
        drops: { sin: true, cos: true },
        level: 0.5,
        shadeUpperHalf: true,
        mirror: { from: PI / 3, to: (2 * PI) / 3 },
        sr: "The unit circle at 2π/3.",
      },
      chips: [{ slot: 0, value: Math.sin((2 * PI) / 3), text: "0.87", color: "g" }],
      h: 380,
    },
    {
      title: "bars · gauges, net-flow arrow, sparkline, white timer",
      card: {
        kind: "bars",
        slot: 0,
        title: "SLUICE",
        bars: [
          { id: "o", label: "OUTSIDE", value: 7, max: 10, color: "f" },
          { id: "i", label: "INSIDE", value: 3, max: 10, color: "g" },
        ],
        sparkline: { points: [1, 2, 4, 3, 5, 6, 5, 7, 8, 7], max: 10, color: "h" },
        timer: { fraction: 0.6 },
        arrow: "out",
        sr: "Outside 7, inside 3.",
      },
    },
    {
      title: "schematic · pump cross-section",
      card: {
        kind: "schematic",
        slot: 0,
        title: "PUMP",
        viewBox: [420, 200],
        prims: [
          { p: "rect", x: 0, y: 70, w: 420, h: 60, color: "h", fill: true },
          { p: "poly", points: [[170, 20], [250, 20], [270, 180], [150, 180]], color: "g", fill: true, w: 3 },
          { p: "arc", cx: 210, cy: 100, r: 60, a0: 0.3, a1: 2.8, color: "accent", w: 4 },
          { p: "line", x1: 40, y1: 30, x2: 120, y2: 30, color: "f", w: 3, dash: true },
          { p: "text", x: 210, y: 16, text: "stage 3 · flip out", size: 20, color: "f", anchor: "middle" },
        ],
        sr: "The pump opening outward.",
      },
    },
    {
      title: "link board · seated cords (white), a focused cord",
      card: {
        kind: "link_board",
        slot: 0,
        title: "PUMP SOCKETS",
        lefts: e8.lefts.map((l) => ({ key: l.key, label: l.text })),
        rights: e8.rights.map((r) => ({ key: r.key, label: r.text, sub: null })),
        links: [
          { leftKey: "l0", rightKey: "r0", state: "seated" },
          { leftKey: "l2", rightKey: "r2", state: "focus" },
        ],
        sr: "Two of four sockets connected.",
      },
      h: 420,
    },
    {
      title: "claims · idle, hover, aimed",
      card: {
        kind: "claims",
        slot: 0,
        title: "CLAIMS",
        scenario: null,
        items: e3.chests.map((c, i) => ({ key: String(c.statementIndex), letter: "ABC"[i], text: c.text, glyph: null, state: i === 0 ? "hover" : i === 1 ? "aimed" : "idle" })),
        sr: "Three claims; B is aimed.",
      },
      h: 360,
    },
    {
      title: "slot rail · heading, lamps, pylons (civil e9)",
      card: {
        kind: "slot_rail",
        slot: 0,
        title: "BRIDGE BAYS",
        heading: "AS PRINTED IN CH. 21",
        slots: [0, 1, 2, 3].map((i) => ({ index: i, key: i < 2 ? e9.planks[i].key : null, label: i < 2 ? e9.planks[i].text : null, lamp: i < 2 ? "on" : "off" })),
        anchorsRight: 2,
        sr: "Two of four bays filled.",
      },
      h: 420,
    },
    {
      title: "matrix · strikes, accused, struck-count shading (civil e12)",
      card: {
        kind: "matrix",
        slot: 0,
        title: "TUMBLERS",
        clues: e12.clues.map((c) => ({ index: c.index, text: c.text, date: null })),
        hypotheses: e12.hypotheses,
        marks: [
          { clueIndex: 0, hypothesisId: e12.hypotheses[2].id },
          { clueIndex: 1, hypothesisId: e12.hypotheses[0].id },
          { clueIndex: 2, hypothesisId: e12.hypotheses[0].id },
        ],
        accused: e12.hypotheses[3].id,
        shadeCounts: true,
        sr: "Four explanations, three strikes.",
      },
      h: 560,
    },
    { title: "energy cells · spent, projected, chip", card: { kind: "energy_cells", slot: 0, title: "ATP", total: 12, spent: 3, projected: 2, sr: "12 cells, 3 spent, 2 projected." }, h: 150 },
    {
      title: "document · with stamp (civil e7)",
      card: { kind: "document", slot: 0, title: "PROGRAM", body: ["MARCH ON WASHINGTON FOR JOBS AND FREEDOM · AUGUST 28, 1963", ...e7.lefts.map((l) => `${l.text}: ______`)].join("\n"), stamp: "ARCHIVED", sr: "The march program." },
      h: 380,
    },
    {
      title: "cause graph · tubes (civil e5)",
      card: {
        kind: "cause_graph",
        slot: 0,
        title: "RELAY LINE",
        nodes: e5.nodes.map((n, i) => ({ key: n.key, label: n.text, x: nodePos[i % 6][0], y: nodePos[i % 6][1] })),
        edges: [
          { fromKey: e5.nodes[3].key, toKey: e5.nodes[1].key, state: "draft" },
          { fromKey: e5.nodes[1].key, toKey: e5.nodes[2].key, state: "focus" },
        ],
        sr: "Two of four tubes laid.",
      },
      h: 420,
    },
  ];
}

function CardsPage({ games }: { games: GalleryGame[] }) {
  const cards = useMemo(() => galleryCards(games), [games]);
  const [picked, setPicked] = useState<string | null>("o1");
  const [cols, setCols] = useState([
    { key: "a", label: "x = 3.5", value: 2 },
    { key: "b", label: "x = 5", value: 0 },
    { key: "c", label: "x = 6.5", value: -1 },
  ]);
  const stageStops = rangeOfProbe(probeOf(BINDINGS.cell.e8_pump)!);
  const [stage, setStage] = useState(3);
  return (
    <div style={{ position: "relative", padding: "24px 24px 60px 60px", background: "var(--ui-panel-solid)", minHeight: "100vh" }}>
      <HexGrid />
      <PanelScope style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(620px, 1fr))", rowGap: 48, columnGap: 170, paddingLeft: 110 }}>
        {cards.map((c, i) => (
          <figure key={i} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 14 }} data-testid={`gallery-card-${c.card.kind}`}>
            <figcaption className="xp-caps">{c.title}</figcaption>
            <div style={{ position: "relative", height: c.h ?? 260, display: "flex", flexDirection: "column" }}>
              <CardView card={c.card} chips={c.chips ?? []} />
            </div>
          </figure>
        ))}
        <figure style={{ margin: 0 }} data-testid="gallery-parts">
          <figcaption className="xp-caps" style={{ marginBottom: 14 }}>
            parts · back tab, trace lines, chips, Verify, success badge
          </figcaption>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, position: "relative", paddingLeft: 60 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <BackTab onBack={() => undefined} />
              <BackTab onBack={() => undefined} done />
            </div>
            <TraceLine start="ring" end="dots" />
            <div style={{ position: "relative", height: 60 }}>
              <ValueChip text="0.83π" color="f" top={30} />
              <div style={{ position: "absolute", left: 120, top: 30 }}>
                <ValueChip text="−2.4" color="g" top={0} />
              </div>
              <div style={{ position: "absolute", left: 250, top: 30 }}>
                <ValueChip text="1957" color="h" top={0} />
              </div>
            </div>
            <VerifyButton label="LOCK THE RINGS" enabled onVerify={() => undefined} />
            <VerifyButton label="VERIFY GATE" enabled={false} onVerify={() => undefined} />
            <SuccessBadge text="PATCH SUCCESSFUL" />
          </div>
        </figure>
        <figure style={{ margin: 0 }}>
          <figcaption className="xp-caps" style={{ marginBottom: 30 }}>
            scrubber · probe with stage stops (cell e8), readout &quot;stage 3 · flip out&quot;
          </figcaption>
          <div style={{ paddingLeft: 240, position: "relative" }}>
            <Scrubber range={stageStops} value={stage} symbol="k" label="pump stage" probe={probeOf(BINDINGS.cell.e8_pump)} onChange={(v) => setStage(v)} testId="gallery-scrubber" />
          </div>
        </figure>
        <figure style={{ margin: 0, display: "flex", gap: 40, alignItems: "flex-start" }}>
          <div>
            <figcaption className="xp-caps" style={{ marginBottom: 14 }}>
              orb palette (bible §3.6)
            </figcaption>
            <OrbPalette
              columns={3}
              orbs={ORB_FILLS.map((fill, i) => ({ key: `o${i}`, fill, label: `${fill} orb`, placed: i === 4 }))}
              picked={picked}
              onPick={setPicked}
              onPencil={() => undefined}
            />
          </div>
          <div>
            <figcaption className="xp-caps" style={{ marginBottom: 14 }}>
              slider columns (§3.7)
            </figcaption>
            <ColumnSliders columns={cols} min={-3} max={3} step={0.5} onChange={(k, v) => setCols((cs) => cs.map((c) => (c.key === k ? { ...c, value: v } : c)))} />
          </div>
        </figure>
        <figure style={{ margin: 0, height: 360 }}>
          <figcaption className="xp-caps" style={{ marginBottom: 14 }}>
            brief sheet (vault column, (i) sheet)
          </figcaption>
          <BriefSheet brief={{ prompt: games[2].stations[11].prompt, plaque: "The Editor keeps the story that was never printed.", hints: games[2].stations[11].hints.slice(0, 2) }} warm />
        </figure>
      </PanelScope>
    </div>
  );
}

// ---------------------------------------------------------------- shell

export function PanelGallery({ games, initial }: { games: GalleryGame[]; initial: GalleryQuery }) {
  const [query, setQueryState] = useState<GalleryQuery>(initial);
  const setQuery = useCallback((patch: Partial<GalleryQuery>) => {
    setQueryState((q) => {
      const next = { ...q, ...patch };
      if (typeof window !== "undefined") {
        const u = new URL(window.location.href);
        u.searchParams.set("game", next.game);
        if (next.enc) u.searchParams.set("enc", next.enc);
        else u.searchParams.delete("enc");
        u.searchParams.set("view", next.view);
        if (next.aid) u.searchParams.set("aid", String(next.aid));
        else u.searchParams.delete("aid");
        if (next.slate) u.searchParams.set("slate", "1");
        else u.searchParams.delete("slate");
        u.searchParams.delete("value");
        u.searchParams.delete("solved");
        window.history.replaceState(null, "", u.toString());
      }
      return next;
    });
  }, []);
  const game = games.find((g) => g.key === query.game) ?? games[0];
  const station = game.stations.find((s) => s.encounterId === query.enc) ?? game.stations[0];

  if (query.view === "cards") {
    return (
      <main data-testid="panel-gallery" style={{ minHeight: "100vh", background: "#0B1F27" }}>
        {!query.full ? <Nav games={games} query={query} onQuery={setQuery} /> : null}
        <CardsPage games={games} />
      </main>
    );
  }
  return (
    <main data-testid="panel-gallery" style={{ minHeight: "100vh", background: "#0B1F27", color: "#fff" }}>
      {!query.full ? <Nav games={games} query={query} onQuery={setQuery} /> : null}
      <Stage key={`${game.key}-${station.encounterId}-${query.aid}-${query.slate}`} game={game} station={station} stations={game.stations} query={query} onQuery={setQuery} />
      {!query.full ? (
        <nav aria-label="Stations" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 16 }}>
          {game.stations.map((s) => {
            const b = BINDINGS[game.key][s.encounterId];
            return (
              <button
                key={s.encounterId}
                type="button"
                className="xp-token"
                aria-pressed={s.encounterId === station.encounterId}
                onClick={() => setQuery({ enc: s.encounterId })}
                style={{ fontSize: 18 }}
              >
                {s.encounterId} · {b?.contraption ?? "console_slate"} · {s.modeKey}
              </button>
            );
          })}
        </nav>
      ) : null}
    </main>
  );
}

function Nav({ games, query, onQuery }: { games: GalleryGame[]; query: GalleryQuery; onQuery: (q: Partial<GalleryQuery>) => void }) {
  return (
    <nav aria-label="Gallery" style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 16px", background: "#0F2A33", borderBottom: "1px solid #3B7682" }}>
      <strong style={{ fontSize: 18, letterSpacing: "0.12em", marginRight: 12, color: "#fff" }}>PANEL GALLERY (dev)</strong>
      {games.map((g) => (
        <button key={g.key} type="button" className="xp-token" aria-pressed={query.view === "stage" && query.game === g.key} onClick={() => onQuery({ game: g.key, enc: g.stations[0].encounterId, view: "stage" })} style={{ fontSize: 18 }}>
          {g.title}
        </button>
      ))}
      <button type="button" className="xp-token" aria-pressed={query.view === "cards"} onClick={() => onQuery({ view: "cards" })} style={{ fontSize: 18 }}>
        Every card and part
      </button>
    </nav>
  );
}
