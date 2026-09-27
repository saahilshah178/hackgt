import { describe, expect, it } from "vitest";
import { devWorld } from "../../hosts/expedition/__fixtures__/dev-world";
import { emptyWorldState, reduceWorldState } from "../../../world/state/world-state";
import { planInteract, textBoxes, type InteractCtx } from "./interactions";
import type { Phase } from "./machine";
import {
  barLayoutOf,
  bossBatchToSay,
  briefOf,
  expressWorldOf,
  hintLabelOf,
  hudInsetRight,
  hudModeOf,
  isCompact,
  layoutFor,
  layoutModeOf,
  outroFor,
  panelContextOf,
  progressOf,
  safeRectFor,
  sameLayout,
  sameProgress,
  startZoneOf,
  zoneNameOf,
} from "./session";

const { spec, world } = devWorld();
const VP = { w: 1600, h: 900 };

describe("progress follows the runner (D3)", () => {
  it("everything before the runner's index is solved", () => {
    expect(progressOf(spec, 0)).toEqual({ solvedIds: [], currentId: "e1_radians" });
    expect(progressOf(spec, 2)).toEqual({ solvedIds: ["e1_radians", "e2_period"], currentId: "e3_amplitude" });
  });
  it("a finished runner has every id solved and no current", () => {
    const p = progressOf(spec, null);
    expect(p.solvedIds).toHaveLength(spec.encounters.length);
    expect(p.currentId).toBeNull();
    expect(progressOf(spec, 999)).toEqual(p);
  });
  it("sameProgress compares by value", () => {
    expect(sameProgress(progressOf(spec, 3), progressOf(spec, 3))).toBe(true);
    expect(sameProgress(progressOf(spec, 3), progressOf(spec, 4))).toBe(false);
  });
});

describe("layout and safe rect (§3.1)", () => {
  it("explore frames the whole stage", () => {
    expect(layoutFor({ kind: "explore" }, world, VP)).toEqual({ mode: "explore", safeRect: { x: 0, y: 0, w: 1600, h: 900 }, focus: null });
  });
  it("a station minigame frames the whole stage; compact screens keep the top 40 %", () => {
    expect(safeRectFor("scrub", VP)).toEqual({ x: 0, y: 0, w: 1600, h: 900 });
    expect(safeRectFor("board", VP)).toEqual({ x: 0, y: 0, w: 1600, h: 900 });
    expect(safeRectFor("vault", VP)).toEqual({ x: 0, y: 0, w: 1600, h: 900 });
    expect(safeRectFor("sandbox", VP)).toEqual(safeRectFor("scrub", VP));
  });
  it("the HUD controls stay in the corner while a minigame is open", () => {
    expect(hudInsetRight("scrub", VP, true)).toBe(0);
    expect(hudInsetRight("board", VP, true)).toBe(0);
    expect(hudInsetRight("sandbox", VP, true)).toBe(0);
    expect(hudInsetRight("explore", VP, true)).toBe(0);
    expect(hudInsetRight("vault", VP, true)).toBe(0);
    expect(hudInsetRight("scrub", VP, false)).toBe(0);
    expect(hudInsetRight("board", { w: 700, h: 900 }, true)).toBe(0);
  });
  it("compact screens keep the top 40 % above the bottom sheet", () => {
    expect(isCompact({ w: 700, h: 900 })).toBe(true);
    expect(safeRectFor("board", { w: 700, h: 900 })).toEqual({ x: 0, y: 0, w: 700, h: 360 });
  });
  it("the open station's layout comes from the resolved world, and focus names it", () => {
    const p: Phase = { kind: "panel", encounterId: "e2_selectivity" };
    expect(layoutModeOf(p, world)).toBe("board");
    expect(layoutFor(p, world, VP).focus).toEqual({ kind: "station", encounterId: "e2_selectivity" });
    expect(layoutModeOf({ kind: "resolving", encounterId: "e12_boss", correct: false }, world)).toBe("vault");
    expect(layoutModeOf({ kind: "payoff", encounterId: "e1_radians" }, world)).toBe(world.stationByEncounter.get("e1_radians")?.layout);
    expect(layoutFor({ kind: "sandbox", sandboxId: "dev_music_box" }, world, VP)).toMatchObject({ mode: "sandbox", focus: { kind: "sandbox", sandboxId: "dev_music_box" } });
  });
  it("sameLayout compares by value", () => {
    const a = layoutFor({ kind: "panel", encounterId: "e1_radians" }, world, VP);
    expect(sameLayout(a, layoutFor({ kind: "panel", encounterId: "e1_radians" }, world, VP))).toBe(true);
    expect(sameLayout(a, layoutFor({ kind: "panel", encounterId: "e2_period" }, world, VP))).toBe(false);
    expect(sameLayout(a, layoutFor({ kind: "panel", encounterId: "e1_radians" }, world, { w: 1280, h: 720 }))).toBe(false);
  });
});

describe("panel context (A6)", () => {
  it("carries the record strip, solved ids and the open station's probe window", () => {
    const st = world.stationByEncounter.get("e7_march") ?? null;
    const ctx = panelContextOf(world, ["e1_radians"], st);
    expect(ctx.recordStrip).toBe(world.overlay.story.recordStrip);
    expect(ctx.solvedIds).toEqual(["e1_radians"]);
    expect(ctx.probeWindow).toEqual(st?.probe?.window ? { start: st.probe.window.start, end: st.probe.window.end } : null);
    expect(panelContextOf(world, [], null).probeWindow).toBeNull();
  });
});

describe("bar and HUD modes", () => {
  it("cutscenes use the band; panels their layout; explore the toast strip", () => {
    expect(barLayoutOf({ kind: "intro", cutsceneId: "dev_intro" }, world)).toBe("cutscene");
    expect(barLayoutOf({ kind: "finale", cutsceneId: "dev_finale", clearedId: "e12_boss" }, world)).toBe("cutscene");
    expect(barLayoutOf({ kind: "explore" }, world)).toBe("explore");
    expect(barLayoutOf({ kind: "panel", encounterId: "e2_selectivity" }, world)).toBe("board");
    expect(hudModeOf({ kind: "panel", encounterId: "e1_radians" })).toBe("panel");
    expect(hudModeOf({ kind: "cutscene", cutsceneId: "x", purpose: "zone" })).toBe("cutscene");
    expect(hudModeOf({ kind: "explore" })).toBe("explore");
  });
});

describe("brief and hint label", () => {
  it("the Brief sheet shows the prompt verbatim and only the hints unlocked so far", () => {
    const st = world.stationByEncounter.get("e1_radians")!;
    const enc = spec.encounters.find((e) => e.id === "e1_radians")!;
    expect(briefOf(enc.prompt, st, 0, enc.hints, "cog")).toEqual({ prompt: enc.prompt, plaque: null, hints: [] });
    const two = briefOf(enc.prompt, st, 2, enc.hints, "cog");
    expect(two.hints.length).toBe(2);
    expect(two.hints).toContain(enc.hints[0]);
  });
  it("hint labels", () => {
    expect(hintLabelOf(1, 3)).toBe("Hint (1 of 3 used)");
    expect(hintLabelOf(3, 3)).toMatch(/No hints left/);
    expect(hintLabelOf(0, 0)).toMatch(/No hints/);
  });
});

describe("boss batches", () => {
  const phases = [{ itemKeys: ["a", "b"] }, { itemKeys: ["c"] }, { itemKeys: ["d", "e"] }];
  it("speaks each batch's line once, when the previous batch is placed", () => {
    expect(bossBatchToSay(new Set(), phases, 0)).toBeNull();
    expect(bossBatchToSay(new Set(["a", "b"]), phases, 0)).toBe(1);
    expect(bossBatchToSay(new Set(["a", "b"]), phases, 1)).toBeNull();
    expect(bossBatchToSay(new Set(["a", "b", "c", "d", "e"]), phases, 1)).toBe(2);
    expect(bossBatchToSay(new Set(), [], -1)).toBeNull();
  });
});

describe("world views", () => {
  it("expressWorldOf mirrors stations and zones in order", () => {
    const ew = expressWorldOf(world);
    expect(ew.stations.map((s) => s.encounterId)).toEqual(spec.encounters.map((e) => e.id));
    expect(ew.zones.map((z) => z.id)).toEqual(["dev_meadow", "dev_depths"]);
    expect(ew.zones[0].exits[0]).toMatchObject({ toZoneId: "dev_depths" });
    expect(ew.finaleCutsceneId).toBe("dev_finale");
  });
  it("the finale speaks the outro, so the end screen does not repeat it", () => {
    expect(outroFor(spec, world)).toEqual([]);
    expect(outroFor(spec, null)).toEqual(spec.narrative.outro);
  });
  it("zone names and the start zone", () => {
    expect(zoneNameOf(world, "dev_depths")).toEqual({ id: "dev_depths", name: "Dev Depths" });
    expect(zoneNameOf(world, null)?.id).toBe("dev_meadow");
    expect(startZoneOf(world, progressOf(spec, 0))).toBe("dev_meadow");
    expect(startZoneOf(world, progressOf(spec, 8))).toBe(world.stationByEncounter.get(spec.encounters[8].id)?.zoneId);
  });
});

describe("interactions (§2.4.3–§2.4.7)", () => {
  const ctx = (patch: Partial<InteractCtx> = {}): InteractCtx => ({
    world,
    solvedIds: ["e1_radians"],
    currentId: "e2_period",
    state: emptyWorldState(),
    guideId: "cog",
    express: false,
    ...patch,
  });
  it("the current console opens the panel; a solved one replays; a future one does nothing", () => {
    expect(planInteract({ kind: "station", encounterId: "e2_period" }, ctx())).toEqual({ kind: "open_panel", encounterId: "e2_period" });
    const replay = planInteract({ kind: "station", encounterId: "e1_radians" }, ctx());
    expect(replay.kind).toBe("replay");
    if (replay.kind === "replay") expect(replay.say?.lines[0].kind).toBe("success");
    expect(planInteract({ kind: "station", encounterId: "e4_solve" }, ctx())).toEqual({ kind: "none" });
  });
  it("NPC lines come from the active state and record talk + flag afterwards", () => {
    const p = planInteract({ kind: "npc", npcId: "otis", stateId: "watch" }, ctx());
    expect(p.kind).toBe("npc");
    if (p.kind !== "npc") return;
    expect(p.say?.lines[0].text).toBe("Mind the ledge.");
    expect(p.say?.lines[0].speakerId).toBe("otis");
    expect(p.after).toEqual([{ type: "talk", npcId: "otis", stateId: "watch" }]);
    const later = planInteract({ kind: "npc", npcId: "otis", stateId: "cheer" }, ctx({ solvedIds: ["e1_radians", "e2_period"] }));
    expect(later.kind === "npc" && later.say?.lines[0].text).toBe("The gate moved!");
  });
  it("plaques read in document style with the title", () => {
    const p = planInteract({ kind: "plaque", plaqueId: "dev_plaque" }, ctx());
    expect(p.kind).toBe("plaque");
    if (p.kind === "plaque") {
      expect(p.say.lines).toHaveLength(1);
      expect(p.say.lines[0].kind).toBe("document");
      expect(p.say.lines[0].text).toMatch(/^Dev Plaque: Every link kind/);
      expect(p.say.blocking).toBe(false);
    }
  });
  it("a note longer than the dialogue box continues in the next box", () => {
    const note = "A full circle is 2π radians, and π is halfway. 5π/6 is five of the six equal steps from sunrise to that halfway mark, so it sits just short of π.";
    const full = `Ilse's note: radians: ${note}`;
    const boxes = textBoxes(full);
    expect(boxes).toHaveLength(2);
    expect(boxes[1].endsWith("π.")).toBe(true);
    expect(boxes.join(" ")).toBe(full);
    const plaque = world.overlay.plaques[0];
    const p = planInteract(
      { kind: "plaque", plaqueId: plaque.id },
      ctx({ world: { ...world, overlay: { ...world.overlay, plaques: [{ ...plaque, title: "Ilse's note: radians", text: note }] } } }),
    );
    expect(p.kind).toBe("plaque");
    if (p.kind === "plaque") {
      expect(p.say.lines.map((l) => l.text)).toEqual(boxes);
      expect(p.say.blocking).toBe(true);
    }
  });
  it("collectibles are collected once", () => {
    const p = planInteract({ kind: "collectible", collectibleId: "dev_shard" }, ctx());
    expect(p).toMatchObject({ kind: "collect", events: [{ type: "collect", id: "dev_shard" }], collectibleId: "dev_shard" });
    const had = reduceWorldState(emptyWorldState(), { type: "collect", id: "dev_shard" });
    expect(planInteract({ kind: "collectible", collectibleId: "dev_shard" }, ctx({ state: had }))).toEqual({ kind: "none" });
  });
  it("touch props say their line, play their cue and record the touch once", () => {
    const p = planInteract({ kind: "touch", propId: "dev_lantern" }, ctx());
    expect(p).toMatchObject({ kind: "touch", cue: "lantern_lit", events: [{ type: "touch", id: "dev_lantern" }] });
    const had = reduceWorldState(emptyWorldState(), { type: "touch", id: "dev_lantern" });
    expect(planInteract({ kind: "touch", propId: "dev_lantern" }, ctx({ state: had }))).toEqual({ kind: "none" });
  });
  it("sandboxes open, except in express", () => {
    expect(planInteract({ kind: "sandbox", sandboxId: "dev_music_box" }, ctx())).toEqual({ kind: "sandbox", sandboxId: "dev_music_box" });
    expect(planInteract({ kind: "sandbox", sandboxId: "dev_music_box" }, ctx({ express: true }))).toEqual({ kind: "none" });
    expect(planInteract({ kind: "sandbox", sandboxId: "nope" }, ctx())).toEqual({ kind: "none" });
  });
  it("vehicles run their station's ride cutscene only once solved; links and exits are the host's", () => {
    expect(planInteract({ kind: "vehicle", encounterId: "e1_radians" }, ctx())).toEqual({ kind: "none" });
    expect(planInteract({ kind: "link", linkId: "hop_ledge", verb: "hop" }, ctx())).toEqual({ kind: "none" });
    expect(planInteract({ kind: "exit", exitId: "to_depths" }, ctx())).toEqual({ kind: "none" });
  });
});
