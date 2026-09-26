import { describe, expect, it } from "vitest";
import civil from "../../../fixtures/civil-rights-mystery.json";
import docConfigs from "../../../tests/world-doc-configs.json";
import { makeDraft } from "../draft-inputs";
import type { Diagnosis, Draft, HintsUsed, PairsView, PoseInput, StaticInput } from "../types";
import {
  cordSag,
  DECOY_DIM_ALPHA,
  decoyDimActive,
  hintNamesDecoy,
  leftJackAt,
  programLine,
  rightJackAt,
  SWITCHBOARD_SKINS,
  switchboardMeta as meta,
  SwitchboardConfig,
  type SwitchboardPose,
} from "./switchboard.meta";

const MODE = "linker.pairs" as const;
const e7 = civil.encounters.find((e) => e.id === "e7_march")!;
const params = e7.params as { pairs: { left: string; right: string; why: string }[]; decoyRights: string[] };
/** The view as pairs.present() builds it: lefts l0… in order; rights r0… + decoy x0, shown shuffled. */
const RIGHT_ORDER = ["r2", "x0", "r0", "r3", "r1"];
const rightText = (k: string) => (k.startsWith("x") ? params.decoyRights[Number(k.slice(1))] : params.pairs[Number(k.slice(1))].right);
const VIEW: PairsView = {
  lefts: params.pairs.map((p, i) => ({ key: `l${i}`, text: p.left })),
  rights: RIGHT_ORDER.map((key) => ({ key, text: rightText(key) })),
};
const CONFIG = SwitchboardConfig.parse(docConfigs.configs.find((c) => c.encounterId === "e7_march")!.config);
const NO_DIM = SwitchboardConfig.parse({ ...CONFIG, decoyDimRung: null });
const SOLUTION = [0, 1, 2, 3].map((i) => ({ leftKey: `l${i}`, rightKey: `r${i}` }));

function draft(links: { leftKey: string; rightKey: string }[], patch: Partial<Draft> = {}): Draft {
  return makeDraft("e7_march", MODE, { links }, patch);
}
function input(d: Draft | null, patch: Partial<PoseInput<SwitchboardConfig>> = {}): PoseInput<SwitchboardConfig> {
  return { view: VIEW, draft: d, config: CONFIG, probe: d?.probe ?? null, t: 1, aidTier: 0, hintsUsed: 0, sim: null, solved: false, reducedMotion: false, ...patch };
}
function staticIn(patch: Partial<StaticInput<SwitchboardConfig>> = {}): StaticInput<SwitchboardConfig> {
  return { view: VIEW, config: CONFIG, aidTier: 0, hintsUsed: 0, reducedMotion: false, skinId: "switchboard", record: true, ...patch };
}
const pose = (i: PoseInput<SwitchboardConfig>): SwitchboardPose => meta.pose(i);
const lamps = (p: SwitchboardPose) => [...p.lefts, ...p.rights].map((j) => j.lamp);
function diag(failKey: Diagnosis["failKey"], wrongKeys: string[]): Diagnosis {
  return { correct: false, feedback: "", displayFeedback: "", failKey, wrongKeys, prefix: null, disclosed: {}, nearMiss: null, probeKeys: [] };
}
const ctx = (view: unknown = VIEW) => ({
  modeKey: MODE,
  encounter: e7 as never,
  params,
  solution: e7.solution,
  view,
  texts: [e7.prompt, ...e7.hints],
  biome: "archive_of_voices",
});

describe("switchboard meta (civil e7)", () => {
  it("the doc's e7 config validates; decoyDimRung needs a hint 3 that names the decoy", () => {
    expect(meta.validateConfig(CONFIG, ctx())).toEqual([]);
    expect(hintNamesDecoy(e7.hints[2], VIEW)).toBe(true);
    const other = { ...e7, hints: [e7.hints[0], e7.hints[1], "Think about who organized the day."] };
    expect(meta.validateConfig(CONFIG, { ...ctx(), encounter: other as never }).map((i) => i.path.join("."))).toContain("decoyDimRung");
    expect(meta.validateConfig(NO_DIM, { ...ctx(), encounter: other as never })).toEqual([]);
  });

  it("seated lamps are WHITE, never cyan, before Verify (every partial and complete draft, right or wrong)", () => {
    const drafts = [
      [],
      SOLUTION.slice(0, 1),
      SOLUTION.slice(0, 3),
      SOLUTION,
      [{ leftKey: "l0", rightKey: "x0" }, { leftKey: "l1", rightKey: "r2" }, { leftKey: "l2", rightKey: "r0" }, { leftKey: "l3", rightKey: "r1" }],
    ];
    for (const links of drafts) {
      for (const hintsUsed of [0, 1, 2] as HintsUsed[]) {
        const p = pose(input(draft(links), { hintsUsed }));
        expect(lamps(p)).not.toContain("cyan");
        expect(p.stepLamps).not.toContain("cyan");
        const seated = new Set(links.flatMap((l) => [l.leftKey, l.rightKey]));
        for (const j of [...p.lefts, ...p.rights]) expect(j.lamp).toBe(seated.has(j.key) ? "white" : "off");
        p.lefts.forEach((j, i) => expect(p.stepLamps[i]).toBe(j.seated ? "white" : "off"));
      }
    }
    // the right and a wrong complete draft look the same apart from which cords exist
    const right = pose(input(draft(SOLUTION)));
    const wrong = pose(input(draft(drafts[4])));
    expect(lamps(right).filter((l) => l === "white").length).toBe(lamps(wrong).filter((l) => l === "white").length);
    expect(meta.describe(right, input(null)).srText).toBe(meta.describe(wrong, input(null)).srText);
    // only the solved pose is cyan
    const solved = meta.solvedPose(input(draft(SOLUTION), { solved: true }));
    expect(lamps(solved).every((l) => l === "cyan")).toBe(true);
    expect(solved.stepLamps.every((l) => l === "cyan")).toBe(true);
    expect(solved).toMatchObject({ steps: 1, printed: true });
    expect(pose(input(draft(SOLUTION), { config: { ...CONFIG, stepLamps: false } })).stepLamps).toEqual([]);
  });

  it("program lines fill by LEFT key: line i is lefts[i] — the role patched to it", () => {
    const links = [{ leftKey: "l2", rightKey: "r0" }, { leftKey: "l0", rightKey: "x0" }];
    const p = pose(input(draft(links)));
    expect(p.lines).toEqual([programLine(params.pairs[0].left, params.decoyRights[0]), null, programLine(params.pairs[2].left, params.pairs[0].right), null]);
    expect(p.title).toBe("MARCH ON WASHINGTON FOR JOBS AND FREEDOM · AUGUST 28, 1963");
    // re-patching a left replaces its line; a jack holds one cord (the later cord wins)
    const q = pose(input(draft([...links, { leftKey: "l2", rightKey: "r2" }, { leftKey: "l3", rightKey: "x0" }])));
    expect(q.lines[2]).toBe(programLine(params.pairs[2].left, params.pairs[2].right));
    expect(q.lines[0]).toBeNull(); // l0's cord to x0 moved to l3
    expect(q.lines[3]).toBe(programLine(params.pairs[3].left, params.decoyRights[0]));
    expect(q.linked).toBe(2);
  });

  it("decoy dim only at hintsUsed = 3 and only when configured", () => {
    for (const hintsUsed of [0, 1, 2, 3] as HintsUsed[]) {
      for (const cfg of [CONFIG, NO_DIM]) {
        for (const aidTier of [0, 1, 2] as const) {
          const p = pose(input(draft(SOLUTION.slice(0, 2)), { hintsUsed, aidTier, config: cfg }));
          const x0 = p.rights.find((r) => r.key === "x0")!;
          const on = hintsUsed === 3 && cfg.decoyDimRung === 3;
          expect(decoyDimActive(cfg, hintsUsed)).toBe(on);
          expect(p.decoyDim).toBe(on);
          expect(x0.lamp).toBe(on ? "dim" : "off");
          expect(x0.alpha).toBe(on ? DECOY_DIM_ALPHA : 1);
          for (const r of p.rights.filter((r) => r.key !== "x0")) expect(r.lamp).not.toBe("dim");
        }
      }
    }
    // before rung 3 the decoy jack is indistinguishable from any other unseated role jack
    const p = pose(input(draft([]), { hintsUsed: 2 }));
    const omit = (o: object) => Object.fromEntries(Object.entries(o).filter(([k]) => !["key", "text", "index", "y"].includes(k)));
    expect(omit(p.rights.find((r) => r.key === "x0")!)).toEqual(omit(p.rights.find((r) => r.key === "r0")!));
  });

  it("jacks sit by index (lefts in view order, rights in display order); cords hang between them", () => {
    const p = pose(input(draft([{ leftKey: "l1", rightKey: "r0" }])));
    p.lefts.forEach((j, i) => expect({ x: j.x, y: j.y }).toEqual(leftJackAt(i, 4)));
    p.rights.forEach((j, i) => {
      expect(j.key).toBe(RIGHT_ORDER[i]);
      expect({ x: j.x, y: j.y }).toEqual(rightJackAt(i, 5));
    });
    const c = p.cords[0];
    expect(c).toMatchObject({ leftKey: "l1", rightKey: "r0", leftIndex: 1, rightIndex: 2, shape: "verlet" });
    expect(c.a).toEqual(leftJackAt(1, 4));
    expect(c.b).toEqual(rightJackAt(2, 5));
    expect(c.sag).toBeCloseTo(cordSag(c.a, c.b), 9);
    // unknown keys are ignored
    expect(pose(input(draft([{ leftKey: "l9", rightKey: "r0" }]))).cords).toEqual([]);
  });

  it("the failure plan unseats wrongKeys[0]'s cord and flickers its jack amber; nothing else acts", () => {
    const links = [{ leftKey: "l0", rightKey: "r0" }, { leftKey: "l1", rightKey: "r1" }, { leftKey: "l2", rightKey: "r0x" }, { leftKey: "l2", rightKey: "r2" }, { leftKey: "l3", rightKey: "x0" }];
    const plan = meta.failurePlan(diag("wrong_link", ["l3"]), input(draft(links)));
    const x0Index = RIGHT_ORDER.indexOf("x0");
    expect(plan.beats[0]).toMatchObject({ anchor: `right_${x0Index}`, action: "unseat", params: { leftKey: "l3", rightKey: "x0" } });
    expect(plan.beats[1]).toMatchObject({ anchor: "left_3", action: "flash", params: { color: "amber" } });
    const acted = plan.beats.filter((b) => b.action === "unseat" || (b.action === "flash" && b.anchor.startsWith("left_")));
    expect(acted.every((b) => b.params?.leftKey === "l3" || b.params?.key === "l3")).toBe(true);
    expect(plan.cue).toBe("relay_click");
    expect(plan.durationMs).toBeGreaterThanOrEqual(600);
    expect(plan.durationMs).toBeLessThanOrEqual(1600);
    expect(meta.failurePlan(diag("incomplete", []), input(draft([]))).beats.some((b) => b.action === "unseat")).toBe(false);
  });

  it("success: lamps turn cyan in sequence, the program prints, the steps rise", () => {
    const plan = meta.successPlan(input(draft(SOLUTION), { solved: true }), "stairs_rise");
    const seq = plan.beats.filter((b) => b.action === "light_sequence");
    expect(seq.map((b) => b.anchor)).toEqual(["left_0", "left_1", "left_2", "left_3"]);
    expect(seq.map((b) => b.atMs)).toEqual([0, 160, 320, 480]);
    expect(plan.beats.some((b) => b.anchor === "sheet" && b.action === "print")).toBe(true);
    expect(plan.beats.find((b) => b.anchor === "steps" && b.action === "rise")!.params).toMatchObject({ anim: "stairs_rise" });
    expect(plan.durationMs).toBeGreaterThanOrEqual(1200);
    expect(plan.durationMs).toBeLessThanOrEqual(2500);
  });

  it("panel: FILE (AUG 28 1963 from the title), the link board, the program document", () => {
    const st = meta.panelStatic(staticIn());
    expect(st.cards.map((c) => [c.kind, c.slot])).toEqual([["timeline", 0], ["link_board", 1], ["document", 2]]);
    const file = st.cards[0];
    if (file.kind !== "timeline") throw new Error("timeline");
    expect(file.pins).toHaveLength(1);
    expect(file.pins[0].at).toBeCloseTo(1963 + 7 / 12 + 27 / 365.25, 6);
    const live = meta.panelLive(st, input(draft(SOLUTION.slice(0, 2), { focus: "l1", probe: 1963.62 })));
    const board = live.liveCards.find((c) => c.kind === "link_board");
    if (!board || board.kind !== "link_board") throw new Error("board");
    expect(board.links).toEqual([{ leftKey: "l0", rightKey: "r0", state: "seated" }, { leftKey: "l1", rightKey: "r1", state: "focus" }]);
    expect(board.rights.map((r) => r.key)).toEqual(RIGHT_ORDER);
    const doc = live.liveCards.find((c) => c.kind === "document");
    if (!doc || doc.kind !== "document") throw new Error("document");
    expect(doc.body.split("\n")[0]).toBe(`1. ${programLine(params.pairs[0].left, params.pairs[0].right)}`);
    expect(doc.body.split("\n")[2]).toBe("3. …");
    expect(doc.stamp).toBeNull();
    expect(live.chips.map((c) => c.text)).toContain("2 / 4 CORDS");
    expect(live.chips[0].text).toContain("AUG 1963");
    expect(live.readout).toBe("AUG 1963");
    expect(live.highlights).toContainEqual({ slot: 1, key: "l1", state: "focus" });
    // without a record or a dated title, the board is slot 0
    expect(meta.panelStatic(staticIn({ record: false, config: { ...CONFIG, document: null } })).cards.map((c) => [c.kind, c.slot])).toEqual([["link_board", 0]]);
  });

  it("describe: jack chips by index, the sheet's line count; hint targets and skin anchors agree", () => {
    const p = pose(input(draft(SOLUTION.slice(0, 3))));
    const d = meta.describe(p, input(null));
    expect(d.chips.find((c) => c.anchor === "left_0")!.text).toBe(params.pairs[0].left);
    expect(d.chips.find((c) => c.anchor === "right_1")!.text).toBe(params.decoyRights[0]);
    expect(d.chips.find((c) => c.anchor === "sheet")!.text).toBe("3 / 4 LINES");
    expect(d.srText).toBe("3 of 4 cords seated; their jack lamps glow white.");
    const skin = SWITCHBOARD_SKINS[0];
    expect(skin.parts.map((x) => x.slot)).toContain("steps");
    for (const rung of skin.hintTargets) for (const h of rung) expect(skin.anchors).toContain(h.anchor);
    expect(meta.hintTargets(1, staticIn())[0]).toMatchObject({ anchor: "sheet", action: "circle" });
    expect(meta.hintTargets(2, staticIn())[0]).toMatchObject({ anchor: "left_0", action: "land" });
    expect(meta.lerp(p, pose(input(draft(SOLUTION))), 0.1).linked).toBe(4); // discrete fields land at once
    expect(meta.debug(p)).toMatchObject({ linked: 3, white: 6, cyan: 0 });
  });
});
