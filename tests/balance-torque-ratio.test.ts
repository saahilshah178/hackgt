import { describe, expect, it } from "vitest";
import { ratio } from "../src/mechanics/families/balance/ratio";
import { torque } from "../src/mechanics/families/balance/torque";

describe("balance.torque", () => {
  const p = { fixed: [{ mass: "4", position: "2" }], movable: { mass: "2" }, pivot: "5", ask: "position" as const, rangeMin: "0", rangeMax: "12", unit: "m" };
  it("places the movable mass so the torques cancel", () => {
    expect(torque.check(p)).toEqual([]);
    const s = torque.resolve(p);
    expect(s.answer).toBeCloseTo(11, 9); // 4·(2−5) + 2·(x−5) = 0 → x = 11
    expect(torque.grade(p, torque.solutionInput(p, s)).correct).toBe(true);
    expect(torque.grade(p, { position: 8 }).feedback).toMatch(/tips to the left/);
    expect(torque.grade(p, { position: 11.2 }).correct).toBe(true);
  });
  it("finds the fulcrum as the weighted mean (mean vs median)", () => {
    const q = { ...p, ask: "pivot" as const, fixed: [{ mass: "1", position: "1" }, { mass: "1", position: "2" }, { mass: "1", position: "9" }] };
    expect(torque.check(q)).toEqual([]);
    expect(torque.resolve(q).answer).toBeCloseTo(4, 9);
    expect(torque.grade(q, { position: 2 }).feedback).toMatch(/weighted average/);
  });
  it("rejects trivial or impossible setups", () => {
    expect(torque.check({ ...p, fixed: [{ mass: "4", position: "5" }] }).join(" ")).toMatch(/already balance/);
    expect(torque.check({ ...p, movable: { mass: "0.5" } }).join(" ")).toMatch(/falls off the beam/);
    expect(torque.check({ ...p, pivot: "5.0001" }).join(" ")).toMatch(/rounded decimal/);
    expect(torque.check({ ...p, fixed: [{ mass: "-1", position: "2" }] }).join(" ")).toMatch(/positive/);
  });
});

describe("balance.ratio", () => {
  const p = {
    recipe: [
      { name: "propane", amount: "1", unit: "mol" },
      { name: "oxygen", amount: "5", unit: "mol" },
    ],
    available: [
      { name: "propane", amount: "2" },
      { name: "oxygen", amount: "6" },
    ],
    product: { name: "carbon dioxide", perBatch: "3", unit: "mol" },
    ask: "both" as const,
  };
  it("finds the limiting reagent and the product, trapping the 'less mass = limiting' belief", () => {
    expect(ratio.check(p)).toEqual([]);
    const s = ratio.resolve(p);
    expect(s.limiting).toBe("oxygen"); // 6/5 = 1.2 batches < 2/1
    expect(s.product).toBeCloseTo(3.6, 9);
    expect(s.leftovers.find((l) => l.name === "propane")?.amount).toBeCloseTo(0.8, 9);
    expect(ratio.grade(p, ratio.solutionInput(p, s)).correct).toBe(true);
    expect(ratio.grade(p, { limiting: "propane", product: 3.6 }).feedback).toMatch(/2 batches' worth/);
    expect(ratio.grade(p, { limiting: "oxygen", product: 6 }).feedback).toMatch(/more than the limiting/);
    expect(ratio.grade({ ...p, ask: "limiting" }, { limiting: "Oxygen", product: null }).correct).toBe(true);
  });
  it("blind solver round-trips and bad params are rejected", () => {
    const v = ratio.present(p, 1);
    expect(ratio.blind!.describe(p, v)).toMatch(/Available: 2 propane, 6 oxygen/);
    expect(ratio.grade(p, ratio.blind!.toInput(p, v, { limiting: "oxygen", product: 3.6 })).correct).toBe(true);
    expect(ratio.check({ ...p, available: [{ name: "propane", amount: "1" }, { name: "oxygen", amount: "5" }] }).join(" ")).toMatch(/same time/);
    expect(ratio.check({ ...p, available: [{ name: "propane", amount: "2" }, { name: "ozone", amount: "6" }] }).join(" ")).toMatch(/missing "oxygen"/);
    expect(ratio.check({ ...p, product: { ...p.product, perBatch: "0" } }).join(" ")).toMatch(/positive/);
  });
});
