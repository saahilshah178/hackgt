import { describe, expect, it } from "vitest";
import { Cutscene, type CutsceneStep, type InteractRef, type StateTarget } from "../../../../contracts/world";
import type { CutsceneEndState, CutsceneStage } from "../bridge";
import { CutsceneRunner, cutsceneSay } from "./runner";
import { DEFAULT_WALK_MS, STATION_ANIM_MS, compile, endState, expressTrim, type PlayerStart } from "./timeline";

// ---------------------------------------------------------------- a fake stage with its own (independent) model

interface Model {
  zoneId: string;
  x: number;
  surface: string;
  actors: Record<string, number>;
  cam: { x: number | null; y: number | null; zoom: number | null };
  anims: Record<string, string>;
  hubs: Record<string, string>;
  flags: Record<string, boolean>;
  states: string[];
  music: string;
}
const START: PlayerStart = { zoneId: "z0", x: 100, surface: "ground" };

class FakeStage implements CutsceneStage {
  m: Model = {
    zoneId: START.zoneId,
    x: START.x,
    surface: START.surface,
    actors: { companion: 60 },
    cam: { x: null, y: null, zoom: null },
    anims: {},
    hubs: {},
    flags: {},
    states: [],
    music: "(unchanged)",
  };
  calls: string[] = [];
  interactResolvers: (() => void)[] = [];
  autoInteract = true;
  private rec(name: string) {
    this.calls.push(name);
  }
  async fade() { this.rec("fade"); }
  async title() { this.rec("title"); }
  async enterZone(zoneId: string, x: number, surface: string) {
    this.rec("enterZone");
    Object.assign(this.m, { zoneId, x, surface });
    this.m.cam = { x: null, y: null, zoom: null };
  }
  async pan(x: number, y: number | null, zoom: number) {
    this.rec("pan");
    this.m.cam = { x, y: y ?? this.m.cam.y, zoom };
  }
  async camera(x: number | null, y: number | null, zoom: number | null) {
    this.rec("camera");
    this.m.cam = { x: x ?? this.m.cam.x, y: y ?? this.m.cam.y, zoom: zoom ?? this.m.cam.zoom };
  }
  async walk(actor: string, toX: number) {
    this.rec("walk");
    if (actor === "player") this.m.x = toX;
    else this.m.actors[actor] = toX;
  }
  emote() { this.rec("emote"); }
  async station(id: string, anim: string) { this.rec("station"); this.m.anims[id] = anim; }
  async hub(zoneId: string, state: string) { this.rec("hub"); this.m.hubs[zoneId] = state; }
  async ride(step: { toZoneId: string; toX: number; toSurface: string }) {
    this.rec("ride");
    Object.assign(this.m, { zoneId: step.toZoneId, x: step.toX, surface: step.toSurface });
    this.m.cam = { x: null, y: null, zoom: null };
  }
  sfx() { this.rec("sfx"); }
  music(cue: string | null) { this.rec("music"); this.m.music = String(cue); }
  awaitInteract(target: InteractRef) {
    void target;
    this.rec("awaitInteract");
    if (this.autoInteract) return Promise.resolve();
    return new Promise<void>((r) => this.interactResolvers.push(r));
  }
  async controlUntil(x: number, surface: string) { this.rec("controlUntil"); this.m.x = x; this.m.surface = surface; }
  async vista() { this.rec("vista"); }
  setState(target: StateTarget, state: string) {
    this.rec("setState");
    if (target.kind === "flag") this.m.flags[target.id] = state === "on";
    else this.m.states.push(`${target.kind}:${target.id}=${state}`);
  }
  applyEndState(end: CutsceneEndState) {
    this.rec("applyEndState");
    if (end.zone) Object.assign(this.m, { zoneId: end.zone.zoneId, x: end.zone.x, surface: end.zone.surface });
    for (const [a, x] of Object.entries(end.actors)) {
      if (a === "player") this.m.x = x;
      else this.m.actors[a] = x;
    }
    if (end.camera) this.m.cam = { ...end.camera };
    Object.assign(this.m.anims, end.stationAnims);
    Object.assign(this.m.hubs, end.hubs);
    Object.assign(this.m.flags, end.flags);
    for (const s of end.states) this.m.states.push(`${s.target.kind}:${s.target.id}=${s.state}`);
    if (end.music !== undefined) this.m.music = String(end.music);
  }
}

const EVERY_STEP: unknown[] = [
  { do: "fade", to: "clear", ms: 400 },
  { do: "title", text: "The Orrery Terraces", ms: 1200 },
  { do: "pan", x: 900, y: 400, zoom: 0.8, ms: 1500 },
  { do: "camera", y: 700, ms: 600 },
  { do: "walk", actor: "player", toX: 400 },
  { do: "walk", actor: "companion", toX: 420 },
  { do: "say", lines: [{ speakerId: "cog", text: "Wind me, please." }, { speakerId: "narrator", text: "The owl creaks." }] },
  { do: "emote", actor: "companion", glyph: "!" },
  { do: "wait", ms: 200 },
  { do: "await_interact", target: { kind: "npc", id: "cog" }, prompt: "Wind Cog" },
  { do: "set_state", target: { kind: "flag", id: "cog_awake" }, state: "on" },
  { do: "set_state", target: { kind: "prop", id: "beam_pylon_s0" }, state: "lit" },
  { do: "station", encounterId: "e1_arc", anim: "wake" },
  { do: "hub", zoneId: "z1", state: "partial" },
  { do: "sfx", cue: "cog_wind" },
  { do: "music", cue: "curious" },
  { do: "control_until", x: 800, prompt: "Walk down the stair" },
  { do: "vista", asset: "orrery_terraces.vista.canyon", from: { x: 0, y: 0, zoom: 1 }, to: { x: 500, y: 0, zoom: 0.6 }, ms: 3000 },
  { do: "enter_zone", zoneId: "z2", x: 120 },
  { do: "camera", x: 300, zoom: 1.1, ms: 400 },
  { do: "walk", actor: "player", toX: 250 },
  { do: "ride", vehicle: "orrery_terraces.prop.gondola", toZoneId: "z3", toX: 640, toSurface: "dock", ms: 2000, path: [[250, 900], [900, 400]] },
  { do: "set_state", target: { kind: "flag", id: "cog_awake" }, state: "off" },
  { do: "station", encounterId: "e1_arc", anim: "settle" },
  { do: "music", cue: null },
];
const scene = (steps: unknown[], id = "intro", skippable = true) => Cutscene.parse({ id, skippable, steps });

async function fullPlay(c: Cutscene, start: PlayerStart | null) {
  const stage = new FakeStage();
  const flags: Record<string, boolean> = {};
  const runner = new CutsceneRunner({ stage, say: () => undefined, wait: async () => undefined, onFlag: (id, on) => void (flags[id] = on) });
  const result = await runner.run(c, { start });
  return { stage, result, flags };
}
function skipped(c: Cutscene, start: PlayerStart | null) {
  const stage = new FakeStage();
  stage.applyEndState(endState(c, start));
  return stage;
}

describe("endState(cutscene) equals the full-play end state", () => {
  EVERY_STEP.forEach((raw) => {
    const step = raw as CutsceneStep;
    it(`for a lone ${step.do} step`, async () => {
      const c = scene([raw]);
      for (const start of [START, null]) {
        const { stage, result } = await fullPlay(c, start);
        expect(result).toBe("done");
        expect(skipped(c, start).m).toEqual(stage.m);
      }
    });
  });

  it("for every step kind in sequence (incl. ride.toSurface)", async () => {
    const c = scene(EVERY_STEP);
    const kinds = new Set(c.steps.map((s) => s.do));
    expect(kinds.size).toBe(18); // all 18 verbs
    const { stage, flags } = await fullPlay(c, START);
    const end = skipped(c, START);
    expect(end.m).toEqual(stage.m);
    expect(stage.m).toMatchObject({ zoneId: "z3", x: 640, surface: "dock" });
    expect(flags).toEqual({ cog_awake: false });
    expect(endState(c, START).zone).toEqual({ zoneId: "z3", x: 640, surface: "dock" });
  });

  it("every prefix of the sequence too", async () => {
    for (let n = 1; n <= EVERY_STEP.length; n++) {
      const c = scene(EVERY_STEP.slice(0, n));
      const { stage } = await fullPlay(c, START);
      expect(skipped(c, START).m, `prefix ${n}`).toEqual(stage.m);
    }
  });
});

describe("compile", () => {
  it("walk time = distance ÷ speed; say and interactive steps last until resolved", () => {
    const c = scene([
      { do: "fade", to: "clear", ms: 400 },
      { do: "walk", actor: "player", toX: 400 },
      { do: "walk", actor: "npc_ida", toX: 400 },
      { do: "say", lines: [{ speakerId: "cog", text: "Hello." }] },
      { do: "station", encounterId: "e1", anim: "succeed" },
      { do: "await_interact", target: { kind: "prop", id: "main_breaker" }, prompt: "Throw it", timeoutMs: 5000 },
    ]);
    const steps = compile(c, { positions: { player: 100 } });
    expect(steps[0]).toMatchObject({ startMs: 0, durationMs: 400 });
    expect(steps[1]).toMatchObject({ startMs: 400, durationMs: 1000 }); // 300 units at 300 u/s
    expect(steps[2].durationMs).toBe(DEFAULT_WALK_MS);
    expect(steps[3].durationMs).toBeNull();
    expect(steps[3].estMs).toBeGreaterThan(2500);
    expect(steps[4].durationMs).toBe(STATION_ANIM_MS.succeed);
    expect(steps[5]).toMatchObject({ durationMs: null, estMs: 5000, interactive: true });
    expect(steps[4].startMs).toBe(steps[3].startMs + steps[3].estMs);
  });

  it("expressTrim cuts after the first say", () => {
    const steps = compile(scene(EVERY_STEP));
    const trimmed = expressTrim(steps);
    expect(trimmed[trimmed.length - 1].step.do).toBe("say");
    expect(trimmed).toHaveLength(7);
    expect(expressTrim(compile(scene([{ do: "wait", ms: 1 }])))).toHaveLength(1);
  });
});

describe("CutsceneRunner", () => {
  it("say steps become blocking bar lines with per-step ids; narrator lines are narration", async () => {
    const said: string[] = [];
    const stage = new FakeStage();
    const runner = new CutsceneRunner({ stage, say: (r) => void said.push(...r.lines.map((l) => `${l.id}|${l.kind}`)), wait: async () => undefined });
    await runner.run(scene(EVERY_STEP.slice(0, 7)));
    expect(said).toEqual(["cutscene:intro:6:0|line", "cutscene:intro:6:1|narration"]);
    const req = cutsceneSay("intro", 6, scene([EVERY_STEP[6]]).steps[0] as Extract<CutsceneStep, { do: "say" }>);
    expect(req).toMatchObject({ channel: "bar", blocking: true, source: "cutscene:intro" });
  });

  it("skip() mid-way (at an await_interact) applies the full end state and drops the cutscene's lines", async () => {
    const stage = new FakeStage();
    stage.autoInteract = false;
    const skippedSources: string[] = [];
    const runner = new CutsceneRunner({ stage, say: () => undefined, wait: async () => undefined, skipDialogue: (s) => void skippedSources.push(s) });
    const c = scene(EVERY_STEP);
    const p = runner.run(c, { start: START });
    await new Promise((r) => setTimeout(r, 0));
    expect(runner.running).toBe("intro");
    expect(stage.calls[stage.calls.length - 1]).toBe("awaitInteract");
    runner.skip();
    expect(await p).toBe("skipped");
    expect(runner.running).toBeNull();
    expect(skippedSources).toContain("cutscene:intro");
    expect(stage.m).toEqual((await fullPlay(c, START)).stage.m);
  });

  it("non-skippable cutscenes ignore skip; cancel stops without the end state", async () => {
    const stage = new FakeStage();
    stage.autoInteract = false;
    const runner = new CutsceneRunner({ stage, say: () => undefined, wait: async () => undefined });
    const c = scene(EVERY_STEP, "finale", false);
    const p = runner.run(c, { start: START });
    await new Promise((r) => setTimeout(r, 0));
    runner.skip();
    await new Promise((r) => setTimeout(r, 0));
    expect(runner.running).toBe("finale");
    runner.cancel();
    expect(await p).toBe("cancelled");
    expect(stage.calls).not.toContain("applyEndState");
    expect(stage.m.zoneId).toBe("z0");
  });

  it("express trim: runs to the first say, then applies the end state", async () => {
    const stage = new FakeStage();
    const runner = new CutsceneRunner({ stage, say: () => undefined, wait: async () => undefined });
    const c = scene(EVERY_STEP);
    expect(await runner.run(c, { start: START, trim: true })).toBe("skipped");
    expect(stage.calls).not.toContain("awaitInteract");
    expect(stage.calls).not.toContain("vista");
    expect(stage.m).toEqual((await fullPlay(c, START)).stage.m);
  });

  it("waits for the say promise before the next step", async () => {
    const stage = new FakeStage();
    let release!: () => void;
    const runner = new CutsceneRunner({ stage, say: () => new Promise<void>((r) => (release = r)), wait: async () => undefined });
    const p = runner.run(scene([{ do: "say", lines: [{ speakerId: "cog", text: "Hi." }] }, { do: "hub", zoneId: "z1", state: "restored" }]));
    await new Promise((r) => setTimeout(r, 0));
    expect(stage.calls).not.toContain("hub");
    release();
    expect(await p).toBe("done");
    expect(stage.m.hubs).toEqual({ z1: "restored" });
  });

  it("a new run cancels the running one", async () => {
    const stage = new FakeStage();
    stage.autoInteract = false;
    const runner = new CutsceneRunner({ stage, say: () => undefined, wait: async () => undefined });
    const first = runner.run(scene([{ do: "await_interact", target: { kind: "npc", id: "cog" }, prompt: "x" }], "a"));
    await new Promise((r) => setTimeout(r, 0));
    const second = runner.run(scene([{ do: "hub", zoneId: "z1", state: "partial" }], "b"));
    expect(await first).toBe("cancelled");
    expect(await second).toBe("done");
  });
});
