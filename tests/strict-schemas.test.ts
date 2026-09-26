import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { GENRES } from "../src/contracts/common";
import { assessmentSchema, challengeSchema, directorSchema, narrativeSchema } from "../src/contracts/slices";
import { MECHANICS, mechanicsFor } from "../src/mechanics/registry";

/*
 * Walks the JSON Schema the AI SDK actually sends and enforces the strict-mode subset we rely on.
 * Catches schema mistakes in CI instead of as a 400 from the API at 3am.
 * Limits per OpenAI's structured-outputs guide: 5,000 properties, 10 levels of nesting, 1,000 enum values.
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

const conceptIds = ["c_radians", "c_period", "c_amplitude", "c_solve"];

describe("LLM-facing schemas are strict-mode legal", () => {
  for (const genre of GENRES) {
    it(`director schema (${genre})`, () => {
      const schema = directorSchema({ genre, conceptIds, mechanics: mechanicsFor(genre), minEncounters: 5, maxEncounters: 9 });
      expect(audit(schema).errors).toEqual([]);
    });
  }

  for (const m of MECHANICS) {
    it(`challenge schema for ${m.id}`, () => expect(audit(challengeSchema(m)).errors).toEqual([]));
  }

  it("narrative schema", () => expect(audit(narrativeSchema(["cog", "warden"], ["e1", "e2"])).errors).toEqual([]));
  it("assessment schema", () => expect(audit(assessmentSchema(conceptIds)).errors).toEqual([]));

  it("the walker actually catches violations", async () => {
    const { z } = await import("zod");
    const bad = z.object({ a: z.string().min(2), b: z.string().optional(), c: z.record(z.string(), z.number()) });
    const { errors } = audit(bad);
    expect(errors.join("\n")).toMatch(/minLength/);
    expect(errors.join("\n")).toMatch(/\$\.b: must be required/);
    expect(errors.join("\n")).toMatch(/\$\.c: additionalProperties must be false/);
  });
});
