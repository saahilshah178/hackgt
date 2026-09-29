import { generateText, Output, type LanguageModel, type ModelMessage } from "ai";
import { z } from "zod";
import type { CriticReport } from "../../contracts/world3d";
import { criticPasses } from "./critics";

/*
 * The Vision Critic (docs/design/60 §2.5): the third critic, and the only one that sees pixels. The Story and World
 * critics read text and a code-made digest; this one is shown SCREENSHOTS of the running game (flyover, explore HUD,
 * conversation, challenge sheet, map, finale view; scripts/world3d-critique.ts takes them in headless Chrome) and
 * grades what a student would actually see. It is a QA tool, not part of generation: nothing here runs in the forge.
 *
 * This file is the pure half: the rubric, the strict LLM-facing schema (same rules as src/contracts/slices.ts: every
 * field required, no string min/max, bounded ints), the message builder (AI SDK v7 `file` parts with an image media
 * type; the old `image` part is deprecated), the verdict/report conversion and the markdown. Code, not the model,
 * decides the verdict via `criticPasses`, exactly as for the other two critics. `runVisionCritic` is the one impure
 * function (a generateText call) and takes the model as an argument so tests inject a MockLanguageModelV4.
 */

export const VISION_CRITERIA = [
  "first_impression",
  "lighting_and_atmosphere",
  "world_detail",
  "composition_and_wayfinding",
  "character_quality",
  "ui_legibility",
  "ui_polish",
  "story_presentation",
] as const;
export type VisionCriterion = (typeof VISION_CRITERIA)[number];

export const VISION_CRITIC_SYSTEM = `You are the Vision Critic for an educational 3D open-world game. A student will play it in a browser on a laptop, at 1280×720. You are shown labelled screenshots of the running game and grade what is actually on screen, not what the designers intended. Score each criterion from 1 (broken) to 5 (excellent); 3 is acceptable. Be specific and fair: a score below 3 must come with an issue that says how to fix it. Judge only what you can see; if a criterion is not visible in any shot, score it from the closest evidence and say so in the note.

Rubric
- first_impression: would a student want to play this? Does the first screen feel like a place and an invitation, not a tech demo or an empty field?
- lighting_and_atmosphere: believable light and shadow, a sky and haze that suit the setting and time of day, colour that unifies the scene, no blown-out or muddy areas.
- world_detail: ground, vegetation, water and architecture read as a real place: varied textures, sensible scale, no flat untextured planes, obvious repetition, floating or clipping objects, or pop-in.
- composition_and_wayfinding: the goal and the leads (where to go next) are visible and readable, the horizon is framed, the screen is not cluttered, and the player knows where to walk.
- character_quality: the player and the characters look like people (proportions, clothing, pose, facing), are distinct from each other and sit properly on the ground; name tags are legible.
- ui_legibility: at 1280×720 every HUD string is readable (size, contrast against the world behind it), nothing overlaps another element or the characters, nothing is cut off at an edge or hidden behind another panel.
- ui_polish: one consistent theme across HUD, dialogue, sheet and map; even spacing and alignment; clear hierarchy (the primary action stands out); nothing looks like an unstyled default.
- story_presentation: the dialogue box and the challenge sheet feel part of the world (framed by it, in its voice and style) rather than a form pasted over a game; the story text is easy to read and the choices are obvious.

Observations: one short note per screenshot, saying what you see there (use the shot id given with each image). Issues: at most 15, most important first. shot is the id of the screenshot where the problem shows (or "all"); problem says what is wrong, concretely (where on screen, what it looks like); fix says exactly what to change (a value, a component or a rule). pass is true only if you would ship this game's look to a student as it is.`;

export interface VisionSlice {
  scores: Record<VisionCriterion, { score: number; note: string }>;
  observations: { shot: string; note: string }[];
  issues: { shot: string; problem: string; fix: string }[];
  pass: boolean;
}

export function visionCriticSchema(): z.ZodType<VisionSlice> {
  const score = z.object({
    score: z.number().int().min(1).max(5).describe("1 = broken, 3 = acceptable, 5 = excellent"),
    note: z.string().describe("one short sentence: what you see that earns this score"),
  });
  return z.object({
    scores: z.object(Object.fromEntries(VISION_CRITERIA.map((c) => [c, score]))),
    observations: z
      .array(
        z.object({
          shot: z.string().describe("the id of the screenshot, as labelled"),
          note: z.string().describe("one or two short sentences: what this screenshot shows and how it looks"),
        }),
      )
      .min(0)
      .max(12)
      .describe("one entry per screenshot"),
    issues: z
      .array(
        z.object({
          shot: z.string().describe('the id of the screenshot where the problem shows, or "all"'),
          problem: z.string().describe("what is wrong, concretely: where on screen and what it looks like"),
          fix: z.string().describe("the change to make: a value, component or rule"),
        }),
      )
      .min(0)
      .max(15)
      .describe("concrete, fixable problems, most important first; empty when there is nothing worth changing"),
    pass: z.boolean().describe("true when the game's look is ready to ship to a student as it is"),
  }) as unknown as z.ZodType<VisionSlice>;
}

// ---------------------------------------------------------------- messages

export interface VisionShot {
  id: string;
  /** what the shot is, for the model: "Explore at the spawn, HUD visible" */
  label: string;
  png: Buffer | Uint8Array;
}

/**
 * The user message: an intro line, then for each shot a text part naming it followed by an image part. AI SDK v7 image
 * part = `{ type: "file", mediaType: "image/png", data: { type: "data", data: <bytes> } }`.
 */
export function buildVisionMessages(shots: readonly VisionShot[], context = ""): ModelMessage[] {
  const content: Extract<ModelMessage, { role: "user" }>["content"] & unknown[] = [
    {
      type: "text",
      text: [
        context,
        `Here are ${shots.length} screenshots of the running game at 1280×720, in play order. Score them against the rubric and list what to fix.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
  for (const s of shots) {
    content.push({ type: "text", text: `Screenshot "${s.id}": ${s.label}` });
    content.push({ type: "file", mediaType: "image/png", data: { type: "data", data: new Uint8Array(s.png) } });
  }
  return [{ role: "user", content }];
}

/** One generateText call: the rubric as the system prompt, the shots as the user message. The caller supplies the model. */
export async function runVisionCritic(model: LanguageModel, shots: readonly VisionShot[], context = ""): Promise<VisionSlice> {
  const { output } = await generateText({
    model,
    system: VISION_CRITIC_SYSTEM,
    messages: buildVisionMessages(shots, context),
    output: Output.object({ schema: visionCriticSchema(), name: "vision_critic" }),
    maxRetries: 2,
  });
  return output as VisionSlice;
}

// ---------------------------------------------------------------- verdict and report

export interface VisionVerdict {
  pass: boolean;
  /** what the model said; code's rule is `pass` */
  modelPass: boolean;
  mean: number;
  scores: { criterion: VisionCriterion; score: number; note: string }[];
  observations: { shot: string; note: string }[];
  issues: { shot: string; problem: string; fix: string }[];
}

/** Code decides: every score ≥ CRITIC_MIN_SCORE and the mean ≥ CRITIC_PASS_MEAN (critics.ts). */
export function toVisionVerdict(slice: VisionSlice): VisionVerdict {
  const scores = VISION_CRITERIA.map((criterion) => ({ criterion, score: slice.scores[criterion]?.score ?? 1, note: slice.scores[criterion]?.note ?? "" }));
  const values = scores.map((s) => s.score);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { pass: criticPasses(values), modelPass: slice.pass, mean: Math.round(mean * 10) / 10, scores, observations: slice.observations, issues: slice.issues };
}

/** The stored form: a CriticReport with critic "vision". `rounds` is 0 (the vision critic never triggers repair rounds). */
export function toVisionReport(v: VisionVerdict, model: string): CriticReport {
  return {
    critic: "vision",
    model,
    pass: v.pass,
    scores: v.scores.map((s) => ({ criterion: s.criterion, score: s.score, note: s.note })),
    issues: v.issues.map((i) => `${i.shot}: ${i.problem} Fix: ${i.fix}`),
    rounds: 0,
  };
}

export interface VisionReportMeta {
  url: string;
  model: string;
  /** true when the verdict came from a canned mock model, not a real vision model */
  mock: boolean;
  when: string;
  shots: { id: string; label: string; file: string }[];
  consoleErrors: string[];
}

/** A human-readable report: the verdict, the score table, per-shot notes with the screenshot, the issues, console errors. */
export function visionMarkdown(v: VisionVerdict, meta: VisionReportMeta): string {
  const lines: string[] = [
    "# World3D vision critique",
    "",
    ...(meta.mock ? ["> MOCK: this verdict came from a canned mock model, not a vision model. It only proves the pipeline runs; the scores mean nothing.", ""] : []),
    `- URL: ${meta.url}`,
    `- Model: ${meta.model}${meta.mock ? " (mock)" : ""}`,
    `- When: ${meta.when}`,
    `- Verdict: **${v.pass ? "PASS" : "FAIL"}** (mean ${v.mean.toFixed(1)} / 5${v.modelPass !== v.pass ? `; the model said ${v.modelPass ? "pass" : "fail"}, the code rule decides` : ""})`,
    "",
    "## Scores",
    "",
    "| Criterion | Score | Note |",
    "| --- | --- | --- |",
    ...v.scores.map((s) => `| ${s.criterion} | ${s.score}/5 | ${s.note.replace(/\|/g, "\\|")} |`),
    "",
    "## Shots",
    "",
    ...meta.shots.flatMap((s) => {
      const obs = v.observations.find((o) => o.shot === s.id);
      return [`### ${s.id}: ${s.label}`, "", `![${s.id}](${s.file})`, "", obs ? obs.note : "_no observation_", ""];
    }),
    "## Issues",
    "",
    ...(v.issues.length === 0 ? ["None."] : v.issues.map((i, n) => `${n + 1}. **${i.shot}**: ${i.problem}\n   - Fix: ${i.fix}`)),
    "",
    "## Console errors",
    "",
    ...(meta.consoleErrors.length === 0 ? ["None."] : meta.consoleErrors.map((e) => `- ${e}`)),
    "",
  ];
  return lines.join("\n");
}

/** A canned passing verdict for the offline `--mock` run: proves the flow end to end, says nothing about the pixels. */
export function mockVisionSlice(shotIds: readonly string[]): VisionSlice {
  const score = { score: 4, note: "mock verdict: no model looked at this" };
  return {
    scores: Object.fromEntries(VISION_CRITERIA.map((c) => [c, score])) as VisionSlice["scores"],
    observations: shotIds.map((shot) => ({ shot, note: "mock observation: no model looked at this screenshot" })),
    issues: [],
    pass: true,
  };
}
