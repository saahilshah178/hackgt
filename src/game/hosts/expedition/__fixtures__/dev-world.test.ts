import { describe, expect, it } from "vitest";
import { WorldOverlay } from "../../../../contracts/world";
import { getContraption, getSandbox } from "../../../../world/library";
import { DEV_ENCOUNTERS, DEV_WORLD_INPUT } from "./dev-world-data";
import { sheerEdges } from "../scene/terrain";

describe("dev world", () => {
  const world = WorldOverlay.parse(DEV_WORLD_INPUT);

  it("parses, with one station per dev encounter in encounter order", () => {
    expect(world.stations.map((s) => s.encounterId)).toEqual(DEV_ENCOUNTERS.map((e) => e.id));
  });

  it("every station config parses with its meta, and covers every control kind", () => {
    const kinds = new Set<string>();
    for (const st of world.stations) {
      const meta = getContraption(st.contraption);
      expect(meta, st.contraption).toBeDefined();
      expect(() => meta?.configSchema.parse(st.config)).not.toThrow();
      expect(meta?.skins.some((s) => s.id === st.skin)).toBe(true);
      kinds.add(meta?.control ?? "");
    }
    expect([...kinds].sort()).toEqual(["aim", "bins", "cables", "matrix", "scrub", "slots", "tubes", "waves", "widget"]);
    for (const sb of world.sandboxes) expect(() => getSandbox(sb.contraption)?.configSchema.parse(sb.config)).not.toThrow();
  });

  it("has every link kind, a sheer rise and a sheer descent, ≥ 5 layers per set, two segments and an interior", () => {
    const kinds = new Set(world.zones.flatMap((z) => z.links.map((l) => l.kind)));
    expect([...kinds].sort()).toEqual(["climb", "drop", "hop", "ladder", "ride", "timed_hop"]);
    const edges = sheerEdges(world.zones[0].ground.points, world.zones[0].ground.maxStepUp);
    expect(edges.some((e) => e.dir === "rise")).toBe(true);
    expect(edges.some((e) => e.dir === "descent")).toBe(true);
    for (const z of world.zones) for (const ls of z.layerSets) expect(ls.layers.length).toBeGreaterThanOrEqual(5);
    expect(world.zones[0].segments).toHaveLength(2);
    expect(world.zones[0].interiors).toHaveLength(1);
    expect(world.zones[1].height).toBeGreaterThan(1080);
  });
});

describe("dev world resolution", () => {
  it("resolves every station natively (no console_slate fallback) with a view-backed probe where configured", async () => {
    const { devWorld } = await import("./dev-world");
    const { spec, world } = devWorld();
    expect(spec.encounters.map((e) => e.id)).toEqual(DEV_ENCOUNTERS.map((e) => e.id));
    expect(world.stations).toHaveLength(DEV_ENCOUNTERS.length);
    const byId = Object.fromEntries(world.stations.map((s) => [s.encounterId, s.contraption]));
    expect(byId).toMatchObject({ e1_radians: "emitter_rail", e2_period: "ring_gate", e3_amplitude: "claim_holders", e4_solve: "step_bridge", e2_selectivity: "router_lanes", e5_tonicity: "sluice_waves", e7_march: "switchboard", e5_freedom_rides: "cause_tubes", w1_slope: "console_slate", e12_boss: "tumbler_vault" });
    expect(world.sandboxes).toHaveLength(1);
    expect(world.speakers.has("otis")).toBe(true);
  });
});
