import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateGameSpec } from "../src/pipeline/validate/validate-gamespec";

/*
 * Postgres jsonb reorders object keys, so a spec read back from Supabase has every object's keys in a different
 * order. That must not fail validation: the stored solution and locked params are the same values.
 */

/** Deep copy with every object's keys reversed (arrays keep their order). */
function reverseKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(reverseKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)]));
  return v;
}

const FIXTURES = path.join(process.cwd(), "fixtures");
const specs = readdirSync(FIXTURES)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ file: f, spec: JSON.parse(readFileSync(path.join(FIXTURES, f), "utf8")) as unknown }))
  .filter(({ spec }) => validateGameSpec(spec).ok);

describe("validateGameSpec ignores object key order", () => {
  it("has fixtures to check", () => {
    expect(specs.length).toBeGreaterThan(3);
  });

  it.each(specs.map((s) => [s.file, s.spec] as const))("%s still validates with every object's keys reversed", (_file, spec) => {
    const result = validateGameSpec(reverseKeys(spec));
    expect(result.ok ? [] : result.issues).toEqual([]);
  });
});
