"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { GENRES, type Genre } from "@/contracts/common";
import type { Intake, KnowledgeMap, Mcq } from "@/contracts/knowledge";
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
}

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
  const [answers, setAnswers] = useState<(number | undefined)[]>([]);
  const [sections, setSections] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<IntakeData>(`/api/sources/${sourceId}/intake`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setConfidence(Object.fromEntries(d.knowledgeMap.units.map((u) => [u.id, 3])));
        setSections(new Set(d.gatekeeper.outline.map((o) => o.title)));
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  const ready = useMemo(() => data && answers.length === data.preCheck.length && answers.every((a) => a !== undefined), [data, answers]);

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

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const intake: Intake = {
      goal,
      minutes,
      genre,
      confidence,
      preCheck: { items: data.preCheck, answers: answers.map((a) => a ?? 0) },
    };
    try {
      const { jobId } = await api<{ jobId: string }>("/api/games", {
        method: "POST",
        body: JSON.stringify({ sourceId, intake, sections: data.gatekeeper.tooBig ? [...sections] : undefined }),
      });
      router.push(`/forge/${jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-12" data-testid="intake-form">
      <section aria-labelledby="found-heading">
        <p className="text-lg text-muted-foreground">
          {data.source.title} · {data.source.pageCount} page{data.source.pageCount === 1 ? "" : "s"} · {km.subject.domain} / {km.subject.topic}
          {km.unsourced && " · unsourced (built from general knowledge)"}
        </p>
        <h1 id="found-heading" className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Here&apos;s what I found
        </h1>
        {data.gatekeeper.tooBig && data.gatekeeper.outline.length > 0 && (
          <fieldset className="mt-6 rounded-2xl border border-amber-200 bg-warning-soft p-4">
            <legend className="px-2 text-lg font-semibold">This is more than one game&apos;s worth. Pick the sections to play:</legend>
            <div className="grid gap-2 md:grid-cols-2">
              {data.gatekeeper.outline.map((o) => (
                <label key={o.title} className="flex items-center gap-3 text-lg">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={sections.has(o.title)}
                    onChange={(e) => {
                      const next = new Set(sections);
                      if (e.target.checked) next.add(o.title);
                      else next.delete(o.title);
                      setSections(next);
                    }}
                  />
                  {o.title} <span className="text-muted-foreground">pp. {o.pageStart}–{o.pageEnd}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {km.units.map((u) => (
            <div key={u.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-2xl font-bold tracking-tight">{u.name}</h2>
                {unitPageRange(km, u.conceptIds) && <span className="text-base text-muted-foreground">{unitPageRange(km, u.conceptIds)}</span>}
              </div>
              <ul className="mt-3 space-y-2">
                {u.conceptIds.map((cid) => {
                  const c = km.concepts.find((x) => x.id === cid);
                  if (!c) return null;
                  const range = pageRange(km, cid);
                  return (
                    <li key={cid} className="text-lg">
                      <span className="font-medium">{c.name}</span>
                      {range && <span className="text-muted-foreground"> · {range}</span>}
                      <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{c.knowledgeType}</span>
                      {c.importance === "core" && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">core</span>}
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
          ))}
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
          <legend className="text-2xl font-bold tracking-tight">Goal</legend>
          <div className="mt-3 flex flex-col gap-2">
            {GOALS.map((g) => (
              <label key={g.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-lg ${goal === g.id ? "border-primary bg-primary/10" : "border-border"}`}>
                <input type="radio" name="goal" value={g.id} checked={goal === g.id} onChange={() => setGoal(g.id)} className="h-5 w-5" />
                <span>
                  {g.label} <span className="text-muted-foreground">· {g.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-2xl font-bold tracking-tight">Length</legend>
          <div className="mt-3 flex flex-col gap-2">
            {MINUTES.map((m) => (
              <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-lg ${minutes === m ? "border-primary bg-primary/10" : "border-border"}`}>
                <input type="radio" name="minutes" value={m} checked={minutes === m} onChange={() => setMinutes(m)} className="h-5 w-5" />
                {m} minutes
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-2xl font-bold tracking-tight">Genre</legend>
          <div className="mt-3 flex flex-col gap-2">
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-lg ${genre === "auto" ? "border-primary bg-primary/10" : "border-border"}`}>
              <input type="radio" name="genre" value="auto" checked={genre === "auto"} onChange={() => setGenre("auto")} className="h-5 w-5" />
              Pick for me
            </label>
            {GENRES.map((g) => (
              <label key={g} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-lg ${genre === g ? "border-primary bg-primary/10" : "border-border"}`}>
                <input type="radio" name="genre" value={g} checked={genre === g} onChange={() => setGenre(g)} className="h-5 w-5" />
                {GENRE_LABEL[g]}
                {!HOSTS_BUILT.includes(g) && <span className="text-sm text-muted-foreground">(host coming; falls back)</span>}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section aria-labelledby="precheck-heading">
        <h2 id="precheck-heading" className="text-2xl font-bold tracking-tight">
          Quick check: three questions before you play
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {data.preCheck.map((q, i) => (
            <fieldset key={i} className="rounded-2xl border border-border bg-card p-4" data-testid={`precheck-${i}`}>
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
      </section>

      <div className="flex items-center gap-4">
        <Button size="lg" className="h-12 rounded-full px-8 text-base font-semibold" disabled={!ready || busy} onClick={submit} data-testid="forge-button">
          {busy ? "Starting the forge…" : "Forge my game"}
        </Button>
        {!ready && <span className="text-lg text-muted-foreground">Answer the three questions to continue.</span>}
      </div>
    </div>
  );
}
