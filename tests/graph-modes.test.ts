import { describe, expect, it } from "vitest";
import { network } from "../src/mechanics/families/linker/network";
import { path } from "../src/mechanics/families/linker/path";
import { search } from "../src/mechanics/families/mapper/search";
import { hierarchy } from "../src/mechanics/families/sorter/hierarchy";
import { venn } from "../src/mechanics/families/sorter/venn";

describe("sorter.venn", () => {
  const p = {
    sets: [
      { id: "federal", label: "Federal", feature: "powers given to the national government" },
      { id: "state", label: "State", feature: "powers reserved to the states" },
    ],
    items: [
      { text: "Coin money", setIds: ["federal"], why: "Article I, Section 8." },
      { text: "Run public schools", setIds: ["state"], why: "Reserved to the states." },
      { text: "Collect taxes", setIds: ["federal", "state"], why: "Both levels tax." },
      { text: "Grant titles of nobility", setIds: [], why: "Forbidden to both." },
    ],
  };
  it("places items in regions including overlap and neither", () => {
    expect(venn.check(p)).toEqual([]);
    const s = venn.resolve(p);
    expect(venn.grade(p, venn.solutionInput(p, s)).correct).toBe(true);
    const miss = venn.grade(p, { assignments: [{ itemKey: "i0", setIds: ["federal"] }, { itemKey: "i1", setIds: ["state"] }, { itemKey: "i2", setIds: ["federal"] }, { itemKey: "i3", setIds: [] }] });
    expect(miss.feedback).toMatch(/Collect taxes.*Federal AND State/);
    const v = venn.present(p, 2);
    const input = venn.blind!.toInput(p, v, { assignments: v.items.map((it, i) => ({ item: i, sets: s.regions[it.key] })) });
    expect(venn.grade(p, input).correct).toBe(true);
    expect(venn.check({ ...p, items: p.items.filter((it) => it.setIds.length !== 0) }).join(" ")).toMatch(/neither/);
  });
});

describe("sorter.hierarchy", () => {
  const p = {
    levels: ["Kingdom", "Phylum", "Class", "Order"],
    items: [
      { text: "Animalia", level: "Kingdom", why: "All animals." },
      { text: "Chordata", level: "Phylum", why: "Animals with a notochord." },
      { text: "Mammalia", level: "Class", why: "Chordates with hair and milk." },
      { text: "Carnivora", level: "Order", why: "A group within mammals." },
    ],
  };
  it("places items at levels and says whether the guess was too broad or too narrow", () => {
    expect(hierarchy.check(p)).toEqual([]);
    const s = hierarchy.resolve(p);
    expect(hierarchy.grade(p, hierarchy.solutionInput(p, s)).correct).toBe(true);
    const miss = hierarchy.grade(p, { placements: [{ itemKey: "i0", level: "Kingdom" }, { itemKey: "i1", level: "Phylum" }, { itemKey: "i2", level: "Order" }, { itemKey: "i3", level: "Class" }] });
    expect(miss.feedback).toMatch(/Mammalia.*narrower level/);
    expect(hierarchy.check({ ...p, items: [{ ...p.items[0], level: "Species" }] }).join(" ")).toMatch(/not one of the levels/);
  });
});

describe("linker.network", () => {
  const p = {
    relation: "eats",
    directed: true,
    nodes: [{ id: "grass", label: "Grass" }, { id: "rabbit", label: "Rabbit" }, { id: "fox", label: "Fox" }],
    edges: [{ from: "rabbit", to: "grass", why: "Rabbits graze." }, { from: "fox", to: "rabbit", why: "Foxes hunt rabbits." }],
  };
  it("requires exactly the true edges and names extra or missing links", () => {
    expect(network.check(p)).toEqual([]);
    expect(network.grade(p, network.solutionInput(p, network.resolve(p))).correct).toBe(true);
    expect(network.grade(p, { edges: [{ fromId: "rabbit", toId: "grass" }, { fromId: "grass", toId: "fox" }] }).feedback).toMatch(/Grass does not eats Fox/);
    expect(network.grade(p, { edges: [{ fromId: "rabbit", toId: "grass" }] }).feedback).toMatch(/link is missing at Fox/);
    const undirected = { ...p, directed: false };
    expect(network.grade(undirected, { edges: [{ fromId: "grass", toId: "rabbit" }, { fromId: "rabbit", toId: "fox" }] }).correct).toBe(true);
    expect(network.check({ ...p, edges: [...p.edges, { from: "fox", to: "fox", why: "" }] }).join(" ")).toMatch(/self-loop/);
  });
});

describe("linker.path", () => {
  const p = {
    nodes: [{ id: "a", label: "Camp" }, { id: "b", label: "Bridge" }, { id: "c", label: "Cave" }, { id: "d", label: "Keep" }],
    edges: [{ from: "a", to: "d", weight: "10" }, { from: "a", to: "b", weight: "2" }, { from: "b", to: "c", weight: "2" }, { from: "c", to: "d", weight: "2" }],
    directed: false,
    start: "a",
    goal: "d",
    ask: "shortest" as const,
    costName: "hours",
  };
  it("finds the cheapest route and rejects the fewest-hop trap", () => {
    expect(path.check(p)).toEqual([]);
    const s = path.resolve(p);
    expect(s.path).toEqual(["a", "b", "c", "d"]);
    expect(s.cost).toBe(6);
    expect(path.grade(p, path.solutionInput(p, s)).correct).toBe(true);
    expect(path.grade(p, { path: ["a", "d"] }).feedback).toMatch(/costs 10 hours; a cheaper one exists/);
    expect(path.grade(p, { path: ["a", "c", "d"] }).feedback).toMatch(/aren't connected/);
    expect(path.grade({ ...p, ask: "any" }, { path: ["a", "d"] }).correct).toBe(true);
    expect(path.check({ ...p, edges: p.edges.filter((e) => e.from !== "a" || e.to !== "d"), start: "a" }).join(" ")).not.toMatch(/unreachable/);
    expect(path.check({ ...p, goal: "a" }).join(" ")).toMatch(/must differ/);
  });
});

describe("mapper.search", () => {
  const p = { min: "1", max: "64", hidden: "37", maxProbes: 7, thingName: "the page" };
  it("finds the hidden value within the budget by halving and grades the probe sequence", () => {
    expect(search.check(p)).toEqual([]);
    const s = search.resolve(p);
    expect(s.probes.length).toBeLessThanOrEqual(6);
    expect(s.probes[s.probes.length - 1]).toBe(37);
    expect(search.grade(p, search.solutionInput(p, s)).correct).toBe(true);
    expect(search.grade(p, { probes: [10, 20] }).feedback).toMatch(/20 is too low/);
    expect(search.grade(p, { probes: [1, 2, 3, 4, 5, 6, 7, 8] }).feedback).toMatch(/Out of probes/);
    expect(search.check({ ...p, maxProbes: 3 }).join(" ")).toMatch(/at least 6/);
    expect(search.check({ ...p, hidden: "64" }).join(" ")).toMatch(/strictly inside/);
  });
});
