import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, ChevronRight, CircleHelp, Clock, Gamepad2, Layers, Library, ListChecks, Play, Sparkles, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CourseProgress, ExerciseChecklist, type ExerciseItem } from "@/components/course-progress";
import { SubjectArt, type Subject } from "@/components/illustrations";
import type { GameSpec } from "@/contracts/gamespec";
import { COURSES, findCourseMeta, genreLabel, loadCourse } from "@/server/courses";
import { loadFixtureSpec } from "@/server/fixtures";
import { getGameSpecById } from "@/server/storage";

async function loadSpec(id: string): Promise<GameSpec | null> {
  const fixture = await loadFixtureSpec(id);
  if (fixture) return fixture;
  try {
    return await getGameSpecById(id);
  } catch {
    return null;
  }
}

const GENRE_SUBJECT: Record<GameSpec["genre"], Subject> = {
  dungeon: "trig",
  mystery: "history",
  platformer: "platformer",
  puzzle: "lab",
  strategy: "cells",
};

/** /learn/[id]: the overview for one generated game: preview, lessons, exercises, progress and next steps. */
export default async function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spec = await loadSpec(id);

  if (!spec) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg py-16 text-center">
          <h1 className="text-3xl font-bold">Game not found</h1>
          <p className="mt-3 text-lg text-muted-foreground">We couldn&apos;t find a game with id &ldquo;{id}&rdquo;.</p>
          <Link href="/#examples" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 font-semibold text-primary-foreground">
            See example games
          </Link>
        </div>
      </AppShell>
    );
  }

  const meta = findCourseMeta(id);
  const subject = meta?.subject ?? GENRE_SUBJECT[spec.genre];
  const genre = genreLabel(spec.genre);
  const conceptName = new Map(spec.concepts.map((c) => [c.id, c.name]));
  const exercises: ExerciseItem[] = spec.encounters.map((e) => ({
    id: e.id,
    prompt: e.prompt,
    role: e.role,
    concepts: e.conceptIds.map((cid) => conceptName.get(cid) ?? cid).join(" · "),
  }));
  const recommended = await Promise.all(COURSES.filter((c) => c.routeId !== id).slice(0, 3).map(loadCourse));

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-1">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <ChevronRight className="size-4" aria-hidden />
          </li>
          <li className="flex items-center gap-1">
            <Link href={meta ? "/#examples" : "/#start"} className="hover:text-primary">
              {meta ? "Example games" : "Your games"}
            </Link>
            <ChevronRight className="size-4" aria-hidden />
          </li>
          <li aria-current="page" className="font-medium text-foreground">
            {spec.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-12">
          <section aria-labelledby="game-title">
            <Link
              href={`/play/${id}`}
              className="group relative block aspect-video overflow-hidden rounded-3xl ring-1 ring-border"
              aria-label={`Play ${spec.title}`}
            >
              <SubjectArt subject={subject} className="size-full transition-transform duration-500 group-hover:scale-[1.03]" />
              <span className="absolute inset-0 bg-gradient-to-t from-slate-900/45 via-transparent to-transparent" aria-hidden />
              <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
                <span className="flex size-20 items-center justify-center rounded-full bg-card/95 text-primary shadow-xl transition group-hover:scale-110 sm:size-24">
                  <Play className="ml-1 size-9 fill-current sm:size-10" />
                </span>
              </span>
              <span className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-white" aria-hidden>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/50 px-3 py-1 backdrop-blur">
                  <Gamepad2 className="size-4" />
                  Interactive lesson
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/50 px-3 py-1 backdrop-blur">
                  <Clock className="size-4" />
                  {spec.targetMinutes} min
                </span>
              </span>
            </Link>

            <div className="mt-8">
              <p className="text-sm font-semibold text-primary">
                {meta?.subjectLabel ?? spec.source.title} · {genre}
              </p>
              <h1 id="game-title" className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {spec.title}
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">{spec.premise}</p>
              <ul className="mt-6 flex flex-wrap gap-2 text-sm font-medium">
                {[
                  { icon: Layers, text: `${spec.concepts.length} concepts` },
                  { icon: ListChecks, text: `${spec.encounters.length} exercises` },
                  { icon: Clock, text: `About ${spec.targetMinutes} minutes` },
                  { icon: CircleHelp, text: "Before & after check" },
                ].map((chip) => (
                  <li key={chip.text} className="inline-flex items-center gap-2 rounded-full bg-secondary px-3.5 py-1.5">
                    <chip.icon className="size-4 text-primary" aria-hidden />
                    {chip.text}
                  </li>
                ))}
              </ul>
              <p className="mt-6 flex max-w-3xl items-start gap-3 rounded-2xl bg-accent/70 p-4 text-sm leading-relaxed text-accent-foreground">
                <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <strong>{meta ? "Example game, generated by our AI" : "Generated by our AI"}</strong>{" "}
                  {spec.source.unsourced ? (
                    <>from general knowledge about this topic, not from an uploaded source.</>
                  ) : (
                    <>
                      from the study material &ldquo;{spec.source.title}&rdquo;. The lessons and exercises below were built from that material.
                    </>
                  )}{" "}
                  {meta && "Upload your own notes to get a game like this one."}
                </span>
              </p>
            </div>
          </section>

          <section aria-labelledby="lessons-heading">
            <h2 id="lessons-heading" className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
              <BookOpen className="size-6 text-primary" aria-hidden />
              What you&apos;ll learn
            </h2>
            <div className="mt-5 flex flex-col gap-6">
              {spec.units.map((unit, ui) => {
                const concepts = spec.concepts.filter((c) => c.unitId === unit.id);
                if (concepts.length === 0) return null;
                return (
                  <div key={unit.id}>
                    <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                      Unit {ui + 1} · {unit.name}
                    </h3>
                    <ul className="mt-3 grid gap-3 md:grid-cols-2">
                      {concepts.map((c) => (
                        <li key={c.id} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-accent-foreground">
                            <Target className="size-5" aria-hidden />
                          </span>
                          <div>
                            <p className="font-semibold">{c.name}</p>
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.learningObjective}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="exercises-heading">
            <h2 id="exercises-heading" className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
              <ListChecks className="size-6 text-primary" aria-hidden />
              Exercises
            </h2>
            <p className="mt-2 text-base text-muted-foreground">You&apos;ll meet these in order as you play. Each one uses the concept as the rule.</p>
            <div className="mt-5">
              <ExerciseChecklist specId={spec.id} items={exercises} />
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start" aria-label="Game progress and next steps">
          <section aria-labelledby="progress-heading" className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <h2 id="progress-heading" className="text-lg font-bold">
              Your progress
            </h2>
            <div className="mt-4">
              <CourseProgress specId={spec.id} exerciseCount={spec.encounters.length} title={spec.title} />
            </div>
            <Link
              href={`/play/${id}`}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground shadow-md shadow-sky-600/20 transition hover:bg-primary/90"
            >
              <Play className="size-4 fill-current" aria-hidden />
              Play the game
            </Link>
            <Link
              href={`/debrief/${id}`}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border font-semibold transition hover:border-brand hover:bg-accent"
            >
              <BarChart3 className="size-4" aria-hidden />
              Take the after-check
            </Link>
            {meta && (
              <Link
                href="/#start"
                className="mt-5 flex items-center gap-2 border-t border-border pt-5 text-sm font-semibold text-primary hover:underline"
              >
                <Sparkles className="size-4" aria-hidden />
                Make a game from your own notes
                <ArrowRight className="ml-auto size-4" aria-hidden />
              </Link>
            )}
          </section>

          <section aria-labelledby="next-heading" className="rounded-3xl bg-secondary/70 p-6">
            <h2 id="next-heading" className="text-lg font-bold">
              More examples
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {recommended.map((c) => (
                <li key={c.routeId}>
                  <Link href={`/learn/${c.routeId}`} className="group flex items-center gap-3 rounded-2xl bg-card p-2.5 ring-1 ring-border transition hover:ring-brand">
                    <span className="block h-14 w-20 shrink-0 overflow-hidden rounded-xl">
                      <SubjectArt subject={c.subject} className="size-full" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold group-hover:text-primary">{c.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {c.subjectLabel} · {c.exerciseCount} exercises
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/library" className="flex items-center gap-3 rounded-2xl p-2.5 text-sm font-semibold text-primary hover:bg-card">
                  <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
                    <Library className="size-5" aria-hidden />
                  </span>
                  Browse the full library
                  <ArrowRight className="ml-auto size-4" aria-hidden />
                </Link>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
