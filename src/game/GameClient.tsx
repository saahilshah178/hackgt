"use client";
/* eslint-disable react-hooks/refs --
   EncounterRunner is a plain, non-reactive class (LIBRARY: "pure logic, no Phaser"), held in a ref so
   its identity survives re-renders. Every mutating call (submit/hint/skipTo/autoSolve) is paired with
   an explicit `bump()` state update, so React always re-renders after a change; reading it during
   render is intentional, not stale. */
/* eslint-disable react-hooks/static-components --
   `Widget` is a lookup into WIDGET_REGISTRY (src/game/widgets/registry.ts), a stable map of module-level
   component references; getWidget() never creates a new component type. */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { GameSpec } from "../contracts/gamespec";
import type { WorldOverlay } from "../contracts/world";
import type { WorldSource } from "../world/types";
import { getPalette } from "./engine/palettes";
import { installGameDebug, type GameDebugHandle } from "./debug";
import { buildRooms, type HostHandle } from "./hosts/types";
import { chunkById } from "../library/genres";
import { PlayHost } from "./hosts/PlayHost";
import { EncounterRunner } from "./runner/encounter-runner";
import { widgetFor } from "./widgets/registry";
import { HintPanel } from "./systems/HintPanel";
import { ConsequenceOverlay } from "./systems/ConsequenceOverlay";
import { MasteryHud } from "./systems/MasteryHud";
import { EndScreen } from "./systems/EndScreen";
import { describeAnswer } from "./describe-answer";
import { BOARD_GENRES } from "../library/genres";
import { GenreClient } from "./genre/GenreClient";

type Phase = "walking" | "widget" | "consequence" | "finished";

interface ConsequenceState {
  correct: boolean;
  feedback: string;
  yourAnswer?: string;
  /** The mode just cleared, so a correct continue can trigger the host's in-world celebration. */
  mode: string;
}

// ---- Expedition (docs/design/20 §2.1, H2): a resolved world plays in ExpeditionClient, loaded lazily so legacy games
// never fetch it. `?host=legacy` forces the legacy client below, which is the pre-Expedition GameClient unchanged.
const ExpeditionEntry = lazy(() => import("./expedition/client/ExpeditionEntry"));

export interface GameClientProps {
  spec: GameSpec;
  /** the side-car or spec world the play page resolved (plain JSON); null: the legacy host */
  world?: WorldOverlay | null;
  worldSource?: WorldSource | null;
  /** EXPEDITION_SFX ≠ off */
  sfx?: boolean;
}

function legacyRequested(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("host") === "legacy";
  } catch {
    return false;
  }
}

export function GameClient({ spec, world = null, worldSource = null, sfx = true }: GameClientProps) {
  const [legacy] = useState(legacyRequested);
  // Board genres (mystery, puzzle, strategy, explorer, story) progress non-linearly in their own hosts; `?host=legacy`
  // still reaches the pre-board hosts (the legacy MysteryHost, the DOM fallback).
  if (!legacy && (!world || !worldSource) && BOARD_GENRES.includes(spec.genre)) return <GenreClient spec={spec} />;
  if (!world || !worldSource || legacy) return <LegacyGameClient spec={spec} />;
  return (
    <Suspense
      fallback={
        <div role="status" className="flex min-h-screen items-center justify-center text-lg" style={{ fontSize: 20 }}>
          Loading the expedition…
        </div>
      }
    >
      <ExpeditionEntry spec={spec} world={world} source={worldSource} sfx={sfx} />
    </Suspense>
  );
}

/** The pre-Expedition client (genre hosts + widget overlay), byte-for-byte; `?host=legacy` and world-less specs. */
export function LegacyGameClient({ spec }: { spec: GameSpec }) {
  const runnerRef = useRef<EncounterRunner | null>(null);
  if (!runnerRef.current) runnerRef.current = new EncounterRunner(spec);
  const runner = runnerRef.current;

  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const [phase, setPhase] = useState<Phase>("walking");
  const [consequence, setConsequence] = useState<ConsequenceState | null>(null);
  const [lastHint, setLastHint] = useState<string | null>(null);
  const [liveValue, setLiveValueState] = useState<unknown>(undefined);

  const hostRef = useRef<HostHandle>(null);
  const palette = useMemo(() => getPalette(spec.theme.paletteId), [spec.theme.paletteId]);
  const rooms = useMemo(() => buildRooms(spec, chunkById), [spec]);

  const current = runner.finished ? null : runner.current();
  const widgetId = current?.mode.widget;
  const currentView = current?.view;
  const Widget = useMemo(() => (widgetId ? widgetFor(widgetId, currentView) : undefined), [widgetId, currentView]);

  const onReachSocket = (encounterId: string) => {
    if (runner.finished) return;
    const cur = runner.current();
    if (!cur || cur.encounter.id !== encounterId) return;
    setLastHint(null);
    setPhase("widget");
  };

  const onWidgetSubmit = (input: unknown) => {
    const cur = runner.current();
    if (!cur) return;
    const g = runner.submit(input);
    bump();
    setConsequence({ correct: g.correct, feedback: g.feedback, yourAnswer: describeAnswer(cur.encounter.mode, cur.view, input), mode: cur.encounter.mode });
    setPhase("consequence");
  };

  const onContinueConsequence = () => {
    const wasCorrect = consequence?.correct ?? false;
    if (wasCorrect && consequence) hostRef.current?.celebrate?.(consequence.mode);
    setConsequence(null);
    if (wasCorrect) {
      setPhase(runner.finished ? "finished" : "walking");
      hostRef.current?.setLiveValue?.(undefined);
    } else {
      setPhase("widget");
    }
  };

  const onRequestHint = () => {
    const h = runner.hint();
    if (h) setLastHint(h);
    bump();
  };

  const onWidgetLive = (value: number) => {
    setLiveValueState(value);
    hostRef.current?.setLiveValue?.(value);
  };

  // window.__GAME_DEBUG__ — installed regardless of which host is mounted (or whether Phaser booted).
  useEffect(() => {
    const handle: GameDebugHandle = {
      state: () => ({
        finished: runner.finished,
        index: runner.finished ? spec.encounters.length : runner.current()!.index,
        encounterId: runner.finished ? null : runner.current()!.encounter.id,
        mastery: runner.mastery(),
      }),
      skipTo: (encounterId) => {
        runner.skipTo(encounterId);
        setConsequence(null);
        setPhase(runner.finished ? "finished" : "walking");
        hostRef.current?.warpTo(encounterId);
        bump();
      },
      autoSolve: () => {
        if (runner.finished) return;
        const cur = runner.current();
        if (!cur) return;
        hostRef.current?.warpTo(cur.encounter.id);
        runner.autoSolve(); // always answers correctly and advances the runner
        setConsequence(null);
        setPhase(runner.finished ? "finished" : "walking");
        bump();
      },
      events: () => runner.telemetry(),
      mastery: () => runner.mastery(),
    };
    return installGameDebug(handle) ?? undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "finished" || runner.finished) {
    const { mastery, lines } = runner.debrief();
    return <EndScreen gameId={spec.id} title={spec.title} outro={spec.narrative.outro} mastery={mastery} lines={lines} telemetry={runner.telemetry()} />;
  }

  if (!current) return null;
  const masteryConcepts = spec.concepts.map((c) => ({ id: c.id, name: c.name, score: runner.mastery()[c.id]?.score ?? 0 }));

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4" style={{ background: palette.css.background, color: palette.css.text }}>
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold" style={{ fontSize: 24 }}>
          {spec.title}
        </h1>
        <div className="w-64">
          <MasteryHud concepts={masteryConcepts} />
        </div>
      </header>

      <PlayHost ref={hostRef} spec={spec} rooms={rooms} palette={palette} frozen={phase !== "walking"} onReachSocket={onReachSocket} />

      {phase === "widget" && Widget && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-xl p-4" style={{ background: "color-mix(in oklab, currentColor 6%, transparent)" }}>
          <p className="text-lg" style={{ fontSize: 18 }} data-testid="encounter-prompt">
            {current.encounter.prompt}
          </p>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1" data-testid="widget-root">
              <Widget view={current.view} onSubmit={onWidgetSubmit} onLive={onWidgetLive} />
            </div>
            <HintPanel
              before={current.before}
              hintsUsed={runner.hintsUsedOnCurrent}
              hintsAvailable={current.encounter.hints.length}
              lastHint={lastHint}
              onRequestHint={onRequestHint}
            />
          </div>
        </div>
      )}

      {phase === "consequence" && consequence && (
        <ConsequenceOverlay
          correct={consequence.correct}
          feedback={consequence.feedback}
          yourAnswer={consequence.yourAnswer}
          after={consequence.correct ? current.after : undefined}
          onContinue={onContinueConsequence}
        />
      )}
      {/* liveValue is only consumed by the host (via hostRef.setLiveValue); referenced here to satisfy lint. */}
      <span className="sr-only">{typeof liveValue === "number" ? liveValue.toFixed(2) : ""}</span>
    </div>
  );
}
