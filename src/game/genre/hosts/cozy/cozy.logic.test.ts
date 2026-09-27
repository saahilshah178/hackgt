import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { GameSpec } from "../../../../contracts/gamespec";
import { buildProgression, unlockedIds } from "../../../runner/progression";
import {
  BOARD_SLOTS,
  DAY_CAPACITY,
  FIRST_TRY_BONUS,
  LANTERN_CEILING,
  askFor,
  bloomOf,
  buildCozyWorld,
  buy,
  coinsOf,
  endDay,
  eveningDue,
  firstSentence,
  mix,
  paidFor,
  plotOf,
  priceBuildings,
  recordResult,
  settle,
  shortConcept,
  simulate,
  solvedToday,
  startDay,
  thanksFor,
  timeOfDay,
  upcomingVisitors,
  warp,
  type BuildingId,
} from "./cozy.logic";

const FIXTURE_DIR = new URL("../../../../../fixtures/", import.meta.url);
const FIXTURES: GameSpec[] = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => GameSpec.safeParse(JSON.parse(readFileSync(new URL(f, FIXTURE_DIR), "utf8"))))
  .filter((r) => r.success)
  .map((r) => r.data!);
const COZY = FIXTURES.find((s) => s.id === "cell_cozy_001")!;

function world(spec: GameSpec) {
  const p = buildProgression(spec);
  return { p, w: buildCozyWorld(spec, p) };
}

/** a spec with `n` encounters, cloned from the cozy showcase (the last one keeps role boss when `boss`) */
function sized(n: number, boss = true): GameSpec {
  const src = COZY.encounters;
  const encounters = Array.from({ length: n }, (_, i) => {
    const e = src[i % (src.length - 1)];
    return { ...e, id: `x${i + 1}`, role: boss && i === n - 1 ? ("boss" as const) : e.role === "boss" ? ("teach" as const) : e.role };
  });
  return { ...COZY, encounters, narrative: { ...COZY.narrative, beats: [] } };
}

describe("cozy world", () => {
  it("loads the showcase fixture and every other fixture", () => {
    expect(COZY).toBeDefined();
    expect(FIXTURES.length).toBeGreaterThanOrEqual(5);
  });

  it("is deterministic for a spec", () => {
    for (const spec of FIXTURES) {
      const a = world(spec).w;
      const b = world(spec).w;
      expect([...a.villagers.values()]).toEqual([...b.villagers.values()]);
      expect(a.decor).toEqual(b.decor);
      expect(a.buildings).toEqual(b.buildings);
    }
  });

  it("gives every villager a unique name and every house its own cell", () => {
    for (const spec of [...FIXTURES, sized(20), sized(1)]) {
      const { w } = world(spec);
      const vs = [...w.villagers.values()];
      expect(vs).toHaveLength(spec.encounters.length);
      const regular = vs.filter((v) => !v.isFestival);
      expect(new Set(regular.map((v) => v.name)).size).toBe(regular.length);
      const cells = regular.map((v) => `${v.house!.row}:${v.house!.col}`);
      expect(new Set(cells).size, spec.id).toBe(cells.length);
      for (const v of vs) {
        expect(v.ask.length).toBeGreaterThan(8);
        expect(v.snippet.length).toBeLessThanOrEqual(96);
        expect(v.reward).toBeGreaterThan(0);
      }
    }
  });

  it("groups villagers into households named after each track's first concept", () => {
    const { w, p } = world(COZY);
    expect(w.households).toHaveLength(p.tracks.length);
    expect(w.households.map((h) => h.name)).toEqual(["the Phospholipid bilayer household", "the Diffusion household", "the Active transport household"]);
    expect(w.villagers.get("e4_osmosis")!.household).toBe("the Diffusion household");
    expect(w.villagers.get("e11_boss")!.isFestival).toBe(true);
    expect(w.villagers.get("e11_boss")!.house).toBeNull();
    expect(new Set(w.households.map((h) => h.row)).size).toBe(w.households.length);
  });

  it("templates asks by socket and trims prompts to one sentence", () => {
    expect(askFor("market", "Diffusion")).toBe("What's a fair trade for Diffusion?");
    expect(askFor("production_line", "Osmosis")).toContain("order");
    expect(askFor("research_node", "Osmosis")).toMatch(/puzzling/);
    expect(askFor("unknown_socket", "Osmosis")).toContain("Osmosis");
    expect(shortConcept("Tonicity: hypotonic, isotonic, hypertonic")).toBe("Tonicity");
    expect(shortConcept("The sodium-potassium pump")).toBe("Sodium-potassium pump");
    expect(firstSentence("One two. Three four.")).toBe("One two.");
    const long = firstSentence("word ".repeat(60));
    expect(long.length).toBeLessThanOrEqual(96);
    expect(long.endsWith("…")).toBe(true);
  });

  it("gives each helped villager a stable thank-you line and remembers what they paid", () => {
    const { w, p } = world(COZY);
    expect(thanksFor(w, "e1_bilayer")).toBe(thanksFor(w, "e1_bilayer"));
    expect(thanksFor(w, "e1_bilayer")).not.toBe(thanksFor(w, "e2_selectivity"));
    let s = startDay(w, null, new Set(), unlockedIds(p, new Set()));
    s = recordResult(w, s, { encounterId: "e1_bilayer", correct: true, seq: 1 }, 1);
    expect(s.reaction?.line).toBe(thanksFor(w, "e1_bilayer"));
    expect(paidFor(w, s, "e1_bilayer")).toBe(w.villagers.get("e1_bilayer")!.reward + FIRST_TRY_BONUS);
  });

  it("mixes hex colours", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#8bc34a", "#8bc34a", 0.3)).toBe("#8bc34a");
  });
});

describe("cozy economy", () => {
  it("prices the Festival Lanterns within 60% of the minimum pre-festival earnings, and everything within them", () => {
    for (const spec of [...FIXTURES, sized(1), sized(2), sized(20), sized(7, false)]) {
      const { w } = world(spec);
      const lanterns = w.buildings.find((b) => b.id === "lanterns")!;
      expect(lanterns.price, spec.id).toBeLessThanOrEqual(LANTERN_CEILING * w.minEarned);
      const total = w.buildings.reduce((s, b) => s + b.price, 0);
      expect(total, spec.id).toBeLessThanOrEqual(w.minEarned);
      for (const b of w.buildings) expect(b.price).toBeGreaterThanOrEqual(0);
    }
    expect(priceBuildings(0).every((b) => b.price === 0)).toBe(true);
  });

  it("completes every fixture solving each day's requests, with the festival affordable when it unlocks", () => {
    for (const spec of [...FIXTURES, sized(1), sized(2), sized(20), sized(20, false), sized(5, false)]) {
      const { w, p } = world(spec);
      for (const opts of [{}, { spendGreedily: true }, { spendGreedily: true, noBonus: true }]) {
        const r = simulate(w, p, opts);
        expect(r.finished, `${spec.id} ${JSON.stringify(opts)}`).toBe(true);
        expect(r.festivalAffordable, `${spec.id} ${JSON.stringify(opts)}`).toBe(true);
        expect(r.emptyDays, spec.id).toBe(0);
        expect(r.coins).toBeGreaterThanOrEqual(0);
        expect(r.days).toBeLessThanOrEqual(spec.encounters.length);
        if (w.bossId) expect(r.built).toContain("lanterns");
      }
    }
  });

  it("takes about encounters / 3 days on the showcase", () => {
    const { w, p } = world(COZY);
    const r = simulate(w, p);
    expect(r.days).toBeGreaterThanOrEqual(Math.ceil(COZY.encounters.length / DAY_CAPACITY));
    expect(r.days).toBeLessThanOrEqual(6);
  });

  it("pays the first-try bonus once, only on a correct first attempt, and never charges for a wrong answer", () => {
    const { w, p } = world(COZY);
    const solved = new Set<string>();
    let s = startDay(w, null, solved, unlockedIds(p, solved));
    const id = s.slots[0]!;
    s = recordResult(w, s, { encounterId: id, correct: false, seq: 1 }, 1);
    expect(coinsOf(w, s, solved)).toBe(0);
    expect(s.reaction?.correct).toBe(false);
    solved.add(id);
    s = recordResult(w, s, { encounterId: id, correct: true, seq: 2 }, 2);
    expect(s.bonuses[id]).toBeUndefined();
    expect(coinsOf(w, s, solved)).toBe(w.villagers.get(id)!.reward);
    const other = s.slots[1]!;
    solved.add(other);
    s = recordResult(w, s, { encounterId: other, correct: true, seq: 3 }, 1);
    expect(s.bonuses[other]).toBe(FIRST_TRY_BONUS);
    expect(s.reaction?.coins).toBe(w.villagers.get(other)!.reward + FIRST_TRY_BONUS);
    // the same seq is absorbed only once
    expect(recordResult(w, s, { encounterId: other, correct: true, seq: 3 }, 1)).toBe(s);
  });

  it("buys each building once, only when affordable, and fills plots in order", () => {
    const { w, p } = world(COZY);
    const solved = new Set(w.order.filter((id) => id !== w.bossId));
    let s = startDay(w, null, new Set(), unlockedIds(p, new Set()));
    expect(buy(w, s, "lighthouse", new Set())).toBeNull(); // no coins yet (unless free)
    for (const id of ["garden", "cottage", "lanterns", "bakery"] as BuildingId[]) s = buy(w, s, id, solved)!;
    expect(buy(w, s, "garden", solved)).toBeNull();
    expect(plotOf(s, "garden")).toBe(0);
    expect(plotOf(s, "cottage")).toBe(1);
    expect(plotOf(s, "bakery")).toBe(2);
    expect(plotOf(s, "lanterns")).toBe(-1);
    expect(coinsOf(w, s, solved)).toBe(w.minEarned - s.spent);
  });
});

describe("cozy days", () => {
  it("starts with up to three seeded requests from what is available", () => {
    for (const spec of FIXTURES) {
      const { w, p } = world(spec);
      const avail = unlockedIds(p, new Set());
      const s = startDay(w, null, new Set(), avail);
      expect(s.slots).toHaveLength(BOARD_SLOTS);
      const shown = s.slots.filter((x) => x !== null);
      expect(shown.length).toBe(Math.min(BOARD_SLOTS, avail.length));
      for (const id of shown) expect(avail).toContain(id);
      expect(startDay(w, null, new Set(), avail)).toEqual(s);
    }
  });

  it("ends the day after three helped villagers and refills a dry board before then", () => {
    const { w, p } = world(COZY);
    const solved = new Set<string>();
    let s = startDay(w, null, solved, unlockedIds(p, solved));
    const first = s.slots.filter((x): x is string => x !== null);
    solved.add(first[0]);
    s = settle(w, s, solved, unlockedIds(p, solved));
    expect(timeOfDay(s, solved, false)).toBe(1);
    expect(eveningDue(s, solved, false)).toBe(false);
    solved.add(first[1]);
    solved.add(first[2]);
    expect(solvedToday(s, solved)).toHaveLength(3);
    expect(eveningDue(s, solved, false)).toBe(true);
    expect(timeOfDay(s, solved, false)).toBe(3);
    const next = startDay(w, s, solved, unlockedIds(p, solved));
    expect(next.day).toBe(2);
    expect(next.days[0].solved.sort()).toEqual([...first].sort());
    expect(next.days[0].coins).toBeGreaterThan(0);
  });

  it("refills with newly unlocked villagers when the board runs dry mid-day", () => {
    const spec = { ...COZY, encounters: COZY.encounters.filter((e) => ["e1_bilayer", "e2_selectivity", "e11_boss"].includes(e.id)) };
    const { w, p } = world(spec);
    const solved = new Set<string>();
    let s = startDay(w, null, solved, unlockedIds(p, solved));
    expect(s.slots).toEqual(["e1_bilayer", null, null]);
    solved.add("e1_bilayer");
    s = settle(w, s, solved, unlockedIds(p, solved));
    expect(s.slots).toEqual(["e1_bilayer", "e2_selectivity", null]);
    expect(settle(w, s, solved, unlockedIds(p, solved))).toBe(s);
  });

  it("lets the player end the day early, and End day is idempotent", () => {
    const { w, p } = world(COZY);
    const s = startDay(w, null, new Set(), unlockedIds(p, new Set()));
    const e = endDay(s);
    expect(eveningDue(e, new Set(), false)).toBe(true);
    expect(endDay(e)).toBe(e);
    expect(eveningDue(e, new Set(), true)).toBe(false);
  });

  it("warps a debug target onto the board", () => {
    const { w, p } = world(COZY);
    const s = startDay(w, null, new Set(), unlockedIds(p, new Set()));
    const moved = warp(s, "e9_osmosis_review", new Set());
    expect(moved.slots).toContain("e9_osmosis_review");
    expect(warp(moved, "e9_osmosis_review", new Set())).toBe(moved);
  });

  it("grows bloom with helped villagers and buildings", () => {
    const { w, p } = world(COZY);
    let s = startDay(w, null, new Set(), unlockedIds(p, new Set()));
    expect(bloomOf(w, s, new Set()).level).toBe(0);
    const all = new Set(w.order);
    for (const b of w.buildings) s = buy(w, s, b.id, all) ?? s;
    expect(bloomOf(w, s, all).level).toBe(5);
    const half = new Set(w.order.slice(0, 5));
    expect(bloomOf(w, startDay(w, null, half, []), half).level).toBeGreaterThanOrEqual(1);
  });

  it("lighthouse sees villagers one step away", () => {
    const { p } = world(COZY);
    const up = upcomingVisitors(p, new Set(), unlockedIds(p, new Set()));
    expect(up).toEqual(["e2_selectivity", "e4_osmosis", "e8_pump"]);
  });
});
