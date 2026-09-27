import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Id } from "../../../contracts/common";
import { allSkins } from "../../../world/library";
import { CUE_MAP, RECIPES, RECIPE_IDS, cueDurationMs, cueFor, isLoopCue, repeatOffsets, type RecipeId } from "./cues";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
// normalised to LF: on a CRLF checkout (Windows autocrlf) the blank line that ends a table is "\r\n\r\n"
const doc = (name: string) => readFileSync(path.join(ROOT, "docs/design", name), "utf8").replace(/\r\n/g, "\n");

/** Every backticked id in the FIRST column of the first table under `heading` (until the next heading). */
function firstColumnIds(markdown: string, heading: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.startsWith(heading));
  expect(start, `heading ${heading}`).toBeGreaterThanOrEqual(0);
  const ids: string[] = [];
  let inTable = false;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{2,4} /.test(l)) break;
    if (!l.startsWith("|")) {
      if (inTable) break;
      continue;
    }
    inTable = true;
    const first = l.split("|")[1] ?? "";
    if (/^\s*-+\s*$/.test(first) || /Cue id/i.test(first)) continue;
    for (const m of first.matchAll(/`([^`]+)`/g)) ids.push(m[1]);
  }
  return ids;
}

const TRIG = firstColumnIds(doc("10-game-trig.md"), "### 6.8 Sound hooks");
const CELL = firstColumnIds(doc("11-game-cell-transport.md"), "### 6.7 Sound cue ids");
const CIVIL = firstColumnIds(doc("12-game-civil-rights.md"), "#### 5.0.6 Success grammar");

describe("CUE_MAP coverage (trig §6.8, cell §6.7, civil §5.0.6)", () => {
  it("the shared ui_* core set sits on the intended recipes", () => {
    const core: Record<string, RecipeId> = {
      ui_hop: "pop", ui_land: "thunk", ui_bump: "thunk", ui_advance: "tick", ui_talk: "select", ui_hint: "select",
      ui_pickup: "chime", ui_zone: "whoosh", ui_finale: "chord", ui_knob_tick: "tick", ui_page_turn: "page",
    };
    for (const [id, recipe] of Object.entries(core)) expect(cueFor(id)?.recipe, id).toBe(recipe);
  });

  it("parsed every table", () => {
    expect(TRIG.length).toBeGreaterThanOrEqual(35);
    expect(CELL.length).toBeGreaterThanOrEqual(20);
    expect(CIVIL.length).toBeGreaterThanOrEqual(20);
  });

  for (const [game, ids] of [["trig", TRIG], ["cell", CELL], ["civil", CIVIL]] as const) {
    it(`maps every ${game} cue id to a recipe`, () => {
      const missing = ids.filter((id) => !cueFor(id));
      expect(missing).toEqual([]);
      for (const id of ids) {
        expect(Id.safeParse(id).success, id).toBe(true);
        expect(RECIPE_IDS).toContain(CUE_MAP[id].recipe);
      }
    });
  }

  it("covers the architecture's own table (§2.12) exactly: no extra ids", () => {
    const arch = doc("20-expedition-architecture.md");
    const start = arch.indexOf("| Recipe | Synthesis | Cue ids mapped to it |");
    const end = arch.indexOf("\n\n", start);
    const table = arch.slice(start, end).split("\n").slice(2);
    const archIds = new Set<string>();
    for (const row of table) {
      const cells = row.split("|");
      const recipe = /`([a-z_]+)`/.exec(cells[1] ?? "")?.[1];
      const mapped = [...(cells[3] ?? "").matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1]);
      for (const id of mapped) {
        archIds.add(id);
        expect(CUE_MAP[id]?.recipe, `${id} → ${recipe}`).toBe(recipe);
      }
    }
    expect(new Set(Object.keys(CUE_MAP))).toEqual(archIds);
  });

  it("every key is Id-legal and every entry is well-formed", () => {
    for (const [id, c] of Object.entries(CUE_MAP)) {
      expect(Id.safeParse(id).success, id).toBe(true);
      expect(RECIPES[c.recipe]).toBeDefined();
      if (c.repeat !== undefined) expect(c.repeat).toBeGreaterThanOrEqual(2);
      if (c.pitch !== undefined) expect(c.pitch).toBeGreaterThan(0);
      if (c.gain !== undefined) expect(c.gain).toBeGreaterThan(0);
    }
  });

  it("params follow the table: lift_hum one-shot, clunk plays grind, repeats and pitches", () => {
    expect(CUE_MAP.lift_hum).toEqual({ recipe: "whoosh", pitch: 0.5 });
    expect(isLoopCue("lift_hum")).toBe(false);
    expect(CUE_MAP.clunk.recipe).toBe("grind");
    expect(CUE_MAP.warden_bow_rumble.recipe).toBe("rumble");
    expect(CUE_MAP.cog_wind).toEqual({ recipe: "tick", pitch: 0.8, repeat: 6 });
    expect(CUE_MAP.lamp_swing).toEqual({ recipe: "whoosh", pitch: 0.6, gain: 0.4 });
    expect(repeatOffsets("bolt_slide")).toHaveLength(4);
    expect(isLoopCue("mb_tone")).toBe(true);
    expect(cueDurationMs("mb_tone")).toBe(Number.POSITIVE_INFINITY);
    expect(cueDurationMs("teletype")).toBeGreaterThanOrEqual(950);
    expect(cueDurationMs("nope")).toBe(0);
  });

  it("recipes are bounded one-shots or loops", () => {
    for (const id of RECIPE_IDS) {
      const r = RECIPES[id];
      expect(r.voices.length).toBeGreaterThan(0);
      if (!r.loop) {
        const end = Math.max(...r.voices.map((v) => v.atMs + v.durMs));
        expect(end).toBeGreaterThan(0);
        expect(end).toBeLessThanOrEqual(1300);
      }
    }
  });
});

describe("cues used by content are mapped (R16)", () => {
  it("side-car worlds", () => {
    const dir = path.join(ROOT, "fixtures/worlds");
    const used = new Set<string>();
    const walk = (o: unknown, key?: string): void => {
      if (Array.isArray(o)) o.forEach((x) => walk(x));
      else if (o && typeof o === "object") {
        if ((o as { do?: unknown }).do === "music") return; // music cues (Segment.music, the music step) are not cue ids
        for (const [k, v] of Object.entries(o)) walk(v, k);
      }
      else if (key === "cue" && typeof o === "string") used.add(o);
    };
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".world.json"))) walk(JSON.parse(readFileSync(path.join(dir, f), "utf8")));
    expect([...used].filter((c) => !cueFor(c))).toEqual([]);
  });

  it("every skin's cues", () => {
    const missing: string[] = [];
    for (const { ownerId, skin } of allSkins()) {
      for (const c of [skin.cues.live, skin.cues.succeed, skin.cues.fail]) if (c && !cueFor(c)) missing.push(`${ownerId}/${skin.id}: ${c}`);
    }
    expect(missing).toEqual([]);
  });

  it("literal cue ids in metas' failure and success plans", () => {
    const missing: string[] = [];
    for (const sub of ["src/world/contraptions", "src/world/sandboxes"]) {
      const dir = path.join(ROOT, sub);
      for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
        const src = readFileSync(path.join(dir, f), "utf8");
        for (const m of src.matchAll(/\bcue:\s*["']([a-z0-9_]+)["']/g)) if (!cueFor(m[1])) missing.push(`${f}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
