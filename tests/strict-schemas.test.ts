import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { GENRES } from "../src/contracts/common";
import {
  assessmentSchema,
  tutorSchema,
  challengeSchema,
  curriculumSchema,
  directorSchema,
  gatekeeperSchema,
  matcherSchema,
  narrativeSchema,
  preCheckSchema,
  type DirectorMenuFamily,
} from "../src/contracts/slices";
import { CARDS, cardsFor } from "../src/library";
import { BOSS_SOCKET } from "../src/library/genres";
import { allModes, familiesFor, implementedModes, socketsFor } from "../src/mechanics/registry";
import cellFixture from "../fixtures/cell-transport-dungeon.json";
import civilFixture from "../fixtures/civil-rights-mystery.json";
import trigFixture from "../fixtures/trig-dungeon.json";
import { GameSpec } from "../src/contracts/gamespec";
import { contraptionsForMode, writerCtxFor } from "../src/world/library";
import { visionCriticSchema } from "../src/pipeline/world3d/vision-critic";
import { storyCriticSchema, world3dArchitectSchema, worldCriticSchema } from "../src/contracts/world3d-slices";

/*
 * Walks the JSON Schema the AI SDK actually sends and enforces the strict-mode subset we rely on.
 * Catches schema mistakes in CI instead of as a 400 from the API at 3am.
 * Limits per OpenAI's structured-outputs guide: 5,000 properties, 10 levels of nesting, 1,000 enum values.
 */
const BANNED = ["oneOf", "allOf", "not", "const", "minLength", "maxLength", "pattern", "format", "patternProperties", "if"];

type Node = Record<string, unknown>;

export function audit(schema: z.ZodType) {
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
const beliefs = ["π radians is a full circle.", "Amplitude is the distance from peak to trough."];

function menuFor(genre: (typeof GENRES)[number]): DirectorMenuFamily[] {
  const cards = cardsFor(genre);
  return familiesFor(genre).map((f) => ({
    familyId: f.id,
    sockets: socketsFor(f.id, genre, BOSS_SOCKET[genre]),
    cards: cards.filter((c) => c.family === f.id),
  }));
}

describe("LLM-facing schemas are strict-mode legal", () => {
  it("gatekeeper schema", () => expect(audit(gatekeeperSchema()).errors).toEqual([]));
  it("curriculum schema", () => expect(audit(curriculumSchema()).errors).toEqual([]));
  it("matcher schema (with and without misconceptions)", () => {
    expect(audit(matcherSchema(["phase_gate", "mimic_chest", "pulse_matcher"], beliefs)).errors).toEqual([]);
    expect(audit(matcherSchema(["phase_gate", "mimic_chest"], [])).errors).toEqual([]);
  });
  it("pre-check schema", () => expect(audit(preCheckSchema(conceptIds)).errors).toEqual([]));
  it("assessment schema", () => expect(audit(assessmentSchema(conceptIds)).errors).toEqual([]));
  it("tutor schema", () => expect(audit(tutorSchema(conceptIds)).errors).toEqual([]));
  it("narrative schema", () => expect(audit(narrativeSchema(["cog", "warden"], ["e1", "e2"])).errors).toEqual([]));

  for (const genre of GENRES) {
    it(`director schema (${genre})`, () => {
      const schema = directorSchema({ genre, conceptIds, families: menuFor(genre), beliefs, bossSocket: BOSS_SOCKET[genre], minEncounters: 5, maxEncounters: 9 });
      expect(audit(schema).errors).toEqual([]);
    });
  }

  it("director schema with the whole catalog for dungeon stays under the limits", () => {
    const genre = "dungeon";
    const cards = cardsFor(genre, { includeUnimplemented: true });
    const families = familiesFor(genre).map((f) => ({ familyId: f.id, sockets: socketsFor(f.id, genre, "boss"), cards: cards.filter((c) => c.family === f.id) }));
    const { errors, stats } = audit(directorSchema({ genre, conceptIds, families, beliefs: [], bossSocket: "boss", minEncounters: 5, maxEncounters: 9 }));
    expect(errors).toEqual([]);
    expect(stats.enumValues).toBeLessThan(1000);
  });

  for (const { mode, key } of implementedModes()) {
    it(`challenge schema for ${key}`, () => expect(audit(challengeSchema(mode.paramsSchema)).errors).toEqual([]));
    const lockedCards = CARDS.filter((c) => `${c.family}.${c.mode}` === key && c.lockedParams);
    for (const card of lockedCards) {
      it(`challenge schema for ${key} with ${card.id}'s locked params omitted`, () => {
        const schema = challengeSchema(mode.paramsSchema, Object.keys(card.lockedParams!));
        expect(audit(schema).errors).toEqual([]);
        const json = zodSchema(schema).jsonSchema as { properties: { params: { properties: Record<string, unknown> } } };
        for (const k of Object.keys(card.lockedParams!)) expect(json.properties.params.properties).not.toHaveProperty(k);
      });
    }
  }

  for (const { mode, key } of allModes().filter((m) => m.mode.implemented && m.mode.blindSolvable)) {
    it(`blind-solve schema for ${key}`, () => {
      expect(mode.blind, `${key} is blindSolvable but has no blind solver`).toBeDefined();
      expect(audit(mode.blind!.schema).errors).toEqual([]);
    });
  }

  it("the walker actually catches violations", async () => {
    const { z } = await import("zod");
    const bad = z.object({ a: z.string().min(2), b: z.string().optional(), c: z.record(z.string(), z.number()) });
    const { errors } = audit(bad);
    expect(errors.join("\n")).toMatch(/minLength/);
    expect(errors.join("\n")).toMatch(/\$\.b: must be required/);
    expect(errors.join("\n")).toMatch(/\$\.c: additionalProperties must be false/);
  });
});

describe("world3d schemas are strict-mode legal (docs/design/60 §2.5)", () => {
  const encounterIds = ["e1_radians", "e2_period", "e3_amplitude", "e4_solve", "e5_review", "e6_boss"];
  it("World Architect schema, for every map size", () => {
    for (const size of [420, 560, 700]) {
      const { errors, stats } = audit(world3dArchitectSchema({ encounterIds, conceptIds, characterIds: ["cog", "warden"], size }));
      expect(errors).toEqual([]);
      expect(stats.enumValues).toBeLessThan(1000);
    }
  });
  it("World Architect schema at the largest job (14 encounters, 25 concepts, 4 characters)", () => {
    const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
    const { errors, stats } = audit(world3dArchitectSchema({ encounterIds: many("e", 14), conceptIds: many("c_", 25), characterIds: many("ch", 4), size: 700 }));
    expect(errors).toEqual([]);
    expect(stats.enumValues).toBeLessThan(1000);
  });
  it("story critic schema", () => expect(audit(storyCriticSchema()).errors).toEqual([]));
  it("world critic schema", () => expect(audit(worldCriticSchema()).errors).toEqual([]));
  it("vision critic schema", () => expect(audit(visionCriticSchema()).errors).toEqual([]));
});

describe("contraption writer schemas are strict-mode legal (docs/design/20 §4.4)", () => {
  const specs = [
    { spec: GameSpec.parse(trigFixture), domain: "math" as const },
    { spec: GameSpec.parse(cellFixture), domain: "biology" as const },
    { spec: GameSpec.parse(civilFixture), domain: "history" as const },
  ];
  for (const { spec, domain } of specs) {
    spec.encounters.forEach((e, i) => {
      const ctx = writerCtxFor(spec, i, domain);
      for (const meta of contraptionsForMode(ctx.modeKey)) {
        const schema = meta.writerConfigSchema(ctx);
        if (!schema) continue;
        it(`${meta.id} writer schema for ${spec.id}/${e.id}`, () => {
          const wrapped = (schema as z.ZodType & { _zod: { def: { type: string } } })._zod.def.type === "object" ? schema : null;
          expect(wrapped, "writer schemas must be root objects").not.toBeNull();
          expect(audit(schema).errors).toEqual([]);
        });
      }
    });
  }
});
