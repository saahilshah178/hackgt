import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import cellFixture from "../fixtures/cell-transport-dungeon.json";
import civilFixture from "../fixtures/civil-rights-mystery.json";
import trigFixture from "../fixtures/trig-dungeon.json";
import cellWorld from "../fixtures/worlds/cell-transport.world.json";
import civilWorld from "../fixtures/worlds/civil-rights.world.json";
import trigWorld from "../fixtures/worlds/trig.world.json";
import { ID_PATTERN } from "../src/contracts/common";
import { GameSpec } from "../src/contracts/gamespec";
import {
  Accessory,
  AssetKey,
  AssetManifest,
  BossStaging,
  CutsceneStep,
  HERO_CAP_PER_NAMESPACE,
  HintTarget,
  ManifestEntry,
  PuppetAnim,
  MisconceptionProbe,
  PAYOFF_ANIMS,
  PAYOFF_KIND_OF,
  ProbeSpec,
  ProgressEffect,
  QuestStep,
  Sandbox,
  Station,
  TraversalLink,
  WorldFile,
  Zone,
} from "../src/contracts/world";
import { PREFABS, prefabFor, SANDBOX_PREFABS, sandboxPrefabFor } from "../src/game/hosts/expedition/contraptions/registry";
import { getMode, implementedModes } from "../src/mechanics/registry";
import { ASSET_INDEX, ASSET_INDEX_BY_NAMESPACE, namespaceOf } from "../src/world/asset-index";
import { REF_SIM_GHOSTS, REF_SIMS, SIM_IDS, membraneFold, pendulumBeat, beatHz, syncBrightness } from "../src/world/sims";
import docConfigs from "./world-doc-configs.json";
import { hintTargetsFor } from "../src/world/hint-targets";
import { recordCard } from "../src/world/record-strip";
import { assetsForZone } from "../src/world/residency";
import { EmitterRailConfig } from "../src/world/contraptions/emitter-rail.meta";
import { StepBridgeConfig } from "../src/world/contraptions/step-bridge.meta";
import { isDraftMode, modeKeyOf } from "../src/world/draft-inputs";
import {
  allSkins,
  ARCHETYPE_IDS,
  AUTO_ARCHETYPE_BY_MODE,
  configCtxFor,
  CONTRAPTION_LIBRARY,
  contraptionFor,
  getContraption,
  contraptionsForMode,
  implementedModeKeys,
  SANDBOX_IDS,
  SANDBOX_LIBRARY,
  skinOf,
  writerCtxFor,
} from "../src/world/library";
import { WORLD_RULE_IDS } from "../src/world/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const SIDE_CARS = [
  { name: "trig", file: trigWorld, fixture: trigFixture },
  { name: "cell-transport", file: cellWorld, fixture: cellFixture },
  { name: "civil-rights", file: civilWorld, fixture: civilFixture },
] as const;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------- skeleton side-cars

describe("side-cars (fixtures/worlds/*.world.json)", () => {
  it("are the only overlay files and all parse with WorldFile", () => {
    expect(readdirSync(path.join(ROOT, "fixtures/worlds")).sort()).toEqual(["cell-transport.world.json", "civil-rights.world.json", "trig.world.json"]);
    expect(existsSync(path.join(ROOT, "src/game/worlds"))).toBe(false);
    for (const { name, file } of SIDE_CARS) expect(WorldFile.safeParse(file).success, name).toBe(true);
  });

  it("key to the fixture spec ids and sources", () => {
    expect(trigWorld.appliesTo.specIds).toEqual(["trig_demo_001", "trig_platformer_001"]);
    expect(cellWorld.appliesTo.specIds).toEqual(["cell_demo_001"]);
    expect(civilWorld.appliesTo.specIds).toEqual(["history_mystery_001", "history_demo_001"]);
    for (const { file, fixture } of SIDE_CARS) {
      expect(file.appliesTo.specIds).toContain(fixture.id);
      expect(file.appliesTo.sources).toContainEqual({ sourceId: fixture.source.sourceId, genre: fixture.genre });
    }
  });

  it("have one station per encounter on a compatible archetype and skin, in encounter order by (zoneIndex, consoleX)", () => {
    for (const { name, file, fixture } of SIDE_CARS) {
      const w = WorldFile.parse(file).world;
      expect(w.stations.map((s) => s.encounterId), name).toEqual(fixture.encounters.map((e) => e.id));
      const zoneIndex = new Map(w.zones.map((z, i) => [z.id, i]));
      let last: [number, number] = [-1, -1];
      w.stations.forEach((s, i) => {
        const meta = getContraption(s.contraption);
        expect(meta, `${name}/${s.encounterId} contraption ${s.contraption}`).toBeDefined();
        const enc = fixture.encounters[i];
        expect(meta!.modes, `${name}/${s.encounterId}`).toContain(`${enc.familyId}.${enc.mode}`);
        expect(skinOf(meta!, s.skin), `${name}/${s.encounterId} skin ${s.skin}`).toBeDefined();
        expect(meta!.validateConfig(meta!.configSchema.parse(s.config), configCtxFor(GameSpec.parse(fixture), i, w.biome)), `${name}/${s.encounterId} config`).toEqual([]);
        const zi = zoneIndex.get(s.zoneId);
        expect(zi, `${name}/${s.encounterId} zone ${s.zoneId}`).toBeDefined();
        const here: [number, number] = [zi!, s.consoleX];
        expect(here[0] > last[0] || (here[0] === last[0] && here[1] > last[1]), `${name}/${s.encounterId} order`).toBe(true);
        last = here;
        expect(s.payoff.kind).toBe(PAYOFF_KIND_OF[s.payoff.anim]);
        const zone = w.zones[zi!];
        expect(s.consoleX).toBeLessThanOrEqual(zone.width);
      });
      // the boss (last encounter) is staged, nobody else is
      const bosses = w.stations.filter((s) => s.boss !== null).map((s) => s.encounterId);
      expect(bosses).toEqual([fixture.encounters[fixture.encounters.length - 1].id]);
    }
  });

  it("resolve every cutscene and zone reference they make", () => {
    for (const { name, file } of SIDE_CARS) {
      const w = WorldFile.parse(file).world;
      const cutscenes = new Set(w.cutscenes.map((c) => c.id));
      const zones = new Set(w.zones.map((z) => z.id));
      expect(cutscenes.has(w.story.introCutsceneId), name).toBe(true);
      expect(cutscenes.has(w.story.finaleCutsceneId), name).toBe(true);
      for (const s of w.stations) if (s.payoff.rideCutsceneId) expect(cutscenes.has(s.payoff.rideCutsceneId), `${name}/${s.encounterId}`).toBe(true);
      for (const z of w.zones) {
        for (const x of z.exits) {
          expect(zones.has(x.toZoneId), `${name}/${x.id}`).toBe(true);
          if (x.cutsceneId) expect(cutscenes.has(x.cutsceneId)).toBe(true);
        }
        expect(z.segments[0].x0).toBe(0);
        expect(z.segments[z.segments.length - 1].x1).toBe(z.width);
      }
      for (const c of w.cutscenes) {
        for (const step of c.steps) if (step.do === "enter_zone" || step.do === "ride") expect(zones.has(step.do === "ride" ? step.toZoneId : step.zoneId)).toBe(true);
      }
    }
  });

  it("slot into GameSpec.world without changing a fixture that has none", () => {
    const spec = GameSpec.parse(trigFixture);
    expect("world" in spec).toBe(false);
    expect(spec).toEqual(trigFixture);
    const withWorld = GameSpec.parse({ ...clone(trigFixture), world: trigWorld.world });
    expect(withWorld.world?.stations).toHaveLength(6);
    expect(withWorld.world?.zones[0].camera).toEqual({ xDeadzone: 0.3, yDeadzone: 260, lerp: 0.12, minZoom: 0.6, maxZoom: 1.15 });
  });
});

// ---------------------------------------------------------------- strictness and defaults

describe("hand-authored schemas are strict", () => {
  const cases: [string, (w: ReturnType<typeof clone<typeof trigWorld>>) => void][] = [
    ["root", (f) => Object.assign(f, { extra: 1 })],
    ["appliesTo", (f) => Object.assign(f.appliesTo, { specId: "typo" })],
    ["world", (f) => Object.assign(f.world, { titel: "typo" })],
    ["cast.guide", (f) => Object.assign(f.world.cast.guide, { colour: "#fff" })],
    ["story", (f) => Object.assign(f.world.story, { meterr: null })],
    ["zone", (f) => Object.assign(f.world.zones[1], { hieght: 1 })],
    ["station", (f) => Object.assign(f.world.stations[0], { consolex: 1 })],
    ["station.dialogue.instruction", (f) => Object.assign(f.world.stations[0].dialogue.instruction, { speaker: "cog" })],
    ["station.payoff", (f) => Object.assign(f.world.stations[0].payoff, { anmi: "stairs_rise" })],
    ["cutscene step", (f) => Object.assign(f.world.cutscenes[0].steps[0], { zone: "z1" })],
  ];
  for (const [where, mutate] of cases) {
    it(`rejects an unknown key in ${where}`, () => {
      const f = clone(trigWorld);
      mutate(f);
      const r = WorldFile.safeParse(f);
      expect(r.success).toBe(false);
      expect(JSON.stringify(r.error?.issues)).toMatch(/unrecognized_keys/);
    });
  }

  it("rejects unknown keys in leaf schemas too (probe, requirement, manifest entry)", () => {
    expect(ProbeSpec.safeParse({ symbol: "x", label: "probe", min: 0, max: 1, step: 0.1, colour: "red" }).success).toBe(false);
    expect(Station.shape.hintTargets.safeParse([[{ anchor: "lens", action: "hover", holdMs: 10, x: 1 }], [], []]).success).toBe(false);
    expect(
      ManifestEntry.safeParse({ kind: "svg", key: "shared.ui.pin", zone: "all", source: "kit:plate", sha1: "0".repeat(40), file: "ui/pin.svg", width: 10, height: 10, extra: true }).success,
    ).toBe(false);
    expect(HintTarget.safeParse({ anchor: "lens", action: "hover", colour: "red" }).success).toBe(false);
  });
});

describe(".prefault fills nested defaults (zod 4: .default({}) would not)", () => {
  it("documents the zod 4 behaviour the schema relies on", () => {
    const inner = z.strictObject({ a: z.number().default(1) });
    expect(z.strictObject({ o: inner.default({} as z.infer<typeof inner>) }).parse({})).toEqual({ o: {} });
    expect(z.strictObject({ o: inner.prefault({}) }).parse({})).toEqual({ o: { a: 1 } });
  });

  it("fills Zone.camera, Ambient.grade, BossStaging.taunts, Sandbox.lines and config parts", () => {
    const stops = [0, 0.5, 1].map((at) => ({ at, color: "#D8D4CF" }));
    const zone = Zone.parse({
      id: "z", name: "Z", width: 1920, height: 1080, entry: { x: 10 },
      layerSets: [{ id: "ls", layers: [0, 1, 2].map((y) => ({ asset: "shared.layer.test", depth: "L1_far", scrollFactor: 0.15, y })) }],
      segments: [{ id: "ls", x0: 0, x1: 1920, layerSet: "ls", sky: { stops, haze: { color: "#FFFFFF", alpha: 0.2 } }, ambient: { light: "day" } }],
      ground: { points: [[0, 900], [1920, 900]], surface: "shared.ground.test" },
    });
    expect(zone.camera).toEqual({ xDeadzone: 0.3, yDeadzone: 260, lerp: 0.12, minZoom: 0.6, maxZoom: 1.15 });
    expect(zone.segments[0].ambient.grade).toEqual({ saturation: 0, brightness: 0, hue: 0 });
    expect(zone.segments[0].ambient).toMatchObject({ particles: "none", particleCount: 24, shadowColor: "#6E7F9A", dapple: null });
    expect(BossStaging.parse({ speakerId: "warden", arenaTriggerX: 10 }).taunts).toEqual({ approach: [], fail: [], byKey: [] });
    const sb = Sandbox.parse({ id: "mb", zoneId: "z", consoleX: 1, anchor: { x: 1, y: 1 }, contraption: "music_box", skin: "astronomer_box", title: "Box", objectNoun: "box" });
    expect(sb.lines).toEqual({ open: [], idle: [] });
    expect(EmitterRailConfig.parse({}).cards).toEqual({ unitCircle: false, cosTier: 1, sixthsTier: 2 });
    expect(StepBridgeConfig.parse({ bays: "floating", items: [{ key: "s0" }] }).items[0].meta).toEqual({ printedDate: null, madeYear: null, glyph: null, label: null });
    const station = Station.parse({
      encounterId: "e1", zoneId: "z", consoleX: 10, anchor: { x: 10, y: 10 }, contraption: "console_slate", skin: "lectern_slate",
      objectNoun: "Slate", panel: { verifyLabel: "VERIFY", successBadge: "DONE" },
      dialogue: { instruction: { text: "Work the slate." }, fail: { default: { text: "Not yet." } }, success: { text: "Done." } },
      payoff: { kind: "terrain", vertical: "up", anim: "stairs_rise", noun: "stair", blocker: null },
    });
    expect(station).toMatchObject({ consoleSurface: "ground", approachRadius: 500, config: {}, partNouns: [], probes: [], hintTargets: null, boss: null });
    expect(station.dialogue).toMatchObject({ approach: [], tutorial: null, insight: null, hints: null, payoffLine: null, after: [] });
    expect(station.dialogue.fail.byKey).toEqual([]);
  });
});

describe("every union variant parses", () => {
  const L = { speakerId: "cog", text: "Hello." };
  it("CutsceneStep (all verbs)", () => {
    const steps = [
      { do: "fade", to: "black", ms: 400 },
      { do: "title", text: "T", ms: 1000 },
      { do: "enter_zone", zoneId: "z1", x: 10 },
      { do: "pan", x: 100, ms: 500 },
      { do: "camera", y: 400, ms: 900, ease: "in_out_sine" },
      { do: "walk", actor: "player", toX: 50 },
      { do: "say", lines: [L] },
      { do: "emote", actor: "companion", glyph: "♪" },
      { do: "wait", ms: 10 },
      { do: "station", encounterId: "e1", anim: "wake" },
      { do: "hub", zoneId: "z1", state: "partial" },
      { do: "ride", vehicle: "living_gate.part.vesicle_x", toZoneId: "zone_d", toX: 300, toSurface: "high_rail", ms: 1000 },
      { do: "sfx", cue: "sfx_beam_rise" },
      { do: "music", cue: null },
      { do: "await_interact", target: { kind: "npc", id: "cog" }, prompt: "Wind Cog" },
      { do: "control_until", x: 900 },
      { do: "vista", asset: "orrery_terraces.vista.canyon", from: { x: 0, y: 0, zoom: 1 }, to: { x: 10, y: 0, zoom: 0.8 }, ms: 3000 },
      { do: "set_state", target: { kind: "flag", id: "engine_awake" }, state: "on" },
    ];
    for (const s of steps) expect(CutsceneStep.safeParse(s).success, s.do).toBe(true);
    expect(new Set(steps.map((s) => s.do)).size).toBe(CutsceneStep.options.length);
    expect(CutsceneStep.parse({ do: "ride", vehicle: "a.b.c", toZoneId: "z", toX: 1, ms: 1 })).toMatchObject({ toSurface: "ground", path: [] });
    expect(CutsceneStep.safeParse({ do: "sfx", cue: "sfx.beam_rise" }).success).toBe(false); // cue ids are snake_case
  });

  it("TraversalLink, ProgressEffect, QuestStep, MisconceptionProbe, Accessory, ManifestEntry", () => {
    const end = (x: number) => ({ x });
    const links = [
      { kind: "hop", id: "h", from: end(1), to: end(2) },
      { kind: "climb", id: "c", from: end(1), to: end(2) },
      { kind: "ladder", id: "l", from: end(1), to: end(2) },
      { kind: "drop", id: "d", from: end(1), to: end(2) },
      { kind: "timed_hop", id: "t", from: end(1), to: end(2), periodSec: 1.5, open: [0.1, 0.4], missTo: end(3) },
      { kind: "ride", id: "r", from: end(1), to: end(2), vehicle: "a.b.c", path: [[0, 0], [10, 0]], ms: 1000 },
    ];
    for (const l of links) expect(TraversalLink.safeParse(l).success, l.kind).toBe(true);
    const effects = [
      { kind: "beam_line", encounterId: "e1", zoneId: "z1", from: [0, 0], to: [10, 10] },
      { kind: "prop_state", encounterId: "e1", propId: "p", state: "lit" },
      { kind: "label_swap", encounterId: "e1", propId: "p", anchor: "a", before: "x" },
      { kind: "hub_socket", encounterId: "e1", zoneId: "z1", socket: 3 },
    ];
    for (const e of effects) expect(ProgressEffect.safeParse(e).success, e.kind).toBe(true);
    const steps = [
      { kind: "talk", npcId: "n" },
      { kind: "collect", ids: ["c"] },
      { kind: "touch", propIds: ["p"] },
      { kind: "afterSeal", encounterId: "e2" },
      { kind: "visit", triggerId: "t" },
    ];
    for (const s of steps) expect(QuestStep.safeParse(s).success, s.kind).toBe(true);
    const probes = [
      { predicate: "nearValue", value: "2*pi", key: "double" },
      { predicate: "keyInSlot", itemKey: "s2", slot: 0, key: "early" },
      { predicate: "decoyPresent", itemKey: null, key: "any_decoy" },
      { predicate: "aimedIndex", index: 1, key: "b" },
      { predicate: "linkedTo", fromKey: "l0", toKey: "x0", key: "decoy" },
      { predicate: "assignedTo", itemKey: "w2", binId: "hypertonic", key: "hyper_more_water" },
    ];
    for (const p of probes) expect(MisconceptionProbe.safeParse(p).success, p.predicate).toBe(true);
    expect(Accessory.safeParse({ kind: "record_lens", rail: [[0, 0], [100, 0]], carriage: "archive_of_voices.part.lens_carriage" }).success).toBe(true);
    const sha1 = "a".repeat(40);
    const idle = { id: "idle", loop: true, ms: 1600, tracks: [{ part: "wing_l", prop: "rot", wave: { amp: 18, hz: 1.6 } }] };
    const point = (name: string) => ({ name, x: 84, y: 128 });
    const entries = [
      { kind: "svg", key: "orrery_terraces.part.ring_gate_outer_ring", zone: "z1_sunward", source: "hero", sha1, file: "orrery_terraces/part/ring_gate_outer_ring.svg", width: 408, height: 408 },
      { kind: "svg", key: "orrery_terraces.layer.z1_mesa", zone: "z1_sunward", source: "kit:ridgeBand", sha1, file: "orrery_terraces/layer/z1_mesa.svg", width: 2048, height: 620, tileWidth: 2048, scroll: 0.15, seed: 2915730123, legacyId: "A08" },
      {
        kind: "puppet", key: "orrery_terraces.companion.cog", zone: "all", source: "hero", sha1, file: "orrery_terraces/companion/cog.svg", restFile: "orrery_terraces/companion/cog.rest.svg",
        width: 64, height: 60, parts: [{ name: "wing_l", frames: 1, rest: [14, 26], pivot: [0.9, 0.2], z: 1, box: [0, 0, 20, 30] }], anims: [idle, { ...idle, id: "talk" }, { ...idle, id: "cue", loop: false }],
      },
      {
        kind: "atlas", key: "shared.char.wren", zone: "all", source: "rig:female_adventurer", sha1, body: "female_adventurer", image: "shared/char/wren.png", frames: "shared/char/wren.json",
        frameWidth: 192, frameHeight: 256, displayWidth: 168, displayHeight: 224, poses: ["idle", "walk0"],
        anchors: [{ pose: "idle", facing: "front", points: ["head", "face", "torso", "back", "hand_l", "hand_r", "feet"].map(point) }],
        fallback: { image: "shared/char/kenney/female_adventurer.png", xml: "shared/char/kenney/female_adventurer.xml", frameNames: { idle: "idle", walk0: "walk0" } },
      },
    ];
    for (const e of entries) expect(ManifestEntry.safeParse(e).success, `${e.kind} ${e.key}`).toBe(true);
    expect(ManifestEntry.parse(entries[2])).toMatchObject({ rasterScale: 1.5, legacyId: null, anchors: [] });
    expect(ManifestEntry.safeParse({ ...entries[0], source: "kit" }).success).toBe(false); // "kit:<generator>"
    expect(ManifestEntry.safeParse({ ...entries[0], zone: "Z1" }).success).toBe(false); // ZoneTag is "all" or an Id
    expect(ManifestEntry.safeParse({ ...entries[3], anchors: [{ pose: "idle", facing: "front", points: [point("head")] }] }).success).toBe(false); // 7 anchors
    expect(PuppetAnim.safeParse({ ...idle, tracks: [] }).success).toBe(false);
  });

  it("caps hand-authored heroes at 40 per namespace", () => {
    const m = { namespace: "orrery_terraces", paletteId: "orrery_terraces", heroCap: 40, entries: [], totalBytes: 0, gzipBytes: 0, vram: [{ zone: "all", mb: 12 }], swapPeakMb: 0 };
    expect(HERO_CAP_PER_NAMESPACE).toBe(40);
    expect(AssetManifest.safeParse({ ...m, heroCount: HERO_CAP_PER_NAMESPACE }).success).toBe(true);
    expect(AssetManifest.safeParse({ ...m, heroCount: HERO_CAP_PER_NAMESPACE + 1 }).success).toBe(false);
    expect(AssetManifest.safeParse({ ...m, heroCap: 60, heroCount: 0 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------- the library

describe("contraption and sandbox library", () => {
  it("registers a meta with a real configSchema for every archetype and sandbox id", () => {
    expect(ARCHETYPE_IDS).toHaveLength(13);
    expect(SANDBOX_IDS).toHaveLength(3);
    for (const id of ARCHETYPE_IDS) {
      const m = CONTRAPTION_LIBRARY[id];
      expect(m.id).toBe(id);
      expect(typeof m.configSchema.safeParse).toBe("function");
      expect(m.skins.length).toBeGreaterThan(0);
      expect(m.layouts).toContain(m.defaultLayout);
      expect(m.payoffs.length).toBeGreaterThan(0);
      for (const a of m.payoffs) expect(PAYOFF_ANIMS).toContain(a);
      expect(m.status).toBe("demo");
    }
    for (const id of SANDBOX_IDS) {
      const m = SANDBOX_LIBRARY[id];
      expect(m.id).toBe(id);
      expect(typeof m.configSchema.safeParse).toBe("function");
      expect(m.goals.length).toBeGreaterThan(0);
    }
    expect(Object.keys(REF_SIM_GHOSTS)).toEqual(["bilayer_probe", "diffusion_tank", "osmotic_cell", "pump_flume"]);
  });

  it("every skin's part keys are AssetKeys in shared or the skin's biome; cues and anchors are Id-legal", () => {
    const skins = allSkins();
    expect(skins.length).toBeGreaterThanOrEqual(27);
    const ids = new Set<string>();
    for (const { ownerId, skin } of skins) {
      expect(ids.has(skin.id), `duplicate skin ${skin.id}`).toBe(false);
      ids.add(skin.id);
      const allowed = skin.biomes === "any" ? ["shared"] : ["shared", ...skin.biomes];
      for (const p of [...skin.parts.map((x) => x.asset), skin.console]) {
        expect(AssetKey.safeParse(p).success, `${ownerId}/${skin.id}: ${p}`).toBe(true);
        expect(allowed, `${skin.id}: ${p}`).toContain(namespaceOf(p));
      }
      for (const c of [skin.cues.live, skin.cues.succeed, skin.cues.fail]) if (c !== null) expect(c, `${skin.id} cue`).toMatch(ID_PATTERN);
      expect(skin.anchors).toContain("console");
      for (const a of skin.anchors) expect(a).toMatch(ID_PATTERN);
      for (const rung of skin.hintTargets) for (const t of rung) expect(skin.anchors, `${skin.id} hint anchor ${t.anchor}`).toContain(t.anchor);
      expect(skin.nouns.length).toBeGreaterThan(0);
    }
    // the round-2 slots are present
    const slotsOf = (id: string) => skins.find((s) => s.skin.id === id)!.skin.parts.map((p) => p.slot);
    expect(slotsOf("resonance_pillars")).toEqual(expect.arrayContaining(["faceplate", "bell"]));
    expect(slotsOf("specimen_pods")).toContain("mimic_mote");
    expect(slotsOf("membrane_router")).toEqual(expect.arrayContaining(["gate_fin", "gate_ring_outer", "gate_ring_inner"]));
    expect(slotsOf("tonicity_sluices")).toEqual(expect.arrayContaining(["cell_protoplast", "lock_leaf"]));
    expect(slotsOf("gatekeeper_maws")).toContain("eye_pupil");
    expect(slotsOf("switchboard")).toContain("steps");
    expect(slotsOf("filing_cabinets")).toContain("stairwell");
  });

  it("contraptionFor is total over implementedModes() and picks natives per the autoWorld table", () => {
    const keys = implementedModeKeys();
    expect(keys.length).toBe(implementedModes().length);
    for (const key of keys) {
      const meta = contraptionFor(key);
      expect(meta.modes, key).toContain(key);
      expect(contraptionsForMode(key).at(-1)!.id).toBe("console_slate");
    }
    expect([...CONTRAPTION_LIBRARY.console_slate.modes].sort()).toEqual([...keys].sort());
    for (const [mode, id] of Object.entries(AUTO_ARCHETYPE_BY_MODE)) expect(contraptionFor(mode).id).toBe(id);
    expect(contraptionFor("tuner.oscillator", "boss").id).toBe("pendulum_sync");
    expect(contraptionFor("balance.equation").id).toBe("console_slate");
    expect(Object.values(AUTO_ARCHETYPE_BY_MODE)).not.toContain("stage_machine");
    expect(contraptionsForMode("linker.pairs").map((m) => m.id)).toEqual(["switchboard", "stage_machine", "console_slate"]);
  });

  it("every archetype and sandbox has a registered stub prefab over the same meta, with a skin file per meta skin", async () => {
    for (const id of ARCHETYPE_IDS) expect(PREFABS[id].meta.id, id).toBe(id);
    for (const id of SANDBOX_IDS) expect(SANDBOX_PREFABS[id].meta.id, id).toBe(id);
    for (const id of [...ARCHETYPE_IDS, ...SANDBOX_IDS]) {
      const index = (await import(`../src/game/hosts/expedition/contraptions/prefabs/${id}/skins/index.ts`)) as { SKIN_IDS: readonly string[]; SKINS: Record<string, { skinId: string }> };
      const metaSkins = (id in CONTRAPTION_LIBRARY ? CONTRAPTION_LIBRARY[id as (typeof ARCHETYPE_IDS)[number]] : SANDBOX_LIBRARY[id as (typeof SANDBOX_IDS)[number]]).skins.map((x) => x.id);
      expect([...index.SKIN_IDS].sort(), id).toEqual([...metaSkins].sort());
      for (const sk of metaSkins) expect(index.SKINS[sk].skinId).toBe(sk);
      const shared = (await import(`../src/game/hosts/expedition/contraptions/prefabs/${id}/shared.ts`)) as Record<string, unknown>;
      expect(shared.stubBox).toBeTypeOf("function");
    }
    expect(prefabFor("no_such_thing").meta.id).toBe("console_slate");
    expect(sandboxPrefabFor("no_such_thing")).toBeNull();
    expect(PREFABS.console_slate.meta).toBe(CONTRAPTION_LIBRARY.console_slate);
  });

  it("the asset index merges the four namespaces", () => {
    expect(Object.keys(ASSET_INDEX_BY_NAMESPACE)).toEqual(["shared", "orrery_terraces", "living_gate", "archive_of_voices"]);
    expect(Object.keys(ASSET_INDEX)).toHaveLength(Object.values(ASSET_INDEX_BY_NAMESPACE).reduce((s, i) => s + Object.keys(i).length, 0));
  });

  it("names the 19 validateWorld rules", () => {
    expect(WORLD_RULE_IDS).toHaveLength(19);
  });

  it("registers every sim behind src/world/sims/index.ts", () => {
    expect(SIM_IDS).toHaveLength(6);
    expect(Object.keys(REF_SIMS).sort()).toEqual(Object.keys(REF_SIM_GHOSTS).sort());
    for (const sim of Object.values(REF_SIMS)) {
      const s0 = sim.init(1, {}, null, { draft: null, probe: null, t: 0, aidTier: 0 });
      const s1 = sim.step(s0, sim.fixedDt, { draft: null, probe: 1, t: 0, aidTier: 0 });
      expect(typeof sim.readout(s1)).toBe("object");
    }
    expect(membraneFold(["touch", "fold", "pinch", "carry"])).toHaveLength(4);
    expect(pendulumBeat.readout(pendulumBeat.init(1, CONTRAPTION_LIBRARY.pendulum_sync.configSchema.parse({}), null, { draft: null, probe: null, t: 0, aidTier: 0 }))).toMatchObject({ B: 1 });
    expect(beatHz(4, 4)).toBe(0);
    expect(syncBrightness(0)).toBe(1);
  });

  it("ships the rev-3 seams with their final signatures (hint targets, RECORD card, residency)", () => {
    const skin = skinOf(CONTRAPTION_LIBRARY.ring_gate, "ring_gate")!;
    const input = { view: null, config: {}, aidTier: 0 as const, hintsUsed: 0 as const, reducedMotion: false, skinId: "ring_gate", record: false };
    expect(hintTargetsFor({ hintTargets: null }, CONTRAPTION_LIBRARY.ring_gate, 1, input)).toEqual(skin.hintTargets[0]);
    const override = [{ anchor: "doorway", action: "land" as const, holdMs: 900 }];
    expect(hintTargetsFor({ hintTargets: [override, [], []] }, CONTRAPTION_LIBRARY.ring_gate, 1, input)).toEqual(override);
    const strip = {
      lanes: [{ id: "origins", label: "ORIGINS" }],
      pins: [
        { encounterId: "e1_brown", pin: { date: "1954-05-17", precision: "day" as const, label: "Brown", lane: "origins", spanTo: null } },
        { encounterId: "e2_montgomery", pin: { date: "1955-12", precision: "month" as const, label: "Boycott", lane: "origins", spanTo: "1956-12" } },
      ],
    };
    expect(recordCard({ recordStrip: strip, solvedIds: [], probeWindow: null }, [], null).pins).toHaveLength(0);
    const card = recordCard({ recordStrip: strip, solvedIds: ["e1_brown", "e2_montgomery"], probeWindow: { start: 1950, end: 1960 } }, [], 1955);
    expect(card).toMatchObject({ kind: "timeline", slot: 0, title: "RECORD", from: 1950, to: 1960 });
    expect(card.pins).toHaveLength(2);
    expect(card.bands).toHaveLength(1);
    const trig = WorldFile.parse(trigWorld).world;
    const z1 = assetsForZone(trig, "z1_sunward");
    expect(z1).toContain("shared.char.wren");
    expect(z1).toContain(skinOf(CONTRAPTION_LIBRARY.emitter_rail, "vesper_dial")!.parts[0].asset);
    expect(z1).toContain("orrery_terraces.layer.z1_mesa");
    expect(assetsForZone(trig, "nope")).toEqual([]);
  });
});

// ---------------------------------------------------------------- configs against the showcase fixtures

const SPECS = [
  { spec: GameSpec.parse(trigFixture), biome: "orrery_terraces", domain: "math" },
  { spec: GameSpec.parse(cellFixture), biome: "living_gate", domain: "biology" },
  { spec: GameSpec.parse(civilFixture), biome: "archive_of_voices", domain: "history" },
] as const;

describe("configs, validators and defaults on the 29 showcase encounters", () => {
  it("the views match the mirror shapes in src/world/types.ts", () => {
    const expectKeys: Record<string, string[]> = {
      "tuner.oscillator": ["equation", "ask", "askLabel", "wave", "amplitude", "b", "c", "d", "dial"],
      "mapper.number_line": ["scale", "min", "max", "target", "landmarks"],
      "truth_finder.mimic": ["chests"],
      "truth_finder.predict_reveal": ["scenario", "options"],
      "sequencer.linear": ["slots", "planks"],
      "sorter.bins": ["bins", "items"],
      "sorter.type_match": ["categories", "waves", "secondsPerWave"],
      "linker.pairs": ["lefts", "rights"],
      "linker.chain": ["nodes", "edgeCount"],
      "investigator.elimination": ["question", "hypotheses", "clues"],
    };
    for (const { spec, biome } of SPECS) {
      spec.encounters.forEach((e, i) => {
        const ctx = configCtxFor(spec, i, biome);
        expect(Object.keys(ctx.view as object).sort(), `${spec.id}/${e.id}`).toEqual([...expectKeys[ctx.modeKey]].sort());
        expect(isDraftMode(modeKeyOf(e))).toBe(true);
      });
    }
  });

  it("every compatible meta's defaultConfig parses and validates with zero errors", () => {
    let checked = 0;
    for (const { spec, biome } of SPECS) {
      spec.encounters.forEach((e, i) => {
        const ctx = configCtxFor(spec, i, biome);
        for (const meta of contraptionsForMode(ctx.modeKey)) {
          const config = meta.defaultConfig(ctx);
          expect(meta.configSchema.safeParse(config).success, `${meta.id} on ${spec.id}/${e.id}`).toBe(true);
          const errors = meta.validateConfig(config, ctx).filter((x) => x.severity === "error");
          if (meta.id === "pendulum_sync" && (e.params as { ask?: string }).ask !== "period" && (e.params as { ask?: string }).ask !== "frequency") continue;
          expect(errors, `${meta.id} on ${spec.id}/${e.id}`).toEqual([]);
          checked++;
        }
      });
    }
    expect(checked).toBeGreaterThanOrEqual(29 * 2);
  });

  it("writer schemas build for every showcase encounter and map back through fromWriterConfig", () => {
    for (const { spec, biome, domain } of SPECS) {
      spec.encounters.forEach((e, i) => {
        const wctx = writerCtxFor(spec, i, domain);
        const meta = contraptionFor(wctx.modeKey, e.role);
        const schema = meta.writerConfigSchema(wctx);
        if (["ring_gate", "emitter_rail", "pendulum_sync", "console_slate"].includes(meta.id)) expect(schema).toBeNull();
        else expect(schema, `${meta.id} on ${e.id}`).not.toBeNull();
        if (meta.id === "tumbler_vault") {
          const config = meta.fromWriterConfig({ clues: [] }, configCtxFor(spec, i, biome));
          expect(meta.configSchema.safeParse(config).success).toBe(true);
        }
      });
    }
  });

  it("validators catch dishonest configs", () => {
    const [trig, cell] = SPECS;
    // claim_holders: swapped ghost tags break ghost honesty
    const e1 = cell.spec.encounters.findIndex((e) => e.id === "e1_bilayer");
    const ctx1 = configCtxFor(cell.spec, e1, cell.biome);
    const mimic = (ctx1.solution as { mimicIndex: number }).mimicIndex;
    const holders = (ctx1.view as { chests: { statementIndex: number }[] }).chests.map((c) => ({
      statementIndex: c.statementIndex,
      ghost: c.statementIndex === mimic ? "bilayer_outline" : "rigid_holed_slab",
    }));
    const dishonest = CONTRAPTION_LIBRARY.claim_holders.configSchema.parse({ holders, referenceSim: { id: "bilayer_probe" }, aimer: "probe_emitter", quarantineAnim: "ridge_thaw" });
    expect(CONTRAPTION_LIBRARY.claim_holders.validateConfig(dishonest, ctx1).map((x) => x.message).join("\n")).toMatch(/ghost honesty/);
    // ring_gate: a counterweight on a period ask
    const e2 = trig.spec.encounters.findIndex((e) => e.id === "e2_period");
    const ctx2 = configCtxFor(trig.spec, e2, trig.biome);
    expect(CONTRAPTION_LIBRARY.ring_gate.validateConfig({ ...CONTRAPTION_LIBRARY.ring_gate.defaultConfig(ctx2), variant: "counterweight" }, ctx2)).toHaveLength(1);
    // router_lanes: a lane missing for a bin
    const e2c = cell.spec.encounters.findIndex((e) => e.id === "e2_selectivity");
    const ctx3 = configCtxFor(cell.spec, e2c, cell.biome);
    const lanes = CONTRAPTION_LIBRARY.router_lanes.defaultConfig(ctx3);
    expect(CONTRAPTION_LIBRARY.router_lanes.validateConfig({ ...lanes, lanes: lanes.lanes.slice(0, 1).concat({ binId: "nope", laneId: "nope", year: null }) }, ctx3).length).toBeGreaterThan(0);
    // sluice_waves: a fate shown where the text does not state it
    const e5 = cell.spec.encounters.findIndex((e) => e.id === "e9_osmosis_review");
    const ctx4 = configCtxFor(cell.spec, e5, cell.biome);
    const sluice = CONTRAPTION_LIBRARY.sluice_waves.defaultConfig(ctx4);
    sluice.waves[0] = { ...sluice.waves[0], fate: "swell", showFate: false };
    expect(CONTRAPTION_LIBRARY.sluice_waves.validateConfig(sluice, ctx4).map((x) => x.message).join("\n")).toMatch(/showFate: false requires fate: null/);
  });
});

// ---------------------------------------------------------------- configs copied from the game docs (rev-3 M0 acceptance)

describe("each *.config.ts parses station configs copied from its game doc (tests/world-doc-configs.json)", () => {
  type DocConfig = { archetype: string; doc: string; line: number; encounterId: string | null; config: unknown };
  const all = (docConfigs as { configs: DocConfig[] }).configs;
  const specFor: Record<string, { spec: ReturnType<typeof GameSpec.parse>; biome: string }> = {
    "10-game-trig.md": { spec: GameSpec.parse(trigFixture), biome: "orrery_terraces" },
    "11-game-cell-transport.md": { spec: GameSpec.parse(cellFixture), biome: "living_gate" },
    "12-game-civil-rights.md": { spec: GameSpec.parse(civilFixture), biome: "archive_of_voices" },
  };

  it("covers every archetype with config fields and every sandbox", () => {
    const covered = new Set(all.map((c) => c.archetype));
    for (const id of [...ARCHETYPE_IDS.filter((x) => x !== "console_slate"), ...SANDBOX_IDS]) expect(covered.has(id), id).toBe(true);
    expect(CONTRAPTION_LIBRARY.console_slate.configSchema.parse({})).toEqual({ slateTitle: null });
  });

  for (const c of all) {
    it(`${c.archetype} parses and validates ${c.doc}:${c.line}${c.encounterId ? ` (${c.encounterId})` : ""}`, () => {
      if (c.encounterId === null) {
        const meta = SANDBOX_LIBRARY[c.archetype as (typeof SANDBOX_IDS)[number]];
        expect(meta.validateConfig(meta.configSchema.parse(c.config))).toEqual([]);
        return;
      }
      const meta = CONTRAPTION_LIBRARY[c.archetype as (typeof ARCHETYPE_IDS)[number]];
      const { spec, biome } = specFor[c.doc];
      const index = spec.encounters.findIndex((e) => e.id === c.encounterId);
      expect(index, `${c.encounterId} in ${spec.id}`).toBeGreaterThanOrEqual(0);
      const ctx = configCtxFor(spec, index, biome);
      expect(meta.modes).toContain(ctx.modeKey);
      expect(meta.validateConfig(meta.configSchema.parse(c.config), ctx)).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------- purity: the module graph of src/world/library.ts

vi.mock("phaser", () => {
  throw new Error("phaser was imported by the world library");
});
vi.mock("react", () => {
  throw new Error("react was imported by the world library");
});

/** Static walk of runtime imports (type-only imports erased), resolving relative and "@/" specifiers. */
function runtimeImportGraph(entry: string): { files: Set<string>; bare: Set<string> } {
  const files = new Set<string>();
  const bare = new Set<string>();
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith("@/") ? path.join(ROOT, "src", spec.slice(2)) : path.resolve(path.dirname(from), spec);
    for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return c;
    return null;
  };
  const visit = (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    if (!/\.tsx?$/.test(file)) return;
    const src = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true);
    const specs: string[] = [];
    src.forEachChild((node) => {
      if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
        const named = node.importClause?.namedBindings;
        const allTypes = named && ts.isNamedImports(named) && !node.importClause?.name && named.elements.length > 0 && named.elements.every((e) => e.isTypeOnly);
        if (!allTypes) specs.push((node.moduleSpecifier as ts.StringLiteral).text);
      }
      if (ts.isExportDeclaration(node) && node.moduleSpecifier && !node.isTypeOnly) specs.push((node.moduleSpecifier as ts.StringLiteral).text);
    });
    for (const s of specs) {
      if (s.startsWith(".") || s.startsWith("@/")) {
        const r = resolve(file, s);
        if (r) visit(r);
      } else bare.add(s);
    }
  };
  visit(path.join(ROOT, entry));
  return { files, bare };
}

describe("purity", () => {
  it("src/world/library.ts pulls no Phaser, React or Next (static module graph)", () => {
    const { files, bare } = runtimeImportGraph("src/world/library.ts");
    expect(files.size).toBeGreaterThan(40); // metas + mechanics registry + modes
    expect([...files].some((f) => f.endsWith("src/mechanics/registry.ts"))).toBe(true);
    const forbidden = [...bare].filter((b) => /^(phaser|react|react-dom|next)(\/|$)/.test(b));
    expect(forbidden).toEqual([]);
    expect([...files].filter((f) => f.includes("/src/game/") || f.includes("/src/components/"))).toEqual([]);
  });

  it("src/world/library.ts loads in node with phaser and react mocked to throw", async () => {
    const lib = await import("../src/world/library");
    expect(Object.keys(lib.CONTRAPTION_LIBRARY)).toHaveLength(13);
  });

  it("every stored contract module is pure too", () => {
    for (const entry of ["src/contracts/index.ts", "src/world/draft-inputs.ts", "src/world/asset-index/index.ts", "src/game/expedition/dialogue/types.ts"]) {
      const { bare } = runtimeImportGraph(entry);
      expect([...bare].filter((b) => /^(phaser|react|react-dom|next)(\/|$)/.test(b)), entry).toEqual([]);
    }
  });

  it("Zone schema stays the source of per-zone coordinates", () => {
    expect(Zone.shape.width.safeParse(1919).success).toBe(false);
    expect(Zone.shape.height.safeParse(4321).success).toBe(false);
    const any = getMode("tuner", "oscillator");
    expect(any?.implemented).toBe(true);
  });
});
