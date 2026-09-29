import type { Subject } from "@/components/illustrations";
import type { Genre } from "@/contracts/common";
import { GENRE_LABELS } from "@/library/genre-labels";
import { loadFixtureSpec } from "./fixtures";

/** A showcase example: a shipped fixture game shown on the home and learn pages. */
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

/** Every shipped fixture game, in the order the home page groups them. */
export const COURSES: CourseMeta[] = [
  {
    routeId: "fixture-ancient-egypt-world3d",
    subject: "history",
    subjectLabel: "Ancient Egypt · 3D open world",
    blurb: "Roam Giza at golden hour, from the Nile's banks to the Great Pyramid. Its people hold the challenges, and every answer opens the way to the capstone.",
    interactions: "Talking with scribes, farmers and embalmers, reading carvings, weighing the evidence of who built the pyramid, explaining the flood in your own words",
  },
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
    routeId: "fixture-cell-transport",
    subject: "cells",
    subjectLabel: "Cell transport",
    blurb: "The cell's gates open only for a crew that knows what crosses a membrane, how, and at what cost.",
    interactions: "Sorting what can cross, matching each pump to its job, explaining osmosis at the gates",
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
  {
    routeId: "fixture-civil-rights-mystery",
    subject: "history",
    subjectLabel: "Civil rights history",
    blurb: "Search the archive scene by scene, combine clues into leads, and open the vault once the chain of events holds.",
    interactions: "Searching rooms, combining clues, ordering the timeline, judging which source is primary",
  },
  {
    routeId: "fixture-civil-rights-dungeon",
    subject: "history",
    subjectLabel: "Civil rights history",
    blurb: "Move through the archive room by room, rebuild how the movement won its laws, and open the final vault.",
    interactions: "Ordering events, linking a campaign to the law it changed, sorting primary and secondary sources",
  },
  {
    routeId: "fixture-trig-puzzle",
    subject: "lab",
    subjectLabel: "Trigonometry",
    blurb: "Route the wave across the circuit board; each sealed tile opens once you read its rhythm.",
    interactions: "Rotating tiles to connect the circuit, tuning period and amplitude, solving for the angle that breaks a seal",
  },
  {
    routeId: "fixture-trig",
    subject: "trig",
    subjectLabel: "Trigonometry",
    blurb: "Walk the crypt room by room. Each machine moves only when you read its rhythm, and the last one lowers the star chart.",
    interactions: "Setting radians on a dial, matching period and amplitude, solving the equation that opens the vault",
  },
  {
    routeId: "fixture-trig-platformer",
    subject: "platformer",
    subjectLabel: "Trigonometry",
    blurb: "Run the gantry, clear every gear and gate, and tune the last one so the star chart can drop.",
    interactions: "Running and jumping between gates, tuning period and amplitude, solving for the angle that opens the way",
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
