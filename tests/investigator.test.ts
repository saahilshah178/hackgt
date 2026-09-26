import { describe, expect, it } from "vitest";
import { argument } from "../src/mechanics/families/investigator/argument";
import { perspective } from "../src/mechanics/families/investigator/perspective";
import { sourceEval } from "../src/mechanics/families/investigator/source_eval";
import { weigh } from "../src/mechanics/families/investigator/weigh";

describe("investigator.weigh", () => {
  const p = {
    question: "Why did the Voting Rights Act pass in 1965?",
    causes: [
      { text: "Televised violence at Selma", weight: "5", why: "Johnson introduced the bill eight days after Bloody Sunday." },
      { text: "Years of local voter-registration organizing", weight: "4", why: "SNCC and local leaders built the campaign Selma made visible." },
      { text: "King's 'I Have a Dream' speech", weight: "2", why: "Famous, but two years earlier and aimed at the 1964 bill." },
    ],
  };
  it("grades on rank order and explains the first over-ranked cause", () => {
    expect(weigh.check(p)).toEqual([]);
    const s = weigh.resolve(p);
    expect(s.ranking).toEqual(["c0", "c1", "c2"]);
    expect(weigh.grade(p, weigh.solutionInput(p, s)).correct).toBe(true);
    const miss = weigh.grade(p, { weights: [{ causeKey: "c2", value: 60 }, { causeKey: "c0", value: 30 }, { causeKey: "c1", value: 10 }] });
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/I Have a Dream.*#1.*eight days after/);
    expect(weigh.grade(p, { weights: [{ causeKey: "c0", value: 50 }, { causeKey: "c1", value: 50 }, { causeKey: "c2", value: 0 }] }).feedback).toMatch(/same weight/);
    const v = weigh.present(p, 2);
    expect(weigh.grade(p, weigh.blind!.toInput(p, v, { ranking: s.ranking.map((k) => v.causes.findIndex((c) => c.key === k)) })).correct).toBe(true);
    expect(weigh.check({ ...p, causes: [p.causes[0], { ...p.causes[1], weight: "5" }, p.causes[2]] }).join(" ")).toMatch(/distinct/);
  });
});

describe("investigator.source_eval", () => {
  const p = {
    question: "What happened on the Edmund Pettus Bridge?",
    sources: [
      { text: "A trooper's official report written the next day", reliability: 2, cues: "Written by a participant with an incentive to justify the force used." },
      { text: "Film footage broadcast by ABC that evening", reliability: 5, cues: "A direct recording, corroborated by many eyewitnesses." },
      { text: "A 2001 history book on the movement", reliability: 4, cues: "Secondary but synthesizes many corroborated primary sources." },
      { text: "A rumor reported in a distant newspaper a week later", reliability: 1, cues: "Second-hand, late, uncorroborated." },
    ],
  };
  it("ranks by reliability and teaches the cues on a miss", () => {
    expect(sourceEval.check(p)).toEqual([]);
    const s = sourceEval.resolve(p);
    expect(s.order).toEqual(["s1", "s2", "s0", "s3"]);
    expect(sourceEval.grade(p, sourceEval.solutionInput(p, s)).correct).toBe(true);
    expect(sourceEval.grade(p, { keys: ["s0", "s1", "s2", "s3"] }).feedback).toMatch(/Slot 1.*incentive/);
    const v = sourceEval.present(p, 5);
    expect(sourceEval.grade(p, sourceEval.blind!.toInput(p, v, { order: s.order.map((k) => v.sources.findIndex((x) => x.key === k)) })).correct).toBe(true);
    expect(sourceEval.check({ ...p, sources: p.sources.map((x) => ({ ...x, reliability: 3 })) }).join(" ")).toMatch(/distinct/);
  });
});

describe("investigator.perspective", () => {
  const p = {
    actors: [
      { id: "governor", name: "Governor Faubus", motive: "Keep segregationist voters on his side before an election" },
      { id: "student", name: "Elizabeth Eckford", motive: "Attend the school the court said she could" },
    ],
    accounts: [
      { text: "I ordered the Guard to preserve order and prevent violence.", actorId: "governor", why: "Framing exclusion as public safety served the election motive." },
      { text: "I just wanted to go to class like everyone else.", actorId: "student", why: "The court order and her own education were the point." },
      { text: "The federal government has no business in Arkansas's schools.", actorId: "governor", why: "States' rights rhetoric appealed to his voters." },
    ],
  };
  it("matches accounts to actors and explains a wrong link with the motive", () => {
    expect(perspective.check(p)).toEqual([]);
    const s = perspective.resolve(p);
    expect(perspective.grade(p, perspective.solutionInput(p, s)).correct).toBe(true);
    const miss = perspective.grade(p, { links: [{ accountKey: "a0", actorId: "student" }, { accountKey: "a1", actorId: "student" }, { accountKey: "a2", actorId: "governor" }] });
    expect(miss.feedback).toMatch(/doesn't fit Elizabeth Eckford's motive/);
    const v = perspective.present(p, 1);
    const links = v.accounts.map((a, i) => ({ account: i, actor: v.actors.findIndex((x) => x.id === s.links[a.key]) }));
    expect(perspective.grade(p, perspective.blind!.toInput(p, v, { links })).correct).toBe(true);
    expect(perspective.check({ ...p, accounts: [p.accounts[1], p.accounts[1], p.accounts[1]] }).join(" ")).toMatch(/has no account/);
  });
});

describe("investigator.argument", () => {
  const p = {
    claim: "Television coverage was decisive for the Civil Rights Act of 1964.",
    evidence: [
      { text: "Kennedy proposed the bill weeks after the Birmingham images aired", role: "supports" as const, why: "Timing links the coverage to the political response." },
      { text: "Polls showed civil rights jumping to the top national issue after Birmingham", role: "supports" as const, why: "Measured opinion shift right after the coverage." },
      { text: "Television sets were in most American homes by 1963", role: "weak" as const, why: "Shows reach, not effect on the bill." },
      { text: "Congress had debated civil rights bills since 1957 without passing one", role: "counter" as const, why: "Suggests factors other than coverage were needed; the claim must be qualified." },
      { text: "Birmingham's steel industry declined in the 1970s", role: "irrelevant" as const, why: "Different decade, different topic." },
    ],
  };
  it("requires the supports and counters exactly and teaches on each kind of miss", () => {
    expect(argument.check(p)).toEqual([]);
    const s = argument.resolve(p);
    expect(argument.grade(p, argument.solutionInput(p, s)).correct).toBe(true);
    expect(argument.grade(p, { supports: ["v0", "v1", "v2"], counters: ["v3"] }).feedback).toMatch(/Shows reach, not effect/);
    expect(argument.grade(p, { supports: ["v0"], counters: ["v3"] }).feedback).toMatch(/left out/);
    expect(argument.grade(p, { supports: ["v0", "v1"], counters: [] }).feedback).toMatch(/acknowledges the evidence against/);
    expect(argument.grade(p, { supports: ["v0", "v1"], counters: ["v4"] }).feedback).toMatch(/isn't counter-evidence/);
    const v = argument.present(p, 3);
    const pos = (k: string) => v.cards.findIndex((c) => c.key === k);
    expect(argument.grade(p, argument.blind!.toInput(p, v, { supports: s.supports.map(pos), counters: s.counters.map(pos) })).correct).toBe(true);
    expect(argument.check({ ...p, evidence: p.evidence.filter((e) => e.role !== "counter") }).join(" ")).toMatch(/counter card/);
  });
});
