"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ProgressEvent } from "@/contracts/progress";
import { api, titleCase } from "@/components/flow/client-fetch";
import { ForgeSpot } from "@/components/illustrations";

interface AgentCard {
  agent: string;
  status: ProgressEvent["status"];
  startedAt: number;
  endedAt: number | null;
  note: string;
  repairs: number;
}

const ORDER = ["gatekeeper", "curriculum", "matcher", "director", "challenge", "narrative", "assessment", "audio", "verifier"];
const label = (agent: string) => {
  const [kind, id] = agent.split(":");
  if (kind === "challenge") return `Challenge writer · ${id}`;
  if (kind === "blind") return `Blind solver · ${id}`;
  return titleCase(kind);
};
const rank = (agent: string) => {
  const i = ORDER.indexOf(agent.split(":")[0]);
  return i === -1 ? ORDER.length : i;
};

/**
 * /forge/[jobId]: one live card per agent (status, elapsed, latest note) fed by the SSE stream.
 * Cards keep a fixed height and are added in pipeline order so nothing shifts while streaming.
 */
export function ForgeBoard({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [cards, setCards] = useState<Record<string, AgentCard>>({});
  const [catches, setCatches] = useState<{ text: string; warn: boolean }[]>([]);
  const [done, setDone] = useState<{ gameId: string | null; error: string | null } | null>(null);
  const [wishlist, setWishlist] = useState<{ conceptId: string; teachingMechanicId: string }[]>([]);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Create in the effect and close in its cleanup: React StrictMode runs this twice in dev, and a ref
    // guard here would leave the page listening to an EventSource the first cleanup already closed.
    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    const onProgress = (raw: MessageEvent) => {
      const e = JSON.parse(raw.data) as ProgressEvent;
      const at = e.at ? Date.parse(e.at) : Date.now();
      setCards((prev) => {
        const cur = prev[e.agent] ?? { agent: e.agent, status: "start", startedAt: at, endedAt: null, note: "", repairs: 0 };
        const next: AgentCard = {
          ...cur,
          status: e.status,
          note: e.note ?? cur.note,
          repairs: cur.repairs + (e.status === "repair" ? 1 : 0),
          endedAt: e.status === "done" || e.status === "failed" || e.status === "fallback" ? at : cur.endedAt,
        };
        return { ...prev, [e.agent]: next };
      });
      if (e.note && (e.agent === "verifier" || e.status === "fallback" || e.status === "repair")) {
        const text = `${e.agent}: ${e.note}`;
        const warn = e.status === "fallback" || e.status === "repair";
        setCatches((prev) => (prev.some((c) => c.text === text) ? prev : [...prev, { text, warn }]));
      }
    };
    const onDone = (raw: MessageEvent) => {
      const d = JSON.parse(raw.data) as { gameId: string | null; error: string | null };
      setDone(d);
      es.close();
      if (d.gameId) setTimeout(() => router.push(`/play/${d.gameId}`), 1200);
    };
    es.addEventListener("progress", onProgress);
    es.addEventListener("done", onDone);
    es.onmessage = onProgress; // servers that don't name events
    es.onerror = () => {
      // The stream closes on completion; if we never got "done", poll the job once.
      api<{ status: string; gameId: string | null; error: string | null }>(`/api/jobs/${jobId}`)
        .then((j) => {
          if (j.status === "done" || j.status === "failed") setDone({ gameId: j.gameId, error: j.error });
        })
        .catch(() => undefined);
    };
    api<{ sourceId: string }>(`/api/jobs/${jobId}`)
      .then((j) => {
        setSourceId(j.sourceId);
        return api<{ conceptId: string; wishlist: { teachingMechanicId: string }[] }[] | { pending: true }>(`/api/sources/${j.sourceId}/matches`);
      })
      .then((m) => {
        if (Array.isArray(m)) setWishlist(m.flatMap((r) => r.wishlist.slice(0, 2).map((w) => ({ conceptId: r.conceptId, teachingMechanicId: w.teachingMechanicId }))));
      })
      .catch(() => undefined);
    return () => es.close();
  }, [jobId, router]);

  const list = useMemo(() => Object.values(cards).sort((a, b) => rank(a.agent) - rank(b.agent) || a.startedAt - b.startedAt), [cards]);
  const finished = list.filter((c) => c.status === "done").length;

  return (
    <div data-testid="forge-board">
      <div className="flex flex-col-reverse items-start gap-6 rounded-3xl bg-gradient-to-br from-accent via-card to-card p-6 ring-1 ring-border sm:flex-row sm:items-center sm:p-8">
        <div className="w-full flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Forging your game</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            One card per agent. The verifier checks every encounter is winnable and never leaks an answer.
          </p>
          <div role="status" aria-live="polite" className="mt-4 min-h-7 text-base font-medium">
            {done?.error && <span className="text-destructive">Generation failed: {done.error}</span>}
            {done?.gameId && <span className="text-success">Done. Opening your game…</span>}
            {!done && `${finished} of ${Math.max(list.length, 1)} agents finished`}
          </div>
          <div className="mt-3 h-2.5 w-full max-w-xl overflow-hidden rounded-full bg-secondary" aria-hidden>
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${done?.gameId ? "bg-success" : "bg-brand"}`}
              style={{ width: `${done?.gameId ? 100 : list.length ? Math.round((finished / list.length) * 100) : 4}%` }}
            />
          </div>
        </div>
        <ForgeSpot className="w-28 shrink-0 sm:w-36" />
      </div>

      {done?.gameId && (
        <Link
          href={`/play/${done.gameId}`}
          className="mt-4 inline-flex h-14 items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-md shadow-sky-600/20 transition hover:bg-primary/90"
        >
          Enter the game
        </Link>
      )}

      {done?.error && (
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-lg">{done.error}</p>
          {sourceId && (
            <Link href={`/intake/${sourceId}`} className="text-lg font-medium underline underline-offset-4">
              Back to intake
            </Link>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((c) => {
          const elapsed = ((c.endedAt ?? now) - c.startedAt) / 1000;
          const tone =
            c.status === "done" ? "border-success/50" : c.status === "failed" ? "border-destructive" : c.status === "fallback" ? "border-amber-300" : "border-primary/60 animate-pulse";
          return (
            <article key={c.agent} className={`flex h-40 flex-col rounded-2xl border-2 bg-card p-4 ${tone}`} data-testid="agent-card" data-agent={c.agent} data-status={c.status}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="truncate text-xl font-semibold">{label(c.agent)}</h2>
                <span className="text-base tabular-nums text-muted-foreground">{elapsed.toFixed(1)}s</span>
              </div>
              <p className={`mt-1 text-lg ${c.status === "fallback" ? "font-semibold text-warning" : ""}`}>
                {c.status === "start" && "working…"}
                {c.status === "repair" && `repairing (${c.repairs})…`}
                {c.status === "done" && "done"}
                {c.status === "fallback" && "fell back to a safe default"}
                {c.status === "failed" && "failed"}
              </p>
              <p
                className={`mt-auto line-clamp-2 text-base ${
                  c.status === "fallback" || c.status === "repair" ? "font-medium text-warning" : "text-muted-foreground"
                }`}
                title={c.note}
              >
                {c.note}
              </p>
            </article>
          );
        })}
        {list.length === 0 && !done && (
          <article className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-border p-4 text-lg text-muted-foreground">
            Connecting to the forge…
          </article>
        )}
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section aria-labelledby="catches-heading">
          <h2 id="catches-heading" className="text-2xl font-bold tracking-tight">
            Verifier catches
          </h2>
          <ul className="mt-3 min-h-16 space-y-2 text-lg">
            {catches.length === 0 && <li className="text-muted-foreground">Nothing caught yet.</li>}
            {catches.map((c) => (
              <li
                key={c.text}
                className={
                  c.warn
                    ? "rounded-xl border border-amber-200 bg-warning-soft px-3 py-2 font-medium text-warning"
                    : "rounded-xl bg-secondary px-3 py-2"
                }
              >
                {c.text}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="wishlist-heading">
          <h2 id="wishlist-heading" className="text-2xl font-bold tracking-tight">
            Wishlist: great mechanics whose family isn&apos;t built yet
          </h2>
          <ul className="mt-3 min-h-16 space-y-2 text-lg">
            {wishlist.length === 0 && <li className="text-muted-foreground">No wishlist for this material.</li>}
            {wishlist.map((w) => (
              <li key={`${w.conceptId}:${w.teachingMechanicId}`} className="rounded-xl bg-secondary px-3 py-2">
                {titleCase(w.teachingMechanicId)} <span className="text-muted-foreground">for {w.conceptId}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
