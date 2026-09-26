import { describe, expect, it } from "vitest";
import cellFixture from "../../../../../../../fixtures/cell-transport-dungeon.json";
import docConfigs from "../../../../../../../tests/world-doc-configs.json";
import { SLUICE_LAYOUT, SluiceWavesConfig, sluiceWavesMeta as meta } from "@/world/contraptions/sluice-waves.meta";
import type { Diagnosis, Draft, PoseInput, TypeMatchView } from "@/world/types";
import type { PrefabProps } from "../../types";
import { SKINS } from "./skins";
import { dotLayout, routeSluiceFail, routeSluiceSuccess, waterOffset } from "./shared";

// ---------------------------------------------------------------- a Phaser-free mock scene (node): every Graphics call chains; NaN arguments are recorded

function mockScene() {
  const errors: string[] = [];
  const queue: { at: number; fn: () => void; removed: boolean }[] = [];
  let now = 0;
  const chain = (name: string): unknown => {
    const p: unknown = new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === "then"
            ? undefined
            : (...args: unknown[]) => {
                for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) errors.push(`${name}.${String(prop)}: ${a}`);
                return p;
              },
      },
    );
    return p;
  };
  const scene = {
    errors,
    add: { container: () => chain("container"), graphics: () => chain("graphics") },
    time: {
      delayedCall: (ms: number, fn: () => void) => {
        const e = { at: now + ms, fn, removed: false };
        queue.push(e);
        return { remove: () => (e.removed = true) };
      },
    },
    textures: { exists: () => false },
    cameras: { main: { shake: () => {} } },
    scale: { width: 1920 },
  };
  const flush = (ms: number, step: (dt: number) => void) => {
    for (let t = 0; t < ms; t += 16) {
      now += 16;
      for (const e of queue.filter((q) => !q.removed && q.at <= now)) {
        e.removed = true;
        e.fn();
      }
      step(16);
    }
  };
  return { scene: scene as unknown as Parameters<(typeof SKINS)["tonicity_sluices"]["create"]>[0] & { errors: string[] }, flush };
}

// ---------------------------------------------------------------- fixtures

type Enc = { id: string; params: { categories: { id: string; label: string }[]; waves: { text: string; categoryId: string }[]; secondsPerWave: number } };
const enc = (id: string) => (cellFixture.encounters as unknown as Enc[]).find((e) => e.id === id)!;
const viewOf = (e: Enc): TypeMatchView => ({
  categories: e.params.categories.map((c) => ({ id: c.id, label: c.label })),
  waves: e.params.waves.map((w, waveIndex) => ({ waveIndex, text: w.text })),
  secondsPerWave: e.params.secondsPerWave,
});
const configOf = (id: string) =>
  SluiceWavesConfig.parse((docConfigs as { configs: { archetype: string; encounterId: string | null; config: unknown }[] }).configs.find((c) => c.archetype === "sluice_waves" && c.encounterId === id)!.config);
const STATIONS = {
  e5: { e: enc("e5_tonicity"), config: configOf("e5_tonicity"), anchor: { x: 5600, y: 1213 }, consoleX: 5200, anim: "steps_emerge", kind: "terrain" },
  e9: { e: enc("e9_osmosis_review"), config: configOf("e9_osmosis_review"), anchor: { x: 5300, y: 1213 }, consoleX: 5000, anim: "water_rises", kind: "ride" },
} as const;
type K = keyof typeof STATIONS;
const sol = (k: K) => STATIONS[k].e.params.waves.map((w, waveIndex) => ({ waveIndex, categoryId: w.categoryId }));
function draftOf(answers: readonly { waveIndex: number; categoryId: string }[], extra: Partial<Draft> = {}): Draft {
  return { encounterId: "x", modeKey: "sorter.type_match", input: { answers }, complete: false, focus: null, hover: null, probe: null, settled: true, wave: null, marks: null, seq: 1, ...extra };
}
function input(k: K, draft: Draft | null): PoseInput<SluiceWavesConfig, null> {
  return { view: viewOf(STATIONS[k].e), draft, config: STATIONS[k].config, probe: null, t: 1, aidTier: 1, hintsUsed: 0, sim: null, solved: false, reducedMotion: false };
}
function diagnosis(over: Partial<Diagnosis>): Diagnosis {
  return { correct: false, feedback: "", displayFeedback: "", failKey: "wrong_wave", wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [], ...over };
}
function propsOf(k: K): PrefabProps<SluiceWavesConfig> {
  const s = STATIONS[k];
  return {
    station: { encounterId: s.e.id, anchor: s.anchor, consoleX: s.consoleX, skin: "tonicity_sluices", boss: null, payoff: { kind: s.kind, anim: s.anim, blocker: null } } as unknown as PrefabProps<SluiceWavesConfig>["station"],
    config: s.config,
    encounter: s.e as never,
    view: viewOf(s.e),
    groundY: s.anchor.y,
    palette: {},
    fx: { dormancy: () => {} } as unknown as PrefabProps<SluiceWavesConfig>["fx"],
    tex: () => {
      throw new Error("no art yet");
    },
    anchorsOf: () => ({}),
    seed: 11,
    reducedMotion: false,
  };
}

// ---------------------------------------------------------------- tests

describe("sluice_waves prefab · pure helpers", () => {
  it("routeSluiceFail moves only the one wave the plan names", () => {
    const plan = meta.failurePlan(diagnosis({ wrongKeys: ["w2", "w3"], disclosed: { category: "isotonic" } }), input("e5", draftOf(sol("e5"), { complete: true })));
    const r = routeSluiceFail(plan);
    expect(r.wave).toBe(2);
    expect(r.backAtMs).toBe(0);
    expect(r.blinkAtMs).toBe(450);
    expect(r.hold).toMatchObject({ valve: 1, dots: 10, fate: "steady" });
    // a forged plan naming two waves still moves only the first
    const forged = routeSluiceFail({ beats: [{ atMs: 0, anchor: "cell_w1", action: "spit_back" }, { atMs: 10, anchor: "cell_w4", action: "flash" }], durationMs: 800, cue: "x" });
    expect(forged.wave).toBe(1);
    expect(forged.blinkAtMs).toBeNull();
    expect(routeSluiceFail({ beats: [{ atMs: 0, anchor: "lock", action: "flash" }], durationMs: 700, cue: "x" })).toMatchObject({ wave: null, lockFlashAtMs: 0 });
  });

  it("routeSluiceSuccess: basins open, every cell drifts to its basin with its fate, then the water", () => {
    const r5 = routeSluiceSuccess(meta.successPlan({ ...input("e5", draftOf(sol("e5"), { complete: true })), solved: true }, "steps_emerge"));
    expect(r5.basinsAtMs).toBe(0);
    expect(r5.cells.map((c) => c.valve)).toEqual([0, 2, 1, 2, 0]);
    expect(r5.water).toEqual({ atMs: 900, ms: 1400 });
    const r9 = routeSluiceSuccess(meta.successPlan({ ...input("e9", draftOf(sol("e9"), { complete: true })), solved: true }, "water_rises"));
    expect(r9.cells.map((c) => c.fate)).toEqual(["shrink", "swell", "steady", "plasmolysis"]);
    expect(r9.water).not.toBeNull();
  });

  it("the payoff water: e5 drains 1.5 H, e9's Barge Lock fills 2 H; dots are seeded and stable as the count grows", () => {
    expect(waterOffset("steps_emerge", 1)).toEqual({ trench: SLUICE_LAYOUT.drainDepth, barge: 0 });
    expect(waterOffset("water_rises", 0.5)).toEqual({ trench: 0, barge: -SLUICE_LAYOUT.fillRise / 2 });
    expect(waterOffset("gate_lifts", 1)).toEqual({ trench: 0, barge: 0 });
    const rect = { x: 0, y: 0, w: 200, h: 100 };
    const a = dotLayout(5, 10, rect);
    expect(dotLayout(5, 20, rect).slice(0, 10)).toEqual(a);
    expect(dotLayout(6, 10, rect)).not.toEqual(a);
    for (const d of dotLayout(5, 60, rect)) expect(d.x >= 0 && d.x <= 200 && d.y >= 0 && d.y <= 100).toBe(true);
  });
});

describe("sluice_waves prefab · tonicity_sluices builds, poses, fails and succeeds", () => {
  for (const k of ["e5", "e9"] as const) {
    it(`${k}: exposes every skin anchor plus cell_w<i>, valve_<j>, basin_<j>; plays both plans without throwing`, async () => {
      const { scene, flush } = mockScene();
      const view = SKINS.tonicity_sluices.create(scene, {} as never, propsOf(k));
      const d = draftOf(sol(k).slice(0, 2), { wave: { index: 2, secondsLeft: 5, secondsPerWave: 8 }, hover: sol(k)[2]!.categoryId });
      const pose = meta.pose(input(k, d));
      view.setState("active");
      view.applyPose(pose);
      for (let i = 0; i < 20; i++) view.update?.(16);
      for (const a of meta.skins[0].anchors) expect(view.anchors, a).toHaveProperty(a);
      for (const c of pose.cells) expect(view.anchors).toHaveProperty(`cell_w${c.waveIndex}`);
      STATIONS[k].config.valves.forEach((_, j) => {
        expect(view.anchors).toHaveProperty(`valve_${j}`);
        expect(view.anchors).toHaveProperty(`basin_${j}`);
      });
      for (const chip of meta.describe(pose, input(k, d)).chips) expect(view.anchors, chip.anchor).toHaveProperty(chip.anchor);
      for (const rung of [1, 2, 3] as const) for (const t of meta.hintTargets(rung, { ...input(k, d), skinId: "tonicity_sluices", record: false })) expect(view.anchors).toHaveProperty(t.anchor);

      const done = draftOf(sol(k).map((a, i) => (i === 1 ? { ...a, categoryId: STATIONS[k].config.valves.find((v) => v.categoryId !== a.categoryId)!.categoryId } : a)), { complete: true });
      const failPose = meta.pose(input(k, done));
      view.applyPose(failPose);
      const failing = view.playFail(meta.failurePlan(diagnosis({ wrongKeys: ["w1"], disclosed: { category: sol(k)[1]!.categoryId } }), input(k, done)), failPose);
      flush(1800, (ms) => view.update?.(ms));
      await failing;
      const solvedIn = { ...input(k, draftOf(sol(k), { complete: true })), solved: true };
      const solved = meta.solvedPose(solvedIn);
      const succeeding = view.playSucceed(meta.successPlan(solvedIn, STATIONS[k].anim), solved);
      flush(2600, (ms) => view.update?.(ms));
      await succeeding;
      view.applyPose(solved);
      view.update?.(16);
      expect(scene.errors).toEqual([]);
      view.destroy();
    });
  }
});
