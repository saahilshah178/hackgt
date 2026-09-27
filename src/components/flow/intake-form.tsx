"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Intake, KnowledgeMap, Mcq, Unit } from "@/contracts/knowledge";
import type { GatekeeperSlice } from "@/contracts/slices";
import { api } from "@/components/flow/client-fetch";
import { EMPTY_CLARIFY, IntakeClarify, type ClarifyState } from "@/components/flow/intake-clarify";
import { GenrePicker } from "@/components/flow/intake-genre";
import { clarifyProbes, CONCEPTS_PER_GAME, isEmptyProfile, profileFromAnswers } from "@/pipeline/clarify";
import type { GenreRecommendation } from "@/pipeline/personalize";

/** Response of GET /api/sources/:id/intake (instructions.md §9). */
interface IntakeData {
  source: { id: string; kind: string; title: string; pageCount: number };
  gatekeeper: GatekeeperSlice;
  knowledgeMap: KnowledgeMap;
  dropped: { conceptId: string; page: number; quote: string }[];
  preCheck: Mcq[];
  mock: boolean;
  /** how many curriculum calls the document took (1 = read in one go) */
  parts?: number;
}

/** How long after the last tick before asking the server for questions on the new selection. */
const PRECHECK_DEBOUNCE_MS = 700;

const MINUTES: Intake["minutes"][] = [5, 10, 15];
/** The length the page opens on; its concept limit decides whether everything starts ticked. */
const DEFAULT_MINUTES: Intake["minutes"] = 10;

/**
 * Two steps, the second optional: pick the concepts and length, then build. The quick check (what trips you up, a
 * genre, three pre-check questions) sharpens the game but never blocks it: unanswered questions count as "not sure".
 */
const STEPS = [
  { title: "Here's what I found", short: "Concepts" },
  { title: "Quick check (optional)", short: "Quick check" },
] as const;

function conceptPages(km: KnowledgeMap, conceptId: string): number[] {
  const c = km.concepts.find((x) => x.id === conceptId);
  return (c?.facts ?? []).map((f) => f.sourceRef?.page).filter((p): p is number => typeof p === "number");
}

function rangeLabel(pages: number[]): string | null {
  if (pages.length === 0) return null;
  const lo = Math.min(...pages);
  const hi = Math.max(...pages);
  return lo === hi ? `p. ${lo}` : `pp. ${lo}–${hi}`;
}

function pageRange(km: KnowledgeMap, conceptId: string): string | null {
  return rangeLabel(conceptPages(km, conceptId));
}

function unitPageRange(km: KnowledgeMap, conceptIds: readonly string[]): string | null {
  return rangeLabel(conceptIds.flatMap((cid) => conceptPages(km, cid)));
}

export function IntakeForm({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [data, setData] = useState<IntakeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<Intake["minutes"]>(DEFAULT_MINUTES);
  const [genre, setGenre] = useState<Intake["genre"]>("auto");
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // The three questions written for the current subset (POST /api/sources/:id/precheck), keyed by the
  // selection they belong to so a stale reply is never shown against a newer selection.
  const [subset, setSubset] = useState<{ key: string; items: Mcq[] } | null>(null);
  const latestKey = useRef<string>("");
  const [answers, setAnswers] = useState<(number | undefined)[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [clarify, setClarify] = useState<ClarifyState>(EMPTY_CLARIFY);
  // Genre ranking for the inputs it was computed from, so a stale reply never shows against newer answers.
  const [recs, setRecs] = useState<{ key: string; items: GenreRecommendation[] } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    api<IntakeData>(`/api/sources/${sourceId}/intake`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setConfidence(Object.fromEntries(d.knowledgeMap.units.map((u) => [u.id, 3])));
        const all = d.knowledgeMap.concepts.map((c) => c.id);
        // Everything fits in the default length: start fully ticked. Otherwise the student picks which ones.
        setSelected(new Set(all.length <= CONCEPTS_PER_GAME[DEFAULT_MINUTES] ? all : []));
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  const total = data?.knowledgeMap.concepts.length ?? 0;
  const allSelected = total > 0 && selected.size === total;
  // The game covers exactly the ticked concepts, so the length caps how many can be ticked.
  const cap = CONCEPTS_PER_GAME[minutes];
  const overCap = selected.size > cap;
  const selectionKey = useMemo(() => [...selected].sort().join(","), [selected]);
  const needsSubset = data !== null && selected.size > 0 && !allSelected;
  // Questions follow the selection: the prep pre-check covers the whole map, so a subset gets its own.
  const preCheck: Mcq[] = !data || selected.size === 0 ? [] : allSelected ? data.preCheck : subset?.key === selectionKey ? subset.items : [];
  const preCheckBusy = needsSubset && subset?.key !== selectionKey;

  useEffect(() => {
    if (!needsSubset || subset?.key === selectionKey) return;
    const key = selectionKey;
    latestKey.current = key;
    const timer = setTimeout(() => {
      api<{ preCheck: Mcq[] }>(`/api/sources/${sourceId}/precheck`, { method: "POST", body: JSON.stringify({ conceptIds: key.split(",") }) })
        .then((r) => {
          if (latestKey.current === key) setSubset({ key, items: r.preCheck });
        })
        .catch((e) => {
          if (latestKey.current === key) setError(e instanceof Error ? e.message : String(e));
        });
    }, PRECHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [needsSubset, selectionKey, subset, sourceId]);

  const answered = useMemo(() => Object.keys(clarify.answers), [clarify.answers]);
  const probes = useMemo(
    () => (data ? clarifyProbes(data.knowledgeMap, { confidence }, [...selected], undefined, answered) : []),
    [data, confidence, selected, answered],
  );
  const profile = useMemo(() => profileFromAnswers(probes, clarify.answers, clarify), [probes, clarify]);
  const recKey = useMemo(() => JSON.stringify([selectionKey, confidence, profile]), [selectionKey, confidence, profile]);

  // Rank genres for the current pick (debounced so ticking concepts doesn't refetch on every click).
  useEffect(() => {
    if (!data || selected.size === 0 || recs?.key === recKey) return;
    const key = recKey;
    let cancelled = false;
    const timer = setTimeout(() => api<{ recommendations: GenreRecommendation[]; pending?: boolean }>(`/api/sources/${sourceId}/recommend`, {
      method: "POST",
      body: JSON.stringify({ conceptIds: [...selected], confidence, profile }),
    })
      // pending = the matcher is still mapping concepts to mechanics: a key that never matches asks again
      // (the server waits a few seconds per request, so this polls gently)
      .then((r) => !cancelled && setRecs({ key: r.pending ? `${key}#pending` : key, items: r.recommendations }))
      // A failed ranking only costs the badges: the genre list still works and "Pick for me" still resolves server-side.
      .catch(() => !cancelled && setRecs({ key, items: [] })), PRECHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [data, selected, confidence, profile, recKey, recs, sourceId]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  // Nothing to answer is required: the game only needs the three pre-check items to exist (skipped = "not sure").
  const ready = !!data && selected.size > 0 && !overCap && !preCheckBusy && preCheck.length === 3;

  if (error) {
    return (
      <p role="alert" className="text-xl text-destructive">
        {error}
      </p>
    );
  }
  if (!data) {
    // A skeleton shaped like the loaded page (found-heading + two unit cards + setup row + pre-check row)
    // so the page doesn't jump in height once the intake data arrives.
    return (
      <div role="status" aria-live="polite" aria-label="Reading your material and mapping the concepts" data-testid="intake-loading" className="flex flex-col gap-12">
        <div className="animate-pulse">
          <div className="h-6 w-72 rounded bg-secondary" />
          <div className="mt-3 h-10 w-96 rounded bg-secondary" />
          <p className="mt-6 text-2xl">Reading your material and mapping the concepts…</p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-56 rounded-2xl border border-border bg-card p-5">
                <div className="h-7 w-48 rounded bg-secondary" />
                <div className="mt-4 h-4 w-full rounded bg-secondary" />
                <div className="mt-2 h-4 w-5/6 rounded bg-secondary" />
                <div className="mt-6 h-3 w-full rounded bg-secondary" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid animate-pulse gap-8 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 rounded-2xl border border-border bg-card" />
          ))}
        </div>
        <div className="grid animate-pulse gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-2xl border border-border bg-card" />
          ))}
        </div>
      </div>
    );
  }
  const km = data.knowledgeMap;

  // Every change of selection goes through here so the answers to the (soon replaced) questions reset.
  const changeSelection = (next: Set<string>) => {
    setSelected(next);
    setAnswers([]);
  };
  const toggleConcept = (id: string, on: boolean) => {
    if (on && selected.size >= cap) return;
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    changeSelection(next);
  };
  const setUnit = (u: Unit, on: boolean) => {
    const next = new Set(selected);
    for (const id of u.conceptIds) {
      if (on && next.size < cap) next.add(id);
      else if (!on) next.delete(id);
    }
    changeSelection(next);
  };
  const selectAll = () => changeSelection(new Set(km.concepts.map((c) => c.id)));
  const selectNone = () => changeSelection(new Set());

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const intake: Intake = {
      goal: "learn",
      minutes,
      genre,
      confidence,
      preCheck: { items: preCheck, answers: preCheck.map((_, i) => answers[i] ?? -1) },
      ...(allSelected ? {} : { conceptIds: [...selected] }),
      ...(isEmptyProfile(profile) ? {} : { profile }),
    };
    try {
      const { jobId } = await api<{ jobId: string }>("/api/games", {
        method: "POST",
        body: JSON.stringify({ sourceId, intake }),
      });
      router.push(`/forge/${jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const bigUpload = total > cap;
  const atCap = selected.size >= cap;
  const parts = data.parts ?? 1;

  return (
    <div className="flex flex-col gap-12" data-testid="intake-form" data-step={step}>
      <header>
        <nav aria-label="Intake steps">
          <ol className="flex flex-wrap gap-3 text-lg">
            {STEPS.map((st, i) => (
              <li
                key={st.short}
                aria-current={i === step ? "step" : undefined}
                className={`rounded-full border-2 px-4 py-1 ${i === step ? "border-primary bg-primary/15 font-semibold" : i < step ? "border-primary/40" : "border-border text-muted-foreground"}`}
              >
                {i + 1}. {st.short}
              </li>
            ))}
          </ol>
        </nav>
        <p className="mt-6 text-lg text-muted-foreground">
          {data.source.title} · {data.source.pageCount} page{data.source.pageCount === 1 ? "" : "s"} · {km.subject.domain} / {km.subject.topic}
          {parts > 1 && ` · read in ${parts} parts`}
          {km.unsourced && " · unsourced (built from general knowledge)"}
        </p>
        <h1 id="step-heading" ref={headingRef} tabIndex={-1} className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl outline-none">
          {STEPS[step].title}
        </h1>
      </header>

      {step === 0 && (
        <section aria-labelledby="step-heading">
          <fieldset>
            <legend className="text-2xl font-bold tracking-tight">How long a game?</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {MINUTES.map((m) => (
                <label
                  key={m}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-lg ${minutes === m ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <input type="radio" name="minutes" value={m} checked={minutes === m} onChange={() => setMinutes(m)} className="h-5 w-5" data-testid={`minutes-${m}`} />
                  <span>
                    {m} minutes <span className="text-muted-foreground">· up to {CONCEPTS_PER_GAME[m]} concepts</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {bigUpload && (
            <p className="mt-6 rounded-2xl border border-amber-200 bg-warning-soft p-4 text-lg" data-testid="big-upload-note">
              I found {total} concepts in {km.units.length} unit{km.units.length === 1 ? "" : "s"}, more than a {minutes}-minute game covers. Tick the {cap} you want
              this game to cover, or pick a longer game.
            </p>
          )}
          {overCap && (
            <p role="alert" className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-lg" data-testid="over-cap-note">
              A {minutes}-minute game covers up to {cap} concepts. Untick {selected.size - cap} or pick a longer game.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-lg" data-testid="selection-summary" aria-live="polite">
            <span>
              <strong>{selected.size}</strong> of up to {cap} picked · {total} concept{total === 1 ? "" : "s"} found
            </span>
            {total <= cap && (
              <button type="button" className="underline underline-offset-4 hover:text-primary" onClick={selectAll} data-testid="select-all">
                Select all
              </button>
            )}
            <button type="button" className="underline underline-offset-4 hover:text-primary" onClick={selectNone} data-testid="select-none">
              Select none
            </button>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {km.units.map((u) => {
              const picked = u.conceptIds.filter((id) => selected.has(id)).length;
              const unitAll = u.conceptIds.length > 0 && picked === u.conceptIds.length;
              return (
                <div key={u.id} className={`rounded-2xl border border-border bg-card p-5 ${picked === 0 ? "opacity-75" : ""}`} data-testid={`unit-card-${u.id}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={unitAll}
                        ref={(el) => {
                          if (el) el.indeterminate = picked > 0 && !unitAll;
                        }}
                        onChange={(e) => setUnit(u, e.target.checked)}
                        disabled={!unitAll && picked === 0 && selected.size >= cap}
                        aria-label={`Select every concept in ${u.name}`}
                        data-testid={`unit-${u.id}`}
                      />
                      <h2 className="text-2xl font-bold tracking-tight">{u.name}</h2>
                    </div>
                    {unitPageRange(km, u.conceptIds) && <span className="text-base text-muted-foreground">{unitPageRange(km, u.conceptIds)}</span>}
                  </div>
                  <ul className="mt-3 space-y-2">
                    {u.conceptIds.map((cid) => {
                      const c = km.concepts.find((x) => x.id === cid);
                      if (!c) return null;
                      const range = pageRange(km, cid);
                      return (
                        <li key={cid} className="text-lg">
                          <label className={`flex items-start gap-3 ${atCap && !selected.has(cid) ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                            <input
                              type="checkbox"
                              className="mt-1.5 h-5 w-5 shrink-0"
                              checked={selected.has(cid)}
                              disabled={atCap && !selected.has(cid)}
                              onChange={(e) => toggleConcept(cid, e.target.checked)}
                              data-testid={`concept-${cid}`}
                            />
                            <span>
                              <span className="font-medium">{c.name}</span>
                              {range && <span className="text-muted-foreground"> · {range}</span>}
                              <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{c.knowledgeType}</span>
                              {c.importance === "core" && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">core</span>}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <label className="mt-5 block text-lg">
                    How confident are you here? <strong>{confidence[u.id] ?? 3}</strong> / 5
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={confidence[u.id] ?? 3}
                      onChange={(e) => setConfidence({ ...confidence, [u.id]: Number(e.target.value) })}
                      className="mt-2 w-full accent-primary"
                      aria-label={`Confidence in ${u.name}`}
                      data-testid={`confidence-${u.id}`}
                    />
                    <span className="flex justify-between text-sm text-muted-foreground">
                      <span>lost</span>
                      <span>solid</span>
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
          {data.dropped.length > 0 && (
            <p className="mt-4 text-base text-muted-foreground">
              {data.dropped.length} quote{data.dropped.length === 1 ? "" : "s"} could not be verified against the pages and were dropped.
            </p>
          )}
        </section>
      )}

      {step === 1 && (
        <>
          <p className="-mt-6 text-lg text-muted-foreground">Everything here is optional. It helps the game focus on what you need; skip any of it.</p>
          <IntakeClarify probes={probes} value={clarify} onChange={setClarify} />

          <section aria-labelledby="precheck-heading">
            <h2 id="precheck-heading" className="text-2xl font-bold tracking-tight">
              Three quick questions (so your debrief can show what you learned)
            </h2>
            {selected.size === 0 ? (
              <p className="mt-4 text-lg text-muted-foreground" data-testid="precheck-empty">
                Tick at least one concept above and I&apos;ll write three quick questions about your selection.
              </p>
            ) : preCheckBusy ? (
              <p role="status" aria-live="polite" className="mt-4 text-lg" data-testid="precheck-loading">
                Writing three quick questions for your selection…
              </p>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {preCheck.map((q, i) => (
                  <fieldset key={`${selectionKey}:${i}`} className="rounded-2xl border border-border bg-card p-4" data-testid={`precheck-${i}`}>
                    <legend className="px-1 text-lg font-medium">{q.prompt}</legend>
                    <div className="mt-2 flex flex-col gap-2">
                      {q.choices.map((choice, ci) => (
                        <label key={ci} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-lg ${answers[i] === ci ? "border-primary bg-primary/10" : "border-border"}`}>
                          <input
                            type="radio"
                            name={`pre-${i}`}
                            value={ci}
                            checked={answers[i] === ci}
                            onChange={() => {
                              const next = [...answers];
                              next[i] = ci;
                              setAnswers(next);
                            }}
                            className="h-5 w-5"
                          />
                          {choice}
                        </label>
                      ))}
                      <label className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-2.5 text-lg ${answers[i] === -1 ? "border-primary bg-primary/10" : "border-border"}`}>
                        <input
                          type="radio"
                          name={`pre-${i}`}
                          value={-1}
                          checked={answers[i] === -1}
                          onChange={() => {
                            const next = [...answers];
                            next[i] = -1;
                            setAnswers(next);
                          }}
                          className="h-5 w-5"
                          data-testid={`precheck-${i}-skip`}
                        />
                        <span className="text-muted-foreground">Not sure yet</span>
                      </label>
                    </div>
                  </fieldset>
                ))}
              </div>
            )}
          </section>

        </>
      )}

      {/* The genre is always the student's choice (default "Pick for me"), on either screen. */}
      <section aria-labelledby="setup-heading" data-testid="genre-section">
        <h2 id="setup-heading" className="sr-only">
          Game style
        </h2>
        <GenrePicker genre={genre} onChange={setGenre} recommendations={recs?.key === recKey ? recs.items : null} />
      </section>

      <div className="flex flex-wrap items-center gap-4">
        {step > 0 && (
          <Button variant="outline" size="lg" className="h-12 rounded-full px-6 text-base font-semibold" onClick={() => setStep(step - 1)} data-testid="step-back">
            Back
          </Button>
        )}
        <Button size="lg" className="h-12 rounded-full px-8 text-base font-semibold" disabled={!ready || busy} onClick={submit} data-testid="forge-button">
          {busy ? "Starting…" : "Build my game"}
        </Button>
        {step === 0 && (
          <Button
            variant="outline"
            size="lg"
            className="h-12 rounded-full px-6 text-base font-semibold"
            disabled={selected.size === 0 || overCap}
            onClick={() => setStep(1)}
            data-testid="step-next"
          >
            Quick check first (optional)
          </Button>
        )}
        {!ready && (
          <span className="text-lg text-muted-foreground">
            {selected.size === 0 ? "Pick at least one concept to continue." : overCap ? `Untick ${selected.size - cap} to continue.` : "Getting ready…"}
          </span>
        )}
      </div>
    </div>
  );
}
