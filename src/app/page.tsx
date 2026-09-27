import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { UploadPanel } from "@/components/upload-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Genre } from "@/contracts/common";
import { GENRE_INFO } from "@/library/genres";
import { GENRE_LABELS } from "@/library/genre-labels";
import { APP_TAGLINE } from "@/config";

/**
 * One topic, many kinds of game: the board genres progress without walking right. Each card names the perspective and
 * the progression verb, so the variety is visible before anyone clicks Play.
 */
const WAYS_TO_PLAY: { fixture: string; href: string; genre: Genre; progress: string; interactions: string }[] = [
  {
    fixture: "cell-transport-cozy",
    href: "/play/fixture-cell-transport-cozy",
    genre: "strategy",
    progress: "Villagers bring requests each day; answer them to earn coins, build up the town and light the festival.",
    interactions: "Sorting molecules into routes, matching pumps to jobs, explaining osmosis to a villager",
  },
  {
    fixture: "cell-transport-casefile",
    href: "/play/fixture-cell-transport-casefile",
    genre: "mystery",
    progress: "Search the lab for clues, combine two clues into a lead, crack it for a deduction, then accuse.",
    interactions: "Clue combination, cause-and-effect chains, sorting evidence, explaining osmosis to your partner",
  },
  {
    fixture: "civil-rights-explorer",
    href: "/play/fixture-civil-rights-explorer",
    genre: "explorer",
    progress: "Walk a bird's-eye map in any order; each place you understand opens the road to the next, past patrols.",
    interactions: "Pathfinding, timelines, linking causes to consequences",
  },
  {
    fixture: "civil-rights-story",
    href: "/play/fixture-civil-rights-story",
    genre: "story",
    progress: "A branching reporter's notebook: pick which thread to follow, and explain what you saw to move the story.",
    interactions: "Story choices, written explanations, eliminating hypotheses",
  },
];

/** Reads a shipped fixture GameSpec for its title, genre and concept count instead of hand-copying them here. */
async function readFixtureMeta(fixture: string): Promise<{ title: string; genre: string; conceptCount: number } | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "fixtures", `${fixture}.json`), "utf8");
    const spec = JSON.parse(raw) as { title: string; genre: Genre; concepts: { id: string }[] };
    return { title: spec.title, genre: GENRE_INFO[spec.genre]?.name ?? spec.genre, conceptCount: spec.concepts.length };
  } catch {
    return null;
  }
}

const HOW_IT_WORKS: { step: string; detail: string }[] = [
  { step: "Upload", detail: "a PDF chapter, pasted notes, or just a topic name" },
  { step: "Pick", detail: "the concepts to cover and how long a game (optional quick check)" },
  { step: "Generate", detail: "about a minute to build a game from your own material" },
  { step: "Learn & play", detail: "a guide teaches each idea, then the game has you use it" },
  { step: "Debrief", detail: "before → after score and what to review next" },
];

export default async function Home() {
  const wayMetas = await Promise.all(WAYS_TO_PLAY.map((w) => readFixtureMeta(w.fixture)));

  return (
    <AppShell>
      <section className="mb-12">
        <h1 className="text-5xl font-bold leading-tight tracking-tight">{APP_TAGLINE}</h1>
        <p className="mt-4 max-w-3xl text-xl text-muted-foreground">
          Upload a chapter, paste notes, or name a topic. In about a minute you get a game that teaches you the material
          and then has you use it: a guide explains each idea from your own notes, and the concept <em>is</em> the rules of
          play, not trivia between moves.
        </p>
      </section>

      <UploadPanel />

      <section className="mt-16" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-2xl font-semibold">
          How it works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {HOW_IT_WORKS.map((s, i) => (
            <li key={s.step} className="rounded-lg border border-border/60 bg-card p-4">
              <div className="text-base text-muted-foreground">Step {i + 1}</div>
              <div className="text-xl font-semibold">{s.step}</div>
              <p className="mt-1 text-base text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-3xl text-lg">
          <strong>Learn first, then play it.</strong> Every idea is taught before you&apos;re asked to use it, and the Field
          guide keeps the key facts, formulas and common mistakes one keypress away.
        </p>
      </section>

      <section className="mt-16" aria-labelledby="ways-heading">
        <h2 id="ways-heading" className="text-3xl font-semibold">
          Four ways to play
        </h2>
        <p className="mt-2 max-w-3xl text-lg text-muted-foreground">
          The same study material becomes very different games. Each genre has its own perspective and its own way of making
          progress, and most of them have no avatar at all. Pre-generated and playable now, no keys needed.
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2" data-testid="ways-to-play">
          {WAYS_TO_PLAY.map((w, i) => (
            <Card key={w.href} className="flex flex-col">
              <CardHeader>
                <CardDescription className="text-base font-semibold uppercase tracking-wide">
                  {GENRE_LABELS[w.genre].name} · {GENRE_LABELS[w.genre].perspective}
                </CardDescription>
                <CardTitle className="text-2xl">{wayMetas[i]?.title ?? w.fixture}</CardTitle>
                <p className="text-base text-muted-foreground">{subjectFor(w.fixture)}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="text-lg">
                  <strong>How you progress:</strong> {w.progress}
                </p>
                <p className="text-base text-muted-foreground">
                  <strong>You&apos;ll be:</strong> {w.interactions}
                </p>
                <Link
                  href={w.href}
                  className="mt-auto inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-lg font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  Play
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

    </AppShell>
  );
}

function subjectFor(fixture: string): string {
  if (fixture.startsWith("trig")) return "Trigonometry";
  if (fixture.startsWith("cell")) return "Cell transport";
  if (fixture.startsWith("civil-rights")) return "Civil rights history";
  return fixture;
}
