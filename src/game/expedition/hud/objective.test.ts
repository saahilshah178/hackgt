import { describe, expect, it } from "vitest";
import { Meter } from "../../../contracts/world";
import { KEY_LEGEND, hudHotkey } from "./key-legend";
import {
  collectibleCounters,
  countersText,
  gameProgress,
  meterText,
  meterValue,
  objectiveLine,
  objectiveSummary,
  plural,
  ringSegments,
  zoneProgress,
} from "./objective";

const stations = [
  { encounterId: "e1", zoneId: "z1" },
  { encounterId: "e2", zoneId: "z1" },
  { encounterId: "e3", zoneId: "z1" },
  { encounterId: "e4", zoneId: "z2" },
];
const story = { objective: "Restore the orrery's starlight", objectiveLabel: "RHYTHMS", restoredNoun: "rhythm" };

describe("objective ring", () => {
  it("counts the current zone's stations", () => {
    expect(zoneProgress(stations, "z1", ["e1", "e2", "e4"])).toEqual({ solved: 2, total: 3 });
    expect(zoneProgress(stations, "z2", new Set(["e4"]))).toEqual({ solved: 1, total: 1 });
    expect(zoneProgress(stations, "z9", [])).toEqual({ solved: 0, total: 0 });
    expect(gameProgress(stations, ["e1", "e4"])).toEqual({ solved: 2, total: 4 });
  });

  it("tooltip / SR text and the objective line", () => {
    expect(objectiveSummary(story, { solved: 2, total: 3 })).toBe("Restore the orrery's starlight · 2 of 3 rhythms");
    expect(objectiveSummary(story, { solved: 0, total: 1 })).toBe("Restore the orrery's starlight · 0 of 1 rhythm");
    expect(objectiveLine(story, { solved: 2, total: 3 })).toBe("RHYTHMS 2/3");
    expect(plural("gate", 2)).toBe("gates");
    expect(plural("record", 12)).toBe("records");
    expect(plural("press", 2)).toBe("presses");
    expect(plural("story", 2)).toBe("stories");
  });

  it("segments fill clockwise per solved station", () => {
    const segs = ringSegments({ solved: 2, total: 3 }, 55, 20);
    expect(segs.map((s) => s.filled)).toEqual([true, true, false]);
    for (const s of segs) expect(s.d).toMatch(/^M[\d.]+ [\d.]+A/);
    expect(ringSegments({ solved: 0, total: 0 }, 55, 20)).toEqual([expect.objectContaining({ filled: false })]);
    expect(ringSegments({ solved: 1, total: 1 }, 55, 20)[0].filled).toBe(true);
  });
});

describe("meter and counters", () => {
  const meter = Meter.parse({
    id: "gradient",
    label: "GRADIENT",
    unit: "percent",
    start: 10,
    perEncounter: [
      { encounterId: "e1", value: 20 },
      { encounterId: "e2", value: 45 },
    ],
    drives: ["hud_bar", "ambient_particles"],
  });
  it("the value after the latest solve, never below start", () => {
    expect(meterValue(null, [])).toBeNull();
    expect(meterValue(meter, [])).toBe(10);
    expect(meterValue(meter, ["e1"])).toBe(20);
    expect(meterValue(meter, ["e2", "e1"])).toBe(45);
    expect(meterText(meter, 45)).toBe("GRADIENT 45 %");
    expect(meterText({ label: "SEALS", unit: "count" }, 3)).toBe("SEALS 3");
  });
  it("counts collectibles per kind", () => {
    const c = collectibleCounters(
      [
        { id: "p1", kind: "page" },
        { id: "p2", kind: "page" },
        { id: "s1", kind: "shard" },
      ],
      new Set(["p2"]),
    );
    expect(countersText(c)).toBe("Pages 1/2 · Shards 0/1");
  });
});

describe("key legend", () => {
  it("lists the §3.5 keys and maps HUD hotkeys, ignoring typing targets", () => {
    expect(KEY_LEGEND.find((r) => r.keys.includes("N"))?.explore).toBe("Mute");
    expect(hudHotkey({ key: "n" })).toBe("mute");
    expect(hudHotkey({ key: "?" })).toBe("legend");
    expect(hudHotkey({ key: "J" })).toBe("journal");
    expect(hudHotkey({ key: "n", targetTag: "INPUT" })).toBeNull();
    expect(hudHotkey({ key: "n", targetRole: "slider" })).toBeNull();
    expect(hudHotkey({ key: "n", ctrlKey: true })).toBeNull();
    expect(hudHotkey({ key: "x" })).toBeNull();
  });
});
