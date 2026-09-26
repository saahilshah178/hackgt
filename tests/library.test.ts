import { describe, expect, it } from "vitest";
import { CARDS, cardsFor, getCard, isCardImplemented, validateCatalog } from "../src/library";
import { autoSelectGenre, BOSS_SOCKET, CHUNKS, GENRE_WEIGHTS, SOCKETS } from "../src/library/genres";
import { FAMILIES, socketsFor } from "../src/mechanics/registry";
import { GENRES, KNOWLEDGE_TYPES } from "../src/contracts/common";

describe("catalog", () => {
  it("validates: unique ids, known family·mode, valid genres, locked params exist", () => {
    expect(validateCatalog()).toEqual([]);
  });

  it("the walker catches a bad card", () => {
    const issues = validateCatalog([
      ...CARDS.slice(0, 1),
      { ...CARDS[0] },
      { ...CARDS[0], id: "nope_mode", mode: "does_not_exist" },
      { ...CARDS[0], id: "nope_lock", lockedParams: { bogus: 1 } },
    ]);
    expect(issues.map((i) => i.message).join("\n")).toMatch(/duplicate id/);
    expect(issues.map((i) => i.message).join("\n")).toMatch(/unknown mode/);
    expect(issues.map((i) => i.message).join("\n")).toMatch(/lockedParams.bogus/);
  });

  it("has the seed flagships and the five generic cards", () => {
    for (const id of ["phase_gate", "number_line_leap", "mimic_chest", "chrono_bridge", "type_matched_weapon", "grapple_anchors", "cycle_wheel"]) {
      expect(getCard(id), id).toBeDefined();
    }
    expect(getCard("phase_gate")!.lockedParams).toEqual({ ask: "period" });
    expect(isCardImplemented(getCard("phase_gate")!)).toBe(true);
    expect(isCardImplemented(getCard("cycle_wheel")!)).toBe(true); // sequencer.cycle landed in P4 part B
  });

  it("filters to implemented cards per genre unless asked otherwise", () => {
    const dungeon = cardsFor("dungeon");
    expect(dungeon.every(isCardImplemented)).toBe(true);
    expect(cardsFor("dungeon", { includeUnimplemented: true }).length).toBeGreaterThan(dungeon.length);
  });
});

describe("genres", () => {
  it("every genre has a boss socket that is one of its sockets, and prefab chunks for every socket", () => {
    for (const g of GENRES) {
      expect(SOCKETS[g]).toContain(BOSS_SOCKET[g]);
      const provided = new Set(CHUNKS[g].map((c) => c.socket));
      for (const s of SOCKETS[g]) expect(provided.has(s), `${g} has no chunk for ${s}`).toBe(true);
      expect(CHUNKS[g].filter((c) => c.kind === "start")).toHaveLength(1);
      expect(CHUNKS[g].filter((c) => c.kind === "boss")).toHaveLength(1);
    }
  });

  it("every family adapter only names real sockets, and the boss socket is always allowed", () => {
    for (const f of FAMILIES) {
      for (const g of GENRES) {
        const skin = f.genres[g];
        if (!skin) continue;
        for (const s of skin.sockets) expect(SOCKETS[g], `${f.id}/${g}/${s}`).toContain(s);
        expect(socketsFor(f.id, g, BOSS_SOCKET[g])).toContain(BOSS_SOCKET[g]);
      }
    }
  });

  it("auto-selects the genre from knowledge-type weights, restricted to implemented genres", () => {
    expect(autoSelectGenre({ argument: 10 }).genre).toBe("mystery"); // dungeon + mystery hosts exist
    expect(autoSelectGenre({ quantitative: 10 }).genre).toBe("dungeon"); // platformer would win, but its host isn't built
    expect(autoSelectGenre({ argument: 10 }, GENRES).genre).toBe("mystery");
    expect(autoSelectGenre({ quantitative: 10 }, GENRES).genre).toBe("platformer");
    expect(autoSelectGenre({ fact: 4, category: 4 }, GENRES).genre).toBe("dungeon");
    for (const kt of KNOWLEDGE_TYPES) for (const g of GENRES) expect(GENRE_WEIGHTS[kt][g]).toBeGreaterThanOrEqual(0);
  });
});
