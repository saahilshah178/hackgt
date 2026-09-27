"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GENRES, type Genre } from "@/contracts/common";
import type { Intake, KnowledgeMap, Mcq, Unit } from "@/contracts/knowledge";
import type { GatekeeperSlice } from "@/contracts/slices";
import { api } from "@/components/flow/client-fetch";

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

/** Up to this many concepts (one chapter's worth) everything starts ticked; above it the student picks. */
export const SELECT_ALL_UP_TO = 25;
/** How long after the last tick before asking the server for questions on the new selection. */
const PRECHECK_DEBOUNCE_MS = 700;

const GOALS: { id: Intake["goal"]; label: string; hint: string }[] = [
  { id: "learn", label: "Learn it", hint: "first time through" },
  { id: "review", label: "Review", hint: "seen it, want it solid" },
  { id: "test", label: "Test me", hint: "exam soon" },
];
const MINUTES: Intake["minutes"][] = [5, 10, 15];
const GENRE_LABEL: Record<Genre, string> = { dungeon: "Dungeon", mystery: "Mystery", platformer: "Platformer", puzzle: "Puzzle", strategy: "Strategy" };
const HOSTS_BUILT: Genre[] = ["dungeon"];

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
  const [goal, setGoal] = useState<Intake["goal"]>("review");
  const [minutes, setMinutes] = useState<Intake["minutes"]>(10);
  const [genre, setGenre] = useState<Intake["genre"]>("auto");
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // The three questions written for the current subset (POST /api/sources/:id/precheck), keyed by the
  // selection they belong to so a stale reply is never shown against a newer selection.
  const [subset, setSubset] = useState<{ key: string; items: Mcq[] } | null>(null);
  const latestKey = useRef<string>("");
  const [answers, setAnswers] = useState<(number | undefined)[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<IntakeData>(`/api/sources/${sourceId}/intake`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setConfidence(Object.fromEntries(d.knowledgeMap.units.map((u) => [u.id, 3])));
        const all = d.knowledgeMap.concepts.map((c) => c.id);
        setSelected(new Set(all.length <= SELECT_ALL_UP_TO ? all : []));
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  const total = data?.knowledgeMap.concepts.length ?? 0;
  const allSelected = total > 0 && selected.size === total;
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

  const ready = !!data && selected.size > 0 && !preCheckBusy && preCheck.length > 0 && answers.length === preCheck.length && answers.every((a) => a !== undefined);

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
          <p className="mt-6 text-2xl">Reading your material and mapping the concepts… (a whole book takes a few minutes)</p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-56 rounded-lg border border-border/60 bg-card p-5">
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
            <div key={i} className="h-40 rounded-lg border border-border/60 bg-card" />
          ))}
        </div>
        <div className="grid animate-pulse gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-lg border border-border/60 bg-card" />
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
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    changeSelection(next);
  };
  const setUnit = (u: Unit, on: boolean) => {
    const next = new Set(selected);
    for (const id of u.conceptIds) {
      if (on) next.add(id);
      else next.delete(id);
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
      goal,
      minutes,
      genre,
      confidence,
      preCheck: { items: preCheck, answers: answers.map((a) => a ?? 0) },
      ...(allSelected ? {} : { conceptIds: [...selected] }),
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

  const bigUpload = total > SELECT_ALL_UP_TO;
  const parts = data.parts ?? 1;

  return (
    <div className="flex flex-col gap-12" data-testid="intake-form">
      <section aria-labelledby="found-heading">
        <p className="text-lg text-muted-foreground">
          {data.source.title} · {data.source.pageCount} page{data.source.pageCount === 1 ? "" : "s"} · {km.subject.domain} / {km.subject.topic}
          {parts > 1 && ` · read in ${parts} parts`}
          {km.unsourced && " · unsourced (built from general knowledge)"}
        </p>
        <h1 id="found-heading" className="mt-1 text-4xl font-bold tracking-tight">
          Here&apos;s what I found
        </h1>
        {bigUpload && (
          <p className="mt-6 rounded-lg border border-amber-400/40 bg-amber-500/10 p-4 text-lg" data-testid="big-upload-note">
            This is more than one game&apos;s worth: {km.units.length} units and {total} concepts. Tick the concepts you want in this game; a 10-minute game
            works best with about 8 to 12.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-lg" data-testid="selection-summary">
          <span>
            <strong>{selected.size}</strong> of {total} concept{total === 1 ? "" : "s"} selected
          </span>
          <button type="button" className="underline underline-offset-4 hover:text-primary" onClick={selectAll} data-testid="select-all">
            Select all
          </button>
          <button type="button" className="underline underline-offset-4 hover:text-primary" onClick={selectNone} data-testid="select-none">
            Select none
          </button>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {km.units.map((u) => {
            const picked = u.conceptIds.filter((id) => selected.has(id)).length;
            const unitAll = u.conceptIds.length > 0 && picked === u.conceptIds.length;
            return (
              <div key={u.id} className={`rounded-lg border border-border/60 bg-card p-5 ${picked === 0 ? "opacity-75" : ""}`} data-testid={`unit-card-${u.id}`}>
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
                      aria-label={`Select every concept in ${u.name}`}
                      data-testid={`unit-${u.id}`}
                    />
                    <h2 className="text-2xl font-semibold">{u.name}</h2>
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
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1.5 h-5 w-5 shrink-0"
                            checked={selected.has(cid)}
                            onChange={(e) => toggleConcept(cid, e.target.checked)}
                            data-testid={`concept-${cid}`}
                          />
                          <span>
                            <span className="font-medium">{c.name}</span>
                            {range && <span className="text-muted-foreground"> · {range}</span>}
                            <span className="ml-2 rounded bg-secondary px-2 py-0.5 text-sm">{c.knowledgeType}</span>
                            {c.importance === "core" && <span className="ml-2 rounded bg-primary/20 px-2 py-0.5 text-sm">core</span>}
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

      <section aria-labelledby="setup-heading" className="grid gap-8 md:grid-cols-3">
        <h2 id="setup-heading" className="sr-only">
          Game setup
        </h2>
        <fieldset>
          <legend className="text-2xl font-semibold">Goal</legend>
          <div className="mt-3 flex flex-col gap-2">
            {GOALS.map((g) => (
              <label key={g.id} className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-lg ${goal === g.id ? "border-primary bg-primary/10" : "border-border"}`}>
                <input type="radio" name="goal" value={g.id} checked={goal === g.id} onChange={() => setGoal(g.id)} className="h-5 w-5" />
                <span>
                  {g.label} <span className="text-muted-foreground">· {g.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-2xl font-semibold">Length</legend>
          <div className="mt-3 flex flex-col gap-2">
            {MINUTES.map((m) => (
              <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-lg ${minutes === m ? "border-primary bg-primary/10" : "border-border"}`}>
                <input type="radio" name="minutes" value={m} checked={minutes === m} onChange={() => setMinutes(m)} className="h-5 w-5" />
                {m} minutes
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-2xl font-semibold">Genre</legend>
          <div className="mt-3 flex flex-col gap-2">
            <label className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-lg ${genre === "auto" ? "border-primary bg-primary/10" : "border-border"}`}>
              <input type="radio" name="genre" value="auto" checked={genre === "auto"} onChange={() => setGenre("auto")} className="h-5 w-5" />
              Pick for me
            </label>
            {GENRES.map((g) => (
              <label key={g} className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-lg ${genre === g ? "border-primary bg-primary/10" : "border-border"}`}>
                <input type="radio" name="genre" value={g} checked={genre === g} onChange={() => setGenre(g)} className="h-5 w-5" />
                {GENRE_LABEL[g]}
                {!HOSTS_BUILT.includes(g) && <span className="text-sm text-muted-foreground">(host coming; falls back)</span>}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section aria-labelledby="precheck-heading">
        <h2 id="precheck-heading" className="text-2xl font-semibold">
          Quick check: three questions before you play
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
              <fieldset key={`${selectionKey}:${i}`} className="rounded-lg border border-border/60 bg-card p-4" data-testid={`precheck-${i}`}>
                <legend className="px-1 text-lg font-medium">{q.prompt}</legend>
                <div className="mt-2 flex flex-col gap-2">
                  {q.choices.map((choice, ci) => (
                    <label key={ci} className={`flex cursor-pointer items-center gap-3 rounded-md border p-2 text-lg ${answers[i] === ci ? "border-primary bg-primary/10" : "border-border"}`}>
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
                  <label className={`flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-2 text-lg ${answers[i] === -1 ? "border-primary bg-primary/10" : "border-border"}`}>
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

      <div className="flex items-center gap-4">
        <Button size="lg" className="h-14 px-8 text-xl" disabled={!ready || busy} onClick={submit} data-testid="forge-button">
          {busy ? "Starting the forge…" : "Forge my game"}
        </Button>
        {!ready && (
          <span className="text-lg text-muted-foreground">
            {selected.size === 0 ? "Pick at least one concept to continue." : preCheckBusy ? "Waiting for your questions…" : "Answer the three questions to continue."}
          </span>
        )}
      </div>
    </div>
  );
}
