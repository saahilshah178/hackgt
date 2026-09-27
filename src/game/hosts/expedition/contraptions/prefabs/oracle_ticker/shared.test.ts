import { describe, expect, it } from "vitest";
import { oracleTickerMeta, OracleTickerConfig } from "@/world/contraptions/oracle-ticker.meta";
import { makeDraft } from "@/world/draft-inputs";
import type { Diagnosis, PoseInput } from "@/world/types";
import { knobRad, poleTops, routeTickerFail, routeTickerSuccess, TICKER, tickerLayout, wirePath } from "./shared";

const flat = () => 0;
const hill = (x: number) => (x < 500 ? 0 : x < 990 ? -((x - 500) / 490) * 80 : -80 - Math.min(120, x - 990)); // civil S3's walk

describe("wire_ticker layout (civil e3)", () => {
  it("puts the selector at the console, the barrier at the blocker and every walk lamp before it, on the ground", () => {
    const L = tickerLayout(150, 990, 9, hill);
    expect(L.console).toEqual({ x: 150, y: 0 });
    expect(L.dial.x).toBe(150);
    expect(L.dial.y).toBeLessThan(-TICKER.pedestalH);
    expect(L.barrier).toEqual({ x: 990, y: hill(990) });
    expect(L.lamps).toHaveLength(9);
    for (const l of L.lamps) {
      expect(l.x).toBeLessThan(990 - TICKER.barrier.w / 2);
      expect(l.y).toBeCloseTo(hill(l.x));
    }
    const xs = L.lamps.map((l) => l.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(L.poles).toHaveLength(2);
    for (const p of L.poles) expect(p.x > L.wireStart.x && p.x < L.wireEnd.x).toBe(true);
    expect(L.wireEnd.y).toBeLessThan(L.barrier.y - TICKER.barrier.h);
  });
  it("falls back to 990 right of the anchor without a blocker, and draws no lamps for payoffLamps 0", () => {
    const L = tickerLayout(150, null, 0, flat);
    expect(L.barrier.x).toBe(990);
    expect(L.lamps).toEqual([]);
  });
  it("the wire hangs from fixed insulators, sags between them and hums only while a forecast is set", () => {
    const L = tickerLayout(150, 990, 9, flat);
    const fixed = [L.wireStart, ...poleTops(L.poles), L.wireEnd];
    const still = wirePath(fixed, 0, 0);
    expect(still[0]).toEqual(L.wireStart);
    expect(still[still.length - 1]!.x).toBeCloseTo(L.wireEnd.x);
    expect(still[still.length - 1]!.y).toBeCloseTo(L.wireEnd.y);
    // mid-span sags below the chord
    const mid = still[9]!;
    const a = fixed[0]!;
    const b = fixed[1]!;
    expect(mid.y).toBeGreaterThan(a.y + (b.y - a.y) * 0.5);
    const humA = wirePath(fixed, 2, 0.1);
    const humB = wirePath(fixed, 2, 0.2);
    expect(humA.some((p, i) => Math.abs(p.y - still[i]!.y) > 0.5)).toBe(true);
    expect(humA.some((p, i) => Math.abs(p.y - humB[i]!.y) > 0.1)).toBe(true);
    for (let i = 0; i < humA.length; i++) expect(Math.abs(humA[i]!.y - still[i]!.y)).toBeLessThanOrEqual(2 + 1e-9);
    expect(knobRad(40)).toBeCloseTo((40 * Math.PI) / 180);
  });
});

describe("wire_ticker beat routing (real oracle_ticker plans)", () => {
  const VIEW = { scenario: "s", options: [2, 0, 1].map((optionIndex) => ({ optionIndex, text: `option ${optionIndex}` })) };
  const CONFIG = OracleTickerConfig.parse({ payoffLamps: 9 });
  const input = (optionIndex: number): PoseInput<OracleTickerConfig> => ({
    view: VIEW,
    draft: makeDraft("e3", "truth_finder.predict_reveal", { optionIndex }, { complete: true, settled: true }),
    config: CONFIG,
    probe: null,
    t: 0,
    aidTier: 0,
    hintsUsed: 0,
    sim: null,
    solved: false,
    reducedMotion: false,
  });
  const diag: Diagnosis = { correct: false, feedback: "f", displayFeedback: "f", failKey: "wrong_option", wrongKeys: ["1"], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [] };
  it("a miss prints the reveal, stamps the forecast line, then unlocks the selector (in that order)", () => {
    const r = routeTickerFail(oracleTickerMeta.failurePlan(diag, input(1)));
    expect(r.printAt).toBe(0);
    expect(r.stampAt).not.toBeNull();
    expect(r.unseatAt).not.toBeNull();
    expect(r.stampAt!).toBeGreaterThan(r.printAt!);
    expect(r.unseatAt!).toBeGreaterThan(r.stampAt!);
  });
  it("success prints, runs the wire, dissolves the barrier, then lights the nine lamps one at a time", () => {
    const r = routeTickerSuccess(oracleTickerMeta.successPlan({ ...input(0), solved: true }, "barrier_dissolves"));
    expect(r.printAt).toBe(0);
    expect(r.wireAt).not.toBeNull();
    expect(r.dissolveAt).not.toBeNull();
    expect(r.lamps.map((l) => l.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const at = r.lamps.map((l) => l.atMs);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(new Set(at).size).toBe(9);
    expect(at[0]!).toBeGreaterThanOrEqual(r.dissolveAt!);
  });
});
