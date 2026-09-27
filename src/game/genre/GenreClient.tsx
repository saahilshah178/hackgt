"use client";
/* eslint-disable react-hooks/refs --
   EncounterRunner is a plain, non-reactive class held in a ref so its identity survives re-renders. Every mutating
   call (focus/submit/hint/skipTo/autoSolve) is paired with an explicit `bump()`, so React re-renders after a change;
   reading it during render is intentional, as in LegacyGameClient. */

import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { Genre } from "../../contracts/common";
import type { GameSpec } from "../../contracts/gamespec";
import { describeAnswer } from "../describe-answer";
import { installGameDebug, type GameDebugHandle } from "../debug";
import { getPalette } from "../engine/palettes";
import { EncounterRunner, type Current } from "../runner/encounter-runner";
import { EndScreen } from "../systems/EndScreen";
import { MasteryHud } from "../systems/MasteryHud";
import { ChallengePanel, type ChallengeResult, type ChallengeTeach } from "./ChallengePanel";
import { BookIcon, FieldGuide } from "./teach/FieldGuide";
import { conceptsToTeach, lessonMap } from "./teach/lessons";
import { TEACH_CSS } from "./teach/teach.styles";
import type { BoardHostHandle, BoardHostProps, LastResult } from "./types";

/*
 * GenreClient: the client for the board genres (BOARD_GENRES). It replaces the legacy "walk right until a socket,
 * then a modal widget" loop with a free-order runner: the host shows every unlocked encounter in its own terms and
 * the player chooses where to go next. See ./types.ts for the host contract.
 */

type HostComponent = ComponentType<BoardHostProps & { hostRef?: (h: BoardHostHandle | null) => void }>;

const HOSTS: Partial<Record<Genre, HostComponent>> = {
  puzzle: lazy(() => import("./hosts/puzzle/PuzzleHost").then((m) => ({ default: m.PuzzleHost as HostComponent }))),
  strategy: lazy(() => import("./hosts/cozy/CozyHost").then((m) => ({ default: m.CozyHost as HostComponent }))),
  explorer: lazy(() => import("./hosts/explorer/ExplorerHost").then((m) => ({ default: m.ExplorerHost as HostComponent }))),
  story: lazy(() => import("./hosts/story/StoryHost").then((m) => ({ default: m.StoryHost as HostComponent }))),
  mystery: lazy(() => import("./hosts/casefile/CasefileHost").then((m) => ({ default: m.CasefileHost as HostComponent }))),
};

/** Relative luminance of a #rrggbb colour (WCAG). */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Ink for text sitting directly on `bg`: the palette's light text on dark backgrounds, dark ink on light ones (parchment). */
export function inkOn(bg: string, light: string): string {
  return luminance(bg) > 0.4 ? "#2a1d12" : light;
}

export function hasBoardHost(genre: Genre): boolean {
  return HOSTS[genre] !== undefined;
}

export function GenreClient({ spec }: { spec: GameSpec }) {
  const runnerRef = useRef<EncounterRunner | null>(null);
  if (!runnerRef.current) runnerRef.current = new EncounterRunner(spec, { order: "free" });
  const runner = runnerRef.current;
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const palette = useMemo(() => getPalette(spec.theme.paletteId), [spec.theme.paletteId]);
  const hostHandle = useRef<BoardHostHandle | null>(null);
  // the open challenge, snapshotted at open() so the panel keeps its encounter after a correct submit moves the runner on
  const [active, setActive] = useState<Current | null>(null);
  const activeId = active?.encounter.id ?? null;
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [lastHint, setLastHint] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [ended, setEnded] = useState(false);
  const seq = useRef(0);

  // ---- teaching (./teach): session-only, never persisted. Refs, like the runner, because the debug handle installed
  // once on mount calls open()/autoSolve() through its first-render closures.
  const lessons = useMemo(() => lessonMap(spec), [spec]);
  const taughtRef = useRef<Set<string>>(new Set());
  /** the concepts the open challenge teaches first (snapshot at open; shrinks as the player reads) */
  const planRef = useRef<string[]>([]);
  const [guide, setGuide] = useState<{ open: boolean; focus: string | null }>({ open: false, focus: null });
  const learn = (conceptId: string) => {
    taughtRef.current.add(conceptId);
    bump();
  };
  const openGuide = (conceptId: string | null) => setGuide({ open: true, focus: conceptId });

  const open = (id: string) => {
    if (runner.finished || !runner.available().includes(id)) return;
    runner.focus(id);
    const cur = runner.peek(id);
    planRef.current = cur ? conceptsToTeach(cur.encounter, taughtRef.current, spec) : [];
    setActive(cur);
    setResult(null);
    setLastHint(null);
    bump();
  };
  const close = () => {
    runner.unfocus();
    setActive(null);
    setResult(null);
    setLastHint(null);
    bump();
  };
  const submit = (input: unknown) => {
    const cur = runner.current();
    if (!cur || !active || cur.encounter.id !== active.encounter.id || runner.focused !== active.encounter.id) return;
    const g = runner.submit(input);
    setResult({ correct: g.correct, feedback: g.feedback, yourAnswer: describeAnswer(cur.encounter.mode, cur.view, input) });
    setLastResult({ encounterId: cur.encounter.id, correct: g.correct, seq: ++seq.current });
    bump();
  };
  const hint = () => {
    const h = runner.hint();
    if (h) setLastHint(h);
    bump();
  };

  // window.__GAME_DEBUG__: the legacy shape (state/skipTo/autoSolve/events/mastery) plus `board` for free order.
  useEffect(() => {
    // `board` also carries the teaching hooks (beyond BoardDebugApi in ../debug.ts): lesson() = concept ids still to
    // read before the open challenge, dismissLesson() = read them all, taught() = concepts taught this session
    const board = {
      available: () => runner.available(),
      solved: () => [...runner.solved()],
      active: () => runner.focused,
      open: (id: string) => open(id),
      lesson: () => planRef.current.filter((c) => !taughtRef.current.has(c)),
      dismissLesson: () => {
        for (const c of planRef.current) taughtRef.current.add(c);
        bump();
      },
      taught: () => [...taughtRef.current],
    };
    const handle: GameDebugHandle = {
      state: () => {
        const cur = runner.finished ? null : runner.current();
        return { finished: runner.finished, index: cur ? cur.index : spec.encounters.length, encounterId: cur?.encounter.id ?? null, mastery: runner.mastery() };
      },
      skipTo: (encounterId) => {
        runner.skipTo(encounterId);
        // the debug jump lands on the challenge itself (no lesson step)
        planRef.current = [];
        setActive(runner.peek(encounterId));
        setResult(null);
        hostHandle.current?.warpTo?.(encounterId);
        bump();
      },
      autoSolve: () => {
        if (runner.finished) {
          setEnded(true);
          return;
        }
        const cur = runner.current();
        if (!cur) return;
        if (runner.focused !== cur.encounter.id) runner.focus(cur.encounter.id);
        hostHandle.current?.warpTo?.(cur.encounter.id);
        const g = runner.autoSolve();
        // autoSolve skips the lesson step; count its concepts as taught so the Field Guide reflects the run
        for (const c of cur.encounter.conceptIds) taughtRef.current.add(c);
        planRef.current = [];
        setLastResult({ encounterId: cur.encounter.id, correct: g.correct, seq: ++seq.current });
        setActive(null);
        setResult(null);
        // the debug path skips the host's finale so smoke tests reach the end screen like every other host
        if (runner.finished) setEnded(true);
        bump();
      },
      events: () => runner.telemetry(),
      mastery: () => runner.mastery(),
      board,
    };
    return installGameDebug(handle) ?? undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // G opens the Field Guide from anywhere on the board (never while typing; inside the guide, G closes it)
  const activeConcepts = active?.encounter.conceptIds;
  useEffect(() => {
    if (ended) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "g" && e.key !== "G") return;
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      setGuide({ open: true, focus: activeConcepts?.[0] ?? null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ended, activeConcepts]);

  if (ended) {
    const { mastery, lines } = runner.debrief();
    return <EndScreen gameId={spec.id} title={spec.title} outro={spec.narrative.outro} mastery={mastery} lines={lines} telemetry={runner.telemetry()} />;
  }

  const Host = HOSTS[spec.genre];
  const teach: ChallengeTeach = {
    lessons,
    plan: planRef.current,
    pending: planRef.current.filter((c) => !taughtRef.current.has(c)),
    onLearned: learn,
    onReview: (conceptId) => openGuide(conceptId),
  };
  const challenge = active ? (
    <ChallengePanel
      key={active.encounter.id}
      spec={spec}
      palette={palette}
      current={active}
      hintsUsed={runner.hintsUsedOn(active.encounter.id)}
      lastHint={lastHint}
      result={result}
      onHint={hint}
      onSubmit={submit}
      onContinue={close}
      onRetry={() => setResult(null)}
      onClose={close}
      teach={teach}
    />
  ) : null;

  const masteryConcepts = spec.concepts.map((c) => ({ id: c.id, name: c.name, score: runner.mastery()[c.id]?.score ?? 0 }));

  return (
    <div
      className="flex min-h-screen flex-col gap-2 px-3 pb-3 pt-2"
      style={{ background: palette.css.background, color: inkOn(palette.css.background, palette.css.text), ["--tg-accent" as string]: palette.css.accent }}
      data-testid="board-client"
      data-genre={spec.genre}
    >
      <style>{TEACH_CSS}</style>
      {/* compact header: the hosts need the vertical space; mastery opens as a dropdown over the board */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold" style={{ fontSize: 24 }}>
          {spec.title}
        </h1>
        <div className="flex items-center gap-4">
          <p className="text-lg" style={{ fontSize: 18 }} data-testid="board-progress">
            {runner.solved().size} / {spec.encounters.length} solved
          </p>
          <button
            type="button"
            onClick={() => openGuide(active?.encounter.conceptIds[0] ?? null)}
            data-testid="field-guide-button"
            aria-haspopup="dialog"
            aria-keyshortcuts="G"
            className="tg-guide-btn rounded-md border px-3 py-1 text-base font-semibold hover:opacity-80 focus-visible:outline-2"
            style={{ borderColor: "currentColor", fontSize: 18 }}
          >
            <BookIcon /> Field guide <kbd aria-hidden>G</kbd>
          </button>
          <details className="relative">
            <summary className="cursor-pointer rounded-md border px-3 py-1 text-base focus-visible:outline-2" style={{ borderColor: "currentColor" }}>
              Mastery
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border p-3 shadow-xl" style={{ background: "#14161c", color: "#f5f3ee", borderColor: palette.css.accent }}>
              <MasteryHud concepts={masteryConcepts} />
            </div>
          </details>
          {runner.finished && (
            <button
              type="button"
              onClick={() => setEnded(true)}
              data-testid="board-finish"
              className="rounded-md px-4 py-1 text-base font-bold hover:opacity-90 focus-visible:outline-2"
              style={{ background: palette.css.accent, color: inkOn(palette.css.accent, "#ffffff") }}
            >
              See your results
            </button>
          )}
        </div>
      </header>
      {Host ? (
        <Suspense fallback={<p role="status" style={{ fontSize: 20 }}>Loading…</p>}>
          <Host
            hostRef={(h) => (hostHandle.current = h)}
            spec={spec}
            palette={palette}
            progression={runner.progression}
            solved={runner.solved()}
            available={runner.available()}
            activeId={activeId}
            lastResult={lastResult}
            finished={runner.finished}
            mastery={runner.mastery()}
            open={open}
            close={close}
            challenge={challenge}
            complete={() => setEnded(true)}
            peek={(id) => runner.peek(id)}
            attemptsOn={(id) => runner.attemptsOn(id)}
          />
        </Suspense>
      ) : (
        <p role="alert">No host for genre {spec.genre}.</p>
      )}
      <FieldGuide
        spec={spec}
        open={guide.open}
        focusConceptId={guide.focus}
        current={active?.encounter.conceptIds ?? []}
        taught={taughtRef.current}
        onClose={() => setGuide((g) => (g.open ? { open: false, focus: g.focus } : g))}
      />
    </div>
  );
}
