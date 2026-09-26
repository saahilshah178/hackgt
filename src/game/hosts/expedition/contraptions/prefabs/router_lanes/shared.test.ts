import { describe, expect, it } from "vitest";
import cellFixture from "../../../../../../../fixtures/cell-transport-dungeon.json";
import docConfigs from "../../../../../../../tests/world-doc-configs.json";
import { RouterLanesConfig, routerLanesMeta as meta, queueX, type RouterLanesPose } from "@/world/contraptions/router-lanes.meta";
import type { BinsView, Diagnosis, Draft, PoseInput } from "@/world/types";
import type { PrefabProps } from "../../types";
import { SKINS } from "./skins";
import { ITEM_FX_MS, itemFxOffset, itemTarget, passProgress, phasedPose, routeFail, routeSuccess } from "./shared";

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
  return { scene: scene as unknown as Parameters<(typeof SKINS)["membrane_router"]["create"]>[0] & { errors: string[] }, flush };
}

// ---------------------------------------------------------------- fixtures

type Enc = { id: string; params: { bins: { id: string; label: string }[]; items: { text: string; binId: string }[] } };
const enc = (id: string) => (cellFixture.encounters as unknown as Enc[]).find((e) => e.id === id)!;
const viewOf = (e: Enc): BinsView => ({ bins: e.params.bins.map((b) => ({ id: b.id, label: b.label })), items: e.params.items.map((it, i) => ({ key: `i${i}`, text: it.text })) });
const configOf = (id: string) =>
  RouterLanesConfig.parse((docConfigs as { configs: { archetype: string; encounterId: string | null; config: unknown }[] }).configs.find((c) => c.archetype === "router_lanes" && c.encounterId === id)!.config);
const sol = (e: Enc) => e.params.items.map((it, i) => ({ itemKey: `i${i}`, binId: it.binId }));
const PHASES = [
  { id: "p1", itemKeys: ["i0", "i1"] },
  { id: "p2", itemKeys: ["i2", "i3"] },
  { id: "p3", itemKeys: ["i4", "i5", "i6"] },
];
const STATIONS = {
  membrane_router: { e: enc("e2_selectivity"), config: configOf("e2_selectivity"), anchor: { x: 6700, y: 983 }, consoleX: 6300, blocker: 6640, anim: "ramp_forms", boss: null },
  carrier_lanes: { e: enc("e6_facilitated"), config: configOf("e6_facilitated"), anchor: { x: 7900, y: 1213 }, consoleX: 7500, blocker: 7800, anim: "door_carries", boss: null },
  gatekeeper_maws: { e: enc("e11_boss"), config: configOf("e11_boss"), anchor: { x: 4200, y: 1113 }, consoleX: 3800, blocker: 4450, anim: "vault_opens", boss: { phases: PHASES } },
} as const;
type SkinId = keyof typeof STATIONS;

function draftOf(assignments: readonly { itemKey: string; binId: string }[], extra: Partial<Draft> = {}): Draft {
  return { encounterId: "x", modeKey: "sorter.bins", input: { assignments }, complete: false, focus: null, hover: null, probe: null, settled: true, wave: null, marks: null, seq: 1, ...extra };
}
function input(id: SkinId, draft: Draft | null): PoseInput<RouterLanesConfig, null> {
  const s = STATIONS[id];
  return { view: viewOf(s.e), draft, config: s.config, probe: null, t: 1, aidTier: 1, hintsUsed: 0, sim: null, solved: false, reducedMotion: false };
}
function diagnosis(over: Partial<Diagnosis>): Diagnosis {
  return { correct: false, feedback: "", displayFeedback: "", failKey: "wrong_bin", wrongKeys: [], prefix: null, disclosed: {}, nearMiss: null, probeKeys: [], ...over };
}
function propsOf(id: SkinId, reducedMotion = false): PrefabProps<RouterLanesConfig> {
  const s = STATIONS[id];
  return {
    station: {
      encounterId: s.e.id,
      anchor: s.anchor,
      consoleX: s.consoleX,
      skin: id,
      boss: s.boss,
      payoff: { kind: "remove_blocker", anim: s.anim, blocker: { x: s.blocker, surface: "ground", asset: null } },
    } as unknown as PrefabProps<RouterLanesConfig>["station"],
    config: s.config,
    encounter: s.e as never,
    view: viewOf(s.e),
    groundY: s.anchor.y,
    palette: { "mol.na": "#EE8A9A", "stone.base": "#F2E3C6", bogus: "nope" },
    fx: { dormancy: () => {} } as unknown as PrefabProps<RouterLanesConfig>["fx"],
    tex: () => {
      throw new Error("no art yet");
    },
    anchorsOf: () => ({}),
    seed: 7,
    reducedMotion,
  };
}

// ---------------------------------------------------------------- pure helpers

describe("router_lanes prefab · pure helpers", () => {
  it("queued cargo lines up above its lane's mouth by the queue formula; drifting cargo keeps the tide + the skin offset", () => {
    const lanes = [{ mouth: { x: -300, y: -10 }, queueY: -90 }, { mouth: { x: 200, y: -150 }, queueY: -120 }];
    expect(itemTarget({ lane: 1, q: 0, n: 3, x: 9, y: 9 }, lanes, { x: 0, y: -100 })).toEqual({ x: queueX(200, 0, 3), y: -120 });
    expect(queueX(200, 0, 3)).toBe(200 - 56);
    expect(itemTarget({ lane: null, q: 0, n: 0, x: 40, y: -300 }, lanes, { x: 10, y: -100 })).toEqual({ x: 50, y: -400 });
    expect(itemTarget({ lane: 7, q: 0, n: 1, x: 40, y: -300 }, lanes, { x: 0, y: 0 })).toEqual({ x: 40, y: -300 }); // unknown lane
  });

  it("the boss batches: the drawn pose hides later batches until the previous batch is placed", () => {
    const e = STATIONS.gatekeeper_maws.e;
    const p0 = phasedPose(meta.pose(input("gatekeeper_maws", null)), PHASES);
    expect(p0.items.filter((i) => i.visible).map((i) => i.key)).toEqual(["i0", "i1"]);
    const p1 = phasedPose(meta.pose(input("gatekeeper_maws", draftOf(sol(e).slice(0, 2)))), PHASES);
    expect(p1.items.filter((i) => i.visible).map((i) => i.key)).toEqual(["i0", "i1", "i2", "i3"]);
    const all = phasedPose(meta.pose(input("gatekeeper_maws", draftOf(sol(e)))), PHASES);
    expect(all.items.every((i) => i.visible)).toBe(true);
    expect(all.complete).toBe(true);
  });

  it("routeFail moves only what the plan names: wrongKeys[0]'s cargo (and its lane), never another item", () => {
    const e11 = STATIONS.gatekeeper_maws.e;
    const wrong = sol(e11).map((a) => (a.itemKey === "i0" ? { ...a, binId: "active" } : a));
    const plan = meta.failurePlan(diagnosis({ wrongKeys: ["i0", "i3"], disclosed: { bin: "simple" } }), input("gatekeeper_maws", draftOf(wrong)));
    const r = routeFail(plan);
    expect(new Set(r.items.map((i) => i.key))).toEqual(new Set(["i0"]));
    expect(r.items[0]!.kind).toBe("spit_back");
    expect(r.shake).toEqual({ px: 4, ms: 200, atMs: 120 });
    expect(r.lanes.map((l) => l.index)).toEqual([2]); // the pump maw it was put in flashes
    const r6 = routeFail(meta.failurePlan(diagnosis({ wrongKeys: ["i0"] }), input("carrier_lanes", draftOf([{ itemKey: "i0", binId: "active" }]))));
    expect(r6.lanes).toEqual([{ index: 1, kind: "spark", atMs: 0 }]);
    expect(r6.items.map((i) => [i.key, i.kind])).toEqual([["i0", "eject"]]);
    expect(r6.shake).toBeNull();
    const inc = routeFail(meta.failurePlan(diagnosis({ failKey: "incomplete" }), input("membrane_router", draftOf([]))));
    expect(inc).toEqual({ items: [], lanes: [], console: 0, shake: null });
  });

  it("routeSuccess: every cargo passes by its lane's physics, maws swallow, then the payoff", () => {
    const e11 = STATIONS.gatekeeper_maws.e;
    const plan = meta.successPlan({ ...input("gatekeeper_maws", draftOf(sol(e11))), solved: true }, "vault_opens");
    const r = routeSuccess(plan);
    expect(r.passes.map((p) => p.key).sort()).toEqual(["i0", "i1", "i2", "i3", "i4", "i5", "i6"]);
    expect(r.passes.filter((p) => p.spark).map((p) => p.key).sort()).toEqual(["i2", "i5"]); // only the pump maw sparks
    expect(r.lanes.length).toBe(7);
    expect(r.payoffAtMs).not.toBeNull();
  });

  it("failure motions return the cargo to its slot; passes travel then fade", () => {
    for (const k of ["bounce", "spit_back", "eject", "sink", "flash"] as const) {
      const end = itemFxOffset(k, 1, 1);
      expect(Math.abs(end.dx) + Math.abs(end.dy) + Math.abs(end.rot)).toBeLessThan(1e-9);
      if (k !== "sink") expect(itemFxOffset(k, 0, -1).dy).toBeCloseTo(0, 9);
    }
    expect(itemFxOffset("bounce", 0.2).dy).toBeGreaterThan(0); // toward the heads
    expect(itemFxOffset("spit_back", 0.5).dy).toBeLessThan(-100); // shot back up
    expect(itemFxOffset("stall", 1).dy).toBeCloseTo(itemFxOffset("sink", 0).dy, 1); // the sink starts where the stall ends
    expect(Math.max(...Object.values(ITEM_FX_MS))).toBeLessThanOrEqual(1600);
    expect(passProgress(0)).toEqual({ travel: 0, alpha: 1 });
    expect(passProgress(0.6)).toEqual({ travel: 1, alpha: 1 });
    expect(passProgress(1)).toEqual({ travel: 1, alpha: 0 });
  });
});

// ---------------------------------------------------------------- the PoseView against a mock scene

describe("router_lanes prefab · the cell skins build, pose, fail and succeed", () => {
  for (const id of Object.keys(STATIONS) as SkinId[]) {
    it(`${id}: exposes every skin anchor plus lane_i, item_<key>, energy and payoff; plays both plans without throwing`, async () => {
      const { scene, flush } = mockScene();
      const props = propsOf(id);
      const view = SKINS[id].create(scene, {} as never, props);
      const skin = meta.skins.find((s) => s.id === id)!;
      const e = STATIONS[id].e;
      const d = draftOf(sol(e).slice(0, 3), { focus: sol(e)[0]!.itemKey });
      const pose: RouterLanesPose = meta.pose(input(id, d));
      view.setState("active");
      view.applyPose(pose);
      for (let i = 0; i < 5; i++) view.update?.(16);
      for (const a of skin.anchors) expect(view.anchors, `${id} anchor ${a}`).toHaveProperty(a);
      STATIONS[id].config.lanes.forEach((_, i) => expect(view.anchors).toHaveProperty(`lane_${i}`));
      for (const it of pose.items.filter((i) => i.visible)) expect(view.anchors).toHaveProperty(`item_${it.key}`);
      expect(view.anchors).toHaveProperty("energy");
      expect(view.anchors).toHaveProperty("payoff");
      expect(view.anchors.console).toEqual({ x: STATIONS[id].consoleX - STATIONS[id].anchor.x, y: 0 });
      // hover the whole describe() chip set: every chip anchor exists on the view
      for (const chip of meta.describe(pose, input(id, d)).chips) expect(view.anchors, chip.anchor).toHaveProperty(chip.anchor);
      const first = sol(e)[0]!;
      const moved = sol(e).map((a) => (a.itemKey === first.itemKey ? { ...a, binId: STATIONS[id].config.lanes.find((l) => l.binId !== a.binId)!.binId } : a));
      const failPose = meta.pose(input(id, draftOf(moved)));
      view.applyPose(failPose);
      const failing = view.playFail(meta.failurePlan(diagnosis({ wrongKeys: [first.itemKey] }), input(id, draftOf(moved))), failPose);
      flush(2000, (ms) => view.update?.(ms));
      await failing;
      const solved = meta.solvedPose({ ...input(id, draftOf(sol(e))), solved: true });
      const succeeding = view.playSucceed(meta.successPlan({ ...input(id, draftOf(sol(e))), solved: true }, STATIONS[id].anim), solved);
      flush(3000, (ms) => view.update?.(ms));
      await succeeding;
      view.applyPose(solved);
      view.update?.(16);
      expect(scene.errors).toEqual([]);
      view.destroy();
    });
  }

  it("gatekeeper_maws: the pupil tracks the focused cargo and a new active cargo sends a packet down the pipe", () => {
    const { scene } = mockScene();
    const view = SKINS.gatekeeper_maws.create(scene, {} as never, propsOf("gatekeeper_maws", true));
    view.applyPose(meta.pose(input("gatekeeper_maws", draftOf([], { focus: "i0" }))));
    view.update?.(16);
    const at0 = view.anchors.item_i0!;
    const eye = view.anchors.eye!;
    expect(at0).toBeDefined();
    expect(Math.hypot(at0.x - eye.x, at0.y - eye.y)).toBeGreaterThan(0);
    view.applyPose(meta.pose(input("gatekeeper_maws", draftOf([{ itemKey: "i2", binId: "active" }]))));
    view.update?.(16);
    expect(scene.errors).toEqual([]);
  });
});
