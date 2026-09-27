"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BoardHostHandle, BoardHostProps } from "../../types";
import { FiledStamp, Ornament, Vignette } from "./Vignettes";
import {
  bookColors,
  buildChapters,
  buildLog,
  buildThreads,
  choiceText,
  currentChapter,
  endingBlurb,
  endingTitle,
  firstTryRate,
  listText,
  lastOpenedChapter,
  notebookEntries,
  pickEnding,
  socketLabel,
  splitName,
  vignetteFor,
  type EndingKind,
  type Passage,
  type StoryEvent,
} from "./story.logic";
import { STORY_CSS } from "./story.styles";

/*
 * StoryHost: an illustrated book / reporter's notebook with no map and no avatar. The LEFT page is the story so far
 * (prologue, chapter openings, the scenes you chose, what came of them); the RIGHT page is what you can do now: one
 * choice card per open encounter (keys 1-9), or the open challenge on a dark insert card. Choosing a card writes its
 * scene and opens the challenge; the other choices wait, and solving one opens new threads. Tracks are threads with
 * their own ribbon colour. A correct answer stamps the beat "Filed" and adds a notebook entry; a wrong one gets a
 * gentle word from the mentor. The ending depends on how often you got it right the first time.
 *
 * All text and structure is built in ./story.logic.ts (pure, tested); this file only records events and renders.
 */

type Props = BoardHostProps & { hostRef?: (h: BoardHostHandle | null) => void };

const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest(TYPING) !== null;
}

export function StoryHost(props: Props) {
  const { spec, palette, progression, solved, available, activeId, lastResult, finished } = props;

  const chapters = useMemo(() => buildChapters(spec, progression), [spec, progression]);
  const threads = useMemo(() => buildThreads(spec, progression), [spec, progression]);
  const colors = useMemo(() => bookColors(palette.css), [palette]);
  const choices = useMemo(() => new Map(spec.encounters.map((e) => [e.id, choiceText(spec, e.id)])), [spec]);
  const encounterById = useMemo(() => new Map(spec.encounters.map((e) => [e.id, e])), [spec]);
  const threadOf = useMemo(() => {
    const m = new Map<string, number>();
    threads.forEach((t) => t.ids.forEach((id) => m.set(id, t.index)));
    return m;
  }, [threads]);
  const inkOf = (id: string) => {
    const t = threadOf.get(id);
    return t === undefined ? colors.boss : colors.threads[t % colors.threads.length];
  };
  const topicOf = (id: string) => splitName(spec.concepts.find((c) => c.id === encounterById.get(id)?.conceptIds[0])?.name ?? id).short;

  // ---- story events, recorded from the props as they change (React's "adjust state while rendering" pattern)
  const [events, setEvents] = useState<StoryEvent[]>([]);
  const [attemptsAt, setAttemptsAt] = useState<Record<string, number>>({});
  const [seenActive, setSeenActive] = useState<string | null>(null);
  const [seenSeq, setSeenSeq] = useState(0);
  const [seenFinished, setSeenFinished] = useState(false);
  const [justFiled, setJustFiled] = useState<{ id: string; seq: number } | null>(null);
  const [wobbleSeq, setWobbleSeq] = useState(0);
  const newResult = lastResult !== null && lastResult.seq !== seenSeq;
  if (activeId !== seenActive || newResult || (finished && !seenFinished)) {
    let next = events;
    let att = attemptsAt;
    if (activeId !== seenActive) {
      setSeenActive(activeId);
      if (activeId) next = [...next, { kind: "chose", id: activeId }];
    }
    if (newResult && lastResult) {
      setSeenSeq(lastResult.seq);
      const id = lastResult.encounterId;
      if (!next.some((e) => e.kind === "chose" && e.id === id)) next = [...next, { kind: "chose", id }];
      const attempts = Math.max(1, props.attemptsOn(id));
      if (lastResult.correct) {
        if (att[id] === undefined) att = { ...att, [id]: attempts };
        next = [...next, { kind: "filed", id, attempts }];
        setJustFiled({ id, seq: lastResult.seq });
      } else {
        next = [...next, { kind: "stumble", id, attempt: attempts }];
        setWobbleSeq(lastResult.seq);
      }
    }
    if (finished && !seenFinished) {
      setSeenFinished(true);
      next = [...next, { kind: "finished", ending: pickEnding(firstTryRate(att)) }];
    }
    setEvents(next);
    setAttemptsAt(att);
  }

  const log = useMemo(() => buildLog(spec, progression, chapters, events), [spec, progression, chapters, events]);
  const endingEvent = events.find((e): e is Extract<StoryEvent, { kind: "finished" }> => e.kind === "finished");
  const ending: EndingKind = endingEvent?.ending ?? pickEnding(firstTryRate(attemptsAt));

  const [notebookOpen, setNotebookOpen] = useState(false);
  // the header follows the chapter the log last opened (reading ahead opens later chapters early)
  const chapterNow = chapters[Math.max(lastOpenedChapter(log), currentChapter(chapters, solved))];
  const filedCount = spec.encounters.filter((e) => solved.has(e.id)).length;

  // ---- refs, focus, scrolling
  const rootRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const prevActive = useRef<string | null>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  const insertRef = useRef<HTMLDivElement>(null);

  // a wrong answer: the insert card gives a small shake (Web Animations, so the panel is never remounted)
  useEffect(() => {
    const el = insertRef.current;
    if (!wobbleSeq || !el || typeof el.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [
        { transform: "none" },
        { transform: "translateX(-7px) rotate(-0.4deg)" },
        { transform: "translateX(6px) rotate(0.3deg)" },
        { transform: "translateX(-3px)" },
        { transform: "none" },
      ],
      { duration: 480, easing: "ease-in-out" },
    );
  }, [wobbleSeq]);

  // the book fills the viewport below whatever sits above it (header, HUD), measured once and on resize
  useEffect(() => {
    const el = rootRef.current;
    const book = el?.querySelector<HTMLElement>(".st-book");
    if (!el || !book) return;
    const measure = () => {
      const top = book.getBoundingClientRect().top + window.scrollY;
      el.style.setProperty("--st-top", `${Math.round(top)}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // newest passage at the bottom: follow it, and stay pinned while the page reflows (the spread widens and narrows)
  const stickRef = useRef(true);
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    stickRef.current = true;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [log.length]);
  useEffect(() => {
    const el = logRef.current;
    const content = el?.firstElementChild;
    if (!el || !content || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(content);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // debug warp: nothing to move in a book, but keep the log at its newest line
  const hostRef = props.hostRef;
  useEffect(() => {
    hostRef?.({
      warpTo: () => {
        const el = logRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      },
    });
    return () => hostRef?.(null);
  }, [hostRef]);

  // focus: into the widget when a challenge opens; back to the choices (or the finale) when it closes
  useEffect(() => {
    const prev = prevActive.current;
    prevActive.current = activeId;
    const right = rightRef.current;
    if (!right) return;
    if (activeId && activeId !== prev) {
      right.scrollTop = 0;
      const widget = right.querySelector('[data-testid="widget-root"]');
      const target =
        widget?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])') ??
        right.querySelector<HTMLElement>('[data-testid="challenge-panel"] button');
      target?.focus({ preventScroll: true });
    } else if (!activeId && prev) {
      right.scrollTop = 0;
      const target = right.querySelector<HTMLElement>('[data-testid="host-finale-continue"]') ?? right.querySelector<HTMLElement>(".st-card");
      target?.focus({ preventScroll: true });
    }
  }, [activeId, finished]);

  // keys: 1-9 pick a choice card, N toggles the notebook, Escape closes it; never while typing in a field
  const open = props.open;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "Escape" && notebookOpen) {
        setNotebookOpen(false);
        tabRef.current?.focus();
        return;
      }
      if ((e.key === "n" || e.key === "N") && !activeId) {
        setNotebookOpen((v) => !v);
        return;
      }
      if (/^[1-9]$/.test(e.key) && !activeId && !finished) {
        const id = available[Number(e.key) - 1];
        if (id) {
          e.preventDefault();
          setNotebookOpen(false);
          open(id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [available, activeId, finished, notebookOpen, open]);

  const cssVars = {
    "--st-desk": colors.desk,
    "--st-desk-edge": colors.deskEdge,
    "--st-paper": colors.paper,
    "--st-paper-shade": colors.paperShade,
    "--st-ink": colors.ink,
    "--st-ink-soft": colors.inkSoft,
    "--st-accent-ink": colors.accentInk,
    "--st-ribbon": colors.ribbon,
    "--st-leather": colors.leather,
    "--st-boss": colors.boss,
  } as CSSProperties;

  const activeEncounter = activeId ? encounterById.get(activeId) : undefined;
  const availableSet = new Set(available);
  const stateOf = (id: string) => (solved.has(id) ? "solved" : availableSet.has(id) ? "available" : "locked");
  const notes = notebookEntries(spec, chapters, solved);
  const firstTries = Object.values(attemptsAt).filter((n) => n === 1).length;
  const recorded = Object.keys(attemptsAt).length;

  return (
    <div ref={rootRef} className="st-host" data-testid="story-host" data-light={colors.lightPalette ? "true" : "false"} data-finished={finished ? "true" : "false"} style={cssVars}>
      <style>{STORY_CSS}</style>

      <header className="st-bar">
        <div className="st-bar-chapter">
          <span className="st-bar-kicker">
            {finished ? "Epilogue" : `Chapter ${(chapterNow?.index ?? 0) + 1} of ${chapters.length}`}
          </span>
          <span className="st-bar-title" data-testid="story-chapter-title">
            {finished ? endingTitle(ending) : chapterNow?.title}
          </span>
        </div>
        <ul className="st-bar-threads" aria-label="Threads">
          {threads.map((t) => (
            <li key={t.index}>
              <span className="st-bar-swatch" style={{ background: colors.threads[t.index % colors.threads.length] }} aria-hidden />
              {t.name}
            </li>
          ))}
        </ul>
        <span className="st-bar-count" data-testid="story-filed-count">
          Filed <strong>{filedCount}</strong> / {spec.encounters.length}
        </span>
        <button
          ref={tabRef}
          type="button"
          className="st-tab"
          aria-expanded={notebookOpen}
          aria-controls="st-notebook"
          aria-keyshortcuts="N"
          data-testid="notebook-tab"
          onClick={() => setNotebookOpen((v) => !v)}
        >
          Notebook <span className="st-tab-badge">{filedCount}</span>
        </button>
      </header>

      <div className="st-book" data-open={activeId ? "true" : "false"}>
        {/* ---- LEFT: the story so far ---- */}
        <section className="st-page st-page-left" aria-label="The story so far">
          <div className="st-page-head">
            <span className="st-page-label">The story so far</span>
            <span className="st-folio">{spec.title}</span>
          </div>
          <div ref={logRef} className="st-scroll" data-testid="story-log"
            onScroll={(e) => {
              const t = e.currentTarget;
              stickRef.current = t.scrollHeight - t.scrollTop - t.clientHeight < 60;
            }}
            tabIndex={0} aria-live="polite" aria-relevant="additions" aria-label="The story so far">
            <div className="st-log">
              {log.map((p) => (
                <PassageView key={p.key} passage={p} ink={p.encounterId ? inkOf(p.encounterId) : undefined} />
              ))}
            </div>
          </div>
          {notebookOpen && (
            <div className="st-notebook" id="st-notebook" data-testid="notebook" role="region" aria-label="Notebook">
              <button type="button" className="st-note-close" onClick={() => { setNotebookOpen(false); tabRef.current?.focus(); }} data-testid="notebook-close">
                Close
              </button>
              <div className="st-scroll">
                <h3>Notebook</h3>
                {notes.map(({ chapter, entries }) => (
                  <div key={chapter.index} className="st-note-chapter">
                    <h4>
                      Chapter {chapter.index + 1}: {chapter.title}
                    </h4>
                    {entries.length === 0 ? (
                      <p className="st-note-empty">Nothing filed yet.</p>
                    ) : (
                      <ul>
                        {entries.map((n) => (
                          <li key={n.id} className="st-note-entry" data-testid={`note-${n.id}`}>
                            <strong>{n.topic}.</strong>
                            {n.line}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ---- RIGHT: what you can do now ---- */}
        <section className="st-page st-page-right" aria-label={activeId ? "The open question" : finished ? "Epilogue" : "What happens next"}>
          <div ref={rightRef} className="st-scroll">
            {activeId && activeEncounter ? (
              <div
                ref={insertRef}
                className="st-insert"
                style={{ "--st-thread": inkOf(activeId) } as CSSProperties}
                data-testid="story-insert"
              >
                <div className="st-insert-head">
                  <Vignette kind={vignetteFor(activeEncounter.socket, activeEncounter.role)} size={52} className="st-insert-art" />
                  <div>
                    <p className="st-insert-kicker">
                      {socketLabel(activeEncounter.socket, activeEncounter.role)}
                      {threadOf.has(activeId) ? ` · ${threads[threadOf.get(activeId)!]?.name ?? ""}` : ""}
                    </p>
                    <p className="st-insert-title">{choices.get(activeId)?.verb}</p>
                  </div>
                </div>
                {props.challenge}
                {justFiled?.id === activeId && solved.has(activeId) && <FiledStamp key={justFiled.seq} className="st-stamp" />}
              </div>
            ) : finished ? (
              <div className="st-finale" data-testid="story-finale" data-ending={ending}>
                <div className="st-masthead">
                  <p className="st-masthead-kicker">{spec.title}</p>
                  <h2 className="st-masthead-title">{endingTitle(ending)}</h2>
                </div>
                <p className="st-finale-byline">
                  By you, with notes from {listText(spec.characters.map((c) => c.name))}
                </p>
                <p className="st-finale-lede">{endingBlurb(ending)}</p>
                <ol className="st-finale-chapters" aria-label="Chapters">
                  {chapters.map((c) => (
                    <li key={c.index}>
                      <span className="st-finale-num">{c.index + 1}</span>
                      <span className="st-finale-ch">{c.title}</span>
                      <span className="st-finale-sub">{c.subtitle}</span>
                    </li>
                  ))}
                </ol>
                {recorded > 0 && (
                  <p className="st-finale-stats">
                    Right the first time on {firstTries} of {recorded} {recorded === 1 ? "page" : "pages"}.
                  </p>
                )}
                <button type="button" className="st-primary" data-testid="host-finale-continue" onClick={props.complete} autoFocus>
                  Close the book
                </button>
              </div>
            ) : (
              <>
                <h2 className="st-prompt-title">What will you do?</h2>
                <p className="st-prompt-sub">
                  {available.length > 1 ? `${available.length} threads are open. Choose one; the others will wait for you.` : "One thread is open."}
                </p>
                <ol className="st-choices" aria-label="Choices">
                  {available.map((id, i) => {
                    const e = encounterById.get(id);
                    const c = choices.get(id);
                    if (!e || !c) return null;
                    const thread = threadOf.get(id);
                    const kicker = [socketLabel(e.socket, e.role), thread !== undefined ? threads[thread]?.name : "Final chapter", c.tag].filter(Boolean).join(" · ");
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className="st-card"
                          data-testid={`node-${id}`}
                          data-state="available"
                          data-boss={progression.bossId === id ? "true" : "false"}
                          style={{ "--st-thread": inkOf(id), animationDelay: `${i * 70}ms` } as CSSProperties}
                          aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
                          onClick={() => {
                            setNotebookOpen(false);
                            props.open(id);
                          }}
                        >
                          <span className="st-card-key" aria-hidden>
                            {i < 9 ? i + 1 : "·"}
                          </span>
                          <Vignette kind={vignetteFor(e.socket, e.role)} size={56} className="st-card-art" />
                          <span className="st-card-body">
                            <span className="st-card-kicker">{kicker}</span>
                            <span className="st-card-verb">{c.verb}</span>
                            {c.teaser && <span className="st-card-teaser">{c.teaser}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                <p className="st-section-label">The threads</p>
                <div className="st-threads" data-testid="story-threads">
                  {threads.map((t) => (
                    <div key={t.index} className="st-thread-row" style={{ "--st-thread": colors.threads[t.index % colors.threads.length] } as CSSProperties}>
                      <span className="st-thread-name">{t.name}</span>
                      <ul className="st-beads">
                        {t.ids.map((id) => (
                          <Bead key={id} id={id} name={topicOf(id)} state={stateOf(id)} fresh={justFiled?.id === id} />
                        ))}
                      </ul>
                    </div>
                  ))}
                  {progression.bossId && (
                    <div className="st-thread-row" style={{ "--st-thread": colors.boss } as CSSProperties}>
                      <span className="st-thread-name">Last chapter</span>
                      <ul className="st-beads">
                        <Bead id={progression.bossId} name="The final question" state={stateOf(progression.bossId)} fresh={justFiled?.id === progression.bossId} />
                      </ul>
                    </div>
                  )}
                </div>
                <p className="st-keys">
                  <kbd>1</kbd>–<kbd>{Math.min(9, Math.max(1, available.length))}</kbd> choose · <kbd>Tab</kbd> <kbd>Enter</kbd> also work · <kbd>N</kbd> notebook
                </p>
              </>
            )}
          </div>
        </section>

        {/* ribbons below the book: one per thread (longer as it is filed) and the bookmark */}
        <div className="st-ribbons" aria-hidden>
          {threads.map((t, i) => {
            const done = t.ids.filter((id) => solved.has(id)).length / Math.max(1, t.ids.length);
            return (
              <span
                key={t.index}
                className="st-ribbon"
                style={{ left: `calc(60% + ${i * 30}px)`, height: `${30 + Math.round(done * 34)}px`, background: colors.threads[t.index % colors.threads.length] }}
              />
            );
          })}
          <span className="st-ribbon st-ribbon-mark" style={{ left: "28%" }} />
        </div>
      </div>
    </div>
  );
}

function Bead({ id, name, state, fresh }: { id: string; name: string; state: "solved" | "available" | "locked"; fresh: boolean }) {
  const label = state === "solved" ? "filed" : state === "available" ? "open now" : "later in the story";
  return (
    <li className={`st-bead${fresh && state === "solved" ? " st-bead-stamp" : ""}`} data-state={state} data-testid={`thread-${id}`} aria-label={`${name}: ${label}`} title={`${name}: ${label}`}>
      {state === "solved" ? (
        <svg viewBox="0 0 16 16" className="st-bead-check" aria-hidden>
          <path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="st-bead-dot" aria-hidden />
      )}
      <span className="st-bead-name">{name}</span>
    </li>
  );
}

function PassageView({ passage, ink }: { passage: Passage; ink?: string }) {
  const p = passage;
  const style = ink ? ({ "--st-thread": ink } as CSSProperties) : undefined;
  const body = p.paragraphs.map((para, i) =>
    para.kind === "line" ? (
      <p key={i} className="st-line">
        <span className="st-speaker">{para.speaker}</span>
        <span className="st-said">&ldquo;{para.text}&rdquo;</span>
      </p>
    ) : (
      <p key={i} className={p.dropCap && i === 0 ? "st-dropcap" : undefined}>
        {para.text}
      </p>
    ),
  );
  if (p.kind === "prologue" || p.kind === "chapter") {
    return (
      <article className={`st-passage st-chapter${p.kind === "prologue" ? " st-prologue" : ""}`} data-kind={p.kind}>
        {p.kicker && <span className="st-kicker">{p.kicker}</span>}
        {p.heading && <h3>{p.heading}</h3>}
        <div className="st-orn">
          <Ornament />
        </div>
        {body}
      </article>
    );
  }
  if (p.kind === "epilogue") {
    return (
      <article className="st-passage st-epilogue" data-kind={p.kind} data-testid="story-epilogue">
        {p.kicker && <span className="st-kicker">{p.kicker}</span>}
        {p.heading && <h3>{p.heading}</h3>}
        {body}
        <div className="st-end-mark">
          <Ornament width={140} />
        </div>
      </article>
    );
  }
  if (p.kind === "scene") {
    return (
      <article className="st-passage st-scene" data-kind={p.kind} style={style}>
        <Vignette kind={p.vignette ?? "lead"} size={56} className="st-scene-art" />
        {p.heading && <p className="st-scene-title">{p.heading}</p>}
        <div>{body}</div>
      </article>
    );
  }
  return (
    <article className={`st-passage st-${p.kind}`} data-kind={p.kind} style={style}>
      {body}
    </article>
  );
}
