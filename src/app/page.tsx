import Link from "next/link";
import { ArrowRight, BarChart3, Clock, FileUp, GraduationCap, Layers, ListChecks, Play, SlidersHorizontal, Sparkles, Wand2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { UploadPanel } from "@/components/upload-panel";
import { CourseProgress } from "@/components/course-progress";
import { HeroIllustration, SubjectArt } from "@/components/illustrations";
import { APP_TAGLINE } from "@/config";
import { loadCourses, type Course } from "@/server/courses";

const HOW_IT_WORKS = [
  { step: "Upload", detail: "A PDF chapter, pasted notes, or just a topic name.", icon: FileUp },
  { step: "Pick", detail: "The concepts to cover and how long a game (optional quick check).", icon: SlidersHorizontal },
  { step: "Generate", detail: "Build a game from your own material.", icon: Wand2 },
  { step: "Learn & play", detail: "A guide teaches each idea, then the game has you use it.", icon: GraduationCap },
  { step: "Debrief", detail: "Your before → after score and what to review next.", icon: BarChart3 },
];

export default async function Home() {
  const courses = await loadCourses();

  return (
    <AppShell>
      <section className="grid items-center gap-10 pb-6 md:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-foreground">
            <Sparkles className="size-4" aria-hidden />
            Learn by playing
          </span>
          <h1 className="mt-5 text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">{APP_TAGLINE}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Upload a chapter, paste notes, or name a topic. After a few questions, you&apos;ll get a game that both teaches
            and tests you on the material you uploaded. Have fun!
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="#start"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground shadow-md shadow-sky-600/20 transition hover:-translate-y-0.5 hover:bg-primary/90"
            >
              Start a new lesson
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="#examples"
              className="inline-flex h-12 items-center rounded-full border border-border bg-card px-6 text-base font-semibold transition hover:border-brand hover:bg-accent"
            >
              See example games
            </Link>
          </div>
        </div>
        <HeroIllustration className="mx-auto w-full max-w-md md:max-w-none" />
      </section>

      <section id="start" className="mt-16 scroll-mt-24" aria-labelledby="start-heading">
        <div className="grid gap-8 rounded-3xl bg-gradient-to-br from-accent via-card to-card p-6 ring-1 ring-border sm:p-10 lg:grid-cols-[1fr_1.4fr] lg:gap-12">
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">Make your own</p>
            <h2 id="start-heading" className="mt-1 text-3xl font-bold tracking-tight">
              Start a new lesson
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Bring your own material. We&apos;ll map the concepts, let you pick exactly which ones to cover, teach each
              idea, and build a game that has you use it.
            </p>
            <ul className="mt-6 flex flex-col gap-3 text-base">
              {["Works with a chapter or a whole textbook PDF", "Or paste notes, or just name a topic", "Every game is checked to be winnable"].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-accent-foreground">
                    <ListChecks className="size-3.5" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <UploadPanel />
        </div>
      </section>

      <section id="examples" className="mt-20 scroll-mt-24" aria-labelledby="ways-heading">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">Examples</p>
        <h2 id="ways-heading" className="mt-1 text-3xl font-bold tracking-tight">
          Four ways to play
        </h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2" data-testid="ways-to-play">
          {courses.map((c) => (
            <li key={c.routeId}>
              <CourseCard course={c} />
            </li>
          ))}
        </ul>
      </section>

      <section id="how" className="mt-20 scroll-mt-24" aria-labelledby="how-heading">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">The path</p>
        <h2 id="how-heading" className="mt-1 text-3xl font-bold tracking-tight">
          How it works
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {HOW_IT_WORKS.map((s, i) => (
            <li key={s.step} className="relative rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-accent-foreground">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold">{s.step}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Learn first, then play it.</strong> Every idea is taught before you&apos;re
          asked to use it, and the Field guide keeps the key facts, formulas and common mistakes one keypress away.
        </p>
      </section>

    </AppShell>
  );
}

function CourseCard({ course: c }: { course: Course }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card transition hover:-translate-y-1 hover:border-brand hover:shadow-xl hover:shadow-sky-900/5">
      <div className="relative aspect-[16/9] overflow-hidden">
        <SubjectArt subject={c.subject} className="size-full transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute top-3 left-3 rounded-full bg-card/90 px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur">{c.subjectLabel}</span>
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-xs font-semibold text-accent-foreground shadow-sm backdrop-blur">
          <Sparkles className="size-3.5" aria-hidden />
          AI-generated
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          {c.genre && (
            <p className="text-sm font-semibold text-primary">
              {c.genre}
              {c.perspective && <span className="font-medium text-muted-foreground"> · {c.perspective}</span>}
            </p>
          )}
          <h3 className="mt-1 text-xl leading-snug font-bold">{c.title}</h3>
          <p className="mt-2 text-sm leading-relaxed">
            <strong>How you progress:</strong> {c.blurb}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">You&apos;ll be:</strong> {c.interactions}
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <Layers className="size-4" aria-hidden />
            {c.conceptCount} concept{c.conceptCount === 1 ? "" : "s"}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <ListChecks className="size-4" aria-hidden />
            {c.exerciseCount} exercises
          </li>
          {c.minutes > 0 && (
            <li className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              {c.minutes} min
            </li>
          )}
        </ul>
        <div className="mt-auto flex flex-col gap-4">
          <CourseProgress specId={c.specId} exerciseCount={c.exerciseCount} title={c.title} />
          <div className="flex gap-2">
            <Link
              href={`/play/${c.routeId}`}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <Play className="size-4 fill-current" aria-hidden />
              Play
            </Link>
            <Link
              href={`/learn/${c.routeId}`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 font-semibold transition hover:border-brand hover:bg-accent"
            >
              Overview
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
