/**
 * scene/test-zone.ts (H1) — a small parsed zone for the pure-module tests (node). Not a *.test.ts, so Vitest does not
 * collect it; it is imported by the tests beside it.
 */
import { Zone, type ZoneInput } from "./zone-input";

export const TEST_ZONE_INPUT: ZoneInput = {
  id: "z_test",
  name: "Test Zone",
  width: 4000,
  height: 1400,
  layerSets: [
    {
      id: "day",
      layers: [
        { asset: "orrery_terraces.layer.far", depth: "L1_far", scrollFactor: 0.15, y: 200 },
        { asset: "orrery_terraces.layer.mid", depth: "L2_midfar", scrollFactor: 0.35, y: 300 },
        { asset: "orrery_terraces.layer.near", depth: "L3_mid", scrollFactor: 0.6, y: 400 },
      ],
    },
    {
      id: "dusk",
      layers: [
        { asset: "orrery_terraces.layer.far_dusk", depth: "L1_far", scrollFactor: 0.15, y: 200 },
        { asset: "orrery_terraces.layer.mid_dusk", depth: "L2_midfar", scrollFactor: 0.35, y: 300 },
        { asset: "orrery_terraces.layer.near_dusk", depth: "L3_mid", scrollFactor: 0.6, y: 400 },
      ],
    },
  ],
  segments: [
    {
      id: "s_day",
      x0: 0,
      x1: 2000,
      layerSet: "day",
      sky: { stops: [{ at: 0, color: "#D8D4CF" }, { at: 0.5, color: "#E8DCD2" }, { at: 1, color: "#F4E7DA" }], haze: { color: "#FFFFFF", alpha: 0.2 } },
      ambient: { light: "day" },
    },
    {
      id: "s_dusk",
      x0: 2000,
      x1: 4000,
      layerSet: "dusk",
      sky: { stops: [{ at: 0, color: "#9E86D8" }, { at: 0.5, color: "#C9A0DE" }, { at: 1, color: "#F2B8D4" }], haze: { color: "#FFFFFF", alpha: 0.2 } },
      ambient: { light: "dusk" },
      runEnabled: false,
      variants: [{ requires: { solved: "e1" }, weather: "rain_light", sky: null, music: "calm" }],
    },
  ],
  interiors: [{ id: "hall", x0: 2600, x1: 3000, facade: "orrery_terraces.prop.hall_facade", facadeAt: [2580, 300] }],
  ground: {
    // flat 800 → a sheer RISE at 1000 (to 640) → flat → a sheer DESCENT at 2400 (to 960) → a gentle slope → flat
    points: [
      [0, 800],
      [1000, 800],
      [1004, 640],
      [2400, 640],
      [2404, 960],
      [3000, 960],
      [3400, 880],
      [4000, 880],
    ],
    surface: "orrery_terraces.ground.path",
  },
  platforms: [
    { id: "ledge", points: [[400, 600], [700, 600]] },
    { id: "gated", points: [[3100, 700], [3300, 700]], requires: { solved: "e2" } },
  ],
  links: [
    { kind: "hop", id: "hop_ledge", from: { x: 360 }, to: { surface: "ledge", x: 420 }, apex: 100 },
    { kind: "climb", id: "climb_rise", from: { x: 980 }, to: { x: 1030 } },
    { kind: "drop", id: "drop_edge", from: { x: 2380 }, to: { x: 2440 } },
    { kind: "ladder", id: "ladder_edge", from: { x: 2450 }, to: { x: 2370 } },
    {
      kind: "timed_hop",
      id: "gear",
      from: { x: 3050 },
      to: { surface: "gated", x: 3120 },
      periodSec: 2,
      phase: 0,
      open: [0.25, 0.5],
      missTo: { x: 3200 },
      requires: { solved: "e2" },
    },
    { kind: "ride", id: "lift", from: { x: 1500 }, to: { x: 1800 }, vehicle: "orrery_terraces.prop.lift", path: [[1500, 640], [1650, 480], [1800, 640]], ms: 1200 },
  ],
  exits: [{ id: "east", x: 3950, toZoneId: "z_next", toX: 100 }],
  entry: { x: 200 },
};
export const TEST_ZONE = Zone.parse(TEST_ZONE_INPUT);
