import { describe, expect, it } from "vitest";
import { tumblerVaultMeta, TumblerVaultConfig } from "@/world/contraptions/tumbler-vault.meta";
import { makeDraft } from "@/world/draft-inputs";
import type { Diagnosis, PoseInput } from "@/world/types";
import { boltAngle, boltSpan, doorSwing, routeVaultFail, routeVaultSuccess, tumblerAngle, tumblerCenter, VAULT } from "./shared";

describe("tumbler_vault geometry (civil e12)", () => {
  it("places four tumblers at 12, 3, 6 and 9 o'clock on their ring", () => {
    const c = VAULT.center;
    const r = VAULT.tumblerRingR;
    const pts = [0, 1, 2, 3].map((i) => tumblerCenter(i, 4));
    expect(pts[0]!.x).toBeCloseTo(c.x);
    expect(pts[0]!.y).toBeCloseTo(c.y - r);
    expect(pts[1]!.x).toBeCloseTo(c.x + r);
    expect(pts[2]!.y).toBeCloseTo(c.y + r);
    expect(pts[3]!.x).toBeCloseTo(c.x - r);
    expect(tumblerAngle(0, 4)).toBeCloseTo(-Math.PI / 2);
  });
  it("the last unstruck tumbler slides toward the hub by its slide", () => {
    const d0 = Math.hypot(tumblerCenter(1, 4).x - VAULT.center.x, tumblerCenter(1, 4).y - VAULT.center.y);
    const d8 = Math.hypot(tumblerCenter(1, 4, 8).x - VAULT.center.x, tumblerCenter(1, 4, 8).y - VAULT.center.y);
    expect(d0 - d8).toBeCloseTo(8);
  });
  it("bolts sit between the tumblers and retract inward", () => {
    expect([0, 1, 2, 3].map((j) => Math.round((boltAngle(j, 4) * 180) / Math.PI))).toEqual([-45, 45, 135, 225]);
    for (let j = 0; j < 4; j++) {
      const thrown = boltSpan(j, 4, 0);
      const drawn = boltSpan(j, 4, 1);
      const r = (p: { x: number; y: number }) => Math.hypot(p.x - VAULT.center.x, p.y - VAULT.center.y);
      expect(r(thrown.b)).toBeGreaterThan(VAULT.doorR); // into the socket
      expect(r(drawn.b)).toBeLessThanOrEqual(VAULT.doorR + 1e-6); // inside the door
      expect(r(thrown.a) - r(drawn.a)).toBeCloseTo(VAULT.retractPx);
    }
  });
  it("the door swings on its hinge: full face closed, edge-on and shaded open", () => {
    expect(doorSwing(0)).toEqual({ scaleX: 1, shade: 0 });
    expect(doorSwing(1).scaleX).toBeLessThan(0.2);
    expect(doorSwing(1).shade).toBeCloseTo(0.45);
    expect(doorSwing(0.5).scaleX).toBeLessThan(1);
    expect(doorSwing(5)).toEqual(doorSwing(1));
  });
});

describe("tumbler_vault beat routing (real tumbler_vault plans)", () => {
  const VIEW = {
    question: "q",
    hypotheses: ["h_a", "h_b", "h_c", "h_d"].map((id) => ({ id, text: id })),
    clues: [0, 1, 2, 3].map((index) => ({ index, text: `clue ${index}` })),
  };
  const CONFIG = TumblerVaultConfig.parse({ bolts: 4 });
  const input = (hypothesisId: string): PoseInput<TumblerVaultConfig> => ({
    view: VIEW,
    draft: makeDraft("e12", "investigator.elimination", { hypothesisId }, { complete: true, settled: true }),
    config: CONFIG,
    probe: null,
    t: 0,
    aidTier: 0,
    hintsUsed: 0,
    sim: null,
    solved: false,
    reducedMotion: false,
  });
  it("a wrong accusation grinds THAT tumbler (4°, 3×) and holds it bright for the eliminating clue", () => {
    const d: Diagnosis = { correct: false, feedback: "f", displayFeedback: "f", failKey: "wrong_hypothesis", wrongKeys: ["h_c", "clue:2"], prefix: null, disclosed: { clueIndex: 2 }, nearMiss: null, probeKeys: [] };
    const r = routeVaultFail(tumblerVaultMeta.failurePlan(d, input("h_c")));
    expect(r.grind).toMatchObject({ index: 2, deg: 4, times: 3 });
    expect(r.hold?.index).toBe(2);
    expect(r.hold!.atMs).toBeGreaterThan(r.grind!.atMs);
  });
  it("success locks the accused tumbler, retracts the bolts in sequence, spins the rings, then opens the door", () => {
    const r = routeVaultSuccess(tumblerVaultMeta.successPlan({ ...input("h_a"), solved: true }, "vault_opens"));
    expect(r.lock).toMatchObject({ index: 0, atMs: 0 });
    expect(r.bolts.map((b) => b.index)).toEqual([0, 1, 2, 3]);
    const at = r.bolts.map((b) => b.atMs);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(r.spin).toMatchObject({ ringTurns: 1.5, wheelTurns: 2 });
    expect(r.spin!.atMs).toBeGreaterThan(at[at.length - 1]!);
    expect(r.open).toMatchObject({ swingMs: 1200 });
    expect(r.open!.atMs).toBeGreaterThan(r.spin!.atMs);
  });
});
