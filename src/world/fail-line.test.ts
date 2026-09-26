import { describe, expect, it } from "vitest";
import { Station } from "../contracts/world";
import { failKeyCandidates, failLineKey, failLines } from "./fail-line";

const station = (withBoss: boolean) =>
  Station.parse({
    encounterId: "e6_boss",
    zoneId: "z3",
    consoleX: 100,
    anchor: { x: 100, y: 100 },
    contraption: "pendulum_sync",
    skin: "wardens_shield",
    objectNoun: "Shield",
    panel: { verifyLabel: "SYNC", successBadge: "SYNCED" },
    dialogue: {
      instruction: { text: "Sync the shield." },
      fail: {
        default: { text: "default line" },
        byKey: [
          { key: "reach", line: { text: "probe line" } },
          { key: "short_of_cycle", line: { text: "near-miss line" } },
          { key: "over", line: { text: "fail-key line", speakerId: "warden" } },
        ],
      },
      success: { text: "done" },
    },
    payoff: { kind: "remove_blocker", vertical: "none", anim: "door_opens", noun: "door", blocker: null },
    boss: withBoss
      ? { speakerId: "warden", arenaTriggerX: 50, taunts: { fail: [{ speakerId: "cog", text: "t0" }, { speakerId: "cog", text: "t1" }], byKey: [{ key: "over", line: { speakerId: "cog", text: "taunt over" } }] } }
      : null,
  });
const d = (probeKeys: string[], nearMiss: string | null, failKey: "over" | "under" | null) => ({ probeKeys, nearMiss, failKey });

describe("failLines precedence: probe > near-miss > fail key > default", () => {
  it("picks the first candidate with an authored line", () => {
    const st = station(false);
    expect(failLines(st, d(["reach"], "short_of_cycle", "over"), 0, "cog")).toEqual([{ speakerId: "cog", text: "probe line", mood: "neutral" }]);
    expect(failLines(st, d([], "short_of_cycle", "over"), 0, "cog")[0]?.text).toBe("near-miss line");
    expect(failLines(st, d([], null, "over"), 0, "cog")[0]).toMatchObject({ text: "fail-key line", speakerId: "warden" });
    expect(failLines(st, d([], null, "under"), 0, "cog")[0]?.text).toBe("default line");
    // an unmatched probe key falls through to the next candidate
    expect(failLines(st, d(["other_probe"], null, "over"), 0, "cog")[0]?.text).toBe("fail-key line");
    expect(failLineKey(st, d(["other_probe"], "short_of_cycle", "over"))).toBe("short_of_cycle");
    expect(failLineKey(st, d([], null, "under"))).toBeNull();
    expect(failKeyCandidates(d(["a", "b"], "n", "over"))).toEqual(["a", "b", "n", "over"]);
  });
  it("null speakers are the guide (narrator when no guide is given)", () => {
    expect(failLines(station(false), d([], null, null), 0)[0]?.speakerId).toBe("narrator");
  });
});

describe("boss taunt first", () => {
  it("byKey taunt for the same key, spoken by the boss voice", () => {
    const lines = failLines(station(true), d([], null, "over"), 0, "cog");
    expect(lines.map((l) => l.text)).toEqual(["taunt over", "fail-key line"]);
    expect(lines[0]?.speakerId).toBe("warden");
  });
  it("otherwise the fail taunts cycle by attempt", () => {
    expect(failLines(station(true), d([], null, "under"), 0, "cog")[0]?.text).toBe("t0");
    expect(failLines(station(true), d([], null, "under"), 1, "cog")[0]?.text).toBe("t1");
    expect(failLines(station(true), d([], null, "under"), 2, "cog")[0]?.text).toBe("t0");
    expect(failLines(station(true), d([], null, "under"), 3, "cog")).toHaveLength(2);
  });
});
