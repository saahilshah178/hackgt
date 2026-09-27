import type { Subject } from "@/components/illustrations";
import type { Genre } from "@/contracts/common";
import { GENRE_LABELS } from "@/library/genre-labels";
import { loadFixtureSpec } from "./fixtures";

/** A showcase example: a shipped fixture game shown as an AI-generated example on the home and learn pages. */
export interface CourseMeta {
  /** Route id: `/learn/<routeId>` and `/play/<routeId>`. */
  routeId: string;
  subject: Subject;
  subjectLabel: string;
  /** How the game progresses (each board genre has its own progression verb). */
  blurb: string;
  /** What the player does along the way. */
  interactions: string;
}

export interface Course extends CourseMeta {
  /** The GameSpec's own id, which is what the end screen stashes telemetry under. */
  specId: string;
  title: string;
  genre: string;
  perspective: string;
  conceptCount: number;
  exerciseCount: number;
  minutes: number;
}

export const COURSES: CourseMeta[] = [
  {
    routeId: "fixture-cell-transport-cozy",
    subject: "cells",
    subjectLabel: "Cell transport",
    blurb: "Villagers bring requests each day; answer them to earn coins, build up the town and light the festival.",
    interactions: "Sorting molecules into routes, matching pumps to jobs, explaining osmosis to a villager",
  },
  {
    routeId: "fixture-cell-transport-casefile",
    subject: "cells",
    subjectLabel: "Cell transport",
    blurb: "Search the lab for clues, combine two clues into a lead, crack it for a deduction, then accuse.",
    interactions: "Clue combination, cause-and-effect chains, sorting evidence, explaining osmosis to your partner",
  },
  {
    routeId: "fixture-civil-rights-explorer",
    subject: "history",
    subjectLabel: "Civil rights history",
    blurb: "Walk a bird's-eye map in any order; each place you understand opens the road to the next, past patrols.",
    interactions: "Pathfinding, timelines, linking causes to consequences",
  },
  {
    routeId: "fixture-civil-rights-story",
    subject: "history",
    subjectLabel: "Civil rights history",
    blurb: "A branching reporter's notebook: pick which thread to follow, and explain what you saw to move the story.",
    interactions: "Story choices, written explanations, eliminating hypotheses",
  },
];

/** Display name for a genre on the example pages; the catalog's platformer name ("obstacle course") reads as a course. */
export function genreLabel(genre: Genre): string {
  if (genre === "platformer") return "Side-scrolling platformer";
  return GENRE_LABELS[genre]?.name ?? genre;
}

/** The genre's perspective ("Town view, no avatar", "Bird's-eye maze", …) for the example cards. */
export function genrePerspective(genre: Genre): string {
  return GENRE_LABELS[genre]?.perspective ?? "";
}

export async function loadCourse(meta: CourseMeta): Promise<Course> {
  const spec = await loadFixtureSpec(meta.routeId);
  return {
    ...meta,
    specId: spec?.id ?? meta.routeId,
    title: spec?.title ?? meta.subjectLabel,
    genre: spec ? genreLabel(spec.genre) : "",
    perspective: spec ? genrePerspective(spec.genre) : "",
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
