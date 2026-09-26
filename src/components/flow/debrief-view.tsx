"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { GENRES, type Genre } from "@/contracts/common";
import type { GameSpec } from "@/contracts/gamespec";
import { emptyMastery, updateMastery, type TelemetryEvent } from "@/contracts/telemetry";
import { api } from "@/components/flow/client-fetch";
import { TrophySpot } from "@/components/illustrations";
import { ArrowRight } from "lucide-react";

interface Props {
  spec: GameSpec;
  serverTelemetry: TelemetryEvent[];
  insights: Record<string, { cardName: string; learningInsight: string }>;
  /** Fixtures have no server-side GameRecord to score against; skip the POST that would 404. */
  skipServerPostcheck?: boolean;
}

const score = (items: GameSpec["assessment"]["pre"], answers: readonly number[]) =>
  items.reduce((n, q, i) => n + (answers[i] === q.correctIndex ? 1 : 0), 0);

const subscribeNoop = () => () => {};

function readStash(gameId: string): string | null {
  try {
    return sessionStorage.getItem(`qf:telemetry:${gameId}`);
  } catch {
    return null;
  }
}

export function DebriefView({ spec, serverTelemetry, insights, skipServerPostcheck = false }: Props) {
  const router = useRouter();
  // The end screen also stashes telemetry in sessionStorage (fixtures have no server record). Read it as an
  // external store so the server render (no telemetry) and the client render (stash) stay consistent.
  const stashed = useSyncExternalStore(
    subscribeNoop,
    () => readStash(spec.id),
    () => null,
  );
  const telemetry = useMemo<TelemetryEvent[]>(() => {
    if (serverTelemetry.length > 0) return serverTelemetry;
    if (!stashed) return [];
    try {
      return JSON.parse(stashed) as TelemetryEvent[];
    } catch {
      return [];
    }
  }, [serverTelemetry, stashed]);
  const [answers, setAnswers] = useState<(number | undefined)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [genre, setGenre] = useState<Genre | "auto">("auto");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mastery = useMemo(() => {
    let s = emptyMastery(
      spec.concepts.map((c) => c.id),
      spec.mastery,
    );
    for (const e of telemetry) s = updateMastery(s, e, spec.mastery);
    return s;
  }, [spec, telemetry]);

  const pre = score(spec.assessment.pre, spec.intake.preCheckAnswers);
  const post = submitted ? score(spec.assessment.post, answers.map((a) => a ?? -1)) : null;
  const postSkipped = submitted ? answers.filter((a) => a === undefined).length : 0;
  // The pre-check gates on every question answered, but a player can still leave the debrief tab and have
  // the browser resubmit a partial `answers` array, or a future skip control can land here; treat missing
  // answers as "skipped", not silently wrong, so the score block still reads honestly.
  const ready = answers.length === spec.assessment.post.length && answers.every((a) => a !== undefined);

  const finish = () => {
    setSubmitted(true);
    if (skipServerPostcheck) return;
    void api(`/api/games/${spec.id}/postcheck`, { method: "POST", body: JSON.stringify({ answers: answers.map((a) => a ?? 0) }) }).catch(() => undefined);
  };

  const regenerate = async (body: { genre: Genre | "auto"; focusWeak?: boolean }, key: string) => {
    setBusy(key);
    setError(null);
    try {
      const { jobId } = await api<{ jobId: string }>(`/api/games/${spec.id}/regenerate`, { method: "POST", body: JSON.stringify(body) });
      router.push(`/forge/${jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const weakest = [...spec.concepts].sort((a, b) => (mastery[a.id]?.score ?? 0) - (mastery[b.id]?.score ?? 0)).slice(0, 3);

  if (!submitted) {
    return (
      <div data-testid="postcheck">
        <p className="text-lg text-muted-foreground">{spec.title}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Before the debrief: three questions</h1>
        <p className="mt-2 text-xl text-muted-foreground">Same concepts as your pre-check, new questions.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {spec.assessment.post.map((q, i) => (
            <fieldset key={i} className="rounded-2xl border border-border bg-card p-4" data-testid={`postcheck-${i}`}>
              <legend className="px-1 text-lg font-medium">{q.prompt}</legend>
              <div className="mt-2 flex flex-col gap-2">
                {q.choices.map((choice, ci) => (
                  <label key={ci} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-lg ${answers[i] === ci ? "border-primary bg-primary/10" : "border-border"}`}>
                    <input
                      type="radio"
                      name={`post-${i}`}
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
              </div>
            </fieldset>
          ))}
        </div>
        <Button size="lg" className="mt-6 h-12 rounded-full px-8 text-base font-semibold" disabled={!ready} onClick={finish} data-testid="postcheck-submit">
          See my results
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="debrief" className="flex flex-col gap-10">
      <section className="rounded-3xl bg-gradient-to-br from-accent via-card to-card p-6 ring-1 ring-border sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-primary">{spec.title}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Debrief</h1>
          </div>
          <TrophySpot className="hidden w-28 shrink-0 sm:block" />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="rounded-2xl border border-border bg-card px-6 py-4">
            <div className="text-sm font-medium text-muted-foreground">Before</div>
            <div className="text-5xl font-extrabold tabular-nums" data-testid="pre-score">
              {pre}/{spec.assessment.pre.length}
            </div>
          </div>
          <ArrowRight className="size-8 text-brand" aria-hidden />
          <div className="rounded-2xl border border-brand bg-card px-6 py-4 shadow-sm shadow-sky-500/10">
            <div className="text-sm font-medium text-muted-foreground">After</div>
            <div className="text-5xl font-extrabold text-primary tabular-nums" data-testid="post-score">
              {post}/{spec.assessment.post.length}
            </div>
          </div>
          <p className="max-w-md text-lg leading-relaxed">
            {post !== null && post > pre && "You moved. The game made you use the ideas, not just recognize them."}
            {post !== null && post === pre && pre === spec.assessment.pre.length && "Perfect both times. Try a harder length or another genre."}
            {post !== null && post === pre && pre < spec.assessment.pre.length && "Same score. The weak spots below are where to focus."}
            {post !== null && post < pre && "A dip. Replay the weak spots below; the second pass usually sticks."}
          </p>
        </div>
        {postSkipped > 0 && (
          <p className="mt-2 text-base text-muted-foreground">
            {postSkipped} post-check question{postSkipped === 1 ? "" : "s"} skipped, counted as missed above.
          </p>
        )}
      </section>

      <section aria-labelledby="mastery-heading">
        <h2 id="mastery-heading" className="text-2xl font-bold tracking-tight">
          Mastery by concept
        </h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {spec.concepts.map((c) => {
            const m = mastery[c.id];
            const pct = Math.round((m?.score ?? spec.mastery.initial) * 100);
            return (
              <li key={c.id} className="rounded-2xl border border-border bg-card p-4" data-testid="mastery-row">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-medium">{c.name}</span>
                  <span className="text-lg tabular-nums text-muted-foreground">
                    {pct}% · {m?.firstTryCorrect ?? 0} first-try of {m?.attempts ?? 0} tries
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name} mastery`}>
                  <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-base text-muted-foreground">{c.learningObjective}</p>
              </li>
            );
          })}
        </ul>
        {telemetry.length === 0 && <p className="mt-3 text-base text-muted-foreground">No play telemetry was recorded for this game, so the bars show the starting value.</p>}
      </section>

      <section aria-labelledby="did-heading">
        <h2 id="did-heading" className="text-2xl font-bold tracking-tight">
          What you just did
        </h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-2">
          {spec.encounters.map((e, i) => (
            <li key={e.id} className="rounded-2xl border border-border bg-card p-4" data-testid="did-card">
              <div className="text-base text-muted-foreground">
                {i + 1}. {insights[e.id]?.cardName ?? e.teachingMechanicId} · {e.role}
              </div>
              <p className="mt-1 text-lg">{e.debriefLine}</p>
              {insights[e.id]?.learningInsight && <p className="mt-2 text-base text-muted-foreground">{insights[e.id].learningInsight}</p>}
              {e.sourceRef && (
                <p className="mt-2 text-sm text-muted-foreground">
                  p. {e.sourceRef.page}: &ldquo;{e.sourceRef.quote}&rdquo;
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="next-heading" className="rounded-3xl border border-border bg-card p-6">
        <h2 id="next-heading" className="text-2xl font-bold tracking-tight">
          What next?
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link href={`/play/${spec.id}`} className="inline-flex h-12 items-center rounded-full border border-border bg-card px-6 text-base font-semibold transition hover:border-brand hover:bg-accent">
            Replay
          </Link>
          <div className="flex items-center gap-2">
            <label htmlFor="regen-genre" className="text-lg">
              Regenerate as
            </label>
            <select id="regen-genre" value={genre} onChange={(e) => setGenre(e.target.value as Genre | "auto")} className="h-11 rounded-full border border-input bg-card px-4 text-base">
              <option value="auto">auto</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <Button size="lg" className="h-11 rounded-full px-5 text-base font-semibold" disabled={busy !== null} onClick={() => regenerate({ genre }, "genre")} data-testid="regenerate-button">
              {busy === "genre" ? "Forging…" : "Go"}
            </Button>
          </div>
          <Button size="lg" variant="outline" className="h-11 rounded-full px-5 text-base font-semibold" disabled={busy !== null} onClick={() => regenerate({ genre: spec.genre, focusWeak: true }, "weak")} data-testid="focus-weak-button">
            {busy === "weak" ? "Forging…" : `Focus on my weak spots (${weakest.map((c) => c.name).join(", ")})`}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-lg text-destructive">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
