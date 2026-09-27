"use client";
/* eslint-disable react-hooks/refs -- EncounterRunner is a mutable logic engine; mutations explicitly trigger a render. */
/* eslint-disable react-hooks/static-components -- widgetFor returns stable module-level components. */

import { useEffect, useRef, useState } from "react";
import type { GameSpec } from "../../contracts/gamespec";
import { getPalette } from "../engine/palettes";
import { availableEncounters, gardenTurn, INITIAL_GARDEN, playStyle } from "../activity-flow";
import { EncounterRunner } from "../runner/encounter-runner";
import { widgetFor } from "../widgets/registry";
import { EndScreen } from "../systems/EndScreen";
import styles from "./activity.module.css";
import { TopDownMap } from "./TopDownMap";
import { installGameDebug } from "../debug";

const COPY = {
  "top-down": { title: "Atlas", instruction: "Explore the map from above. Choose any open location; solve its task to discover connected knowledge.", action: "Explore" },
  puzzle: { title: "Puzzle workshop", instruction: "Choose an open tile. Build, arrange, connect, or sort its pieces to restore the board.", action: "Work on tile" },
  investigation: { title: "Case desk", instruction: "Inspect an open case file, work with its evidence, and record your findings. Follow leads in any available order.", action: "Investigate" },
  management: { title: "Learning garden", instruction: "Spend water to tend a project. Solving it grows a crop you can harvest. Rest to replenish water; there is no time limit.", action: "Tend project · 1 water" },
  narrative: { title: "Story journal", instruction: "Follow an open story thread. Construct an argument, connect ideas, or rebuild a sequence to write the next part of the story.", action: "Follow thread" },
  "side-view": { title: "Expedition", instruction: "Explore the world.", action: "Explore" },
};

export function ActivityClient({ spec }: { spec: GameSpec }) {
  const runnerRef = useRef<EncounterRunner | null>(null);
  if (!runnerRef.current) runnerRef.current = new EncounterRunner(spec, { openProgression: true });
  const runner = runnerRef.current;
  const firstEncounterId = spec.encounters[0]?.id ?? null;
  const workbenchRef = useRef<HTMLElement | null>(null);
  const [, setRevision] = useState(0);
  // Put the first task on screen immediately. Navigation is available alongside it, rather than
  // making the player discover a distant map marker before the game teaches them how to play.
  const [active, setActive] = useState<string | null>(() =>
    spec.genre === "dungeon" || spec.genre === "puzzle" ? firstEncounterId : null,
  );
  const [inspected, setInspected] = useState<string | null>(() =>
    spec.genre === "mystery" ? firstEncounterId : null,
  );
  const [hint, setHint] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [garden, setGarden] = useState(INITIAL_GARDEN);
  const [funded, setFunded] = useState<Set<string>>(() => new Set());
  const [mysteryStyle, setMysteryStyle] = useState<"investigation" | "narrative">(() => playStyle(spec) === "narrative" ? "narrative" : "investigation");
  const style = spec.genre === "mystery" ? mysteryStyle : playStyle(spec);
  const copy = COPY[style];
  const palette = getPalette(spec.theme.paletteId);
  const completed = runner.completedIds();
  const available = new Set(availableEncounters(spec, completed).map(e => e.id));
  const current = active ? runner.current() : null;
  const Widget = current ? widgetFor(current.mode.widget, current.view) : null;
  useEffect(() => {
    if ((active || inspected) && window.matchMedia("(max-width: 850px)").matches) {
      workbenchRef.current?.scrollIntoView({ block: "start" });
    }
  }, [active, inspected]);

  useEffect(() => installGameDebug({
    state: () => ({ finished: runner.finished, index: runner.finished ? spec.encounters.length : runner.current()!.index,
      encounterId: runner.current()?.encounter.id ?? null, mastery: runner.mastery() }),
    skipTo: id => { if (runner.selectEncounter(id)) { setActive(id); setFeedback(null); setHint(null); setRevision(n => n + 1); } },
    autoSolve: () => {
      if (runner.finished) return;
      runner.autoSolve(); setActive(null); setInspected(null); setFeedback(null); setRevision(n => n + 1);
    },
    events: () => runner.telemetry(), mastery: () => runner.mastery(),
  }), [runner, spec]);

  const open = (id: string) => {
    if (style === "management" && !funded.has(id)) {
      if (garden.water < 1) return;
      setGarden(g => ({ ...g, water: g.water - 1 }));
      setFunded(previous => new Set([...previous, id]));
    }
    if (!runner.selectEncounter(id)) return;
    setActive(id);
    setHint(null);
    setFeedback(null);
  };

  const submit = (input: unknown) => {
    if (!current || feedback?.correct) return;
    const result = runner.submit(input);
    setFeedback({ correct: result.correct, text: result.feedback });
    if (result.correct) {
      if (style === "management") setGarden(g => ({ ...g, growth: g.growth + 1 }));
      setActive(null);
      setInspected(null);
    }
    setRevision(n => n + 1);
  };

  if (runner.finished && !feedback) {
    const { mastery, lines } = runner.debrief();
    return <EndScreen gameId={spec.id} title={spec.title} outro={spec.narrative.outro} mastery={mastery} lines={lines} telemetry={runner.telemetry()} />;
  }

  return <main className={styles.game} style={{ background: palette.css.background, color: palette.css.text }} data-testid="activity-game" data-play-style={style}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>{copy.title} · 2D</p><h1>{spec.title}</h1></div>
      <span>{completed.size} / {spec.encounters.length} completed</span>
    </header>
    <p>{spec.premise}</p>
    {spec.genre === "mystery" && <div className={styles.help} aria-label="Adventure presentation">
      <button aria-pressed={style === "investigation"} onClick={() => setMysteryStyle("investigation")}>Case desk</button>
      <button aria-pressed={style === "narrative"} onClick={() => setMysteryStyle("narrative")}>Story journal</button>
    </div>}
    <p className={styles.instruction}>{copy.instruction}</p>
    {style === "management" && <section className={styles.resources} aria-label="Garden resources">
      <span>Day {garden.day}</span><span>Water {garden.water} / 4</span><span>Growing {garden.growth}</span><span>Harvest {garden.harvest}</span>
      <button onClick={() => setGarden(g => gardenTurn(g, "rest"))}>Rest until tomorrow · +2 water</button>
      <button disabled={garden.growth === 0} onClick={() => setGarden(g => gardenTurn(g, "harvest"))}>Harvest a crop</button>
      <button disabled={garden.harvest === 0 || garden.water === 4} onClick={() => setGarden(g => gardenTurn(g, "compost"))}>Compost a harvest · +2 water</button>
    </section>}
    {feedback && <section role="status" className={styles.feedback}>
      <strong>{feedback.correct ? "Progress made" : "Try another approach"}</strong><p>{feedback.text}</p>
      {feedback.correct && <button onClick={() => setFeedback(null)}>{runner.finished ? "See what you learned" : "Continue exploring"}</button>}
    </section>}
    <div className={`${styles.workspace} ${style === "top-down" ? styles.exploration : ""}`}>
      {style === "top-down" ? <TopDownMap spec={spec} completed={completed} available={available} onOpen={open} /> : <section aria-label={copy.title} className={`${styles.board} ${styles[style]}`}>
        {spec.encounters.map((encounter) => {
          const done = completed.has(encounter.id);
          const unlocked = available.has(encounter.id);
          const title = encounter.conceptIds.map(id => spec.concepts.find(c => c.id === id)?.name ?? id).join(" + ");
          return <button key={encounter.id} className={styles.tile} data-complete={done} aria-pressed={active === encounter.id || inspected === encounter.id}
            disabled={!unlocked || runner.finished || (style === "management" && !funded.has(encounter.id) && garden.water === 0)}
            onClick={() => {
              if (style === "investigation" || style === "narrative") { setInspected(encounter.id); setActive(null); setFeedback(null); }
              else open(encounter.id);
            }}>
            <span className={styles.symbol} aria-hidden="true">{done ? "✓" : encounter.role === "boss" ? "✦" : style === "management" ? "✿" : style === "investigation" ? "▤" : "◇"}</span>
            <strong>{title}</strong>
            <small>{done ? "Completed" : !unlocked ? "Requires earlier discoveries" : encounter.role === "boss" ? "Final synthesis" : copy.action}</small>
          </button>;
        })}
      </section>}
      <section ref={workbenchRef} className={styles.workbench} aria-label="Current task">
        {inspected && !active && (() => {
          const encounter = spec.encounters.find(e => e.id === inspected)!;
          const beats = spec.narrative.beats.filter(b => b.encounterId === inspected && b.when === "before");
          return <article><h2>{style === "narrative" ? "An open thread" : "Inspect the file"}</h2>
            {beats.map((line, i) => <p key={i}>{line.text}</p>)}<p>{encounter.prompt}</p>
            <button onClick={() => open(inspected)}>{copy.action}</button></article>;
        })()}
        {current && Widget && <article key={current.encounter.id}>
          <p className={styles.eyebrow}>{current.card?.name ?? "Challenge"}</p>
          <h2 data-testid="encounter-prompt">{current.encounter.prompt}</h2>
          {current.before.map((line, i) => <p key={i}>{line.text}</p>)}
          <div data-testid="widget-root"><Widget view={current.view} onSubmit={submit} /></div>
          <div className={styles.help}><button disabled={runner.hintsUsedOnCurrent >= current.encounter.hints.length} onClick={() => {
            setHint(runner.hint()); setRevision(n => n + 1);
          }}>Get a hint ({runner.hintsUsedOnCurrent}/3)</button><button onClick={() => { setActive(null); setInspected(null); setFeedback(null); }}>Return to {copy.title.toLowerCase()}</button></div>
          {hint && <p role="status">{hint}</p>}
        </article>}
        {!current && !inspected && <p>Choose an open {style === "management" ? "project" : style === "narrative" ? "thread" : "location"} to begin. Your completed work stays in your journal.</p>}
      </section>
    </div>
    <details className={styles.journal}><summary>Discovery journal · {completed.size} entries</summary>
      {spec.encounters.filter(e => completed.has(e.id)).map(e => <article key={e.id}><p>{e.debriefLine}</p>
        {spec.narrative.beats.filter(b => b.encounterId === e.id && b.when === "after").map((line, i) => <p key={i}>{line.text}</p>)}
      </article>)}
      {!completed.size && <p>Your discoveries will appear here.</p>}
    </details>
  </main>;
}
