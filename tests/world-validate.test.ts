/**
 * validateWorld (docs/design/20 §1.5, §8.1): the three side-cars have zero errors against their fixture specs, and
 * every rule R1–R16 and W1–W3 has at least one negative test. Negatives mutate a small synthetic world that is
 * clean against the fixture spec (so these tests do not depend on the side-cars' content lanes).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Issue } from "../src/contracts/common";
import { GameSpec } from "../src/contracts/gamespec";
import { WorldFile, WorldOverlay, type WorldOverlayInput } from "../src/contracts/world";
import { validateGameSpec, ownerFor } from "../src/pipeline/validate/validate-gamespec";
import type { AssetIndex } from "../src/world/asset-index/index";
import { configCtxFor, CONTRAPTION_LIBRARY } from "../src/world/library";
import { expandAnchors, namesIn, validateWorld, worldOwnerFor, type ValidateWorldOptions } from "../src/world/validate-world";
import { WORLD_RULE_IDS } from "../src/world/types";

const load = (f: string) => GameSpec.parse(JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", `${f}.json`), "utf8")));
const trig = load("trig-dungeon");
const cell = load("cell-transport-dungeon");
const civil = load("civil-rights-mystery");

// ---------------------------------------------------------------- a clean synthetic world for any spec

type Mutable = WorldOverlayInput & Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function baseWorld(spec: GameSpec, biome = "orrery_terraces"): Mutable {
  const guide = spec.characters[0]!.id;
  const boss = spec.characters[spec.characters.length - 1]!.id;
  const n = spec.encounters.length;
  const width = Math.max(1920, 1000 + n * 900);
  const k = (g: string, name: string) => `${biome}.${g}.${name}`;
  return {
    worldVersion: 2,
    biome,
    title: "Test World",
    cast: {
      protagonist: { name: "Wren", look: { atlas: "shared.char.wren" } },
      guide: { characterId: guide, emblem: { glyph: "owl", ring: "#C69A6B", accent: "#8FE0EA" }, companion: { asset: k("companion", "guide") } },
    },
    story: {
      logline: "Wake the machines.",
      objective: "Wake the machines",
      objectiveLabel: "MACHINES",
      restoredNoun: "machine",
      introCutsceneId: "intro",
      finaleCutsceneId: "finale",
    },
    zones: [
      {
        id: "z1",
        name: "Zone One",
        width,
        height: 1600,
        layerSets: [{ id: "ls", layers: [0, 1, 2].map((i) => ({ asset: k("layer", `l${i}`), depth: "L1_far", scrollFactor: 0.15, y: 400 })) }],
        segments: [{ id: "seg", x0: 0, x1: width, layerSet: "ls", sky: { stops: [{ at: 0, color: "#000000" }, { at: 0.5, color: "#111111" }, { at: 1, color: "#222222" }], haze: { color: "#FFFFFF", alpha: 0.2 } }, ambient: { light: "day" } }],
        ground: { points: [[0, 1200], [width, 1200]], surface: k("ground", "base") },
        platforms: [{ id: "ledge", points: [[100, 900], [400, 900]] }],
        links: [
          { kind: "hop", id: "hop1", from: { x: 100 }, to: { surface: "ledge", x: 200 } },
          { kind: "climb", id: "climb1", from: { x: 300 }, to: { surface: "ledge", x: 320 } },
        ],
        entry: { x: 50 },
      },
    ],
    stations: spec.encounters.map((e, i) => {
      const x = 1000 + i * 900;
      return {
        encounterId: e.id,
        zoneId: "z1",
        consoleX: x,
        anchor: { x: x + 300, y: 1100 },
        contraption: "console_slate",
        skin: "lectern_slate",
        objectNoun: "Test Gate",
        panel: { verifyLabel: "VERIFY", successBadge: "DONE" },
        dialogue: {
          instruction: { text: "Work the console to open the Test Gate." },
          fail: { default: { text: "Not yet. Look again." } },
          success: { text: "It opens." },
        },
        payoff: { kind: "terrain", vertical: "up", anim: "stairs_rise", noun: "stair", blocker: { x: x + 200 }, terrain: [{ points: [[x + 200, 1100], [x + 400, 1100]] }] },
        boss: i === n - 1 ? { speakerId: boss, arenaTriggerX: x - 300 } : null,
      };
    }),
    cutscenes: [
      { id: "intro", steps: [{ do: "title", text: "Test", ms: 100 }] },
      { id: "finale", skippable: false, steps: [{ do: "fade", to: "black", ms: 100 }] },
    ],
  } as Mutable;
}

function run(spec: GameSpec, w: Mutable, opts: ValidateWorldOptions = {}) {
  return validateWorld(spec, WorldOverlay.parse(w), { sidecar: true, ...opts });
}
const rules = (xs: readonly Issue[]) => [...new Set(xs.map((i) => i.message.split(":")[0]))];
function expectIssue(xs: readonly Issue[], rule: string, re?: RegExp) {
  const hit = xs.filter((i) => i.message.startsWith(`${rule}:`) && (!re || re.test(i.message)));
  expect(hit, `expected a ${rule}${re ? ` ${re}` : ""} in:\n${xs.map((i) => i.message).join("\n")}`).not.toHaveLength(0);
  return hit;
}
const st = (w: Mutable, i: number): Any => (w.stations as Any[])[i];
const zone = (w: Mutable, i = 0): Any => (w.zones as Any[])[i];

describe("the synthetic base worlds are clean", () => {
  for (const [name, spec, biome] of [["trig", trig, "orrery_terraces"], ["cell", cell, "living_gate"]] as const) {
    it(name, () => {
      const r = run(spec, baseWorld(spec, biome));
      expect(r.issues.map((i) => `${i.path.join(".")} ${i.message}`)).toEqual([]);
      // only "art not built yet" asset warnings remain
      expect(rules(r.warnings).filter((x) => x !== "R1")).toEqual([]);
    });
  }
});

describe("the three side-cars have zero errors against their fixture specs", () => {
  for (const [file, fixtures] of [
    ["trig", ["trig-dungeon", "trig-platformer"]],
    ["cell-transport", ["cell-transport-dungeon"]],
    ["civil-rights", ["civil-rights-mystery", "civil-rights-dungeon"]],
  ] as const) {
    for (const fx of fixtures) {
      it(`${file}.world.json × ${fx}`, () => {
        const wf = WorldFile.parse(JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "worlds", `${file}.world.json`), "utf8")));
        const r = validateWorld(load(fx), wf.world, { sidecar: true });
        expect(r.issues.map((i) => `${i.path.join(".")} ${i.message}`)).toEqual([]);
      });
    }
  }
});

describe("one negative test per rule", () => {
  it("R1: namespace, missing key in a built namespace, group and puppet anims", () => {
    const w = baseWorld(trig);
    zone(w).layerSets[0].layers[0].asset = "living_gate.layer.far";
    expectIssue(run(trig, w).issues, "R1", /namespace "living_gate"/);
    const index: AssetIndex = {
      "orrery_terraces.companion.guide": { ns: "orrery_terraces", kind: "puppet", width: 100, height: 100, anchors: {}, source: "hero", zone: "all", anims: ["idle", "talk"] },
    };
    const r = run(trig, baseWorld(trig), { assetIndex: index });
    expectIssue(r.issues, "R1", /lacks anims cue/); // a companion without `cue`
    expectIssue(r.issues, "R1", /not in the asset index/);
    const w2 = baseWorld(trig);
    (w2.cast as Any).guide.companion.asset = "orrery_terraces.prop.guide";
    expectIssue(run(trig, w2).issues, "R1", /group "companion"/);
    const w3 = baseWorld(trig);
    w3.biome = "atlantis";
    expectIssue(run(trig, w3).issues, "R1", /BIOME_KITS/);
  });
  it("R1: an unbuilt namespace only warns", () => {
    const r = run(trig, baseWorld(trig));
    expectIssue(r.warnings, "R1", /not indexed yet/);
  });
  it("R2: unknown speaker, extras colliding with a character id", () => {
    const w = baseWorld(trig);
    st(w, 0).dialogue.fail.default.speakerId = "ghost";
    expectIssue(run(trig, w).issues, "R2", /unknown speaker "ghost"/);
    const w2 = baseWorld(trig);
    (w2.cast as Any).extras = [{ id: "cog", name: "Cog Two", role: "twin", voiceArchetype: "narrator", emblem: { glyph: "owl", ring: "#000000", accent: "#FFFFFF" } }];
    expectIssue(run(trig, w2).issues, "R2", /collides with a spec character/);
  });
  it("R3: segments must cover the zone", () => {
    const w = baseWorld(trig);
    zone(w).segments[0].x1 = 1000;
    expectIssue(run(trig, w).issues, "R3", /segments end at 1000/);
    const w2 = baseWorld(trig);
    zone(w2).exits = [{ id: "out", x: 100, toZoneId: "nowhere", toX: 0 }];
    expectIssue(run(trig, w2).issues, "R3", /unknown zone "nowhere"/);
  });
  it("R4: unknown encounter and out-of-order stations", () => {
    const w = baseWorld(trig);
    st(w, 0).encounterId = "e99_unknown";
    expectIssue(run(trig, w).issues, "R4", /unknown encounter/);
    const w2 = baseWorld(trig);
    [st(w2, 1).consoleX, st(w2, 2).consoleX] = [st(w2, 2).consoleX, st(w2, 1).consoleX];
    expectIssue(run(trig, w2).issues, "R4", /must come after/);
  });
  it("R5: contraption without the mode, bad skin, config failure, fail/taunt keys, probe refs", () => {
    const w = baseWorld(trig);
    st(w, 0).contraption = "ring_gate"; // e1 is mapper.number_line
    st(w, 0).skin = "vesper_dial";
    expectIssue(run(trig, w).issues, "R5", /does not play mapper.number_line/);
    const w2 = baseWorld(trig);
    st(w2, 1).skin = "vesper_dial";
    expectIssue(run(trig, w2).issues, "R5", /not a skin of "console_slate"/);
    const w3 = baseWorld(trig);
    st(w3, 1).config = { bogus: 1 };
    expectIssue(run(trig, w3).issues, "R5", /config:/);
    const w4 = baseWorld(trig);
    st(w4, 1).dialogue.fail.byKey = [{ key: "nope", line: { text: "No." } }];
    expectIssue(run(trig, w4).issues, "R5", /fail key "nope"/);
    st(w4, 1).dialogue.fail.byKey = [{ key: "over", line: { text: "Too far." } }]; // a legal fail key
    expect(run(trig, w4).issues.filter((i) => /fail key/.test(i.message))).toEqual([]);
    const w5 = baseWorld(trig);
    st(w5, 5).boss.taunts = { byKey: [{ key: "nope", line: { speakerId: "warden", text: "Ha." } }] };
    expectIssue(run(trig, w5).issues, "R5", /taunt key "nope"/);
    // a type_match probe w9 on a 5-wave view (cell e5)
    const w6 = baseWorld(cell, "living_gate");
    const e5 = cell.encounters.findIndex((e) => e.id === "e5_tonicity");
    st(w6, e5).probes = [{ predicate: "assignedTo", itemKey: "w9", binId: "hypertonic", key: "w9_hyper" }];
    expectIssue(run(cell, w6).issues, "R5", /w0…w4 \(5 waves\)/);
    st(w6, e5).probes = [{ predicate: "assignedTo", itemKey: "w4", binId: "hypertonic", key: "w4_hyper" }];
    expect(run(cell, w6).issues.filter((i) => i.message.startsWith("R5"))).toEqual([]);
  });
  it("R6: payoff kind, empty terrain without a gating link, blocker placement", () => {
    const w = baseWorld(trig);
    st(w, 0).payoff.kind = "ride";
    expectIssue(run(trig, w).issues, "R6", /must be "terrain"/);
    const w2 = baseWorld(trig);
    st(w2, 1).payoff.terrain = [];
    expectIssue(run(trig, w2).issues, "R6", /empty terrain payoff/);
    zone(w2).links.push({ kind: "ladder", id: "lad", from: { x: st(w2, 1).consoleX + 150 }, to: { x: st(w2, 1).consoleX + 160 }, requires: { solved: "e2_period" } });
    expect(run(trig, w2).issues.filter((i) => /empty terrain/.test(i.message))).toEqual([]);
    const w3 = baseWorld(trig);
    st(w3, 0).payoff.blocker.x = st(w3, 0).consoleX - 10;
    expectIssue(run(trig, w3).issues, "R6", /blocker x/);
  });
  it("R7: missing cutscene references, interactive steps, ride toSurface", () => {
    const w = baseWorld(trig);
    (w.story as Any).introCutsceneId = "missing";
    expectIssue(run(trig, w).issues, "R7", /unknown cutscene "missing"/);
    const w2 = baseWorld(trig);
    (w2.cutscenes as Any[])[1].steps.push({ do: "control_until", x: 100 });
    expectIssue(run(trig, w2).issues, "R7", /unskippable/);
    const w3 = baseWorld(trig);
    (w3.cutscenes as Any[])[0].steps.push({ do: "ride", vehicle: "orrery_terraces.prop.gondola", toZoneId: "z1", toX: 150, toSurface: "roof", ms: 100 });
    expectIssue(run(trig, w3).issues, "R7", /"roof" is not a surface/);
  });
  it("R8: station texts may not state the answer (token-boundary matcher)", () => {
    const w = baseWorld(trig);
    st(w, 1).dialogue.instruction.text = "Set the timer on the console to π.";
    expectIssue(run(trig, w).issues, "R8", /e2_period/);
    const w2 = baseWorld(trig);
    st(w2, 5).dialogue.approach = [{ speakerId: "cog", text: "Its swing takes 4 seconds." }];
    expectIssue(run(trig, w2).issues, "R8", /e6_boss/);
    const w3 = baseWorld(trig);
    st(w3, 1).dialogue.approach = [
      { speakerId: "cog", text: "The Tidewheel Gate. Its ring runs on y = sin(2t). It must lap once and lock, or the canals stay dry." },
      { speakerId: "cog", text: "Those rings spin on a sine wave. Watch how fast, not how far." },
    ];
    st(w3, 5).dialogue.approach = [{ speakerId: "cog", text: "The bridge is 40 spans long." }];
    expect(run(trig, w3).issues.filter((i) => i.message.startsWith("R8"))).toEqual([]);
    // exempt: success lines may state the answer
    const w4 = baseWorld(trig);
    st(w4, 1).dialogue.success.text = "One lap takes π.";
    expect(run(trig, w4).issues.filter((i) => i.message.startsWith("R8"))).toEqual([]);
    // world-scoped texts warn unless their requirement implies the station solved
    const w5 = baseWorld(trig);
    w5.triggers = [{ id: "t1", zoneId: "z1", x: 100, lines: [{ speakerId: "cog", text: "The answer is π." }] }];
    expectIssue(run(trig, w5).warnings, "R8");
    (w5.triggers as Any[])[0].requires = { solved: "e2_period" };
    expect(run(trig, w5).warnings.filter((i) => i.message.startsWith("R8") && /e2_period/.test(i.message))).toEqual([]);
  });
  it("R9: > 140 characters, instruction noun, verify label", () => {
    const w = baseWorld(trig);
    st(w, 0).dialogue.fail.default.text = "x".repeat(141);
    expectIssue(run(trig, w).issues, "R9", /141 characters/);
    const w2 = baseWorld(trig);
    st(w2, 0).dialogue.instruction.text = "Do the thing.";
    expectIssue(run(trig, w2).issues, "R9", /must name/);
    const w3 = baseWorld(trig);
    st(w3, 0).panel.verifyLabel = "lock it";
    expectIssue(run(trig, w3).issues, "R9", /caps/);
    const w4 = baseWorld(trig);
    st(w4, 0).dialogue.fail.default.text = Array(26).fill("word").join(" ");
    expectIssue(run(trig, w4).warnings, "R9", /26 words/);
    expectIssue(validateWorld(trig, WorldOverlay.parse(w4)).issues, "R9", /26 words/); // World Writer output: an error
  });
  it("R10: sensitive kit: real names, violent plain plaques, cheering, fictional staff", () => {
    const w = baseWorld(civil, "archive_of_voices");
    w.npcs = [
      { id: "rosa", name: "Rosa Parks", speakerId: "archivist", look: { atlas: "shared.char.nell" }, states: [{ id: "s", zoneId: "z1", x: 100, lines: [{ speakerId: "archivist", text: "Hello." }] }] },
      { id: "hal", name: "Hal", speakerId: "archivist", look: { atlas: "shared.char.wren" }, states: [{ id: "s", zoneId: "z1", x: 200, pose: "cheer", lines: [{ speakerId: "archivist", text: "Hi." }] }] },
    ];
    w.plaques = [{ id: "p1", zoneId: "z1", x: 300, asset: "archive_of_voices.doc.plate", title: "Anniston", text: "The bus was firebombed.", kind: "plaque" }];
    const r = run(civil, w);
    expectIssue(r.issues, "R10", /matches a real person/);
    expectIssue(r.issues, "R10", /describes violence/);
    expectIssue(r.issues, "R10", /cheers/);
    expectIssue(r.issues, "R10", /fictional staff/);
    const w2 = baseWorld(civil, "archive_of_voices");
    w2.plaques = [{ id: "p1", zoneId: "z1", x: 300, asset: "archive_of_voices.doc.plate", title: "Anniston", text: "The bus was firebombed.", kind: "photo_withheld" }];
    expect(run(civil, w2).issues.filter((i) => i.message.startsWith("R10"))).toEqual([]);
  });
  it("R10: names are extracted from the spec texts", () => {
    expect(namesIn("On December 1, Rosa Parks refused; Martin Luther King Jr. spoke.")).toEqual(expect.arrayContaining(["Rosa Parks", "Martin Luther King Jr"]));
  });
  it("R11: a link may not bypass an unsolved blocker; ladders are vertical", () => {
    const w = baseWorld(trig);
    const b = st(w, 0).payoff.blocker.x;
    zone(w).links.push({ kind: "hop", id: "cheat", from: { x: b - 50 }, to: { x: b + 50 } });
    expectIssue(run(trig, w).issues, "R11", /crosses the blocker of "e1_radians"/);
    (zone(w).links as Any[]).at(-1).requires = { solved: "e1_radians" };
    expect(run(trig, w).issues.filter((i) => i.message.startsWith("R11"))).toEqual([]);
    const w2 = baseWorld(trig);
    zone(w2).links.push({ kind: "ladder", id: "lean", from: { x: 100 }, to: { surface: "ledge", x: 300 } });
    expectIssue(run(trig, w2).issues, "R11", /ladder/);
    const w3 = baseWorld(trig);
    zone(w3).links.push({ kind: "hop", id: "air", from: { x: 100 }, to: { surface: "ledge", x: 900 } });
    expectIssue(run(trig, w3).issues, "R11", /outside surface "ledge"/);
  });
  it("R11: a sheer edge between consoles without a link warns", () => {
    const w = baseWorld(trig);
    const [a, b] = [st(w, 0).consoleX, st(w, 1).consoleX];
    const mid = (a + b) / 2 + 300; // past e1's payoff terrain
    zone(w).ground.points = [[0, 1200], [mid, 1200], [mid + 4, 1400], [zone(w).width, 1400]];
    expectIssue(run(trig, w).warnings, "R11", /sheer edge/);
  });
  it("R12: undeclared flags, unknown NpcState.anim, npc look xor asset, quest refs", () => {
    const w = baseWorld(trig);
    w.triggers = [{ id: "t1", zoneId: "z1", x: 100, lines: [{ speakerId: "cog", text: "Hm." }], requires: { flag: "never_set" } }];
    expectIssue(run(trig, w).issues, "R12", /flag "never_set" is never set/);
    (w.triggers as Any[]).push({ id: "t2", zoneId: "z1", x: 200, lines: [{ speakerId: "cog", text: "Ok." }], setFlag: "never_set" });
    expect(run(trig, w).issues.filter((i) => i.message.startsWith("R12"))).toEqual([]);
    const w2 = baseWorld(trig);
    w2.npcs = [{ id: "bot", name: "Bot", speakerId: "cog", asset: "orrery_terraces.npc.bot", states: [{ id: "s", zoneId: "z1", x: 100, anim: "arm_sync", lines: [{ speakerId: "cog", text: "Beep." }] }] }];
    const index: AssetIndex = { "orrery_terraces.npc.bot": { ns: "orrery_terraces", kind: "puppet", width: 10, height: 10, anchors: {}, source: "hero", zone: "all", anims: ["idle", "talk"] } };
    expectIssue(run(trig, w2, { assetIndex: index }).issues, "R12", /"arm_sync" is not an anim/);
    const w3 = baseWorld(trig);
    w3.npcs = [{ id: "both", name: "Both", speakerId: "cog", states: [{ id: "s", zoneId: "z1", x: 100, lines: [{ speakerId: "cog", text: "?" }] }] }];
    expectIssue(run(trig, w3).issues, "R12", /exactly one of look and asset/);
    const w4 = baseWorld(trig);
    w4.quests = [{ id: "q", title: "Q", steps: [{ kind: "touch", propIds: ["nothing"] }], reward: { flag: "q_done" } }];
    expectIssue(run(trig, w4).issues, "R12", /no touch block/);
  });
  it("R13: the meter never decreases; record-strip pins need dates in the texts", () => {
    const w = baseWorld(trig);
    (w.story as Any).meter = { id: "m", label: "RHYTHM", unit: "percent", start: 0, perEncounter: [{ encounterId: "e1_radians", value: 50 }, { encounterId: "e2_period", value: 40 }] };
    expectIssue(run(trig, w).issues, "R13", /must not decrease/);
    const w2 = baseWorld(civil, "archive_of_voices");
    (w2.story as Any).recordStrip = { lanes: [{ id: "law", label: "LAW" }], pins: [{ encounterId: "e1_brown", pin: { date: "1901", precision: "year", label: "x", lane: "law" } }] };
    expectIssue(run(civil, w2).issues, "R13", /pin date 1901/);
    (w2.story as Any).recordStrip.pins[0].pin.date = "1954";
    expect(run(civil, w2).issues.filter((i) => i.message.startsWith("R13"))).toEqual([]);
    const w3 = baseWorld(trig);
    w3.feedbackNouns = [{ from: "zeppelin", to: "blimp" }];
    expectIssue(run(trig, w3).warnings, "R13", /"zeppelin" never appears/);
    w3.feedbackNouns = [{ from: "chest", to: "singer" }];
    expect(run(trig, w3).warnings.filter((i) => i.message.startsWith("R13"))).toEqual([]);
  });
  it("R14: record_lens needs a year probe with a window", () => {
    const w = baseWorld(trig);
    const e3 = trig.encounters.findIndex((e) => e.id === "e3_amplitude");
    const meta = CONTRAPTION_LIBRARY.claim_holders;
    st(w, e3).contraption = "claim_holders";
    st(w, e3).skin = meta.skins.find((s) => s.biomes === "any" || s.biomes.includes("orrery_terraces"))!.id;
    st(w, e3).config = meta.defaultConfig(configCtxFor(trig, e3, "orrery_terraces"));
    st(w, e3).accessories = [{ kind: "record_lens", rail: [[100, 100], [200, 100]], carriage: "orrery_terraces.part.lens_carriage" }];
    st(w, e3).payoff.anim = meta.payoffs.includes("stairs_rise") ? "stairs_rise" : meta.payoffs[0];
    expectIssue(run(trig, w).issues, "R14", /year\/month_year probe/);
  });
  it("R15: boss staging only on the boss; phases partition the item keys", () => {
    const w = baseWorld(trig);
    st(w, 0).boss = { speakerId: "warden", arenaTriggerX: 100 };
    expectIssue(run(trig, w).issues, "R15", /only the boss station/);
    const w2 = baseWorld(trig);
    st(w2, 5).boss.phases = [{ id: "p1", itemKeys: ["i0"] }];
    expectIssue(run(trig, w2).issues, "R15", /partition/);
    const w3 = baseWorld(trig);
    st(w3, 5).boss.arenaTriggerX = st(w3, 5).consoleX + 10;
    expectIssue(run(trig, w3).issues, "R15", /arenaTriggerX/);
    const w4 = baseWorld(cell, "living_gate");
    const last = cell.encounters.length - 1; // e11 sorter.bins
    const items = (cell.encounters[last]!.params as { items: unknown[] }).items.map((_, i) => `i${i}`);
    st(w4, last).boss.phases = [{ id: "a", itemKeys: items.slice(0, 3) }, { id: "b", itemKeys: items.slice(3) }];
    expect(run(cell, w4).issues.filter((i) => i.message.startsWith("R15"))).toEqual([]);
    st(w4, last).boss.phases[1].itemKeys = items.slice(2); // i2 twice
    expectIssue(run(cell, w4).issues, "R15", /repeated i2/);
  });
  it("R16: an unmapped cue warns", () => {
    const w = baseWorld(trig);
    (w.cutscenes as Any[])[0].steps.push({ do: "sfx", cue: "kazoo_blast" });
    expectIssue(run(trig, w, { cueIds: new Set(["ui_badge", "latch_slip"]) }).warnings, "R16", /"kazoo_blast" is not in CUE_MAP/);
    expect(run(trig, w).warnings.filter((i) => i.message.startsWith("R16"))).toEqual([]); // no CUE_MAP given: Id-legality only
  });
  it("W1: a zone with stations needs a vertical payoff", () => {
    const w = baseWorld(trig);
    (w.stations as Any[]).forEach((s) => (s.payoff.vertical = "none"));
    expectIssue(run(trig, w).warnings, "W1");
  });
  it("W2: a zone needs two non-walk verbs", () => {
    const w = baseWorld(trig);
    zone(w).links = [zone(w).links[0]];
    expectIssue(run(trig, w).warnings, "W2", /1 non-walk verb/);
  });
  it("W3: a play-layer prop over a console warns", () => {
    const w = baseWorld(trig);
    w.props = [{ zoneId: "z1", asset: "orrery_terraces.prop.crate", x: st(w, 0).consoleX, layer: "L4_play" }];
    expectIssue(run(trig, w).warnings, "W3", /overlaps station "e1_radians"/);
  });
  it("every rule id has a negative test above", () => {
    expect(WORLD_RULE_IDS).toHaveLength(19);
  });
});

describe("owner routing and validateGameSpec's world branch", () => {
  it("routes writer text to world_writer and geometry to code", () => {
    expect(worldOwnerFor(["world", "stations", 0, "dialogue", "instruction", "text"])).toBe("world_writer");
    expect(worldOwnerFor(["world", "stations", 0, "panel", "verifyLabel"])).toBe("world_writer");
    expect(worldOwnerFor(["world", "stations", 0, "consoleX"])).toBe("code");
    expect(worldOwnerFor(["world", "story", "logline"])).toBe("world_writer");
    expect(worldOwnerFor(["world", "zones", 0, "ground"])).toBe("code");
    expect(worldOwnerFor(["world", "cast", "extras", 0, "name"])).toBe("world_writer");
    expect(worldOwnerFor(["world", "plaques", 0, "text"])).toBe("world_writer");
    expect(worldOwnerFor(["world", "cutscenes", 0, "steps", 1, "lines", 0, "text"])).toBe("world_writer");
    expect(ownerFor(["world", "stations", 2, "config", "holders"])).toBe("world_writer");
    expect(ownerFor(["world", "stations", 2, "payoff", "blocker"])).toBe("code");
  });
  it("validateGameSpec runs validateWorld only when spec.world exists", () => {
    expect(validateGameSpec(trig).ok).toBe(true);
    const good = validateGameSpec({ ...trig, world: WorldOverlay.parse(baseWorld(trig)) });
    expect(good.ok).toBe(true);
    const w = baseWorld(trig);
    st(w, 1).dialogue.instruction.text = "Set the timer on the console to π.";
    const bad = validateGameSpec({ ...trig, world: WorldOverlay.parse(w) });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      const leak = bad.issues.find((i) => i.message.startsWith("R8"));
      expect(leak?.path[0]).toBe("world");
      expect(leak?.owner).toBe("world_writer");
    }
  });
  it("expands skin anchor ranges", () => {
    expect(expandAnchors(["drawer_0…2", "table"])).toEqual(["drawer_0", "drawer_1", "drawer_2", "table"]);
  });
});
