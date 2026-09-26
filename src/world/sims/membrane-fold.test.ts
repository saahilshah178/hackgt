import { describe, expect, it } from "vitest";
import type { StageId } from "../contraptions/step-bridge.config";
import { FOLD_ORDER, FOLD_START, foldAt, foldCarries, foldStage, membraneFold } from "./membrane-fold";

const ALL: readonly StageId[] = ["touch", "fold", "pinch", "carry", "dissolve_bounce"];
function permutations<T>(xs: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)], k - 1).map((rest) => [x, ...rest]));
}

describe("membrane_fold stage physics", () => {
  it("the solution order ends detached with travel 1", () => {
    const states = membraneFold(FOLD_ORDER);
    expect(states).toHaveLength(4);
    const last = states.at(-1)!;
    expect(last.detached).toBe(true);
    expect(last.travel).toBe(1);
    expect(last.microVesicle).toBe(false);
    expect(foldCarries(FOLD_ORDER)).toBe(true);
  });

  it("no other 4-stage order of the 5 plates carries the vesicle", () => {
    const orders = permutations(ALL, 4);
    expect(orders).toHaveLength(120);
    const winners = orders.filter((o) => foldCarries(o));
    expect(winners).toEqual([[...FOLD_ORDER]]);
  });

  it("pinch before fold pinches off an EMPTY micro-vesicle and leaves the sub outside", () => {
    const s = membraneFold(["touch", "pinch", "fold", "carry"]).at(-1)!;
    expect(s.microVesicle).toBe(true);
    expect(s.detached).toBe(false);
    expect(s.travel).toBe(0);
  });

  it("fold without touch is a relaxing dimple; carry without detach lights an empty rail", () => {
    expect(foldStage(FOLD_START, "fold")).toEqual(FOLD_START);
    expect(foldStage(FOLD_START, "carry")).toEqual(FOLD_START);
  });

  it("the decoy bounces", () => {
    const s = membraneFold(["touch", "dissolve_bounce"]).at(-1)!;
    expect(s.bounced).toBe(true);
    expect(s.detached).toBe(false);
  });

  it("foldStage is pure", () => {
    const before = { ...FOLD_START };
    foldStage(FOLD_START, "touch");
    expect(FOLD_START).toEqual(before);
  });

  it("foldAt blends neighbouring stages (numbers ease, booleans switch at halfway)", () => {
    const states = membraneFold(FOLD_ORDER);
    expect(foldAt(states, 0)).toEqual(FOLD_START);
    expect(foldAt(states, 4)).toEqual(states[3]);
    const mid = foldAt(states, 1.5);
    expect(mid.depth).toBeCloseTo(0.5, 6);
    expect(mid.touched).toBe(true);
    expect(foldAt(states, 2.25).detached).toBe(false);
    expect(foldAt(states, 2.75).detached).toBe(true);
    expect(foldAt(states, 99)).toEqual(states[3]);
  });
});
