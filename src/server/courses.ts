import type { Subject } from "@/components/illustrations";
import type { Genre } from "@/contracts/common";
import { GENRE_INFO } from "@/library/genres";
import { loadFixtureSpec } from "./fixtures";

/** A showcase example: a shipped fixture game shown as an AI-generated example on the home and learn pages. */
export interface CourseMeta {
  /** Route id: `/learn/<routeId>` and `/play/<routeId>`. */
  routeId: string;
  subject: Subject;
  subjectLabel: string;
  blurb: string;
}

export interface Course extends CourseMeta {
  /** The GameSpec's own id, which is what the end screen stashes telemetry under. */
  specId: string;
  title: string;
  genre: string;
  conceptCount: number;
  exerciseCount: number;
  minutes: number;
}

export const COURSES: CourseMeta[] = [
  {
    routeId: "fixture-trig",
    subject: "trig",
    subjectLabel: "Trigonometry",
    blurb: "Dial a vault door's period, expose the amplitude mimic, lay the planks that solve 2sin(x) = 1.",
  },
  {
    routeId: "fixture-cell-transport",
    subject: "cells",
    subjectLabel: "Cell transport",
    blurb: "Route molecules through the membrane, predict which way water moves, pump ions against the gradient.",
  },
  {
    routeId: "fixture-civil-rights-mystery",
    subject: "history",
    subjectLabel: "Civil rights history",
    blurb: "Chain causes to consequences, sort primary from secondary sources, eliminate hypotheses on the corkboard.",
  },
  {
    routeId: "fixture-trig-platformer",
    subject: "platformer",
    subjectLabel: "Trigonometry",
    blurb: "The same trig material as a side-scroller: bridge the gaps, open the gates, start the moving platform.",
  },
  {
    routeId: "fixture-wave2",
    subject: "lab",
    subjectLabel: "Mixed practice",
    blurb: "The proving ground for newer mechanic families: a sampler of fresh exercise types.",
  },
];

/** Display name for a genre on the example pages; the catalog's platformer name ("obstacle course") reads as a course. */
export function genreLabel(genre: Genre): string {
  if (genre === "platformer") return "Side-scrolling platformer";
  return GENRE_INFO[genre]?.name ?? genre;
}

export async function loadCourse(meta: CourseMeta): Promise<Course> {
  const spec = await loadFixtureSpec(meta.routeId);
  return {
    ...meta,
    specId: spec?.id ?? meta.routeId,
    title: spec?.title ?? meta.subjectLabel,
    genre: spec ? genreLabel(spec.genre) : "",
    conceptCount: spec?.concepts.length ?? 0,
    exerciseCount: spec?.encounters.length ?? 0,
    minutes: spec?.targetMinutes ?? 0,
  };
}

export function loadCourses(): Promise<Course[]> {
  return Promise.all(COURSES.map(loadCourse));
}

export function findCourseMeta(routeId: string): CourseMeta | undefined {
  return COURSES.find((c) => c.routeId === routeId);
}
