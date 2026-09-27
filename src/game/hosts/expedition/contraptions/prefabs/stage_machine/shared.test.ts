import { describe, expect, it } from "vitest";
import cellFixture from "../../../../../../../fixtures/cell-transport-dungeon.json";
import docConfigs from "../../../../../../../tests/world-doc-configs.json";
import type { GameSpec } from "@/contracts/gamespec";
import { getMode } from "@/mechanics/registry";
import { drumSlotAt, PUMP, sideHome, StageMachineConfig, stageMachineMeta as meta, type PumpLoad } from "@/world/contraptions/stage-machine.meta";
import type { Draft, PairsView, PoseInput } from "@/world/types";
import { hash01, ionPosition, jawMouth, mix, playbackK, releaseHome, shakeOffset, withStage, type IonsLoad } from "./shared";

const spec = cellFixture as unknown as GameSpec;
const i8 = spec.encounters.findIndex((e) => e.id === "e8_pump");
const VIEW = getMode("linker", "pairs")!.present(spec.encounters[i8]!.params as never, spec.seed + i8) as PairsView;
const CONFIG = StageMachineConfig.parse(
  (docConfigs as { configs: { archetype: string; encounterId: string | null; config: unknown }[] }).configs.find((c) => c.archetype === "stage_machine")!.config,
);
const LINKS = [
  { leftKey: "l0", rightKey: "r0" },
  { leftKey: "l1", rightKey: "r1" },
  { leftKey: "l2", rightKey: "r2" },
  { leftKey: "l3", rightKey: "r3" },
];
function input(k: number): PoseInput<StageMachineConfig> {
  const draft: Draft = { encounterId: "e8_pump", modeKey: "linker.pairs", input: { links: LINKS }, complete: true, focus: null, hover: null, probe: k, settled: true, wave: null, marks: null, seq: 1 };
  return { view: VIEW, draft, config: CONFIG, probe: k, t: 0, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false };
}
const ions = (k: number, socket = "l0"): IonsLoad => meta.pose(input(k)).loads.find((l): l is Extract<PumpLoad, { kind: "ions" }> => l.kind === "ions" && l.socket === socket)!;

describe("pump_rewiring · ion positions through the playback", () => {
  it("waits beyond the jaw on its from-side, rides its drum socket once bound, leaves toward its cartridge's direction", () => {
    const n = 3;
    expect(ionPosition(ions(0), 1, 0)).toEqual(sideHome("in", 1, n, ions(0).group)); // Na⁺ waits in the cytoplasm below
    const bound = ions(2);
    const at = ionPosition(bound, 1, 2 * (Math.PI / 3));
    const want = drumSlotAt(bound.group, 1, n, 2 * (Math.PI / 3));
    expect(at.x).toBeCloseTo(want.x, 6);
    expect(at.y).toBeCloseTo(want.y, 6);
    const gone = ions(4);
    const out = ionPosition(gone, 0, 4 * (Math.PI / 3));
    expect(out.y).toBeCloseTo(releaseHome("out", 0, n).y, 6); // released up into the tide
    expect(out.y).toBeLessThan(PUMP.housing.top);
  });
  it("a blocked group presses on the shut jaw at mid-stage and falls back home", () => {
    const blocked: IonsLoad = { ...ions(0), from: "out", to: "in", blocked: true, releaseStage: null, bind: 0.5, release: 0 };
    const mid = ionPosition(blocked, 0, 0);
    expect(mid.y).toBeCloseTo(sideHome("out", 0, 3, blocked.group).y + 0.9 * (jawMouth("out", 0, 3).y - sideHome("out", 0, 3, blocked.group).y), 6);
    expect(ionPosition({ ...blocked, bind: 1 }, 0, 0).y).toBeCloseTo(sideHome("out", 0, 3).y, 6);
  });
});

describe("pump_rewiring · playback clock", () => {
  it("one run: 170 ms per stage from → to, then holds", () => {
    expect(playbackK(0, 0, 4, 170)).toBe(0);
    expect(playbackK(340, 0, 4, 170)).toBeCloseTo(2, 9);
    expect(playbackK(5000, 0, 4, 170)).toBe(4);
  });
  it("two cycles wrap back to the first stage", () => {
    expect(playbackK(7 * 170 + 85, 0, 6, 170, 2)).toBeCloseTo(0.5, 9);
    expect(playbackK(99999, 0, 6, 170, 2)).toBe(6);
  });
  it("the grind shake decays to 0 by its end", () => {
    expect(shakeOffset(-1, 3, 300)).toBe(0);
    expect(shakeOffset(300, 3, 300)).toBe(0);
    expect(Math.abs(shakeOffset(11, 3, 300))).toBeLessThanOrEqual(3);
  });
  it("withStage replays only the stage fields (links, labels and lamps unchanged)", () => {
    const base = meta.pose(input(0));
    const at4 = withStage(base, CONFIG, VIEW, 4);
    const direct = meta.pose(input(4));
    expect(at4.drumAngle).toBeCloseTo(direct.drumAngle, 12);
    expect(at4.jawUpper).toBe(direct.jawUpper);
    expect(at4.loads).toEqual(direct.loads);
    expect(at4.sockets).toBe(base.sockets);
    expect(at4.cables).toBe(base.cables);
  });
});

describe("cell drawing kit · pure helpers", () => {
  it("mix blends channels; hash01 is deterministic in [0, 1)", () => {
    expect(mix(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mix(0x102030, 0x102030, 0.7)).toBe(0x102030);
    expect(hash01(1, 2, 3)).toBe(hash01(1, 2, 3));
    for (let i = 0; i < 50; i++) {
      const h = hash01(i, i * 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});
