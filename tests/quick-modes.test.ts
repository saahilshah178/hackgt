import { describe, expect, it } from "vitest";
import { timeline } from "../src/mechanics/families/sequencer/timeline";
import { counterexample } from "../src/mechanics/families/truth_finder/counterexample";
import { errorHunt } from "../src/mechanics/families/truth_finder/error_hunt";

describe("truth_finder.error_hunt", () => {
  const p = {
    title: "Solving 2x + 3 = 11",
    lines: [
      { text: "2x + 3 = 11", isWrong: false, explanation: "The equation as given." },
      { text: "2x = 11 + 3", isWrong: true, explanation: "Moving +3 across must flip its sign: 2x = 11 − 3." },
      { text: "2x = 14", isWrong: false, explanation: "Follows from the previous line as written." },
      { text: "x = 7", isWrong: false, explanation: "Dividing both sides by 2." },
    ],
    fixedLine: "2x = 11 − 3",
  };
  it("finds the wrong line and keeps lines in order", () => {
    expect(errorHunt.check(p)).toEqual([]);
    const s = errorHunt.resolve(p);
    expect(s.wrongIndex).toBe(1);
    expect(errorHunt.present(p, 9).lines.map((l) => l.lineIndex)).toEqual([0, 1, 2, 3]);
    expect(errorHunt.grade(p, errorHunt.solutionInput(p, s)).feedback).toMatch(/Fixed: 2x = 11 − 3/);
    expect(errorHunt.grade(p, { lineIndex: 2 }).feedback).toMatch(/Line 3 is fine/);
    expect(errorHunt.check({ ...p, lines: p.lines.map((l) => ({ ...l, isWrong: false })) }).join(" ")).toMatch(/exactly one/);
    expect(errorHunt.grade(p, errorHunt.blind!.toInput(p, errorHunt.present(p, 1), { line: 1, why: "" })).correct).toBe(true);
  });
});

describe("truth_finder.counterexample", () => {
  const p = {
    rule: "Every promise is a legally binding contract.",
    cases: [
      { text: "A shop agrees to sell a bike for $200 and the buyer pays", breaksRule: false, explanation: "Offer, acceptance and consideration are all present." },
      { text: "A friend promises to give you her old laptop for free", breaksRule: true, explanation: "No consideration flows back, so it is a gift promise, not a contract." },
      { text: "A freelancer agrees to build a site for $1,000", breaksRule: false, explanation: "Mutual promises with consideration on both sides." },
    ],
  };
  it("finds the breaking case among shuffled cases", () => {
    expect(counterexample.check(p)).toEqual([]);
    const v = counterexample.present(p, 3);
    expect(v.cases.map((c) => c.caseIndex).sort()).toEqual([0, 1, 2]);
    const pos = v.cases.findIndex((c) => c.caseIndex === 1);
    expect(counterexample.grade(p, counterexample.blind!.toInput(p, v, { case: pos, why: "" })).correct).toBe(true);
    expect(counterexample.grade(p, { caseIndex: 0 }).feedback).toMatch(/satisfies the rule/);
    expect(counterexample.check({ ...p, cases: [p.cases[0], p.cases[0], p.cases[1]] }).join(" ")).toMatch(/distinct/);
  });
});

describe("sequencer.timeline", () => {
  const p = {
    events: [
      { text: "Voting Rights Act signed", date: "1965.6", dateLabel: "August 1965" },
      { text: "Brown v. Board decided", date: "1954", dateLabel: "May 1954" },
      { text: "March on Washington", date: "1963.65", dateLabel: "August 1963" },
      { text: "Civil Rights Act signed", date: "1964.5", dateLabel: "July 1964" },
    ],
    decoys: [{ text: "The 19th Amendment is ratified", dateLabel: "1920" }],
  };
  it("orders by date, reveals labels on success, and rejects decoys", () => {
    expect(timeline.check(p)).toEqual([]);
    const s = timeline.resolve(p);
    expect(s.order).toEqual(["e1", "e2", "e3", "e0"]);
    const ok = timeline.grade(p, timeline.solutionInput(p, s));
    expect(ok.correct).toBe(true);
    expect(ok.feedback).toMatch(/May 1954.*July 1964.*August 1965/);
    expect(timeline.grade(p, { keys: ["e1", "d0", "e3", "e0"] }).feedback).toMatch(/another period \(1920\)/);
    expect(timeline.grade(p, { keys: ["e1", "e3", "e2", "e0"] }).feedback).toMatch(/Slot 2/);
    const v = timeline.present(p, 4);
    const pos = (k: string) => v.cards.findIndex((c) => c.key === k);
    expect(timeline.grade(p, timeline.blind!.toInput(p, v, { order: s.order.map(pos) })).correct).toBe(true);
    expect(timeline.check({ ...p, events: [...p.events.slice(0, 3), { ...p.events[3], date: "1954" }] }).join(" ")).toMatch(/same date/);
  });
});
