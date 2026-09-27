import { describe, expect, it } from "vitest";
import { AIM_RIGS, aimAngleAt, ClaimHoldersConfig } from "@/world/contraptions/claim-holders.meta";
import type { FailurePlan, SuccessPlan } from "@/world/types";
import { aimedSlotOf, capsuleCenter, ghostOf, headParting, podX, POD, probeValueOf, readFailure, readSuccess, scenarioOkOf, slotFromAim } from "./specimen_pods";

const view = { chests: [{ statementIndex: 2, text: "c" }, { statementIndex: 0, text: "a" }, { statementIndex: 1, text: "b" }] };
const config = ClaimHoldersConfig.parse({
  holders: [
    { statementIndex: 0, ghost: "water_out_arrows" },
    { statementIndex: 1, ghost: "salt_inflow" },
    { statementIndex: 2, ghost: "shrink_outline" },
  ],
  referenceSim: { id: "osmotic_cell", params: { cIn: 2, b: 0.3 } },
  probe: { symbol: "s", label: "bath salt", min: 0, max: 10, step: 0.1, unit: "%", format: "number", initial: 6 },
  probeWorld: "bath_salt",
  scenarioMin: 2.5,
  aimer: "probe_emitter",
  quarantineAnim: "raft_lock_flood",
});

describe("specimen_pods · layout", () => {
  it("pods stand left of the console in display order, the last one nearest it, clear of the player (console − 70 ± 70)", () => {
    expect([0, 1, 2].map((i) => podX(-400, 3, i))).toEqual([-400 - POD.fromConsole - 2 * POD.spacing, -400 - POD.fromConsole - POD.spacing, -400 - POD.fromConsole]);
    expect(podX(-400, 3, 2) + POD.w / 2).toBeLessThan(-400 - 70 - 70 + 10);
    expect(capsuleCenter(0, 0, 3, 1).y).toBeCloseTo(-(POD.pedestal + POD.collar + POD.capsule / 2), 9);
  });
});

describe("specimen_pods · reading the eased pose", () => {
  it("the continuous aim maps each standard-rig slot back to itself", () => {
    for (let s = 0; s < 3; s++) expect(slotFromAim(aimAngleAt(AIM_RIGS.probe_emitter, 3, s, 0, true), 3)).toBeCloseTo(s, 6);
  });
  it("the aimed slot is the brightest holder while the beam is on, else null", () => {
    expect(aimedSlotOf({ beam: 1, holderGlow: [0.6, 1, 0.6], aimed: null })).toBe(1);
    expect(aimedSlotOf({ beam: 0.1, holderGlow: [0.6, 1, 0.6], aimed: 1 })).toBeNull();
    expect(aimedSlotOf({ beam: 0.7, holderGlow: [0.36, 0.36, 0.6], aimed: null })).toBe(2);
    expect(aimedSlotOf({ beam: 1, holderGlow: [1, 1, 1], aimed: 0 })).toBe(0);
  });
  it("ghost ids follow display slots through the view (never statement order)", () => {
    expect(ghostOf(config, view, 0)).toBe("shrink_outline");
    expect(ghostOf(config, view, 2)).toBe("salt_inflow");
    expect(ghostOf(config, view, null)).toBeNull();
  });
  it("the scenario gate: ghosts only when s > scenarioMin", () => {
    expect(probeValueOf(config, 0.6)).toBeCloseTo(6, 9);
    expect(scenarioOkOf(config, 0.6)).toBe(true);
    expect(scenarioOkOf(config, 0.2)).toBe(false);
    expect(scenarioOkOf({ ...config, scenarioMin: null }, null)).toBe(true);
  });
});

describe("specimen_pods · the bilayer's fluid parting (cell §5.1)", () => {
  it("heads part away from the needle by 22·min(d, 1) at 36 units, lift 4, and tails bend 0.4·Δx/22", () => {
    const at = headParting(36, 0, 2);
    const k = Math.exp(-0.5);
    expect(at.dx).toBeCloseTo(22 * k, 9);
    expect(at.dy).toBeCloseTo(-4 * k, 9);
    expect(at.tilt).toBeCloseTo((0.4 * 22 * k) / 22, 9);
    expect(headParting(-36, 0, 0.5).dx).toBeCloseTo(-11 * k, 9);
    expect(headParting(36, 0, 0).dx).toBe(0);
  });
});

describe("specimen_pods · plans", () => {
  it("reads the quarantine, its pod, the humming honest pods and the lantern sequence from the success plan", () => {
    const plan: SuccessPlan = {
      beats: [
        { atMs: 0, anchor: "emitter", action: "ignite" },
        { atMs: 0, anchor: "pod_1", action: "ignite", params: { quarantine: "lanterns_ignite" } },
        { atMs: 250, anchor: "pod_1", action: "dissolve", params: { prop: "mimic_mote" } },
        { atMs: 400, anchor: "pod_0", action: "spin", params: { deg: 30 } },
        { atMs: 400, anchor: "pod_2", action: "spin", params: { deg: 30 } },
        { atMs: 900, anchor: "apparatus", action: "light_sequence", params: { count: 12, staggerMs: 80 } },
        { atMs: 900, anchor: "apparatus", action: "rise", params: { anim: "lift_moves" } },
      ],
      cardEffects: [],
      durationMs: 2400,
      cue: "pod_crack",
    };
    expect(readSuccess(plan)).toEqual({ slot: 1, quarantine: "lanterns_ignite", payoffAtMs: 900, honest: [0, 2], lanterns: { at: 900, stagger: 80, count: 12 } });
  });
  it("reads the honest pod and the ghost register from the failure plan", () => {
    const plan: FailurePlan = {
      beats: [
        { atMs: 0, anchor: "pod_2", action: "hold_bright", params: { slot: 2, holdMs: 2000 } },
        { atMs: 100, anchor: "ghost_origin", action: "flash", params: { register: 1 } },
        { atMs: 300, anchor: "apparatus", action: "stall" },
      ],
      durationMs: 1200,
      cue: "bell_honest",
    };
    expect(readFailure(plan)).toEqual({ slot: 2, ghostRegister: true, apparatus: "stall" });
  });
});
