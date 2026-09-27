import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { WorldOverlay } from "../../../contracts/world";
import { withTrigLearnPhase } from "./trig-learn";

const world = JSON.parse(readFileSync("fixtures/worlds/trig.world.json", "utf8")).world as WorldOverlay;

describe("trig dungeon learn phase", () => {
  it("leaves every other spec, including the side-scroller, on the shared world", () => {
    expect(withTrigLearnPhase("trig_platformer_001", world)).toBe(world);
  });

  it("teaches on the walk up to the chasm, then stops", () => {
    const dressed = withTrigLearnPhase("trig_demo_001", world);
    expect(dressed).not.toBe(world);
    expect(dressed.triggers.map((t) => t.id)).toEqual([
      ...world.triggers.map((t) => t.id),
      "learn_radians",
      "learn_period",
      "learn_amplitude",
      "learn_solve",
      "learn_quiz",
    ]);
    expect(dressed.plaques.map((p) => p.id)).toEqual(["note_radians", "note_period", "note_amplitude", "note_solve"]);
    expect(dressed.npcs.find((n) => n.id === "brasswick")?.states.map((s) => s.id)).toEqual([
      "before",
      "after_radians",
      "after_period",
      "after_amplitude",
    ]);
    const quiz = dressed.triggers.find((t) => t.id === "learn_quiz");
    expect(quiz?.requires?.solved).toBe("e4_solve");
    expect(dressed.triggers.filter((t) => t.requires?.solved === "e5_period_review" || t.requires?.solved === "e6_boss")).toEqual([]);
  });

  it("leaves the six crypt machines as they were authored", () => {
    const dressed = withTrigLearnPhase("trig_demo_001", world);
    for (const id of ["e1_radians", "e2_period", "e3_amplitude", "e4_solve", "e5_period_review", "e6_boss"]) {
      const got = dressed.stations.find((s) => s.encounterId === id)!;
      const orig = world.stations.find((s) => s.encounterId === id)!;
      expect(got.dialogue).toEqual(orig.dialogue);
      expect(got.panel.cards).toEqual(orig.panel.cards);
    }
  });

  it("keeps every added line inside the dialogue budget", () => {
    const dressed = withTrigLearnPhase("trig_demo_001", world);
    const spoken = [
      ...dressed.triggers.filter((t) => t.id.startsWith("learn_")).flatMap((t) => t.lines.map((l) => l.text)),
      ...(dressed.npcs.find((n) => n.id === "brasswick")?.states.flatMap((s) => s.lines.map((l) => l.text)) ?? []),
      ...["e1_radians", "e2_period", "e3_amplitude", "e4_solve", "e5_period_review"].flatMap((id) => {
        const d = dressed.stations.find((s) => s.encounterId === id)!.dialogue;
        return [d.instruction.text, ...d.approach.map((l) => l.text)];
      }),
    ];
    for (const text of spoken) expect(text.length, text).toBeLessThanOrEqual(140);
    for (const plaque of dressed.plaques) {
      expect(plaque.title.length, plaque.title).toBeLessThanOrEqual(48);
      expect(plaque.text.length, plaque.text).toBeLessThanOrEqual(320);
    }
  });
});
