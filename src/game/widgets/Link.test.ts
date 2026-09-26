import { describe, expect, it } from "vitest";
import {
  chainToInput,
  eliminationToInput,
  isChainView,
  isEliminationView,
  isPairsView,
  pairsToInput,
} from "./Link";

describe("Link.pairsToInput", () => {
  it("maps a leftKey->rightKey record to the links array grade() expects", () => {
    expect(pairsToInput({ l0: "r0", l1: "x0" })).toEqual({
      links: [
        { leftKey: "l0", rightKey: "r0" },
        { leftKey: "l1", rightKey: "x0" },
      ],
    });
  });
});

describe("Link.chainToInput", () => {
  it("maps a fromKey->toKey record to the edges array grade() expects", () => {
    expect(chainToInput({ n0: "n1", n1: "n2" })).toEqual({
      edges: [
        { fromKey: "n0", toKey: "n1" },
        { fromKey: "n1", toKey: "n2" },
      ],
    });
  });
});

describe("Link.eliminationToInput", () => {
  it("wraps the chosen hypothesis id", () => {
    expect(eliminationToInput("survivor")).toEqual({ hypothesisId: "survivor" });
  });
});

describe("Link view-shape detection", () => {
  it("distinguishes pairs, chain, and elimination views", () => {
    const pairs = { lefts: [], rights: [] };
    const chain = { nodes: [], edgeCount: 0 };
    const elimination = { question: "", hypotheses: [], clues: [] };
    expect(isPairsView(pairs)).toBe(true);
    expect(isChainView(pairs)).toBe(false);
    expect(isChainView(chain)).toBe(true);
    expect(isPairsView(chain)).toBe(false);
    expect(isEliminationView(elimination)).toBe(true);
    expect(isPairsView(elimination)).toBe(false);
  });
});
