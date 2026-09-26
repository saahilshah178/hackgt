import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { bins } from "../src/mechanics/families/sorter/bins";
import { type_match } from "../src/mechanics/families/sorter/type_match";
import { pairs } from "../src/mechanics/families/linker/pairs";
import { chain } from "../src/mechanics/families/linker/chain";
import { elimination } from "../src/mechanics/families/investigator/elimination";

/*
 * A copy of the `audit()` helper from tests/strict-schemas.test.ts (importing that file directly would
 * re-run its own top-level describe blocks). Keep in sync if the strict-mode rules there change.
 */
const BANNED = ["oneOf", "allOf", "not", "const", "minLength", "maxLength", "pattern", "format", "patternProperties", "if"];
type Node = Record<string, unknown>;
function audit(schema: z.ZodType) {
  const json = zodSchema(schema).jsonSchema as Node;
  const errors: string[] = [];
  const stats = { properties: 0, enumValues: 0, maxDepth: 0 };
  const walk = (node: unknown, path: string, depth: number) => {
    if (typeof node !== "object" || node === null) return;
    const n = node as Node;
    for (const k of BANNED) if (k in n) errors.push(`${path}: uses "${k}"`);
    if (Array.isArray(n.enum)) stats.enumValues += n.enum.length;
    if (n.type === "integer" && (typeof n.minimum !== "number" || Math.abs(n.maximum as number) > 1e9)) {
      errors.push(`${path}: bound this integer explicitly`);
    }
    if (n.type === "object" || n.properties) {
      stats.maxDepth = Math.max(stats.maxDepth, depth);
      if (n.additionalProperties !== false) errors.push(`${path}: additionalProperties must be false (no z.record)`);
      const props = (n.properties ?? {}) as Record<string, unknown>;
      const required = new Set((n.required as string[]) ?? []);
      for (const [k, v] of Object.entries(props)) {
        stats.properties++;
        if (!required.has(k)) errors.push(`${path}.${k}: must be required (use .nullable(), not .optional())`);
        walk(v, `${path}.${k}`, depth + 1);
      }
    }
    if (n.items) walk(n.items, `${path}[]`, depth);
    if (Array.isArray(n.anyOf)) n.anyOf.forEach((s, i) => walk(s, `${path}<${i}>`, depth));
  };
  if (json.type !== "object") errors.push("root must be an object");
  walk(json, "$", 1);
  if (stats.properties > 5000) errors.push(`too many properties: ${stats.properties}`);
  if (stats.maxDepth > 10) errors.push(`nesting too deep: ${stats.maxDepth}`);
  if (stats.enumValues > 1000) errors.push(`too many enum values: ${stats.enumValues}`);
  return { errors, stats };
}

describe("sorter.bins", () => {
  const p = {
    bins: [
      { id: "diffuses", label: "Crosses alone", feature: "small and nonpolar" },
      { id: "protein", label: "Needs a protein", feature: "polar or charged" },
    ],
    items: [
      { text: "Oxygen", binId: "diffuses", why: "small and nonpolar" },
      { text: "Sodium ion", binId: "protein", why: "charged" },
      { text: "Carbon dioxide", binId: "diffuses", why: "small and nonpolar" },
      { text: "Glucose", binId: "protein", why: "large and polar" },
    ],
  };

  it("valid params pass check", () => {
    expect(bins.check(p)).toEqual([]);
  });

  it("rejects duplicate bin ids, an unknown binId, and an empty bin", () => {
    expect(bins.check({ ...p, bins: [p.bins[0], p.bins[0]] }).join(" ")).toMatch(/unique/);
    expect(bins.check({ ...p, items: [{ ...p.items[0], binId: "nope" }, ...p.items.slice(1)] }).join(" ")).toMatch(/doesn't match any bin/);
    expect(
      bins
        .check({ ...p, bins: [...p.bins, { id: "empty_bin", label: "Empty", feature: "nothing" }] })
        .join(" "),
    ).toMatch(/no items assigned/);
  });

  it("solutionInput passes grade", () => {
    const sol = bins.resolve(p);
    expect(bins.grade(p, bins.solutionInput(p, sol)).correct).toBe(true);
  });

  it("wrong inputs give informative feedback naming category and feature", () => {
    const sol = bins.resolve(p);
    const badInput = bins.solutionInput(p, sol);
    badInput.assignments[0] = { itemKey: "i0", binId: "protein" };
    const miss = bins.grade(p, badInput);
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/Crosses alone/);
    expect(miss.feedback).toMatch(/small and nonpolar/);

    const missing = bins.grade(p, { assignments: [{ itemKey: "i0", binId: "diffuses" }] });
    expect(missing.correct).toBe(false);
    expect(missing.feedback).toMatch(/Place all/);
  });

  it("present is deterministic and shuffled", () => {
    const v1 = bins.present(p, 5);
    const v2 = bins.present(p, 5);
    expect(v1).toEqual(v2);
    expect(v1.items.map((i) => i.key)).not.toEqual(p.items.map((_, i) => `i${i}`));
  });

  it("blind solver round-trips through describe/toInput", () => {
    const view = bins.present(p, 3);
    const posOf = (key: string) => view.items.findIndex((i) => i.key === key);
    expect(bins.blind!.describe(p, view)).toContain("Bins:");
    const out = { assignments: p.items.map((it, i) => ({ item: posOf(`i${i}`), bin: it.binId })), why: "" };
    const input = bins.blind!.toInput(p, view, out);
    expect(bins.grade(p, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(bins.paramsSchema).errors).toEqual([]);
    expect(audit(bins.blind!.schema).errors).toEqual([]);
  });
});

describe("sorter.type_match", () => {
  const p = {
    categories: [
      { id: "hypotonic", label: "Hypotonic" },
      { id: "hypertonic", label: "Hypertonic" },
    ],
    waves: [
      { text: "Cell swelling in pure water", categoryId: "hypotonic", why: "less solute outside" },
      { text: "Cell shrivelling in seawater", categoryId: "hypertonic", why: "more solute outside" },
      { text: "Cell swelling in a dilute drink", categoryId: "hypotonic", why: "less solute outside" },
      { text: "Cell shrivelling in salty soil water", categoryId: "hypertonic", why: "more solute outside" },
    ],
    secondsPerWave: 8,
  };

  it("valid params pass check", () => {
    expect(type_match.check(p)).toEqual([]);
  });

  it("rejects a bad category id, an unknown categoryId, and an unused category", () => {
    expect(type_match.check({ ...p, categories: [{ id: "Bad-Id", label: "x" }, p.categories[1]] }).join(" ")).toMatch(/snake_case/);
    expect(
      type_match.check({ ...p, waves: [{ ...p.waves[0], categoryId: "nope" }, ...p.waves.slice(1)] }).join(" "),
    ).toMatch(/doesn't match any category/);
    expect(
      type_match.check({ ...p, categories: [...p.categories, { id: "isotonic", label: "Isotonic" }] }).join(" "),
    ).toMatch(/no waves/);
  });

  it("solutionInput passes grade", () => {
    const sol = type_match.resolve(p);
    expect(type_match.grade(p, type_match.solutionInput(p, sol)).correct).toBe(true);
  });

  it("wrong inputs give informative feedback", () => {
    const wrong = type_match.grade(p, { answers: [{ waveIndex: 0, categoryId: "hypertonic" }, { waveIndex: 1, categoryId: "hypertonic" }, { waveIndex: 2, categoryId: "hypotonic" }, { waveIndex: 3, categoryId: "hypertonic" }] });
    expect(wrong.correct).toBe(false);
    expect(wrong.feedback).toMatch(/less solute outside/);

    const late = type_match.grade(p, { answers: [{ waveIndex: 1, categoryId: "hypertonic" }] });
    expect(late.correct).toBe(false);
  });

  it("present keeps waves in order (never shuffled)", () => {
    const view = type_match.present(p, 1);
    expect(view.waves.map((w) => w.text)).toEqual(p.waves.map((w) => w.text));
  });

  it("blind solver round-trips through describe/toInput", () => {
    const view = type_match.present(p, 1);
    expect(type_match.blind!.describe(p, view)).toContain("Categories:");
    const out = { answers: p.waves.map((w) => w.categoryId) };
    const input = type_match.blind!.toInput(p, view, out);
    expect(type_match.grade(p, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(type_match.paramsSchema).errors).toEqual([]);
    expect(audit(type_match.blind!.schema).errors).toEqual([]);
  });
});

describe("linker.pairs", () => {
  const p = {
    pairs: [
      { left: "Sodium ions per cycle", right: "3, out of the cell", why: "Three Na+ leave." },
      { left: "Potassium ions per cycle", right: "2, into the cell", why: "Two K+ enter." },
      { left: "Energy spent per cycle", right: "1 ATP", why: "One ATP powers each cycle." },
    ],
    decoyRights: ["2, out of the cell"],
  };

  it("valid params pass check", () => {
    expect(pairs.check(p)).toEqual([]);
  });

  it("rejects duplicate lefts, duplicate rights/decoys, and a decoy matching a real right", () => {
    expect(pairs.check({ ...p, pairs: [p.pairs[0], p.pairs[0], p.pairs[2]] }).join(" ")).toMatch(/left items must be distinct/);
    expect(pairs.check({ ...p, decoyRights: ["3, out of the cell"] }).join(" ")).toMatch(/right items.*distinct/);
    expect(pairs.check({ ...p, decoyRights: ["2, out of the cell", "2, out of the cell"] }).join(" ")).toMatch(/distinct/);
  });

  it("solutionInput passes grade", () => {
    const sol = pairs.resolve(p);
    expect(pairs.grade(p, pairs.solutionInput(p, sol)).correct).toBe(true);
  });

  it("wrong inputs give informative feedback naming the wrong link and a clue", () => {
    const sol = pairs.resolve(p);
    const input = pairs.solutionInput(p, sol);
    input.links[0] = { leftKey: "l0", rightKey: "r1" };
    const miss = pairs.grade(p, input);
    expect(miss.correct).toBe(false);
    expect(miss.feedback).toMatch(/Sodium ions per cycle/);
    expect(miss.feedback).toMatch(/Three Na\+ leave/);

    const missing = pairs.grade(p, { links: [{ leftKey: "l0", rightKey: "r0" }] });
    expect(missing.correct).toBe(false);
    expect(missing.feedback).toMatch(/Link all/);
  });

  it("present is deterministic; rights are shuffled", () => {
    const v1 = pairs.present(p, 11);
    const v2 = pairs.present(p, 11);
    expect(v1).toEqual(v2);
    expect(v1.rights.map((r) => r.key)).not.toEqual(["r0", "r1", "r2", "x0"]);
  });

  it("blind solver round-trips through describe/toInput", () => {
    const view = pairs.present(p, 4);
    const rightPos = (key: string) => view.rights.findIndex((r) => r.key === key);
    const out = { links: [0, 1, 2].map((i) => ({ left: i, right: rightPos(`r${i}`) })) };
    const input = pairs.blind!.toInput(p, view, out);
    expect(pairs.blind!.describe(p, view)).toContain("Lefts:");
    expect(pairs.grade(p, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(pairs.paramsSchema).errors).toEqual([]);
    expect(audit(pairs.blind!.schema).errors).toEqual([]);
  });
});

describe("linker.chain", () => {
  const p = {
    nodes: ["Tax the colonies", "Colonists protest", "Crackdown by the crown", "Calls for independence grow"],
    decoys: ["The colonies adopt a new flag"],
  };

  it("valid params pass check", () => {
    expect(chain.check(p)).toEqual([]);
  });

  it("rejects duplicate nodes, a duplicate decoy, and too few nodes", () => {
    expect(chain.check({ ...p, nodes: [p.nodes[0], p.nodes[0], p.nodes[2]] }).join(" ")).toMatch(/distinct/);
    expect(chain.check({ ...p, decoys: [p.nodes[0]] }).join(" ")).toMatch(/distinct/);
    const parsed = chain.paramsSchema.safeParse({ ...p, nodes: [p.nodes[0], p.nodes[1]] });
    expect(parsed.success).toBe(false);
  });

  it("solutionInput passes grade", () => {
    const sol = chain.resolve(p);
    expect(chain.grade(p, chain.solutionInput(p, sol)).correct).toBe(true);
  });

  it("wrong inputs give informative feedback: a decoy edge, and a broken link", () => {
    const decoyMiss = chain.grade(p, { edges: [{ fromKey: "n0", toKey: "d0" }] });
    expect(decoyMiss.correct).toBe(false);
    expect(decoyMiss.feedback).toMatch(/isn't part of this chain/);

    const brokenMiss = chain.grade(p, { edges: [{ fromKey: "n0", toKey: "n2" }, { fromKey: "n2", toKey: "n3" }] });
    expect(brokenMiss.correct).toBe(false);
    expect(brokenMiss.feedback).toMatch(/lead to/);
  });

  it("present is deterministic and shuffled", () => {
    const v1 = chain.present(p, 9);
    const v2 = chain.present(p, 9);
    expect(v1).toEqual(v2);
    expect(v1.nodes.map((n) => n.key)).not.toEqual(["n0", "n1", "n2", "n3", "d0"]);
  });

  it("blind solver round-trips through describe/toInput", () => {
    const view = chain.present(p, 6);
    const posOf = (key: string) => view.nodes.findIndex((n) => n.key === key);
    const sol = chain.resolve(p);
    const out = { edges: sol.edges.map((e) => ({ from: posOf(e.from), to: posOf(e.to) })) };
    const input = chain.blind!.toInput(p, view, out);
    expect(chain.blind!.describe(p, view)).toContain("Nodes shown:");
    expect(chain.grade(p, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(chain.paramsSchema).errors).toEqual([]);
    expect(audit(chain.blind!.schema).errors).toEqual([]);
  });
});

describe("investigator.elimination", () => {
  const p = {
    question: "What caused the vault door to jam?",
    hypotheses: [
      { id: "dust", text: "Dust in the gears" },
      { id: "sabotage", text: "Deliberate sabotage" },
      { id: "power", text: "A power failure" },
    ],
    clues: [
      { text: "The gears were freshly oiled and spotless.", eliminates: ["dust"] },
      { text: "The backup generator was running the whole time.", eliminates: ["power"] },
    ],
  };

  it("valid params pass check", () => {
    expect(elimination.check(p)).toEqual([]);
  });

  it("rejects a non-snake_case id, an unknown eliminates reference, and zero/multiple survivors", () => {
    expect(
      elimination.check({ ...p, hypotheses: [{ id: "Dust", text: "x" }, p.hypotheses[1], p.hypotheses[2]] }).join(" "),
    ).toMatch(/snake_case/);
    expect(
      elimination.check({ ...p, clues: [{ ...p.clues[0], eliminates: ["nope"] }, p.clues[1]] }).join(" "),
    ).toMatch(/unknown hypothesis/);
    expect(
      elimination
        .check({ ...p, clues: [{ text: "Nothing conclusive.", eliminates: [] }, p.clues[1]] })
        .join(" "),
    ).toMatch(/exactly one hypothesis must survive/);
  });

  it("solutionInput passes grade", () => {
    const sol = elimination.resolve(p);
    expect(sol.survivorId).toBe("sabotage");
    expect(elimination.grade(p, elimination.solutionInput(p, sol)).correct).toBe(true);
  });

  it("wrong inputs give the eliminating clue as feedback", () => {
    const missDust = elimination.grade(p, { hypothesisId: "dust" });
    expect(missDust.correct).toBe(false);
    expect(missDust.feedback).toMatch(/freshly oiled/);

    const missPower = elimination.grade(p, { hypothesisId: "power" });
    expect(missPower.correct).toBe(false);
    expect(missPower.feedback).toMatch(/backup generator/);
  });

  it("present is deterministic and shuffles hypotheses; clues stay in order", () => {
    const v1 = elimination.present(p, 2);
    const v2 = elimination.present(p, 2);
    expect(v1).toEqual(v2);
    expect(v1.clues.map((c) => c.index)).toEqual([0, 1]);
  });

  it("blind solver round-trips through describe/toInput", () => {
    const view = elimination.present(p, 8);
    const pos = view.hypotheses.findIndex((h) => h.id === "sabotage");
    const input = elimination.blind!.toInput(p, view, { hypothesis: pos, why: "" });
    expect(elimination.blind!.describe(p, view)).toContain("Hypotheses:");
    expect(elimination.grade(p, input).correct).toBe(true);
  });

  it("strict schemas", () => {
    expect(audit(elimination.paramsSchema).errors).toEqual([]);
    expect(audit(elimination.blind!.schema).errors).toEqual([]);
  });
});
