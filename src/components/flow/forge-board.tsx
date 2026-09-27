"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/flow/client-fetch";
import { ForgeSpot } from "@/components/illustrations";

/*
 * /forge/[jobId]: a calm "building your game" screen. The agents' progress stays internal (it still streams
 * over /api/jobs/:id/stream and is kept on the job); the student sees a loader, a status line that moves along,
 * and a rotating fun fact, then lands in the game. No percentages: generation time varies too much to promise one.
 */

const STATUS_LINES = [
  "Reading the concepts you picked…",
  "Writing a lesson for each idea…",
  "Designing the challenges…",
  "Building the world…",
  "Checking every challenge can be solved…",
  "Adding the finishing touches…",
];
const STATUS_EVERY_MS = 9000;

const FUN_FACTS = [
  "Octopuses have three hearts, and two of them stop beating while they swim.",
  "Honey found in ancient Egyptian tombs was still edible after 3,000 years.",
  "A day on Venus is longer than its year.",
  "Bananas are berries, but strawberries are not.",
  "Your brain uses about 20% of your body's energy while weighing about 2% of it.",
  "There are more possible chess games than atoms in the observable universe.",
  "Sharks existed before trees did.",
  "Wombat droppings are cube-shaped.",
  "The Eiffel Tower grows about 15 cm taller in summer as the metal expands.",
  "A group of flamingos is called a flamboyance.",
  "Explaining an idea out loud to someone else is one of the fastest ways to learn it.",
  "Spacing your practice over days beats cramming the same hours into one night.",
  "Sea otters hold hands while they sleep so they don't drift apart.",
  "Light from the Sun takes about 8 minutes and 20 seconds to reach Earth.",
  "The shortest war in recorded history lasted under 40 minutes.",
  "Butterflies taste with their feet.",
  "Testing yourself (retrieval practice) helps memory more than rereading notes.",
  "A single cloud can weigh more than a million pounds.",
  "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.",
  "Hot water can sometimes freeze faster than cold water (the Mpemba effect).",
];
const FACT_EVERY_MS = 6500;

function startIndex(jobId: string, n: number): number {
  let h = 0;
  for (const ch of jobId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % n;
}

export function ForgeBoard({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [done, setDone] = useState<{ gameId: string | null; error: string | null } | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [statusIdx, setStatusIdx] = useState(0);
  const [factIdx, setFactIdx] = useState(() => startIndex(jobId, FUN_FACTS.length));
  const [factVisible, setFactVisible] = useState(true);

  useEffect(() => {
    const s = setInterval(() => setStatusIdx((i) => Math.min(i + 1, STATUS_LINES.length - 1)), STATUS_EVERY_MS);
    let swap: ReturnType<typeof setTimeout> | undefined;
    const f = setInterval(() => {
      setFactVisible(false);
      swap = setTimeout(() => {
        setFactIdx((i) => (i + 1) % FUN_FACTS.length);
        setFactVisible(true);
      }, 350);
    }, FACT_EVERY_MS);
    return () => {
      clearInterval(s);
      clearInterval(f);
      if (swap) clearTimeout(swap);
    };
  }, []);

  useEffect(() => {
    // Create in the effect and close in its cleanup: React StrictMode runs this twice in dev.
    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    const onDone = (raw: MessageEvent) => {
      const d = JSON.parse(raw.data) as { gameId: string | null; error: string | null };
      setDone(d);
      es.close();
      if (d.gameId) setTimeout(() => router.push(`/play/${d.gameId}`), 600);
    };
    es.addEventListener("done", onDone);
    es.onerror = () => {
      // The stream closes on completion; if we never got "done", ask the job once.
      api<{ status: string; gameId: string | null; error: string | null }>(`/api/jobs/${jobId}`)
        .then((j) => {
          if (j.status === "done" || j.status === "failed") {
            setDone({ gameId: j.gameId, error: j.error });
            if (j.gameId) router.push(`/play/${j.gameId}`);
          }
        })
        .catch(() => undefined);
    };
    api<{ sourceId: string }>(`/api/jobs/${jobId}`)
      .then((j) => setSourceId(j.sourceId))
      .catch(() => undefined);
    return () => es.close();
  }, [jobId, router]);

  if (done?.error) {
    return (
      <div data-testid="forge-board" className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-16 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">That game didn&apos;t come together</h1>
        <p role="alert" className="text-lg text-muted-foreground" data-testid="forge-error">
          Something went wrong while building it. Picking fewer concepts or a longer game usually helps.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {sourceId && (
            <Link
              href={`/intake/${sourceId}`}
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground shadow-md shadow-sky-600/20 transition hover:bg-primary/90"
            >
              Try again
            </Link>
          )}
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-7 text-base font-semibold transition hover:border-brand hover:bg-accent"
          >
            Start over
          </Link>
        </div>
        <details className="w-full rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-left text-base text-muted-foreground">
          <summary className="cursor-pointer font-medium">Technical details</summary>
          <p className="mt-2 break-words">{done.error}</p>
        </details>
      </div>
    );
  }

  return (
    <div data-testid="forge-board" className="mx-auto flex max-w-2xl flex-col items-center gap-10 py-16 text-center">
      <div className="relative flex size-36 items-center justify-center" aria-hidden="true">
        <div className="absolute inset-0 rounded-full border-4 border-brand/15" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand motion-safe:animate-spin" />
        <div className="absolute inset-4 rounded-full bg-brand-soft motion-safe:animate-pulse" />
        <ForgeSpot className="relative w-20" />
      </div>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{done?.gameId ? "Your game is ready" : "Building your game"}</h1>
        <p role="status" aria-live="polite" className="mt-3 min-h-8 text-lg font-medium text-muted-foreground" data-testid="forge-status">
          {done?.gameId ? "Opening it now…" : STATUS_LINES[statusIdx]}
        </p>
        {!done && <p className="mt-1 text-base text-muted-foreground">This usually takes about a minute.</p>}
      </div>
      {done?.gameId ? (
        <Link
          href={`/play/${done.gameId}`}
          className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-md shadow-sky-600/20 transition hover:bg-primary/90"
        >
          Enter the game
        </Link>
      ) : (
        <figure className="w-full rounded-3xl border border-border bg-gradient-to-br from-accent via-card to-card px-8 py-6 shadow-sm" data-testid="fun-fact">
          <figcaption className="text-sm font-semibold tracking-wide text-primary uppercase">Did you know?</figcaption>
          <blockquote className={`mt-2 min-h-16 text-xl leading-relaxed transition-opacity duration-300 ${factVisible ? "opacity-100" : "opacity-0"}`}>
            {FUN_FACTS[factIdx]}
          </blockquote>
        </figure>
      )}
    </div>
  );
}
