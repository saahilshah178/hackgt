/**
 * The parity test (docs/design/20 §2.5.4, amendment 11): for each of the 10 showcase modes, ≥ 50 seeded wrong inputs
 * sampled from the three fixtures' encounters; diagnose's mirror agrees with grade() on `correct`, and the needle
 * derived from failKey/wrongKeys appears in grade().feedback. A change to a mode's grade() order fails here first.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GameSpec } from "../../contracts/gamespec";
import { getMode } from "../../mechanics/registry";
import { mulberry32 } from "../../mechanics/util";
import { viewTextOf } from "../config-validators";
import { DIAGNOSED_MODES, diagnose, failKeysFor, mirrorFor } from "./index";
import { OSCILLATOR_DIRECTION } from "./oscillator";

const FIXTURES = ["trig-dungeon", "cell-transport-dungeon", "civil-rights-mystery"];
const specs = FIXTURES.map((f) => JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", `${f}.json`), "utf8")) as GameSpec);

interface Case {
  modeKey: string;
  params: unknown;
  view: Record<string, unknown>;
  solution: unknown;
  encounterId: string;
}
const cases: Case[] = specs.flatMap((spec) =>
  spec.encounters.map((e, i) => {
    const mode = getMode(e.familyId, e.mode)!;
    return { modeKey: `${e.familyId}.${e.mode}`, params: e.params, view: mode.present(e.params, spec.seed + i) as Record<string, unknown>, solution: e.solution, encounterId: e.id };
  }),
);

type Rng = () => number;
const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
function shuffle<T>(r: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}
type Row = { key?: string; id?: string; text?: string };
const keys = (v: Record<string, unknown>, f: string, k: "key" | "id" = "key") => (v[f] as Row[]).map((r) => String(r[k]));

/** A random (often wrong) input for a case. */
function randomInput(c: Case, r: Rng): unknown {
  const v = c.view;
  switch (c.modeKey) {
    case "mapper.number_line": {
      const min = v.min as number;
      const max = v.max as number;
      const value = v.scale === "log" ? 10 ** (Math.log10(min) + r() * (Math.log10(max) - Math.log10(min))) : min + r() * (max - min);
      return { value };
    }
    case "tuner.oscillator": {
      const dial = v.dial as { min: number; max: number };
      return { value: dial.min + r() * (dial.max - dial.min) };
    }
    case "truth_finder.mimic":
      return { statementIndex: pick(r, (v.chests as { statementIndex: number }[]).map((x) => x.statementIndex)) };
    case "truth_finder.predict_reveal":
      return { optionIndex: pick(r, (v.options as { optionIndex: number }[]).map((x) => x.optionIndex)) };
    case "sequencer.linear": {
      const slots = v.slots as number;
      const n = r() < 0.15 ? Math.max(0, slots - 1) : slots;
      const planks = keys(v, "planks");
      const pool = r() < 0.5 ? planks.filter((k) => k.startsWith("s")) : planks;
      return { keys: shuffle(r, pool).slice(0, n) };
    }
    case "sorter.bins": {
      const bins = keys(v, "bins", "id");
      const items = keys(v, "items").filter(() => r() > 0.05);
      return { assignments: items.map((itemKey) => ({ itemKey, binId: pick(r, bins) })) };
    }
    case "sorter.type_match": {
      const cats = keys(v, "categories", "id");
      const waves = (v.waves as { waveIndex: number }[]).map((w) => w.waveIndex).filter(() => r() > 0.05);
      return { answers: shuffle(r, waves).map((waveIndex) => ({ waveIndex, categoryId: pick(r, cats) })) };
    }
    case "linker.pairs": {
      const lefts = keys(v, "lefts").filter(() => r() > 0.05);
      const rights = shuffle(r, keys(v, "rights"));
      return { links: lefts.map((leftKey, i) => ({ leftKey, rightKey: rights[i % rights.length] as string })) };
    }
    case "linker.chain": {
      const nodes = keys(v, "nodes");
      const edgeCount = v.edgeCount as number;
      const pool = r() < 0.5 ? nodes.filter((k) => k.startsWith("n")) : nodes;
      const order = shuffle(r, pool);
      const edges: { fromKey: string; toKey: string }[] = [];
      for (let i = 0; i + 1 < order.length && edges.length < edgeCount; i++) edges.push({ fromKey: order[i] as string, toKey: order[i + 1] as string });
      if (r() < 0.1 && edges.length > 0) edges.pop();
      if (r() < 0.1) edges.push({ fromKey: pick(r, nodes), toKey: pick(r, nodes) });
      return { edges };
    }
    case "investigator.elimination":
      return { hypothesisId: pick(r, keys(v, "hypotheses", "id")) };
    default:
      return null;
  }
}

/** Near-miss inputs: the solution with one small change (these exercise the later grade() branches). */
function nearInput(c: Case, r: Rng): unknown {
  const mode = getMode(...(c.modeKey.split(".") as [string, string]))!;
  const sol = structuredClone(mode.solutionInput(c.params, c.solution)) as Record<string, unknown>;
  switch (c.modeKey) {
    case "sequencer.linear": {
      const ks = sol.keys as string[];
      const i = Math.floor(r() * (ks.length - 1));
      [ks[i], ks[i + 1]] = [ks[i + 1] as string, ks[i] as string];
      return sol;
    }
    case "linker.chain": {
      const es = sol.edges as { fromKey: string; toKey: string }[];
      const i = Math.floor(r() * es.length);
      const other = pick(r, keys(c.view, "nodes").filter((k) => k !== es[i]?.toKey));
      es[i] = { fromKey: es[i]!.fromKey, toKey: other };
      return sol;
    }
    case "linker.pairs": {
      const ls = sol.links as { leftKey: string; rightKey: string }[];
      const i = Math.floor(r() * ls.length);
      ls[i] = { leftKey: ls[i]!.leftKey, rightKey: pick(r, keys(c.view, "rights").filter((k) => k !== ls[i]?.rightKey)) };
      return sol;
    }
    default:
      return randomInput(c, r);
  }
}

describe("diagnose parity with grade() (10 showcase modes)", () => {
  it("the fixtures cover exactly the 10 diagnosed modes", () => {
    const modes = new Set(cases.map((c) => c.modeKey));
    expect([...modes].sort()).toEqual([...DIAGNOSED_MODES].sort());
  });

  for (const modeKey of DIAGNOSED_MODES) {
    it(`${modeKey}: ≥ 50 seeded wrong inputs agree with grade()`, () => {
      const pool = cases.filter((c) => c.modeKey === modeKey);
      const mode = getMode(...(modeKey.split(".") as [string, string]))!;
      const r = mulberry32(0x5eed ^ modeKey.length * 7919);
      let wrong = 0;
      const failKeys = new Set<string>();
      for (let n = 0; n < 4000 && wrong < 60; n++) {
        const c = pool[n % pool.length]!;
        const input = n % 3 === 2 ? nearInput(c, r) : randomInput(c, r);
        const g = mode.grade(c.params, input);
        const m = mirrorFor(modeKey, { params: c.params, view: c.view, solution: c.solution, input });
        expect(m, `${c.encounterId}`).not.toBeNull();
        expect(m!.correct, `${c.encounterId} ${JSON.stringify(input)} → ${g.feedback}`).toBe(g.correct);
        if (g.correct) continue;
        wrong++;
        expect(m!.failKey).not.toBeNull();
        failKeys.add(m!.failKey!);
        expect(failKeysFor(modeKey)).toContain(m!.failKey);
        expect(g.feedback, `${c.encounterId} ${m!.failKey}`).toContain(m!.needle);
        // the item diagnose names is the one grade() names: its view text appears in the feedback
        const k = m!.wrongKeys[0];
        if (k && !["truth_finder.mimic", "truth_finder.predict_reveal", "linker.pairs"].includes(modeKey)) {
          const text = viewTextOf(c.view, k);
          if (text) expect(g.feedback).toContain(text);
        }
        const d = diagnose({ modeKey: modeKey as never, params: c.params, view: c.view, solution: c.solution, input, grade: g, probes: [], nearMiss: null, feedbackNouns: [] });
        expect(d.correct).toBe(false);
        expect(d.feedback).toBe(g.feedback);
        expect(d.failKey).toBe(m!.failKey);
        expect(d.wrongKeys).toEqual(m!.wrongKeys);
      }
      expect(wrong).toBeGreaterThanOrEqual(50);
      // each mode exercises more than one grade() branch where it has several
      if (failKeysFor(modeKey).length > 1) expect(failKeys.size).toBeGreaterThan(1);
    });
  }

  it("solution inputs are correct for every case (mirror and diagnose)", () => {
    for (const c of cases) {
      const mode = getMode(...(c.modeKey.split(".") as [string, string]))!;
      const input = mode.solutionInput(c.params, c.solution);
      const g = mode.grade(c.params, input);
      expect(g.correct).toBe(true);
      expect(mirrorFor(c.modeKey, { params: c.params, view: c.view, solution: c.solution, input })?.correct).toBe(true);
      const d = diagnose({ modeKey: c.modeKey as never, params: c.params, view: c.view, solution: c.solution, input, grade: g, probes: [], nearMiss: "x", feedbackNouns: [] });
      expect(d).toMatchObject({ correct: true, failKey: null, wrongKeys: [], prefix: null, nearMiss: null, probeKeys: [] });
    }
  });
});

describe("prefix and disclosed values", () => {
  const byId = (id: string) => cases.find((c) => c.encounterId === id)!;
  it("linear: prefix = wrongAt; decoy and incomplete carry none", () => {
    const c = cases.find((x) => x.modeKey === "sequencer.linear")!;
    const order = (c.solution as { order: string[] }).order;
    const swapped = [...order];
    [swapped[1], swapped[2]] = [swapped[2]!, swapped[1]!];
    const m = mirrorFor(c.modeKey, { ...c, input: { keys: swapped } })!;
    expect(m).toMatchObject({ failKey: "order", prefix: 1, wrongKeys: [swapped[1]] });
    expect(mirrorFor(c.modeKey, { ...c, input: { keys: order.slice(1) } })).toMatchObject({ failKey: "incomplete", prefix: null, wrongKeys: [] });
    const decoy = keys(c.view, "planks").find((k) => k.startsWith("d"));
    if (decoy) {
      expect(mirrorFor(c.modeKey, { ...c, input: { keys: [decoy, ...order.slice(1)] } })).toMatchObject({ failKey: "decoy", wrongKeys: [decoy], prefix: null });
    }
  });
  it("chain: prefix = the index of the first solution edge not given", () => {
    const c = byId("e5_freedom_rides");
    const edges = (c.solution as { edges: { from: string; to: string }[] }).edges.map((e) => ({ fromKey: e.from, toKey: e.to }));
    const bad = edges.map((e, i) => (i === 2 ? { fromKey: e.fromKey, toKey: edges[0]!.fromKey } : e));
    expect(mirrorFor(c.modeKey, { ...c, input: { edges: bad } })).toMatchObject({ failKey: "wrong_link", prefix: 2, wrongKeys: [edges[2]!.fromKey] });
    expect(mirrorFor(c.modeKey, { ...c, input: { edges: [...edges, { fromKey: edges[edges.length - 1]!.toKey, toKey: "n0" }] } })).toMatchObject({ failKey: "incomplete", prefix: null });
  });
  it("bins, type_match, pairs and elimination disclose what the feedback states", () => {
    const bins = cases.find((x) => x.modeKey === "sorter.bins")!;
    const sol = (bins.solution as { assignments: Record<string, string> }).assignments;
    const other = keys(bins.view, "bins", "id").find((b) => b !== sol.i0)!;
    const input = { assignments: Object.entries(sol).map(([itemKey, binId]) => ({ itemKey, binId: itemKey === "i0" ? other : binId })) };
    expect(mirrorFor(bins.modeKey, { ...bins, input })).toMatchObject({ failKey: "wrong_bin", wrongKeys: ["i0"], disclosed: { bin: sol.i0 } });

    const tm = cases.find((x) => x.modeKey === "sorter.type_match")!;
    const answers = (tm.solution as { answers: string[] }).answers;
    const m = mirrorFor(tm.modeKey, { ...tm, input: { answers: answers.slice(1).map((categoryId, i) => ({ waveIndex: i + 1, categoryId })) } });
    expect(m).toMatchObject({ failKey: "wrong_wave", wrongKeys: ["w0"], disclosed: { category: answers[0] } });

    const pr = cases.find((x) => x.modeKey === "linker.pairs")!;
    const links = (pr.solution as { links: Record<string, string> }).links;
    const wrongRight = keys(pr.view, "rights").find((k) => k !== links.l0)!;
    const pin = { links: Object.entries(links).map(([leftKey, rightKey]) => ({ leftKey, rightKey: leftKey === "l0" ? wrongRight : rightKey })) };
    expect(mirrorFor(pr.modeKey, { ...pr, input: pin })).toMatchObject({ failKey: "wrong_link", wrongKeys: ["l0"], disclosed: { given: wrongRight } });

    const el = cases.find((x) => x.modeKey === "investigator.elimination")!;
    const s = el.solution as { survivorId: string; eliminatedBy: Record<string, number> };
    const [hid, ci] = Object.entries(s.eliminatedBy)[0]!;
    expect(mirrorFor(el.modeKey, { ...el, input: { hypothesisId: hid } })).toMatchObject({ failKey: "wrong_hypothesis", wrongKeys: [hid, `clue:${ci}`], disclosed: { clueIndex: ci } });
  });
  it("oscillator direction words cover every ask", () => {
    expect(Object.keys(OSCILLATOR_DIRECTION).sort()).toEqual(["amplitude", "frequency", "midline", "period", "phase"]);
  });
});

describe("diagnose()", () => {
  it("never throws on malformed input and gives no detail for undiagnosed modes", () => {
    for (const modeKey of DIAGNOSED_MODES) {
      expect(() => mirrorFor(modeKey, { params: null, view: null, solution: null, input: null })).not.toThrow();
    }
    const d = diagnose({ modeKey: "balance.equation", params: {}, view: {}, solution: {}, input: {}, grade: { correct: false, feedback: "The chest is off." }, probes: [], nearMiss: "tilted", feedbackNouns: [{ from: "chest", to: "singer" }] });
    expect(d).toMatchObject({ correct: false, failKey: null, wrongKeys: [], nearMiss: "tilted", displayFeedback: "The singer is off.", feedback: "The chest is off." });
    expect(failKeysFor("balance.equation")).toEqual([]);
  });
  it("matches probes on failed Verifies only and passes the near-miss through", () => {
    const c = cases.find((x) => x.encounterId === "e3_amplitude")!;
    const mode = getMode("truth_finder", "mimic")!;
    const honest = (c.view.chests as { statementIndex: number }[]).find((x) => x.statementIndex !== (c.solution as { mimicIndex: number }).mimicIndex)!;
    const input = { statementIndex: honest.statementIndex };
    const probes = [{ predicate: "aimedIndex" as const, index: honest.statementIndex, key: "picked_true" }];
    const d = diagnose({ modeKey: "truth_finder.mimic", params: c.params, view: c.view, solution: c.solution, input, grade: mode.grade(c.params, input), probes, nearMiss: null, feedbackNouns: [{ from: "chest", to: "singer" }] });
    expect(d.probeKeys).toEqual(["picked_true"]);
    expect(d.failKey).toBe("honest");
    expect(d.wrongKeys).toEqual([String(honest.statementIndex)]);
    expect(d.displayFeedback.startsWith("That singer was honest")).toBe(true);
  });
});
