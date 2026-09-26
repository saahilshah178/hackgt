import { z } from "zod";
import { defineMode } from "../../types";
import { evalExact, shuffleNotIdentity } from "../../util";

/* sequencer · timeline: events with sourced dates; dates are revealed after placing. Cards: timeline_reconstruction, gallery_timeline. */

const Params = z.object({
  events: z
    .array(z.object({ text: z.string().describe("the event, under 100 characters"), date: z.string().describe('exact sortable number: a year like "1965", or "1965.25" for a month within a year'), dateLabel: z.string().describe('what is revealed after placing, e.g. "March 1965"') }))
    .min(3)
    .max(8)
    .describe("Events in ANY order; code sorts by date"),
  decoys: z.array(z.object({ text: z.string(), dateLabel: z.string() })).min(0).max(2).describe("0-2 events from another period that do NOT belong"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  order: string[];
  labels: Record<string, string>;
}
interface Input {
  keys: string[];
}
interface View {
  slots: number;
  cards: { key: string; text: string }[];
}

function solve(p: Params): Solution {
  const sorted = p.events.map((e, i) => ({ i, d: evalExact(e.date) ?? Number.NaN })).sort((a, b) => a.d - b.d);
  return { order: sorted.map((x) => `e${x.i}`), labels: Object.fromEntries(p.events.map((e, i) => [`e${i}`, e.dateLabel])) };
}

const textFor = (p: Params, key: string) => (key.startsWith("d") ? p.decoys[Number(key.slice(1))]?.text : p.events[Number(key.slice(1))]?.text) ?? key;

export const timeline = defineMode({
  id: "timeline",
  name: "Timeline",
  implemented: true,
  blindSolvable: true,
  widget: "order",
  knowledgeTypes: ["sequence", "fact"],
  directorBlurb: "Events placed in chronological order; the dates are revealed only after placing. Chronology, periodization, art and science history.",
  authoringGuide: [
    "Give each event an exact sortable date (year, or year plus fraction for months) and a human dateLabel; the label is what the player sees after placing.",
    "Choose events whose order is NOT the order the source mentions them, so the player must reason from causes and clues.",
    "Decoys come from a different period and are tempting. Placeholders: {{count}}, {{first}} (the earliest event: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const ds = p.events.map((e) => evalExact(e.date));
    if (ds.some((d) => d === null)) problems.push("every date must be an exact number (a year, optionally with a decimal for the month)");
    else if (new Set(ds).size !== ds.length) problems.push("two events share the same date; give them distinct dates (add a month fraction)");
    const texts = [...p.events.map((e) => e.text), ...p.decoys.map((d) => d.text)].map((t) => t.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) problems.push("events and decoys must be distinct");
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { count: String(p.events.length), first: textFor(p, s.order[0]) };
  },
  answerVars: ["first"],
  present(p, seed): View {
    const cards = [...p.events.map((e, i) => ({ key: `e${i}`, text: e.text })), ...p.decoys.map((d, i) => ({ key: `d${i}`, text: d.text }))];
    return { slots: p.events.length, cards: shuffleNotIdentity(cards, seed) };
  },
  grade(p, input: Input) {
    const s = solve(p);
    if (input.keys.length !== s.order.length) return { correct: false, feedback: `Fill all ${s.order.length} slots, earliest first.` };
    const decoy = input.keys.find((k) => k.startsWith("d"));
    if (decoy) return { correct: false, feedback: `"${textFor(p, decoy)}" belongs to another period (${p.decoys[Number(decoy.slice(1))]?.dateLabel}).` };
    const wrongAt = input.keys.findIndex((k, i) => k !== s.order[i]);
    if (wrongAt === -1) return { correct: true, feedback: `In order: ${s.order.map((k) => `${textFor(p, k)} (${s.labels[k]})`).join(" → ")}` };
    return { correct: false, feedback: `Slot ${wrongAt + 1} is out of place. Which event had to happen before "${textFor(p, input.keys[wrongAt])}" could?` };
  },
  solutionInput: (_p, s) => ({ keys: s.order }),
  blind: {
    schema: z.object({ order: z.array(z.number().int().min(0).max(9)).min(3).max(8).describe("Positions (0-based) of the shown cards in chronological order; leave out cards from another period") }),
    describe: (_p, view: View) => `${view.slots} slots, earliest first. Cards:\n${view.cards.map((c, i) => `${i}. ${c.text}`).join("\n")}`,
    toInput: (_p, view: View, out) => ({ keys: (out as { order: number[] }).order.map((i) => view.cards[i]?.key ?? "?") }),
  },
});
