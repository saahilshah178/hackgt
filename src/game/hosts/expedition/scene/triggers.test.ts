import { describe, expect, it } from "vitest";
import { Trigger } from "../../../../contracts/world";
import { emptyWorldState, reduceAll, reduceWorldState } from "../../../../world/state/world-state";
import { HINT_IDLE_MS, emptyTriggerTracker, firingTriggers, stepTriggers, triggerEffects } from "./triggers";

const t = (over: Record<string, unknown>) =>
  Trigger.parse({ id: "s0_controls", zoneId: "z1", x: 500, radius: 100, lines: [{ speakerId: "cog", text: "Use A and D." }], ...over });
const at = (x: number, zoneId = "z1", surface = "ground") => ({ zoneId, x, surface });
const none = new Set<string>();

describe("firingTriggers", () => {
  it("fires inside the radius on its surface and zone only", () => {
    const trig = t({});
    const s = emptyWorldState();
    expect(firingTriggers([trig], at(600), s, none)).toHaveLength(1);
    expect(firingTriggers([trig], at(601), s, none)).toHaveLength(0);
    expect(firingTriggers([trig], at(500, "z2"), s, none)).toHaveLength(0);
    expect(firingTriggers([trig], at(500, "z1", "ledge"), s, none)).toHaveLength(0);
  });

  it("once triggers fire once (the fired set), and honour requires", () => {
    const trig = t({ requires: { solved: "e1_arc" } });
    let s = emptyWorldState();
    expect(firingTriggers([trig], at(500), s, none)).toHaveLength(0);
    const solved = new Set(["e1_arc"]);
    const fire = firingTriggers([trig], at(500), s, solved);
    expect(fire.map((x) => x.id)).toEqual(["s0_controls"]);
    s = reduceAll(s, triggerEffects(fire[0], "cog").events);
    expect(firingTriggers([trig], at(500), s, solved)).toHaveLength(0);
    const flagged = t({ id: "g_flag", requires: { flag: "cog_awake", notFlag: "cog_asleep" } });
    const awake = reduceWorldState(emptyWorldState(), { type: "flag", id: "cog_awake", on: true });
    expect(firingTriggers([flagged], at(500), awake, none)).toHaveLength(1);
    const asleep = reduceWorldState(awake, { type: "flag", id: "cog_asleep", on: true });
    expect(firingTriggers([flagged], at(500), asleep, none)).toHaveLength(0);
  });

  it("repeatable triggers fire once per entry (latch), not per frame", () => {
    const trig = t({ id: "g_echo", once: false });
    const s = emptyWorldState();
    let tr = emptyTriggerTracker();
    let r = stepTriggers(tr, [trig], at(500), s, none);
    expect(r.fire).toHaveLength(1);
    tr = r.tracker;
    r = stepTriggers(tr, [trig], at(520), s, none);
    expect(r.fire).toHaveLength(0);
    expect(r.tracker).toBe(tr); // unchanged while inside
    r = stepTriggers(r.tracker, [trig], at(900), s, none); // leave
    expect(r.tracker.latched.size).toBe(0);
    r = stepTriggers(r.tracker, [trig], at(500), s, none); // re-enter
    expect(r.fire).toHaveLength(1);
  });

  it("hint triggers need 20 s idle inside; express disables ambient and hint", () => {
    const hint = t({ id: "h1", kind: "hint" });
    const amb = t({ id: "a1", kind: "ambient" });
    const arr = t({ id: "r1", kind: "arrival" });
    const s = emptyWorldState();
    expect(firingTriggers([hint], at(500), s, none, { idleMs: HINT_IDLE_MS - 1 })).toHaveLength(0);
    expect(firingTriggers([hint], at(500), s, none, { idleMs: HINT_IDLE_MS })).toHaveLength(1);
    const ids = firingTriggers([hint, amb, arr], at(500), s, none, { idleMs: 99_999, express: true }).map((x) => x.id);
    expect(ids).toEqual(["r1"]);
  });
});

describe("triggerEffects", () => {
  it("records the trigger, sets the flag, and carries cue and cutsceneId", () => {
    const e = triggerEffects(t({ setFlag: "saw_controls", cue: "pip_chirp", cutsceneId: "s7_viewpoint" }), "cog");
    expect(e.events).toEqual([
      { type: "trigger", id: "s0_controls" },
      { type: "flag", id: "saw_controls", on: true },
    ]);
    expect(e.cue).toBe("pip_chirp");
    expect(e.cutsceneId).toBe("s7_viewpoint");
  });

  it("ambient → toast (ambient), arrival → bar (story), hint → toast (story)", () => {
    expect(triggerEffects(t({ kind: "ambient" }), "cog").say).toMatchObject({ channel: "toast", priority: "ambient", blocking: false, source: "trigger:s0_controls" });
    const arrival = triggerEffects(t({ kind: "arrival" }), "cog").say;
    expect(arrival).toMatchObject({ channel: "bar", priority: "story" });
    expect(arrival?.lines[0]).toMatchObject({ kind: "arrival", id: "trigger:s0_controls:0" });
    expect(triggerEffects(t({ kind: "hint" }), "cog").say).toMatchObject({ channel: "toast", priority: "story", lines: [{ kind: "hint" }] });
  });
});
