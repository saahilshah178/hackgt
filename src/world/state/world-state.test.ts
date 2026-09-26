import { describe, expect, it } from "vitest";
import { Npc, Quest, Requirement } from "../../contracts/world";
import {
  activeNpcState,
  emptyWorldState,
  mirrorBonus,
  npcVisibleIn,
  questStatus,
  readBonus,
  reduceAll,
  reduceWorldState,
  requirementMet,
  settleQuests,
  worldStateDebug,
  type KeyValueStore,
  type ReqCtx,
  type WorldState,
} from "./index";

const ctx = (state: WorldState, solved: string[] = []): ReqCtx => ({ solvedIds: new Set(solved), state });

describe("reduceWorldState", () => {
  it("sets and clears flags immutably", () => {
    const s0 = emptyWorldState();
    const s1 = reduceWorldState(s0, { type: "flag", id: "cog_awake", on: true });
    expect(s1.flags.has("cog_awake")).toBe(true);
    expect(s0.flags.has("cog_awake")).toBe(false);
    const s2 = reduceWorldState(s1, { type: "flag", id: "cog_awake", on: false });
    expect(s2.flags.has("cog_awake")).toBe(false);
  });

  it("returns the same object when nothing changes", () => {
    const s0 = emptyWorldState();
    expect(reduceWorldState(s0, { type: "flag", id: "x", on: false })).toBe(s0);
    const s1 = reduceWorldState(s0, { type: "collect", id: "page_1" });
    expect(reduceWorldState(s1, { type: "collect", id: "page_1" })).toBe(s1);
    const s2 = reduceWorldState(s1, { type: "cosmetic", asset: "shared.costume.gold_trim" });
    expect(reduceWorldState(s2, { type: "cosmetic", asset: "shared.costume.gold_trim" })).toBe(s2);
  });

  it("records every event kind under its key", () => {
    const s = reduceAll(emptyWorldState(), [
      { type: "collect", id: "shard_2" },
      { type: "touch", id: "lantern_a" },
      { type: "talk", npcId: "brasswick", stateId: "before" },
      { type: "trigger", id: "s0_controls" },
      { type: "sandbox_goal", sandboxId: "music_box", goal: "explored" },
      { type: "cosmetic", asset: "shared.costume.gold_trim" },
    ]);
    expect(s.collected.has("shard_2")).toBe(true);
    expect(s.touched.has("lantern_a")).toBe(true);
    expect(s.talked.has("brasswick:before")).toBe(true);
    expect(s.fired.has("s0_controls")).toBe(true);
    expect(s.sandboxGoals.has("music_box:explored")).toBe(true);
    expect(s.cosmetics).toEqual(["shared.costume.gold_trim"]);
    expect(worldStateDebug(s)).toEqual({ flags: [], collected: ["shard_2"], touched: ["lantern_a"] });
  });
});

describe("requirementMet", () => {
  const s = reduceAll(emptyWorldState(), [
    { type: "flag", id: "a", on: true },
    { type: "collect", id: "n1" },
    { type: "collect", id: "n2" },
  ]);
  it("null always holds", () => {
    expect(requirementMet(null, ctx(emptyWorldState()))).toBe(true);
  });
  it("checks solved, flag, notFlag and collected together", () => {
    expect(requirementMet(Requirement.parse({ solved: "e2_period" }), ctx(s))).toBe(false);
    expect(requirementMet(Requirement.parse({ solved: "e2_period" }), ctx(s, ["e2_period"]))).toBe(true);
    expect(requirementMet(Requirement.parse({ flag: "a" }), ctx(s))).toBe(true);
    expect(requirementMet(Requirement.parse({ flag: "b" }), ctx(s))).toBe(false);
    expect(requirementMet(Requirement.parse({ notFlag: "a" }), ctx(s))).toBe(false);
    expect(requirementMet(Requirement.parse({ notFlag: "b" }), ctx(s))).toBe(true);
    expect(requirementMet(Requirement.parse({ collected: ["n1", "n2"] }), ctx(s))).toBe(true);
    expect(requirementMet(Requirement.parse({ collected: ["n1", "n3"] }), ctx(s))).toBe(false);
    expect(requirementMet(Requirement.parse({ flag: "a", solved: "e1", collected: ["n1"] }), ctx(s, ["e1"]))).toBe(true);
    expect(requirementMet(Requirement.parse({ flag: "a", solved: "e1", notFlag: "a" }), ctx(s, ["e1"]))).toBe(false);
  });
});

const line = (text: string) => ({ speakerId: "brasswick", text });

describe("activeNpcState", () => {
  const npc = Npc.parse({
    id: "brasswick",
    name: "Brasswick",
    speakerId: "brasswick",
    asset: "orrery_terraces.npc.brasswick",
    states: [
      { id: "before", zoneId: "z1", x: 900, lines: [line("My arm swings wrong.")] },
      { id: "waiting", requires: { flag: "brass_asked" }, zoneId: "z1", x: 900, lines: [line("Fix the gate first.")] },
      { id: "after", requires: { flag: "brass_asked", solved: "e2_period" }, zoneId: "z1", x: 900, lines: [line("It swings true!")], anim: "arm_sync" },
      { id: "gone", requires: { flag: "brass_done" }, zoneId: "z2", x: 100, pose: "hidden", lines: [line("…")] },
    ],
  });
  it("picks the LAST state whose requirement holds", () => {
    expect(activeNpcState(npc, ctx(emptyWorldState()))?.id).toBe("before");
    const asked = reduceWorldState(emptyWorldState(), { type: "flag", id: "brass_asked", on: true });
    expect(activeNpcState(npc, ctx(asked))?.id).toBe("waiting");
    expect(activeNpcState(npc, ctx(asked, ["e2_period"]))?.id).toBe("after");
    const done = reduceWorldState(asked, { type: "flag", id: "brass_done", on: true });
    expect(activeNpcState(npc, ctx(done, ["e2_period"]))?.id).toBe("gone");
  });
  it("hidden and other-zone states are not visible", () => {
    const done = reduceAll(emptyWorldState(), [{ type: "flag", id: "brass_done", on: true }]);
    expect(npcVisibleIn(npc, "z1", ctx(emptyWorldState()))).toBe(true);
    expect(npcVisibleIn(npc, "z2", ctx(emptyWorldState()))).toBe(false);
    expect(npcVisibleIn(npc, "z2", ctx(done))).toBe(false);
  });
  it("returns null when no state holds", () => {
    const gated = Npc.parse({
      id: "sucra",
      name: "Sucra",
      speakerId: "sucra",
      asset: "living_gate.npc.sucra",
      states: [{ id: "a", requires: { solved: "e3" }, zoneId: "z", x: 1, lines: [line("hi")] }],
    });
    expect(activeNpcState(gated, ctx(emptyWorldState()))).toBeNull();
  });
});

describe("quests", () => {
  const quest = Quest.parse({
    id: "brasswick_arm",
    title: "Brasswick's Arm",
    giverNpcId: "brasswick",
    steps: [
      { kind: "talk", npcId: "brasswick", stateId: "before" },
      { kind: "afterSeal", encounterId: "e2_period" },
      { kind: "talk", npcId: "brasswick", stateId: "after" },
    ],
    reward: {
      flag: "brass_done",
      lines: [{ speakerId: "brasswick", text: "Take this page." }],
      collectibleId: "page_3",
      cosmetic: "shared.costume.gold_trim",
      debriefLine: "You fixed Brasswick's arm with the corrected period.",
    },
  });

  it("steps complete in order", () => {
    const e = emptyWorldState();
    expect(questStatus(quest, ctx(e, ["e2_period"]))).toEqual({ step: 0, done: false }); // solved first: still step 0
    const talked = reduceWorldState(e, { type: "talk", npcId: "brasswick", stateId: "before" });
    expect(questStatus(quest, ctx(talked))).toEqual({ step: 1, done: false });
    expect(questStatus(quest, ctx(talked, ["e2_period"]))).toEqual({ step: 2, done: false });
    const back = reduceWorldState(talked, { type: "talk", npcId: "brasswick", stateId: "after" });
    expect(questStatus(quest, ctx(back, ["e2_period"]))).toEqual({ step: 3, done: true });
  });

  it("covers collect, touch, visit and any-state talk steps", () => {
    const q = Quest.parse({
      id: "lanterns",
      title: "Kay's Lanterns",
      steps: [
        { kind: "talk", npcId: "kay" },
        { kind: "touch", propIds: ["l1", "l2", "l3"] },
        { kind: "collect", ids: ["shard_2"] },
        { kind: "visit", triggerId: "zb_arrive" },
      ],
      reward: { flag: "lanterns_done" },
    });
    let s = reduceAll(emptyWorldState(), [
      { type: "talk", npcId: "kay", stateId: "whatever" },
      { type: "touch", id: "l1" },
      { type: "touch", id: "l2" },
    ]);
    expect(questStatus(q, ctx(s)).step).toBe(1);
    s = reduceAll(s, [{ type: "touch", id: "l3" }, { type: "collect", id: "shard_2" }]);
    expect(questStatus(q, ctx(s)).step).toBe(3);
    s = reduceWorldState(s, { type: "trigger", id: "zb_arrive" });
    expect(questStatus(q, ctx(s)).done).toBe(true);
  });

  it("settleQuests rewards a completed quest exactly once", () => {
    let s = reduceAll(emptyWorldState(), [
      { type: "talk", npcId: "brasswick", stateId: "before" },
      { type: "talk", npcId: "brasswick", stateId: "after" },
    ]);
    const none = settleQuests([quest], ctx(s));
    expect(none).toEqual({ events: [], say: [], debrief: [] });
    const out = settleQuests([quest], ctx(s, ["e2_period"]));
    expect(out.events).toEqual([
      { type: "flag", id: "brass_done", on: true },
      { type: "collect", id: "page_3" },
      { type: "cosmetic", asset: "shared.costume.gold_trim" },
    ]);
    expect(out.say.map((l) => l.text)).toEqual(["Take this page."]);
    expect(out.debrief).toEqual(["You fixed Brasswick's arm with the corrected period."]);
    s = reduceAll(s, out.events);
    expect(s.collected.has("page_3")).toBe(true);
    expect(settleQuests([quest], ctx(s, ["e2_period"]))).toEqual({ events: [], say: [], debrief: [] });
  });
});

describe("bonus mirror", () => {
  const memory = (): KeyValueStore & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };
  it("merges and dedupes under expedition:bonus:<specId>", () => {
    const store = memory();
    mirrorBonus(store, "trig_demo_001", { collected: ["page_1"] });
    mirrorBonus(store, "trig_demo_001", { collected: ["page_1", "page_2"], debrief: ["line"] });
    expect(readBonus(store, "trig_demo_001")).toEqual({ collected: ["page_1", "page_2"], debrief: ["line"] });
    expect(store.data.has("expedition:bonus:trig_demo_001")).toBe(true);
  });
  it("survives a missing or throwing store and bad JSON", () => {
    expect(readBonus(null, "x")).toEqual({ collected: [], debrief: [] });
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(mirrorBonus(throwing, "x", { collected: ["a"] })).toEqual({ collected: ["a"], debrief: [] });
    const bad = memory();
    bad.setItem("expedition:bonus:x", "{not json");
    expect(readBonus(bad, "x")).toEqual({ collected: [], debrief: [] });
  });
});
