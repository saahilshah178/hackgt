import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { UploadPanel } from "@/components/upload-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TAGLINE } from "@/config";

/** Demo insurance: three showcase games that play from fixtures with zero keys (P11 fills the last two). */
const SHOWCASE = [
  {
    title: "Trigonometry",
    subtitle: "The Clockwork Crypt · Dungeon",
    blurb: "Dial a vault door's period, expose the amplitude mimic, lay the planks that solve 2sin(x) = 1.",
    href: "/play/fixture-trig",
    concepts: "radians · period · amplitude · solving sin x = k",
  },
  {
    title: "Cell transport",
    subtitle: "Biology · Dungeon",
    blurb: "Route molecules through the membrane, predict which way water moves, pump ions against the gradient.",
    href: "/play/fixture-cell-transport",
    concepts: "diffusion · osmosis · active transport · selectivity",
  },
  {
    title: "Civil rights history",
    subtitle: "History · Mystery",
    blurb: "Chain causes to consequences, sort primary from secondary sources, eliminate hypotheses on the corkboard.",
    href: "/play/fixture-civil-rights-mystery",
    concepts: "chronology · cause & effect · sources · inference",
  },
];

export default function Home() {
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

      <section className="mt-16" aria-labelledby="showcase-heading">
        <h2 id="showcase-heading" className="text-3xl font-semibold">
          Showcase games
        </h2>
        <p className="mt-2 text-lg text-muted-foreground">Pre-generated and playable right now, no keys needed.</p>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {SHOWCASE.map((g) => (
            <Card key={g.href} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-2xl">{g.title}</CardTitle>
                <CardDescription className="text-base">{g.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-lg">{g.blurb}</p>
                <p className="text-sm text-muted-foreground">{g.concepts}</p>
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
      </section>
    </AppShell>
  );
}
