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

/** Demo insurance (MEGAPROMPT P11): showcase games that play from fixtures with zero keys. */
interface Showcase {
  title: string;
  href: string;
  blurb: string;
  concepts: string;
  conceptCount: number;
  genre: string;
}

const SHOWCASE_META: { fixture: string; href: string; blurb: string }[] = [
  {
    fixture: "trig-dungeon",
    href: "/play/fixture-trig",
    blurb: "Dial a vault door's period, expose the amplitude mimic, lay the planks that solve 2sin(x) = 1.",
  },
  {
    fixture: "cell-transport-dungeon",
    href: "/play/fixture-cell-transport",
    blurb: "Route molecules through the membrane, predict which way water moves, pump ions against the gradient.",
  },
  {
    fixture: "civil-rights-mystery",
    href: "/play/fixture-civil-rights-mystery",
    blurb: "Chain causes to consequences, sort primary from secondary sources, eliminate hypotheses on the corkboard.",
  },
];

/**
 * One topic, many kinds of game: the board genres progress without walking right. Each card names the perspective and
 * the progression verb, so the variety is visible before anyone clicks Play.
 */
const WAYS_TO_PLAY: { fixture: string; href: string; genre: Genre; progress: string; interactions: string }[] = [
  {
    fixture: "trig-puzzle",
    href: "/play/fixture-trig-puzzle",
    genre: "puzzle",
    progress: "Rotate conduit tiles to route a sine wave across the board; a seal only breaks once power reaches it.",
    interactions: "Tile rotation, ordering steps, placing values on a number line, matching waves to amplitudes, explaining why",
  },
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

const WAVE2 = {
  fixture: "wave2-dungeon",
  href: "/play/fixture-wave2",
  blurb: "The proving ground for wave-2 mechanic families as they land tonight.",
};

const PLATFORMER = {
  fixture: "trig-platformer",
  href: "/play/fixture-trig-platformer",
  blurb: "The same trig material as a side-scroller: bridge the gaps, open the gates, start the moving platform.",
};

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
  { step: "Intake", detail: "confidence per unit, goal, length, genre, a 3-question check" },
  { step: "Forge", detail: "agents build a validated GameSpec, live on screen, ~60–90 s" },
  { step: "Play", detail: "the concept is the ruleset, not trivia between jumps" },
  { step: "Debrief", detail: "pre → post score, mastery per concept, what you just did" },
];

export default async function Home() {
  const metas = await Promise.all(SHOWCASE_META.map((s) => readFixtureMeta(s.fixture)));
  const showcase: (Showcase & { subject: string })[] = SHOWCASE_META.map((s, i) => {
    const m = metas[i];
    return {
      title: subjectFor(s.fixture),
      subject: m?.title ?? subjectFor(s.fixture),
      href: s.href,
      blurb: s.blurb,
      concepts: "",
      conceptCount: m?.conceptCount ?? 0,
      genre: m?.genre ?? "",
    };
  });
  const wave2Meta = await readFixtureMeta(WAVE2.fixture);
  const wayMetas = await Promise.all(WAYS_TO_PLAY.map((w) => readFixtureMeta(w.fixture)));
  const platformerMeta = await readFixtureMeta(PLATFORMER.fixture);

  return (
    <AppShell>
      <section className="mb-12">
        <h1 className="text-5xl font-bold leading-tight tracking-tight">{APP_TAGLINE}</h1>
        <p className="mt-4 max-w-3xl text-xl text-muted-foreground">
          Upload a chapter, paste notes, or name a topic. Tell us what you&apos;re shaky on. In about a minute you get a
          game where the concept <em>is</em> the rules: you tune the gate&apos;s period to open the door, you don&apos;t answer
          trivia between jumps.
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
          The core claim: <strong>the concept becomes the rules of the game.</strong> Games are data (a validated
          GameSpec), rendered and graded by hand-built genre hosts and mechanic families &mdash; never generated code.
        </p>
      </section>

      <section className="mt-16" aria-labelledby="ways-heading">
        <h2 id="ways-heading" className="text-3xl font-semibold">
          Not just side-scrollers
        </h2>
        <p className="mt-2 max-w-3xl text-lg text-muted-foreground">
          The same study material becomes very different games. Each genre has its own perspective and its own way of making
          progress, and most of them have no avatar at all. Pre-generated and playable now, no keys needed.
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3" data-testid="ways-to-play">
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

      <section className="mt-16" aria-labelledby="showcase-heading">
        <h2 id="showcase-heading" className="text-3xl font-semibold">
          Side-view adventures
        </h2>
        <p className="mt-2 text-lg text-muted-foreground">The walking genres, for material where a journey fits.</p>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {showcase.map((g) => (
            <Card key={g.href} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-2xl">{g.title}</CardTitle>
                <CardDescription className="text-base">
                  {g.subject} · {g.genre}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-lg">{g.blurb}</p>
                <p className="text-sm text-muted-foreground">{g.conceptCount} concept{g.conceptCount === 1 ? "" : "s"}</p>
                <Link
                  href={g.href}
                  className="mt-auto inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-lg font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  Play
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Trigonometry as a Platformer</CardTitle>
            <CardDescription className="text-base">{platformerMeta?.genre ?? "Platformer"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-base">{PLATFORMER.blurb}</p>
            <p className="text-sm text-muted-foreground">{platformerMeta?.conceptCount ?? 0} concepts</p>
            <Link
              href={PLATFORMER.href}
              className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-5 text-base font-semibold hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Play
            </Link>
          </CardContent>
        </Card>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Wave-2 proving ground</CardTitle>
            <CardDescription className="text-base">{wave2Meta?.genre ?? "Dungeon"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-base">{WAVE2.blurb}</p>
            <p className="text-sm text-muted-foreground">{wave2Meta?.conceptCount ?? 0} concepts</p>
            <Link
              href={WAVE2.href}
              className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-5 text-base font-semibold hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Play
            </Link>
          </CardContent>
        </Card>
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
