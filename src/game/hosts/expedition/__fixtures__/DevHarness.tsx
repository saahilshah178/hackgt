"use client";
/**
 * __fixtures__/DevHarness.tsx (H1) — the /dev/expedition harness: mounts the dev world on the Expedition host (WebGL,
 * or the reduced DOM host with `?renderer=dom`) with a minimal stand-in for the client (H2): E at the current console
 * opens a fake panel (layout scrub/board/vault, frozen, focus moves into a `[data-panel]` region with a slider and a text
 * field: the D4 keyboard check), Solve/Fail resolve the station, the progress prop advances, and a Skip button ends
 * cutscenes. `window.__DEV_EXPEDITION__` exposes the same actions for Playwright. Dev-only.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Diagnosis } from "../../../../world/types";
import type { HostEvent, HostHandle, InteractTarget, LayoutState } from "../../types";
import { PALETTES } from "../../../engine/palettes";
import { ExpeditionHost } from "../ExpeditionHost";
import { EMPTY_WORLD_STATE } from "../scene/requirements";
import { devWorld } from "./dev-world";

const WRONG: Diagnosis = { correct: false, feedback: "Not yet.", displayFeedback: "Not yet.", failKey: null, wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [] };
const RIGHT: Diagnosis = { ...WRONG, correct: true, feedback: "Correct.", displayFeedback: "Correct." };
const EXPLORE: LayoutState = { mode: "explore", safeRect: { x: 0, y: 0, w: 0, h: 0 }, focus: null };

type DevWindow = Window & { __DEV_EXPEDITION__?: Record<string, unknown> };

export default function DevHarness() {
  const { spec, world } = useMemo(() => devWorld(), []);
  const hostRef = useRef<HostHandle>(null);
  const [solvedIds, setSolved] = useState<string[]>([]);
  const currentId = spec.encounters.find((e) => !solvedIds.includes(e.id))?.id ?? null;
  const progress = useMemo(() => ({ solvedIds, currentId }), [solvedIds, currentId]);
  const [layout, setLayout] = useState<LayoutState>(EXPLORE);
  const [cutscene, setCutscene] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [slider, setSlider] = useState(50);
  const [text, setText] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<HostEvent[]>([]);
  const frozen = layout.mode !== "explore" || cutscene !== null;

  const log = (s: string) => setEvents((ev) => [s, ...ev].slice(0, 6));
  const openPanel = (encounterId: string) => {
    const st = world.stationByEncounter.get(encounterId);
    const mode = st?.layout ?? "scrub";
    const w = window.innerWidth;
    const safeW = mode === "board" ? Math.round(w * 0.45) : mode === "vault" ? w : Math.round(w * 0.58);
    setLayout({ mode, safeRect: { x: 0, y: 0, w: safeW, h: window.innerHeight }, focus: { kind: "station", encounterId } });
    setTimeout(() => panelRef.current?.querySelector<HTMLElement>("input[type=range]")?.focus(), 0);
  };
  const closePanel = () => setLayout(EXPLORE);
  const resolve = async (correct: boolean) => {
    const id = layout.focus?.kind === "station" ? layout.focus.encounterId : currentId;
    if (!id) return;
    await hostRef.current?.resolveEncounter?.(id, correct ? RIGHT : WRONG);
    if (correct) {
      setSolved((s) => (s.includes(id) ? s : [...s, id]));
      closePanel();
    }
  };
  const onInteract = (t: InteractTarget) => {
    log(`interact ${t.kind}`);
    if (t.kind === "station" && t.encounterId === currentId) openPanel(t.encounterId);
  };
  const onHostEvent = (e: HostEvent) => {
    eventsRef.current = [...eventsRef.current, e].slice(-200);
    if (e.type === "cutscene") setCutscene(e.state === "start" ? e.id : null);
    if (e.type !== "load_progress" && e.type !== "near") log(e.type === "cutscene" ? `cutscene ${e.id} ${e.state}` : e.type);
    if (e.type === "back") closePanel();
  };

  const actionsRef = useRef({ openPanel, closePanel, resolve, setSolved });
  // the latest handlers for window.__DEV_EXPEDITION__ (refreshed after every render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void (actionsRef.current = { openPanel, closePanel, resolve, setSolved }));
  useEffect(() => {
    const w = window as DevWindow;
    w.__DEV_EXPEDITION__ = {
      openPanel: (id?: string) => actionsRef.current.openPanel(id ?? spec.encounters.find((e) => !document.body.dataset.devSolved?.split(",").includes(e.id))?.id ?? ""),
      closePanel: () => actionsRef.current.closePanel(),
      solve: () => actionsRef.current.resolve(true),
      fail: () => actionsRef.current.resolve(false),
      setSolved: (ids: string[]) => actionsRef.current.setSolved(ids),
      events: () => eventsRef.current,
      host: () => hostRef.current,
    };
    return () => {
      delete w.__DEV_EXPEDITION__;
    };
  }, [spec]);
  useEffect(() => {
    document.body.dataset.devSolved = solvedIds.join(",");
  }, [solvedIds]);

  const btn: React.CSSProperties = { fontSize: 18, padding: "8px 14px", borderRadius: 8, border: "2px solid #9FE6F2", background: "#0F2A33", color: "#fff", cursor: "pointer" };
  return (
    <main style={{ position: "fixed", inset: 0, background: "#0B1F27", color: "#fff" }}>
      <h1 style={{ position: "absolute", left: 16, top: 8, zIndex: 20, fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8, margin: 0 }}>Dev Expedition</h1>
      <div style={{ position: "absolute", inset: 0 }}>
        <ExpeditionHost
          ref={hostRef}
          spec={spec}
          rooms={[]}
          palette={Object.values(PALETTES)[0]}
          frozen={frozen}
          onReachSocket={() => {}}
          world={world}
          progress={progress}
          layout={layout}
          worldState={EMPTY_WORLD_STATE}
          meterValue={Math.round((solvedIds.length / spec.encounters.length) * 100)}
          onInteract={onInteract}
          onHostEvent={onHostEvent}
          onSay={(req) => log(`say ${req.lines[0]?.text.slice(0, 40) ?? ""}`)}
        />
      </div>
      <nav aria-label="Dev controls" style={{ position: "absolute", left: 96, bottom: 16, zIndex: 20, display: "flex", gap: 8, flexWrap: "wrap", maxWidth: "55vw" }}>
        <button type="button" style={btn} onClick={() => hostRef.current?.playCutscene?.("dev_intro")} data-testid="dev-intro">Intro</button>
        {cutscene && (
          <button type="button" style={btn} onClick={() => hostRef.current?.skipCutscene?.()} data-testid="cutscene-skip">Skip</button>
        )}
        <button type="button" style={btn} onClick={() => currentId && hostRef.current?.warpTo(currentId)} data-testid="dev-warp">Warp to current</button>
        <button type="button" style={btn} onClick={() => currentId && openPanel(currentId)} data-testid="dev-open">Open panel</button>
        <span style={{ fontSize: 18, alignSelf: "center" }} data-testid="dev-current">
          current: {currentId ?? "done"} · solved {solvedIds.length}/{spec.encounters.length}
        </span>
      </nav>
      <ol aria-label="Host events" style={{ position: "absolute", left: 16, top: 40, zIndex: 20, fontSize: 18, margin: 0, paddingLeft: 20, opacity: 0.85, pointerEvents: "none" }}>
        {events.map((e, i) => (
          <li key={`${e}:${i}`}>{e}</li>
        ))}
      </ol>
      {layout.mode !== "explore" && (
        <aside
          ref={panelRef}
          data-panel
          data-testid="instrument-panel"
          aria-label="Instrument panel (dev stand-in)"
          style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: layout.mode === "board" ? "55vw" : "42vw", zIndex: 20, background: "rgba(38,92,106,0.86)", backdropFilter: "blur(6px)", padding: 24, display: "flex", flexDirection: "column", gap: 16, fontSize: 20 }}
        >
          <h2 style={{ margin: 0, fontSize: 24 }}>{layout.focus?.kind === "station" ? world.stationByEncounter.get(layout.focus.encounterId)?.objectNoun : "Panel"}</h2>
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            Dial
            <input type="range" min={0} max={100} value={slider} onChange={(e) => setSlider(Number(e.target.value))} data-testid="dev-slider" style={{ width: "100%" }} />
            <span data-testid="dev-slider-value">{slider}</span>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            Note
            <input type="text" value={text} onChange={(e) => setText(e.target.value)} data-testid="dev-text" style={{ fontSize: 20, padding: 8, color: "#000" }} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={btn} onClick={() => void resolve(false)} data-testid="dev-fail">Verify (wrong)</button>
            <button type="button" style={btn} onClick={() => void resolve(true)} data-testid="widget-submit">Verify (right)</button>
            <button type="button" style={btn} onClick={closePanel} data-testid="panel-back">Back</button>
          </div>
          <button type="button" style={btn} onClick={() => layout.focus?.kind === "station" && hostRef.current?.onHint?.(layout.focus.encounterId, 2)} data-testid="dev-hint">Hint (rung 2)</button>
        </aside>
      )}
    </main>
  );
}
