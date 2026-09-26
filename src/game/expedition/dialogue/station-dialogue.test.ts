import { describe, expect, it } from "vitest";
import { BossStaging, StationDialogue } from "../../../contracts/world";
import type { Diagnosis } from "../../../world/types";
import { DialogueEngine } from "./engine";
import {
  StationSlotFlow,
  approachSay,
  arenaSay,
  bossPhaseSay,
  defaultFailLines,
  failKeyOf,
  failResponse,
  hintSay,
  panelOpenPins,
  replaySay,
  successResponse,
  unlockedHints,
} from "./station-dialogue";

const dialogue = StationDialogue.parse({
  approach: [{ speakerId: "cog", text: "That gate hums in a loop." }],
  instruction: { text: "Tune the Tidewheel Gate's latch timer to one full turn." },
  tutorial: { text: "Drag the knob; the ring turns as you do." },
  insight: { text: "A rhythm repeats after one full cycle." },
  hints: [{ text: "Watch where the ring starts." }, { text: "One turn is 2π radians." }, { speakerId: "wren", text: "Try near π." }],
  fail: {
    default: { text: "Not quite: watch the ring." },
    byKey: [
      { key: "aligned_multiple", line: { text: "Two turns also line up; find the first." } },
      { key: "half_turn", line: { text: "That is half a cycle." } },
      { key: "over", line: { text: "Too long a wait." } },
    ],
  },
  success: { text: "One period: the ring comes home after π." },
  payoffLine: { text: "The gate swings wide!" },
  after: [{ speakerId: "cog", text: "Onward, the stair is lit." }],
});
const st = { encounterId: "e2_period", dialogue, boss: null };
const boss = BossStaging.parse({
  speakerId: "warden",
  arenaTriggerX: 100,
  phases: [{ id: "p1", itemKeys: ["i0"], line: { speakerId: "warden", text: "First batch." } }, { id: "p2", itemKeys: ["i1"] }],
  taunts: {
    approach: [{ speakerId: "warden", text: "Who winds my orrery?" }],
    fail: [
      { speakerId: "warden", text: "Wrong, little owl." },
      { speakerId: "warden", text: "Again wrong." },
    ],
    byKey: [{ key: "half_turn", line: { speakerId: "warden", text: "Half a heart." } }],
  },
});
const bossSt = { encounterId: "e6_boss", dialogue, boss };

const diag = (over: Partial<Diagnosis> = {}): Diagnosis => ({
  correct: false,
  feedback: "Too high.",
  displayFeedback: "Too high (display).",
  failKey: "over",
  wrongKeys: [],
  prefix: null,
  disclosed: {},
  nearMiss: null,
  probeKeys: [],
  ...over,
});

describe("station slot flow", () => {
  it("approach lines are a story-priority toast, once per station", () => {
    const r = approachSay(st, "cog");
    expect(r).toMatchObject({ channel: "toast", priority: "story", blocking: false });
    expect(r?.lines[0].id).toBe("station:e2_period:approach:0");
    const flow = new StationSlotFlow("cog");
    expect(flow.approach(st)).not.toBeNull();
    expect(flow.approach(st)).toBeNull();
  });

  it("tutorial pins on the first open only; insight after", () => {
    const first = panelOpenPins(st, "cog", true);
    expect(first.primary).toEqual({ kind: "instruction", text: dialogue.instruction.text, speakerId: "cog" });
    expect(first.secondary).toEqual({ kind: "tutorial", text: dialogue.tutorial!.text });
    const flow = new StationSlotFlow("cog");
    expect(flow.open(st).secondary?.kind).toBe("tutorial");
    expect(flow.open(st).secondary?.kind).toBe("insight");
    expect(flow.open(st).secondary?.text).toBe(dialogue.insight!.text);
  });

  it("falls back to insight when there is no tutorial, and to nothing when neither exists", () => {
    const noTut = { ...st, dialogue: { ...dialogue, tutorial: null } };
    expect(panelOpenPins(noTut, "cog", true).secondary?.kind).toBe("insight");
    const bare = { ...st, dialogue: { ...dialogue, tutorial: null, insight: null } };
    expect(panelOpenPins(bare, "cog", true).secondary).toBeNull();
  });

  it("hint rungs use the guide-voiced lines, else the fixture hints verbatim", () => {
    const r1 = hintSay(st, 1, ["fixture one", "fixture two"], "cog");
    expect(r1?.lines[0]).toMatchObject({ kind: "hint", text: "Watch where the ring starts.", speakerId: "cog" });
    expect(r1).toMatchObject({ channel: "bar", priority: "instruction" });
    expect(hintSay(st, 3, [], "cog")?.lines[0].speakerId).toBe("wren");
    const plain = { ...st, dialogue: { ...dialogue, hints: null } };
    expect(hintSay(plain, 2, ["fixture one", "fixture two"], "cog")?.lines[0]).toMatchObject({ text: "fixture two", speakerId: "cog" });
    expect(hintSay(plain, 3, ["fixture one", "fixture two"], "cog")).toBeNull();
    const unlocked = unlockedHints(st, 2, ["f1", "f2", "f3"], "cog");
    expect(unlocked.guide.map((g) => g.rung)).toEqual([1, 2]);
    expect(unlocked.fixture).toEqual(["f1", "f2"]);
  });

  it("fail key precedence: probe key, then near miss, then fail key", () => {
    expect(failKeyOf(diag({ probeKeys: ["half_turn"], nearMiss: "aligned_multiple" }))).toEqual({ key: "half_turn", kind: "probe" });
    expect(failKeyOf(diag({ nearMiss: "aligned_multiple" }))).toEqual({ key: "aligned_multiple", kind: "near_miss" });
    expect(failKeyOf(diag())).toEqual({ key: "over", kind: "line" });
    expect(failKeyOf(diag({ failKey: null }))).toEqual({ key: null, kind: "line" });
  });

  it("fail lines pick byKey then default, and pin the display feedback as line 2", () => {
    const probe = failResponse(st, diag({ probeKeys: ["half_turn"] }), 0, "cog");
    expect(probe.say?.lines.map((l) => [l.kind, l.text])).toEqual([["probe", "That is half a cycle."]]);
    expect(probe.pin).toEqual({ secondary: { kind: "feedback", text: "Too high (display)." } });
    const near = failResponse(st, diag({ nearMiss: "aligned_multiple" }), 0, "cog");
    expect(near.say?.lines[0]).toMatchObject({ kind: "near_miss", text: "Two turns also line up; find the first." });
    const plain = failResponse(st, diag({ failKey: "under" }), 0, "cog");
    expect(plain.say?.lines[0]).toMatchObject({ kind: "line", text: "Not quite: watch the ring.", speakerId: "cog" });
    expect(plain.say).toMatchObject({ channel: "bar", priority: "instruction", blocking: false });
  });

  it("bosses taunt first: byKey, else cycled by attempt", () => {
    const keyed = defaultFailLines(bossSt, diag({ probeKeys: ["half_turn"] }), 0);
    expect(keyed.map((l) => l.text)).toEqual(["Half a heart.", "That is half a cycle."]);
    const flow = new StationSlotFlow("cog");
    const a0 = flow.fail(bossSt, diag({ failKey: "under" }));
    const a1 = flow.fail(bossSt, diag({ failKey: "under" }));
    const a2 = flow.fail(bossSt, diag({ failKey: "under" }));
    expect(a0.say?.lines[0]).toMatchObject({ kind: "taunt", text: "Wrong, little owl.", speakerId: "warden" });
    expect(a1.say?.lines[0].text).toBe("Again wrong.");
    expect(a2.say?.lines[0].text).toBe("Wrong, little owl.");
    expect(a0.say?.source).not.toBe(a1.say?.source);
    expect(flow.failedAttempts("e6_boss")).toBe(3);
  });

  it("an injected failLines (V1's) is used verbatim", () => {
    const r = failResponse(st, diag(), 0, "cog", { failLines: () => [{ speakerId: null, text: "Injected.", mood: "neutral" }] });
    expect(r.say?.lines[0]).toMatchObject({ text: "Injected.", speakerId: "cog" });
  });

  it("success replaces the instruction, clears line 2, toasts the payoff line, then after lines", () => {
    const r = successResponse(st, "cog");
    expect(r.pin).toEqual({ primary: { kind: "success", text: dialogue.success.text, speakerId: "cog" }, secondary: null });
    expect(r.payoff).toMatchObject({ channel: "toast", lines: [{ kind: "payoff", text: "The gate swings wide!" }] });
    expect(r.after).toMatchObject({ channel: "bar", priority: "story", lines: [{ text: "Onward, the stair is lit." }] });
    // the engine shows success as the primary pin after an instruction was pinned
    const e = new DialogueEngine({ now: () => 0 });
    e.pin(panelOpenPins(st, "cog", true));
    e.pin(r.pin);
    expect(e.snapshot().pinned.primary?.kind).toBe("success");
    expect(e.snapshot().pinned.secondary).toBeNull();
  });

  it("boss arena and phase lines; solved stations replay success + after", () => {
    expect(arenaSay(st, "cog")).toBeNull();
    expect(arenaSay(bossSt, "cog")).toMatchObject({ blocking: true, channel: "bar", lines: [{ kind: "taunt", speakerId: "warden" }] });
    expect(bossPhaseSay(bossSt, 0, "cog")?.lines[0].text).toBe("First batch.");
    expect(bossPhaseSay(bossSt, 1, "cog")).toBeNull();
    const replay = replaySay(st, "cog");
    expect(replay?.lines.map((l) => l.kind)).toEqual(["success", "line"]);
  });
});
