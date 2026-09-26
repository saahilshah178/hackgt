/**
 * src/world/validate-world.ts (V1) — referential and semantic rules R1–R16 and W1–W3 (docs/design/20 §1.5).
 *
 *   validateWorld(spec, world, opts?) → { issues, warnings }
 *
 * The same split validateGameSpec uses: errors go to `issues`, warnings to `warnings`. Every message starts with its
 * rule id ("R5: …"). Paths start with "world" so validateGameSpec can append them and route them with ownerFor
 * (`worldOwnerFor` below: writer-produced text → world_writer; geometry and structure → code).
 *
 * Called by validateGameSpec when spec.world exists (World Writer output: R9's word budget is an error) and by
 * loadWorldFor for side-cars (`sidecar: true`: the word budget is a warning; issues skip the side-car).
 *
 * Asset checks (R1) read ASSET_INDEX, never the filesystem. A namespace whose generated index is still EMPTY (art not
 * built yet) downgrades "missing asset" to a warning so a world can play on kit stand-ins; namespace, group and kind
 * rules stay errors. Cue checks (R16) need the §2.12 CUE_MAP, which the audio lane owns: pass `cueIds` (loadWorldFor
 * passes CUE_MAP from src/game/expedition/audio/cues.ts); without it only Id-legality is checked.
 */
import { ID_PATTERN, type Issue, type Owner } from "../contracts/common";
import type { Encounter, GameSpec } from "../contracts/gamespec";
import {
  NARRATOR_SPEAKER,
  PAYOFF_KIND_OF,
  PLAYER_SPEAKER,
  type Cutscene,
  type LineSlot,
  type Requirement,
  type Station,
  type WorldLine,
  type WorldOverlay,
  type Zone,
} from "../contracts/world";
import { getMode } from "../mechanics/registry";
import type { AnyFamilyMode } from "../mechanics/types";
import { bannedValuesFor, leakedValues } from "./answer-leak";
import { ASSET_INDEX, ASSET_INDEX_BY_NAMESPACE, groupOf, namespaceOf, type AssetIndex } from "./asset-index/index";
import { biomeKitOf } from "./biomes";
import { containsPhrase, stringsIn, wordTokens, writerItemKeys } from "./config-validators";
import { dateAppears } from "./date-parse";
import { failKeysFor } from "./diagnose/index";
import { polylineSpan } from "./geom";
import { configCtxFor, getContraption, getSandbox, skinOf } from "./library";
import { probeRefIssues } from "./probes";
import { declaredFlagsOf } from "./resolve-world";
import type { AnyContraptionMeta, BiomeKit, ModeKey, ValidateWorldResult, WorldRuleId } from "./types";

export interface ValidateWorldOptions {
  /** a side-car (hand-authored): R9's 24-word budget is a warning; World Writer output (default) makes it an error */
  sidecar?: boolean;
  /** override the asset index (tests); default ASSET_INDEX with per-namespace emptiness from ASSET_INDEX_BY_NAMESPACE */
  assetIndex?: AssetIndex;
  /** namespaces whose art is built (missing keys are errors); default: every namespace with a non-empty index */
  builtNamespaces?: ReadonlySet<string>;
  /** the §2.12 CUE_MAP ids; null/undefined = only Id-legality is checked (R16) */
  cueIds?: ReadonlySet<string> | null;
}

type Path = (string | number)[];

const WRITER_STATION_FIELDS = new Set(["objectNoun", "partNouns", "pins", "dialogue", "config"]);
/** ownerFor's `case "world"` (§1.5 owner routing). `path` starts with "world". */
export function worldOwnerFor(path: readonly (string | number)[]): Owner {
  const [, section, a, b, c] = path;
  switch (section) {
    case "story":
      return ["logline", "objective", "objectiveLabel", "restoredNoun"].includes(String(a)) ? "world_writer" : "code";
    case "cast":
      if (a === "extras") return "world_writer";
      return path.includes("name") ? "world_writer" : "code";
    case "stations":
      if (WRITER_STATION_FIELDS.has(String(b))) return "world_writer";
      if (b === "panel" && (c === "verifyLabel" || c === "successBadge")) return "world_writer";
      return "code";
    case "npcs":
    case "triggers":
    case "collectibles":
    case "plaques":
      return path.some((p) => p === "text" || p === "lines" || p === "title" || p === "name") ? "world_writer" : "code";
    case "cutscenes":
      return path.includes("lines") ? "world_writer" : "code";
    default:
      return "code";
  }
}

// ---------------------------------------------------------------- generic walkers

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
/** Depth-first visit of every object node with its path. */
function walk(v: unknown, path: Path, fn: (node: Record<string, unknown>, path: Path) => void): void {
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...path, i], fn));
  else if (isObj(v)) {
    fn(v, path);
    for (const [k, x] of Object.entries(v)) walk(x, [...path, k], fn);
  }
}

/** Fields whose string values are AssetKeys (§1.3). */
const ASSET_FIELDS = new Set([
  "asset", "atlas", "portrait", "surface", "underside", "facade", "dapple", "vehicle", "carriage", "consoleAsset", "litAsset", "cosmetic",
]);
/** Mirrors the AssetKey regex of src/contracts/world.ts (used to recognise keys while walking). */
const ASSET_KEY_RE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+){2,3}$/;

/** Expands skin anchor ranges: "drawer_0…1" → drawer_0, drawer_1. */
export function expandAnchors(anchors: readonly string[]): string[] {
  return anchors.flatMap((a) => {
    const m = /^(.*_)(\d+)(?:…|\.\.\.)(\d+)$/.exec(a);
    if (!m) return [a];
    const out: string[] = [];
    for (let i = Number(m[2]); i <= Number(m[3]); i++) out.push(`${m[1]}${i}`);
    return out;
  });
}

// ---------------------------------------------------------------- per-encounter context

interface EncInfo {
  index: number;
  encounter: Encounter;
  mode: AnyFamilyMode | undefined;
  modeKey: ModeKey;
  view: unknown;
}

function encInfos(spec: GameSpec): EncInfo[] {
  return spec.encounters.map((encounter, index) => {
    const mode = getMode(encounter.familyId, encounter.mode);
    let view: unknown = null;
    try {
      view = mode ? mode.present(encounter.params, spec.seed + index) : null;
    } catch {
      view = null;
    }
    return { index, encounter, mode, modeKey: `${encounter.familyId}.${encounter.mode}` as ModeKey, view };
  });
}

/** Capitalized multi-word names in a text ("Rosa Parks", "Martin Luther King Jr"), R10. */
export function namesIn(text: string): string[] {
  const out: string[] = [];
  const re = /\b([A-Z][a-z'’]+(?:\s+(?:[A-Z]\.\s*)*[A-Z][a-z'’]+)+)\b/g;
  for (const m of text.matchAll(re)) out.push((m[1] as string).replace(/\s+/g, " "));
  return out;
}

// ---------------------------------------------------------------- the validator

export function validateWorld(spec: GameSpec, world: WorldOverlay, opts: ValidateWorldOptions = {}): ValidateWorldResult {
  const issues: Issue[] = [];
  const warnings: Issue[] = [];
  const P = (...p: Path): Path => ["world", ...p];
  const emit = (rule: WorldRuleId, severity: "error" | "warning", path: Path, message: string, encounterId?: string) => {
    const issue: Issue = { path, message: `${rule}: ${message}`, owner: worldOwnerFor(path), ...(encounterId ? { encounterId } : {}) };
    (severity === "error" ? issues : warnings).push(issue);
  };
  const E = (rule: WorldRuleId, path: Path, message: string, encounterId?: string) => emit(rule, "error", path, message, encounterId);
  const W = (rule: WorldRuleId, path: Path, message: string, encounterId?: string) => emit(rule, "warning", path, message, encounterId);

  const index = opts.assetIndex ?? ASSET_INDEX;
  const built =
    opts.builtNamespaces ??
    new Set(
      opts.assetIndex
        ? [...new Set(Object.values(opts.assetIndex).map((e) => e.ns))]
        : Object.entries(ASSET_INDEX_BY_NAMESPACE)
            .filter(([, idx]) => Object.keys(idx).length > 0)
            .map(([ns]) => ns),
    );
  const kit: BiomeKit | undefined = biomeKitOf(world.biome);
  const encs = encInfos(spec);
  const encIndex = new Map(encs.map((e) => [e.encounter.id, e.index]));
  const zoneIndex = new Map(world.zones.map((z, i) => [z.id, i]));
  const zoneById = new Map(world.zones.map((z) => [z.id, z]));
  const stationByEnc = new Map<string, { st: Station; i: number }>();
  world.stations.forEach((st, i) => {
    if (!stationByEnc.has(st.encounterId)) stationByEnc.set(st.encounterId, { st, i });
  });
  const cutsceneById = new Map<string, Cutscene>();
  const npcIds = new Set(world.npcs.map((n) => n.id));
  const propIds = new Set(world.props.flatMap((p) => (p.id ? [p.id] : [])));
  const collectibleIds = new Set(world.collectibles.map((c) => c.id));
  const triggerIds = new Set(world.triggers.map((t) => t.id));
  const sandboxIds = new Set(world.sandboxes.map((s) => s.id));

  // ================================================================ R1 · assets
  if (!kit) E("R1", P("biome"), `biome "${world.biome}" is not in BIOME_KITS`);
  const assetOk = (key: string, path: Path): boolean => {
    const ns = namespaceOf(key);
    if (ns !== "shared" && ns !== world.biome) {
      E("R1", path, `asset "${key}" is in namespace "${ns}"; use "shared" or "${world.biome}"`);
      return false;
    }
    if (!(key in index)) {
      if (built.has(ns)) E("R1", path, `asset "${key}" is not in the asset index`);
      else W("R1", path, `asset "${key}" is not indexed yet (namespace "${ns}" has no built art; kit stand-ins play)`);
      return false;
    }
    return true;
  };
  walk(world, ["world"], (node, path) => {
    for (const [k, v] of Object.entries(node)) {
      if (ASSET_FIELDS.has(k) && typeof v === "string" && ASSET_KEY_RE.test(v)) assetOk(v, [...path, k]);
      if (k === "costume" && Array.isArray(v)) {
        v.forEach((c, i) => {
          const a = isObj(c) ? c.asset : null;
          if (typeof a === "string" && groupOf(a) !== "costume") E("R1", [...path, k, i, "asset"], `costume asset "${a}" must be in group "costume"`);
        });
      }
    }
  });
  const kindCheck = (key: string, path: Path, want: { group?: string; ns?: string; kinds?: readonly string[]; anims?: readonly string[]; svgWarn?: boolean; what: string }) => {
    if (want.group && groupOf(key) !== want.group) E("R1", path, `${want.what} "${key}" must be in group "${want.group}"`);
    if (want.ns && namespaceOf(key) !== want.ns) E("R1", path, `${want.what} "${key}" must be in namespace "${want.ns}"`);
    const entry = index[key];
    if (!entry) return;
    if (want.kinds && !want.kinds.includes(entry.kind)) {
      if (want.svgWarn && entry.kind === "svg") W("R1", path, `${want.what} "${key}" is an svg: it plays a procedural bob instead of puppet anims`);
      else E("R1", path, `${want.what} "${key}" is kind "${entry.kind}", expected ${want.kinds.join(" or ")}`);
      return;
    }
    if (want.anims && entry.kind === "puppet") {
      const missing = want.anims.filter((a) => !(entry.anims ?? []).includes(a));
      if (missing.length) E("R1", path, `${want.what} "${key}" lacks anims ${missing.join(", ")}`);
    }
  };
  const lookAtlas = (atlas: string, path: Path) => kindCheck(atlas, path, { group: "char", ns: "shared", kinds: ["atlas"], what: "character atlas" });
  lookAtlas(world.cast.protagonist.look.atlas, P("cast", "protagonist", "look", "atlas"));
  kindCheck(world.cast.guide.companion.asset, P("cast", "guide", "companion", "asset"), {
    group: "companion", kinds: ["puppet"], anims: ["idle", "talk", "cue"], svgWarn: true, what: "companion",
  });
  const portrait = (key: string | null, path: Path) => key && kindCheck(key, path, { kinds: ["svg", "puppet"], what: "portrait" });
  portrait(world.cast.guide.portrait, P("cast", "guide", "portrait"));
  world.cast.speakers.forEach((s, i) => portrait(s.portrait, P("cast", "speakers", i, "portrait")));
  world.cast.extras.forEach((s, i) => portrait(s.portrait, P("cast", "extras", i, "portrait")));
  world.npcs.forEach((n, i) => {
    if (n.look) lookAtlas(n.look.atlas, P("npcs", i, "look", "atlas"));
    if (n.asset) kindCheck(n.asset, P("npcs", i, "asset"), { group: "npc", kinds: ["puppet"], anims: ["idle", "talk"], svgWarn: true, what: "npc" });
  });
  world.zones.forEach((z, zi) => {
    const hub = z.hub;
    if (!hub) return;
    const want = [hub.anims.partial, hub.anims.restored].filter((a): a is string => a !== null);
    if (want.length === 0) return;
    const entry = index[hub.asset];
    if (!entry) return;
    if (entry.kind !== "puppet") E("R1", P("zones", zi, "hub", "anims"), `hub anims need a puppet hub asset; "${hub.asset}" is ${entry.kind}`);
    else {
      const missing = want.filter((a) => !(entry.anims ?? []).includes(a));
      if (missing.length) E("R1", P("zones", zi, "hub", "anims"), `hub "${hub.asset}" lacks anims ${missing.join(", ")}`);
    }
  });
  world.cutscenes.forEach((c, ci) =>
    c.steps.forEach((s, si) => {
      if (s.do === "vista") kindCheck(s.asset, P("cutscenes", ci, "steps", si, "asset"), { group: "vista", what: "vista" });
    }),
  );

  // ================================================================ R2 · speakers
  const charIds = new Set(spec.characters.map((c) => c.id));
  if (!charIds.has(world.cast.guide.characterId)) E("R2", P("cast", "guide", "characterId"), `guide "${world.cast.guide.characterId}" is not a spec character`);
  world.cast.speakers.forEach((s, i) => {
    if (!charIds.has(s.characterId)) E("R2", P("cast", "speakers", i, "characterId"), `"${s.characterId}" is not a spec character`);
  });
  const extraSeen = new Set<string>();
  world.cast.extras.forEach((x, i) => {
    if (extraSeen.has(x.id)) E("R2", P("cast", "extras", i, "id"), `extra "${x.id}" is declared twice`);
    extraSeen.add(x.id);
    if (charIds.has(x.id)) E("R2", P("cast", "extras", i, "id"), `extra "${x.id}" collides with a spec character id`);
    if (x.id === PLAYER_SPEAKER || x.id === NARRATOR_SPEAKER) E("R2", P("cast", "extras", i, "id"), `extra id "${x.id}" is reserved`);
  });
  const speakerIds = new Set([...charIds, ...extraSeen, PLAYER_SPEAKER, NARRATOR_SPEAKER]);
  walk(world, ["world"], (node, path) => {
    if (typeof node.speakerId === "string" && !speakerIds.has(node.speakerId)) {
      E("R2", [...path, "speakerId"], `unknown speaker "${node.speakerId}" (not a spec character, an extra, player or narrator)`);
    }
  });

  // ================================================================ R3 · zones
  const zoneSeen = new Set<string>();
  world.zones.forEach((z, zi) => {
    if (zoneSeen.has(z.id)) E("R3", P("zones", zi, "id"), `zone id "${z.id}" is used twice`);
    zoneSeen.add(z.id);
    const setIds = new Set(z.layerSets.map((l) => l.id));
    let x = 0;
    z.segments.forEach((s, si) => {
      if (Math.abs(s.x0 - x) > 1e-6) E("R3", P("zones", zi, "segments", si, "x0"), `segment "${s.id}" starts at ${s.x0}, expected ${x} (segments are ordered and contiguous)`);
      if (!(s.x1 > s.x0)) E("R3", P("zones", zi, "segments", si, "x1"), `segment "${s.id}" is empty or reversed`);
      if (!setIds.has(s.layerSet)) E("R3", P("zones", zi, "segments", si, "layerSet"), `layer set "${s.layerSet}" is not in zone "${z.id}"`);
      x = s.x1;
    });
    if (Math.abs(x - z.width) > 1e-6) E("R3", P("zones", zi, "segments"), `segments end at ${x}, not the zone width ${z.width}`);
    const segIds = new Set(z.segments.map((s) => s.id));
    z.interiors.forEach((it, ii) => {
      if (!(it.x0 >= 0 && it.x1 <= z.width && it.x0 < it.x1)) E("R3", P("zones", zi, "interiors", ii), `interior "${it.id}" is not inside [0, ${z.width}]`);
      if (it.segment !== null && !segIds.has(it.segment)) E("R3", P("zones", zi, "interiors", ii, "segment"), `segment "${it.segment}" is not in zone "${z.id}"`);
      z.interiors.slice(ii + 1).forEach((o) => {
        if (it.x0 < o.x1 && o.x0 < it.x1) E("R3", P("zones", zi, "interiors", ii), `interiors "${it.id}" and "${o.id}" overlap`);
      });
    });
    z.exits.forEach((ex, ei) => {
      const to = zoneById.get(ex.toZoneId);
      if (!to) E("R3", P("zones", zi, "exits", ei, "toZoneId"), `exit to unknown zone "${ex.toZoneId}"`);
      else if (ex.toX > to.width) E("R3", P("zones", zi, "exits", ei, "toX"), `exit lands at x ${ex.toX}, past zone "${to.id}" (width ${to.width})`);
      if (ex.x > z.width) E("R3", P("zones", zi, "exits", ei, "x"), `exit x ${ex.x} is outside zone "${z.id}"`);
    });
    if (z.entry.x > z.width) E("R3", P("zones", zi, "entry", "x"), `entry x ${z.entry.x} is outside zone "${z.id}"`);
  });
  const zonesWithStations = new Set(world.stations.map((s) => s.zoneId));
  const lastStationZone = Math.max(-1, ...world.stations.map((s) => zoneIndex.get(s.zoneId) ?? -1));
  const bossEnc = spec.encounters.findIndex((e) => e.role === "boss");
  if (bossEnc >= 0) {
    const bossSt = stationByEnc.get(spec.encounters[bossEnc]!.id);
    if (bossSt && (zoneIndex.get(bossSt.st.zoneId) ?? -1) !== lastStationZone) {
      E("R3", P("stations", bossSt.i, "zoneId"), "the boss station must be in the last zone that has stations", bossSt.st.encounterId);
    }
  }
  let run = 0;
  world.zones.forEach((z, zi) => {
    run = zonesWithStations.has(z.id) ? 0 : run + 1;
    if (run === 3) W("R3", P("zones", zi), `more than two consecutive zones without a station (ending at "${z.id}")`);
  });

  // ================================================================ R4 · stations follow encounters
  world.stations.forEach((st, i) => {
    if (!encIndex.has(st.encounterId)) E("R4", P("stations", i, "encounterId"), `station for unknown encounter "${st.encounterId}"`);
    else if (stationByEnc.get(st.encounterId)?.i !== i) E("R4", P("stations", i, "encounterId"), `encounter "${st.encounterId}" has more than one station`, st.encounterId);
    if (!zoneIndex.has(st.zoneId)) E("R4", P("stations", i, "zoneId"), `station in unknown zone "${st.zoneId}"`, st.encounterId);
  });
  let prev: { z: number; x: number; id: string } | null = null;
  for (const e of encs) {
    const hit = stationByEnc.get(e.encounter.id);
    if (!hit) {
      E("R4", P("stations"), `encounter "${e.encounter.id}" has no station`, e.encounter.id);
      continue;
    }
    const z = zoneIndex.get(hit.st.zoneId) ?? -1;
    const cur = { z, x: hit.st.consoleX, id: e.encounter.id };
    if (prev && !(cur.z > prev.z || (cur.z === prev.z && cur.x > prev.x))) {
      E("R4", P("stations", hit.i, "consoleX"), `station "${cur.id}" must come after "${prev.id}" (zone, consoleX strictly increase with the encounter index)`, cur.id);
    }
    prev = cur;
  }

  // ================================================================ R5 · contraption compatibility (and the parsed configs R6/R14/R15 use)
  interface StationCtx {
    st: Station;
    i: number;
    enc: EncInfo;
    meta: AnyContraptionMeta | undefined;
    parsed: unknown;
    parsedOk: boolean;
    layout: string | null;
  }
  const stationCtx: StationCtx[] = [];
  world.stations.forEach((st, i) => {
    const ei = encIndex.get(st.encounterId);
    if (ei === undefined) return;
    const enc = encs[ei]!;
    const id = st.encounterId;
    const meta = getContraption(st.contraption);
    const ctx: StationCtx = { st, i, enc, meta, parsed: null, parsedOk: false, layout: null };
    stationCtx.push(ctx);
    if (!meta) return E("R5", P("stations", i, "contraption"), `unknown contraption "${st.contraption}"`, id);
    if (meta.status === "post_demo") W("R5", P("stations", i, "contraption"), `"${meta.id}" is post-demo`, id);
    if (!meta.modes.includes(enc.modeKey)) E("R5", P("stations", i, "contraption"), `"${meta.id}" does not play ${enc.modeKey}`, id);
    const skin = skinOf(meta, st.skin);
    if (!skin) E("R5", P("stations", i, "skin"), `"${st.skin}" is not a skin of "${meta.id}"`, id);
    else if (skin.biomes !== "any" && !skin.biomes.includes(world.biome)) E("R5", P("stations", i, "skin"), `skin "${st.skin}" does not allow biome "${world.biome}"`, id);
    const parsed = meta.configSchema.safeParse(st.config);
    if (!parsed.success) {
      parsed.error.issues.forEach((iss) =>
        E("R5", P("stations", i, "config", ...iss.path.map((x) => (typeof x === "symbol" ? String(x) : x))), `config: ${iss.message}`, id),
      );
    } else {
      ctx.parsed = parsed.data;
      ctx.parsedOk = true;
      try {
        const cfgIssues = meta.validateConfig(parsed.data, configCtxFor(spec, ei, world.biome));
        cfgIssues.forEach((ci) => emit("R5", ci.severity, P("stations", i, "config", ...ci.path), `config: ${ci.message}`, id));
      } catch (err) {
        E("R5", P("stations", i, "config"), `config validator threw: ${(err as Error).message}`, id);
      }
    }
    ctx.layout = st.panel.layout ?? meta.defaultLayout;
    if (st.panel.layout !== null && !meta.layouts.includes(st.panel.layout)) E("R5", P("stations", i, "panel", "layout"), `layout "${st.panel.layout}" is not one of ${meta.layouts.join(", ")}`, id);
    if (!meta.payoffs.includes(st.payoff.anim)) E("R5", P("stations", i, "payoff", "anim"), `payoff "${st.payoff.anim}" is not one of ${meta.payoffs.join(", ")}`, id);
    st.accessories.forEach((a, ai) => {
      if (!meta.accessories.includes(a.kind)) E("R5", P("stations", i, "accessories", ai, "kind"), `"${meta.id}" takes no ${a.kind}`, id);
    });
    const legalKeys = new Set<string>([...meta.nearMissKeys, ...failKeysFor(enc.modeKey), ...st.probes.map((p) => p.key)]);
    st.dialogue.fail.byKey.forEach((b, bi) => {
      if (!legalKeys.has(b.key)) E("R5", P("stations", i, "dialogue", "fail", "byKey", bi, "key"), `fail key "${b.key}" is not a probe, near-miss or fail key of this station`, id);
    });
    st.boss?.taunts.byKey.forEach((b, bi) => {
      if (!legalKeys.has(b.key)) E("R5", P("stations", i, "boss", "taunts", "byKey", bi, "key"), `taunt key "${b.key}" is not a probe, near-miss or fail key of this station`, id);
    });
    // several probes may share one key (an OR of predicates for one misconception)
    st.probes.forEach((pr, pi) => {
      probeRefIssues(pr, enc.modeKey, enc.view).forEach((msg) => E("R5", P("stations", i, "probes", pi), msg, id));
    });
    if (st.hintTargets && skin) {
      const anchors = new Set(expandAnchors(skin.anchors));
      st.hintTargets.forEach((rung, ri) =>
        rung.forEach((t, ti) => {
          if (!anchors.has(t.anchor)) E("R5", P("stations", i, "hintTargets", ri, ti, "anchor"), `anchor "${t.anchor}" is not an anchor of skin "${skin.id}"`, id);
        }),
      );
    }
  });

  // ================================================================ R6 · geometry
  const inZone = (z: Zone, x: number, y: number | null = null) => x >= 0 && x <= z.width && (y === null || (y >= 0 && y <= z.height));
  world.zones.forEach((z, zi) => {
    const pts = z.ground.points;
    pts.forEach(([x, y], pi) => {
      if (pi > 0 && !(x > (pts[pi - 1] as [number, number])[0])) E("R6", P("zones", zi, "ground", "points", pi), "ground x must strictly ascend");
      if (y < 0 || y > z.height) E("R6", P("zones", zi, "ground", "points", pi), `ground y ${y} is outside [0, ${z.height}]`);
    });
    if (pts[0]?.[0] !== 0 || pts[pts.length - 1]?.[0] !== z.width) E("R6", P("zones", zi, "ground", "points"), `the ground must span [0, ${z.width}]`);
    z.platforms.forEach((pl, pli) => {
      pl.points.forEach(([x, y], pi) => {
        if (!inZone(z, x, y)) E("R6", P("zones", zi, "platforms", pli, "points", pi), `platform "${pl.id}" point (${x}, ${y}) is outside the zone`);
        if (pi > 0 && !(x > (pl.points[pi - 1] as [number, number])[0])) E("R6", P("zones", zi, "platforms", pli, "points", pi), `platform "${pl.id}" x must strictly ascend`);
      });
    });
  });
  const stationsInZone = (zoneId: string) => stationCtx.filter((c) => c.st.zoneId === zoneId).sort((a, b) => a.enc.index - b.enc.index);
  for (const c of stationCtx) {
    const { st, i } = c;
    const id = st.encounterId;
    const z = zoneById.get(st.zoneId);
    if (!z) continue;
    if (st.consoleX > z.width) E("R6", P("stations", i, "consoleX"), `consoleX ${st.consoleX} is outside zone "${z.id}"`, id);
    if (!inZone(z, st.anchor.x, st.anchor.y)) E("R6", P("stations", i, "anchor"), `anchor (${st.anchor.x}, ${st.anchor.y}) is outside zone "${z.id}"`, id);
    if (c.meta && c.parsedOk) {
      try {
        const b = c.meta.frameBounds(c.parsed, c.enc.view);
        const x0 = st.anchor.x + b.x;
        const y0 = st.anchor.y + b.y;
        if (x0 < 0 || y0 < -400 || x0 + b.w > z.width || y0 + b.h > z.height) W("R6", P("stations", i, "anchor"), "the contraption's frame bounds leave the zone", id);
      } catch {
        /* the meta's live half may still be a stub */
      }
    }
    if (st.payoff.kind !== PAYOFF_KIND_OF[st.payoff.anim]) {
      E("R6", P("stations", i, "payoff", "kind"), `payoff kind "${st.payoff.kind}" must be "${PAYOFF_KIND_OF[st.payoff.anim]}" for anim "${st.payoff.anim}"`, id);
    }
    const blocker = st.payoff.blocker;
    if (blocker) {
      const later = stationsInZone(st.zoneId).find((o) => o.enc.index > c.enc.index);
      const hi = later ? later.st.consoleX : z.width;
      if (!(blocker.x > st.consoleX && blocker.x <= hi)) {
        E("R6", P("stations", i, "payoff", "blocker", "x"), `blocker x ${blocker.x} must lie between this console (${st.consoleX}) and ${later ? `the next console (${hi})` : `the zone edge (${hi})`}`, id);
      }
    }
    st.payoff.terrain.forEach((t, ti) =>
      t.points.forEach(([x, y], pi) => {
        if (!inZone(z, x, y)) E("R6", P("stations", i, "payoff", "terrain", ti, "points", pi), `terrain point (${x}, ${y}) is outside the zone`, id);
      }),
    );
    if (st.payoff.kind === "terrain" && st.payoff.terrain.length === 0) {
      const opener = z.links.some((l) => l.requires?.solved === id);
      if (!opener) E("R6", P("stations", i, "payoff", "terrain"), "an empty terrain payoff needs a link in the zone with requires.solved = this station", id);
    }
  }
  // ride and carry cutscenes end later (checked with R7's cutscene table below)

  // ================================================================ R7 · cutscenes
  world.cutscenes.forEach((c, ci) => {
    if (cutsceneById.has(c.id)) E("R7", P("cutscenes", ci, "id"), `cutscene id "${c.id}" is used twice`);
    else cutsceneById.set(c.id, c);
  });
  const needCutscene = (id: string | null, path: Path) => {
    if (id !== null && !cutsceneById.has(id)) E("R7", path, `unknown cutscene "${id}"`);
  };
  needCutscene(world.story.introCutsceneId, P("story", "introCutsceneId"));
  needCutscene(world.story.finaleCutsceneId, P("story", "finaleCutsceneId"));
  world.zones.forEach((z, zi) => {
    needCutscene(z.entryCutsceneId, P("zones", zi, "entryCutsceneId"));
    z.exits.forEach((ex, ei) => needCutscene(ex.cutsceneId, P("zones", zi, "exits", ei, "cutsceneId")));
  });
  world.stations.forEach((st, i) => {
    needCutscene(st.payoff.rideCutsceneId, P("stations", i, "payoff", "rideCutsceneId"));
    needCutscene(st.boss?.arenaCutsceneId ?? null, P("stations", i, "boss", "arenaCutsceneId"));
  });
  world.triggers.forEach((t, ti) => {
    if (t.cutsceneId === null) return;
    const c = cutsceneById.get(t.cutsceneId);
    if (!c) E("R7", P("triggers", ti, "cutsceneId"), `unknown cutscene "${t.cutsceneId}"`);
    else if (!c.skippable) E("R7", P("triggers", ti, "cutsceneId"), `trigger cutscenes must be skippable ("${c.id}" is not)`);
  });
  const surfaceSpan = (z: Zone, surface: string): readonly [number, number] | null => {
    if (surface === "ground") return [0, z.width];
    const pl = z.platforms.find((p) => p.id === surface);
    return pl ? polylineSpan(pl.points) : null;
  };
  const actors = new Set(["player", "companion", ...npcIds]);
  world.cutscenes.forEach((c, ci) =>
    c.steps.forEach((s, si) => {
      const path = P("cutscenes", ci, "steps", si);
      switch (s.do) {
        case "enter_zone": {
          const z = zoneById.get(s.zoneId);
          if (!z) E("R7", [...path, "zoneId"], `unknown zone "${s.zoneId}"`);
          else if (s.x > z.width) E("R7", [...path, "x"], `x ${s.x} is outside zone "${z.id}"`);
          break;
        }
        case "ride": {
          const z = zoneById.get(s.toZoneId);
          if (!z) {
            E("R7", [...path, "toZoneId"], `unknown zone "${s.toZoneId}"`);
            break;
          }
          const span = surfaceSpan(z, s.toSurface);
          if (!span) E("R7", [...path, "toSurface"], `"${s.toSurface}" is not a surface of zone "${z.id}"`);
          else if (s.toX < span[0] || s.toX > span[1]) E("R7", [...path, "toX"], `toX ${s.toX} is outside surface "${s.toSurface}" [${span[0]}, ${span[1]}]`);
          break;
        }
        case "station":
          if (!encIndex.has(s.encounterId)) E("R7", [...path, "encounterId"], `unknown encounter "${s.encounterId}"`);
          break;
        case "walk":
        case "emote":
          if (!actors.has(s.actor)) E("R7", [...path, "actor"], `unknown actor "${s.actor}" (player, companion or an npc id)`);
          break;
        case "hub":
          if (!zoneById.has(s.zoneId)) E("R7", [...path, "zoneId"], `unknown zone "${s.zoneId}"`);
          else if (!zoneById.get(s.zoneId)!.hub) E("R7", [...path, "zoneId"], `zone "${s.zoneId}" has no hub`);
          break;
        case "await_interact": {
          const { kind, id } = s.target;
          const ok = kind === "npc" ? npcIds.has(id) : kind === "prop" ? propIds.has(id) : kind === "station" ? encIndex.has(id) : sandboxIds.has(id);
          if (!ok) E("R7", [...path, "target"], `await_interact target ${kind} "${id}" does not exist${kind === "prop" ? " (a prop target needs an id)" : ""}`);
          if (!c.skippable) E("R7", path, `interactive step in unskippable cutscene "${c.id}"`);
          break;
        }
        case "control_until":
          if (!c.skippable) E("R7", path, `interactive step in unskippable cutscene "${c.id}"`);
          break;
        case "set_state": {
          const { kind, id } = s.target;
          const ok =
            kind === "flag" ? true : kind === "prop" ? propIds.has(id) : kind === "npc" ? npcIds.has(id) : kind === "station" ? encIndex.has(id) : zoneById.get(id)?.hub != null;
          if (!ok) E("R7", [...path, "target"], `set_state target ${kind} "${id}" does not exist`);
          break;
        }
        default:
          break;
      }
    }),
  );
  // R6 (cont.): ride and carry cutscenes end in a later zone, or later in the same zone
  for (const c of stationCtx) {
    const { st, i } = c;
    if ((st.payoff.kind !== "ride" && st.payoff.kind !== "carry") || !st.payoff.rideCutsceneId) continue;
    const cs = cutsceneById.get(st.payoff.rideCutsceneId);
    if (!cs) continue;
    let end: { z: number; x: number } | null = null;
    for (const s of cs.steps) {
      if (s.do === "ride") end = { z: zoneIndex.get(s.toZoneId) ?? -1, x: s.toX };
      if (s.do === "enter_zone") end = { z: zoneIndex.get(s.zoneId) ?? -1, x: s.x };
    }
    const here = zoneIndex.get(st.zoneId) ?? -1;
    if (end && !(end.z > here || (end.z === here && end.x > st.consoleX))) {
      E("R6", P("stations", i, "payoff", "rideCutsceneId"), `ride cutscene "${cs.id}" must end in a later zone or later in this zone`, st.encounterId);
    }
  }

  // ================================================================ R8 · answer leaks
  const banned = new Map<string, string[]>();
  for (const e of encs) banned.set(e.encounter.id, e.mode ? bannedValuesFor(e.mode, e.encounter.params, e.encounter.solution) : []);
  const leakCheck = (text: string, path: Path, encounterId: string, severity: "error" | "warning", scope: string) => {
    const hit = leakedValues(text, banned.get(encounterId) ?? []);
    if (hit.length) emit("R8", severity, path, `${scope} text reveals the answer of "${encounterId}" (${hit.map((h) => `"${h}"`).join(", ")})`, encounterId);
  };
  for (const { st, i } of stationCtx) {
    const id = st.encounterId;
    const d = st.dialogue;
    const S = (text: string, ...p: Path) => leakCheck(text, P("stations", i, ...p), id, "error", "station");
    d.approach.forEach((l, k) => S(l.text, "dialogue", "approach", k, "text"));
    S(d.instruction.text, "dialogue", "instruction", "text");
    if (d.tutorial) S(d.tutorial.text, "dialogue", "tutorial", "text");
    if (d.insight) S(d.insight.text, "dialogue", "insight", "text");
    if (d.hints) {
      S(d.hints[0].text, "dialogue", "hints", 0, "text");
      S(d.hints[1].text, "dialogue", "hints", 1, "text");
    }
    S(d.fail.default.text, "dialogue", "fail", "default", "text");
    d.fail.byKey.forEach((b, k) => S(b.line.text, "dialogue", "fail", "byKey", k, "line", "text"));
    st.pins.forEach((p, k) => p.text && S(p.text, "pins", k, "text"));
    if (st.boss) {
      st.boss.taunts.approach.forEach((l, k) => S(l.text, "boss", "taunts", "approach", k, "text"));
      st.boss.taunts.fail.forEach((l, k) => S(l.text, "boss", "taunts", "fail", k, "text"));
      st.boss.taunts.byKey.forEach((b, k) => S(b.line.text, "boss", "taunts", "byKey", k, "line", "text"));
    }
  }
  // world-scoped texts: warnings against every station not implied solved
  const solvedThrough = (req: Pick<Requirement, "solved"> | null): number => (req?.solved ? (encIndex.get(req.solved) ?? -1) : -1);
  const worldText = (text: string, path: Path, through: number) => {
    for (const e of encs) if (e.index > through) leakCheck(text, path, e.encounter.id, "warning", "world");
  };
  world.triggers.forEach((t, ti) => t.lines.forEach((l, k) => worldText(l.text, P("triggers", ti, "lines", k, "text"), solvedThrough(t.requires))));
  world.npcs.forEach((n, ni) =>
    n.states.forEach((s, si) => s.lines.forEach((l, k) => worldText(l.text, P("npcs", ni, "states", si, "lines", k, "text"), solvedThrough(s.requires)))),
  );
  world.plaques.forEach((p, pi) => worldText(p.text, P("plaques", pi, "text"), solvedThrough(p.requires)));
  world.collectibles.forEach((c, ci) => worldText(c.text, P("collectibles", ci, "text"), solvedThrough(c.requires)));
  world.quests.forEach((q, qi) => {
    const through = Math.max(-1, ...q.steps.map((s) => (s.kind === "afterSeal" ? (encIndex.get(s.encounterId) ?? -1) : -1)));
    q.reward.lines.forEach((l, k) => worldText(l.text, P("quests", qi, "reward", "lines", k, "text"), through));
    if (q.reward.debriefLine) worldText(q.reward.debriefLine, P("quests", qi, "reward", "debriefLine"), through);
  });
  const cutsceneThrough = new Map<string, number>();
  const noteThrough = (id: string | null, through: number) => {
    if (id === null) return;
    cutsceneThrough.set(id, Math.min(cutsceneThrough.get(id) ?? Infinity, through));
  };
  noteThrough(world.story.introCutsceneId, -1);
  world.zones.forEach((z, zi) => {
    const before = stationCtx.filter((c) => (zoneIndex.get(c.st.zoneId) ?? -1) < zi).map((c) => c.enc.index);
    const through = before.length ? Math.max(...before) : -1;
    noteThrough(z.entryCutsceneId, through);
    z.exits.forEach((ex) => noteThrough(ex.cutsceneId, through));
  });
  stationCtx.forEach((c) => {
    noteThrough(c.st.payoff.rideCutsceneId, c.enc.index);
    noteThrough(c.st.boss?.arenaCutsceneId ?? null, c.enc.index - 1);
  });
  world.triggers.forEach((t) => noteThrough(t.cutsceneId, solvedThrough(t.requires)));
  world.cutscenes.forEach((c, ci) => {
    if (c.id === world.story.finaleCutsceneId) return;
    const through = cutsceneThrough.get(c.id) ?? -1;
    c.steps.forEach((s, si) => {
      if (s.do === "say") s.lines.forEach((l, k) => worldText(l.text, P("cutscenes", ci, "steps", si, "lines", k, "text"), Number.isFinite(through) ? through : -1));
    });
  });

  // ================================================================ R9 · text budgets
  walk(world, ["world"], (node, path) => {
    if (typeof node.text === "string" && typeof node.speakerId !== "undefined") {
      const text = node.text;
      if (text.length > 140) E("R9", [...path, "text"], `line is ${text.length} characters (max 140)`);
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      if (words > 24) emit("R9", opts.sidecar ? "warning" : "error", [...path, "text"], `line is ${words} words (max 24)`);
    }
  });
  for (const { st, i, meta } of stationCtx) {
    const id = st.encounterId;
    const nouns = [st.objectNoun, ...st.partNouns, ...(meta ? (skinOf(meta, st.skin)?.nouns ?? []) : [])];
    if (!nouns.some((n) => containsPhrase(st.dialogue.instruction.text, n))) {
      E("R9", P("stations", i, "dialogue", "instruction", "text"), `the instruction must name "${st.objectNoun}", a part noun or a skin noun`, id);
    }
    const v = st.panel.verifyLabel;
    if (v.length > 24 || v !== v.toUpperCase()) E("R9", P("stations", i, "panel", "verifyLabel"), `verifyLabel "${v}" must be ≤ 24 characters in caps`, id);
    if (st.panel.successBadge.length > 28) E("R9", P("stations", i, "panel", "successBadge"), `successBadge is longer than 28 characters`, id);
  }

  // ================================================================ R10 · history sensitivity
  if (kit?.sensitive) {
    world.npcs.forEach((n, ni) => {
      if (n.look && !kit.fictionalStaff.includes(n.look.atlas)) E("R10", P("npcs", ni, "look", "atlas"), `human NPCs use the kit's fictional staff (${kit.fictionalStaff.join(", ")}), not "${n.look.atlas}"`);
    });
    walk(world, ["world"], (node, path) => {
      for (const [k, v] of Object.entries(node)) {
        if (ASSET_FIELDS.has(k) && typeof v === "string" && /portrait/.test(v) && !/\.(doc|silhouette)\./.test(v)) {
          E("R10", [...path, k], `"${v}": portraits in a sensitive biome must be document or silhouette assets`);
        }
      }
    });
    const specTexts = [
      ...spec.encounters.flatMap((e) => [...stringsIn(e.params), e.prompt, ...(e.sourceRef ? [e.sourceRef.quote] : [])]),
      ...spec.narrative.intro.map((l) => l.text),
      ...spec.narrative.outro.map((l) => l.text),
      ...spec.narrative.beats.map((l) => l.text),
    ];
    const people = [...new Set([...specTexts.flatMap(namesIn), ...kit.protectedNames])];
    const nameClash = (name: string) => people.find((p) => containsPhrase(name, p) || containsPhrase(p, name));
    world.npcs.forEach((n, ni) => {
      const hit = nameClash(n.name);
      if (hit) E("R10", P("npcs", ni, "name"), `NPC name "${n.name}" matches a real person named in the spec ("${hit}")`);
    });
    world.cast.extras.forEach((x, xi) => {
      const hit = nameClash(x.name);
      if (hit) E("R10", P("cast", "extras", xi, "name"), `extra name "${x.name}" matches a real person named in the spec ("${hit}")`);
    });
    const violent = (text: string) => kit.violenceLexicon.find((w) => containsPhrase(text, w));
    world.plaques.forEach((p, pi) => {
      const w = violent(`${p.title} ${p.text}`);
      if (w && p.kind === "plaque") E("R10", P("plaques", pi, "kind"), `plaque "${p.id}" describes violence ("${w}"): use kind "document" or "photo_withheld"`);
    });
    world.collectibles.forEach((c, ci) => {
      const w = violent(`${c.title} ${c.text}`);
      if (w) E("R10", P("collectibles", ci, "text"), `collectible "${c.id}" describes violence ("${w}"): move it to a document or photo_withheld plaque`);
    });
    for (const { st, i, meta } of stationCtx) {
      const skin = meta ? skinOf(meta, st.skin) : undefined;
      if (skin && !skin.sensitiveSafe) E("R10", P("stations", i, "skin"), `skin "${skin.id}" is not sensitiveSafe`, st.encounterId);
    }
    if (kit.successPose !== "show") E("R10", P("biome"), `sensitive kit "${kit.id}" must use successPose "show"`);
    world.npcs.forEach((n, ni) =>
      n.states.forEach((s, si) => {
        if (s.pose === "cheer") E("R10", P("npcs", ni, "states", si, "pose"), "no NPC cheers in a sensitive biome");
      }),
    );
  }

  // ================================================================ R11 · traversal links
  world.zones.forEach((z, zi) => {
    const endOk = (end: { surface: string; x: number }, path: Path) => {
      const span = surfaceSpan(z, end.surface);
      if (!span) E("R11", [...path, "surface"], `"${end.surface}" is not a surface of zone "${z.id}"`);
      else if (end.x < span[0] - 1e-6 || end.x > span[1] + 1e-6) E("R11", [...path, "x"], `x ${end.x} is outside surface "${end.surface}" [${span[0]}, ${span[1]}]`);
    };
    z.links.forEach((l, li) => {
      const path = P("zones", zi, "links", li);
      endOk(l.from, [...path, "from"]);
      endOk(l.to, [...path, "to"]);
      if (l.kind === "ladder" && Math.abs(l.from.x - l.to.x) > 40) E("R11", path, `ladder "${l.id}" ends are ${Math.abs(l.from.x - l.to.x)} apart (max 40)`);
      if (l.kind === "timed_hop") {
        if (!(l.open[0] < l.open[1])) E("R11", [...path, "open"], `timed_hop "${l.id}" needs open[0] < open[1]`);
        endOk(l.missTo, [...path, "missTo"]);
      }
      if (l.kind === "ride") l.path.forEach(([x, y], pi) => !inZone(z, x, y) && E("R11", [...path, "path", pi], `ride "${l.id}" path point (${x}, ${y}) leaves the zone`));
      // no link bypasses an unsolved blocker
      const lo = Math.min(l.from.x, l.to.x);
      const hi = Math.max(l.from.x, l.to.x);
      for (const c of stationCtx) {
        const b = c.st.payoff.blocker;
        if (c.st.zoneId !== z.id || !b || !(lo < b.x && b.x < hi)) continue;
        const req = l.requires?.solved ? (encIndex.get(l.requires.solved) ?? -1) : -1;
        if (req < c.enc.index) E("R11", path, `link "${l.id}" crosses the blocker of "${c.st.encounterId}" at x ${b.x} without requiring it solved`);
      }
    });
    // sheer edges between consecutive consoles
    const zs = stationsInZone(z.id);
    const pts = z.ground.points;
    for (let k = 0; k + 1 < zs.length; k++) {
      const a = zs[k]!;
      const b = zs[k + 1]!;
      for (let pi = 0; pi + 1 < pts.length; pi++) {
        const [x0, y0] = pts[pi] as [number, number];
        const [x1, y1] = pts[pi + 1] as [number, number];
        if (!(x1 - x0 <= 8 && Math.abs(y1 - y0) > z.ground.maxStepUp)) continue;
        const ex = (x0 + x1) / 2;
        if (!(ex > a.st.consoleX && ex < b.st.consoleX)) continue;
        const byLink = z.links.some((l) => Math.min(l.from.x, l.to.x) <= ex && ex <= Math.max(l.from.x, l.to.x));
        const byTerrain = a.st.payoff.terrain.some((t) => {
          const span = polylineSpan(t.points);
          return !!span && span[0] <= ex && ex <= span[1];
        });
        if (!byLink && !byTerrain) W("R11", P("zones", zi, "ground", "points", pi), `a sheer edge at x ${ex} between "${a.st.encounterId}" and "${b.st.encounterId}" has no link or payoff terrain across it`);
      }
    }
  });

  // ================================================================ R12 · side content
  const declaredFlags = declaredFlagsOf(world);
  const uniq = (what: string, ids: readonly string[], path: (i: number) => Path) => {
    const seen = new Set<string>();
    ids.forEach((id, i) => {
      if (seen.has(id)) E("R12", path(i), `${what} id "${id}" is used twice`);
      seen.add(id);
    });
  };
  {
    // props without ids are fine; only named ones must be unique
    const seen = new Set<string>();
    world.props.forEach((p, i) => {
      if (p.id === null) return;
      if (seen.has(p.id)) E("R12", P("props", i, "id"), `prop id "${p.id}" is used twice`);
      seen.add(p.id);
    });
  }
  uniq("npc", world.npcs.map((n) => n.id), (i) => P("npcs", i, "id"));
  uniq("quest", world.quests.map((q) => q.id), (i) => P("quests", i, "id"));
  uniq("trigger", world.triggers.map((t) => t.id), (i) => P("triggers", i, "id"));
  uniq("sandbox", world.sandboxes.map((s) => s.id), (i) => P("sandboxes", i, "id"));
  uniq("collectible", world.collectibles.map((c) => c.id), (i) => P("collectibles", i, "id"));
  uniq("plaque", world.plaques.map((p) => p.id), (i) => P("plaques", i, "id"));
  world.npcs.forEach((n, ni) => uniq(`npc "${n.id}" state`, n.states.map((s) => s.id), (i) => P("npcs", ni, "states", i, "id")));
  walk(world, ["world"], (node, path) => {
    const req = node.requires;
    if (!isObj(req)) return;
    const r = req as Requirement;
    if (r.solved && !encIndex.has(r.solved)) E("R12", [...path, "requires", "solved"], `requires unknown encounter "${r.solved}"`);
    for (const f of [r.flag, r.notFlag]) if (f && !declaredFlags.has(f)) E("R12", [...path, "requires"], `flag "${f}" is never set (declare it with a quest reward, trigger, NPC state, sandbox or cutscene)`);
    (r.collected ?? []).forEach((c, k) => !collectibleIds.has(c) && E("R12", [...path, "requires", "collected", k], `unknown collectible "${c}"`));
  });
  if (world.cast.guide.companion.awakeFlag && !declaredFlags.has(world.cast.guide.companion.awakeFlag)) {
    E("R12", P("cast", "guide", "companion", "awakeFlag"), `flag "${world.cast.guide.companion.awakeFlag}" is never set`);
  }
  const touchProps = new Set(world.props.flatMap((p) => (p.id && p.touch ? [p.id] : [])));
  world.quests.forEach((q, qi) => {
    if (q.giverNpcId && !npcIds.has(q.giverNpcId)) E("R12", P("quests", qi, "giverNpcId"), `unknown npc "${q.giverNpcId}"`);
    if (q.reward.collectibleId && !collectibleIds.has(q.reward.collectibleId)) E("R12", P("quests", qi, "reward", "collectibleId"), `unknown collectible "${q.reward.collectibleId}"`);
    q.steps.forEach((s, si) => {
      const path = P("quests", qi, "steps", si);
      switch (s.kind) {
        case "talk": {
          const npc = world.npcs.find((n) => n.id === s.npcId);
          if (!npc) E("R12", [...path, "npcId"], `unknown npc "${s.npcId}"`);
          else if (s.stateId && !npc.states.some((st) => st.id === s.stateId)) E("R12", [...path, "stateId"], `npc "${s.npcId}" has no state "${s.stateId}"`);
          break;
        }
        case "collect":
          s.ids.forEach((c, k) => !collectibleIds.has(c) && E("R12", [...path, "ids", k], `unknown collectible "${c}"`));
          break;
        case "touch":
          s.propIds.forEach((p, k) => !touchProps.has(p) && E("R12", [...path, "propIds", k], `prop "${p}" does not exist or has no touch block`));
          break;
        case "afterSeal":
          if (!encIndex.has(s.encounterId)) E("R12", [...path, "encounterId"], `unknown encounter "${s.encounterId}"`);
          break;
        case "visit":
          if (!triggerIds.has(s.triggerId)) E("R12", [...path, "triggerId"], `unknown trigger "${s.triggerId}"`);
          break;
      }
    });
  });
  world.npcs.forEach((n, ni) => {
    if ((n.look === null) === (n.asset === null)) E("R12", P("npcs", ni), `npc "${n.id}" needs exactly one of look and asset`);
    const entry = n.asset ? index[n.asset] : undefined;
    n.states.forEach((s, si) => {
      if (!zoneById.has(s.zoneId)) E("R12", P("npcs", ni, "states", si, "zoneId"), `unknown zone "${s.zoneId}"`);
      if (s.anim === null) return;
      if (n.asset && entry?.kind === "puppet") {
        if (!(entry.anims ?? []).includes(s.anim)) E("R12", P("npcs", ni, "states", si, "anim"), `"${s.anim}" is not an anim of puppet "${n.asset}"`);
      } else if (n.look || entry?.kind === "svg") {
        W("R12", P("npcs", ni, "states", si, "anim"), `npc "${n.id}" is ${n.look ? "on the rig" : "an svg"}: anim "${s.anim}" is ignored`);
      }
    });
  });
  const zoneRef = (zoneId: string, path: Path) => !zoneById.has(zoneId) && E("R12", path, `unknown zone "${zoneId}"`);
  world.props.forEach((p, i) => zoneRef(p.zoneId, P("props", i, "zoneId")));
  world.triggers.forEach((t, i) => zoneRef(t.zoneId, P("triggers", i, "zoneId")));
  world.collectibles.forEach((c, i) => zoneRef(c.zoneId, P("collectibles", i, "zoneId")));
  world.plaques.forEach((p, i) => zoneRef(p.zoneId, P("plaques", i, "zoneId")));
  world.sandboxes.forEach((s, si) => {
    zoneRef(s.zoneId, P("sandboxes", si, "zoneId"));
    const meta = getSandbox(s.contraption);
    if (!meta) return E("R12", P("sandboxes", si, "contraption"), `unknown sandbox "${s.contraption}"`);
    if (!meta.skins.some((k) => k.id === s.skin)) E("R12", P("sandboxes", si, "skin"), `"${s.skin}" is not a skin of "${meta.id}"`);
    const parsed = meta.configSchema.safeParse(s.config);
    if (!parsed.success) parsed.error.issues.forEach((iss) => E("R12", P("sandboxes", si, "config"), `config: ${iss.message}`));
    else meta.validateConfig(parsed.data).forEach((ci) => emit("R12", ci.severity, P("sandboxes", si, "config", ...ci.path), `config: ${ci.message}`));
    if (s.goal !== null && !meta.goals.includes(s.goal)) E("R12", P("sandboxes", si, "goal"), `goal "${s.goal}" is not one of ${meta.goals.join(", ")}`);
  });

  // ================================================================ R13 · purpose
  const meter = world.story.meter;
  if (meter) {
    const seen = new Set<string>();
    let last = -Infinity;
    const sorted = meter.perEncounter
      .map((p, k) => ({ ...p, k, idx: encIndex.get(p.encounterId) }))
      .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
    meter.perEncounter.forEach((p, k) => {
      if (!encIndex.has(p.encounterId)) E("R13", P("story", "meter", "perEncounter", k, "encounterId"), `unknown encounter "${p.encounterId}"`);
      if (seen.has(p.encounterId)) E("R13", P("story", "meter", "perEncounter", k), `encounter "${p.encounterId}" appears twice`);
      seen.add(p.encounterId);
      if (meter.unit === "percent" && p.value > 100) E("R13", P("story", "meter", "perEncounter", k, "value"), "percent values are ≤ 100");
    });
    for (const p of sorted) {
      if (p.idx === undefined) continue;
      if (p.value < last) E("R13", P("story", "meter", "perEncounter", p.k, "value"), `meter values must not decrease in encounter order (${p.value} after ${last})`);
      last = Math.max(last, p.value);
    }
  }
  world.story.progressEffects.forEach((pe, k) => {
    const path = P("story", "progressEffects", k);
    if (!encIndex.has(pe.encounterId)) E("R13", [...path, "encounterId"], `unknown encounter "${pe.encounterId}"`);
    if ("zoneId" in pe && !zoneById.has(pe.zoneId)) E("R13", [...path, "zoneId"], `unknown zone "${pe.zoneId}"`);
    if ("propId" in pe && !propIds.has(pe.propId)) E("R13", [...path, "propId"], `unknown prop "${pe.propId}" (props need an id)`);
    if (pe.kind === "hub_socket") {
      const hub = zoneById.get(pe.zoneId)?.hub;
      if (zoneById.has(pe.zoneId) && (!hub || pe.socket >= hub.sockets)) E("R13", [...path, "socket"], `zone "${pe.zoneId}" hub has no socket ${pe.socket}`);
    }
  });
  world.story.map?.nodes.forEach((n, k) => {
    if (!zoneById.has(n.zoneId)) E("R13", P("story", "map", "nodes", k, "zoneId"), `unknown zone "${n.zoneId}"`);
    n.stations.forEach((s, j) => !encIndex.has(s) && E("R13", P("story", "map", "nodes", k, "stations", j), `unknown encounter "${s}"`));
  });
  const strip = world.story.recordStrip;
  if (strip) {
    const lanes = new Set(strip.lanes.map((l) => l.id));
    strip.pins.forEach((p, k) => {
      const path = P("story", "recordStrip", "pins", k);
      if (!lanes.has(p.pin.lane)) E("R13", [...path, "pin", "lane"], `lane "${p.pin.lane}" is not a record-strip lane`);
      const ei = encIndex.get(p.encounterId);
      if (ei === undefined) return E("R13", [...path, "encounterId"], `unknown encounter "${p.encounterId}"`);
      const e = spec.encounters[ei]!;
      const texts = [...stringsIn(e.params), e.prompt, ...(e.sourceRef ? [e.sourceRef.quote] : [])];
      if (!dateInAny(texts, p.pin.date)) E("R13", [...path, "pin", "date"], `pin date ${p.pin.date} does not appear in "${p.encounterId}"'s params, prompt or source quote`, p.encounterId);
    });
  }
  world.feedbackNouns.forEach((fn, k) => {
    const targets = stationCtx.filter((c) => fn.stations === null || fn.stations.includes(c.st.encounterId));
    (fn.stations ?? []).forEach((s, j) => !encIndex.has(s) && E("R13", P("feedbackNouns", k, "stations", j), `unknown encounter "${s}"`));
    const found = targets.some((c) => feedbackSpace(c.enc).some((t) => containsPhrase(t, fn.from)));
    if (!found) W("R13", P("feedbackNouns", k, "from"), `"${fn.from}" never appears in the feedback of the stations it applies to`);
  });

  // ================================================================ R14 · accessories
  for (const c of stationCtx) {
    const { st, i } = c;
    const z = zoneById.get(st.zoneId);
    st.accessories.forEach((a, ai) => {
      if (a.kind !== "record_lens") return;
      let probe = null;
      try {
        probe = c.meta && c.parsedOk ? c.meta.probe(c.parsed, c.enc.view) : null;
      } catch {
        probe = null;
      }
      if (!probe || (probe.format !== "year" && probe.format !== "month_year") || !probe.window) {
        E("R14", P("stations", i, "accessories", ai), "record_lens needs the station's probe to be a year/month_year probe with a window", st.encounterId);
      }
      if (z) a.rail.forEach(([x, y], pi) => !inZone(z, x, y) && E("R14", P("stations", i, "accessories", ai, "rail", pi), `rail point (${x}, ${y}) leaves the zone`, st.encounterId));
    });
  }

  // ================================================================ R15 · boss
  for (const c of stationCtx) {
    const { st, i, enc } = c;
    const isBoss = enc.encounter.role === "boss" && enc.index === spec.encounters.length - 1;
    if (!isBoss) {
      if (st.boss) E("R15", P("stations", i, "boss"), "only the boss station has boss staging", st.encounterId);
      continue;
    }
    if (!st.boss) {
      W("R15", P("stations", i, "boss"), "the boss station has no boss staging", st.encounterId);
      continue;
    }
    const b = st.boss;
    if (!(b.arenaTriggerX < st.consoleX)) E("R15", P("stations", i, "boss", "arenaTriggerX"), `arenaTriggerX ${b.arenaTriggerX} must be before the console (${st.consoleX})`, st.encounterId);
    if (b.arenaBounds) {
      const { x0, x1 } = b.arenaBounds;
      if (!(x0 <= st.consoleX && st.consoleX <= x1 && x0 <= b.arenaTriggerX && b.arenaTriggerX <= x1)) {
        E("R15", P("stations", i, "boss", "arenaBounds"), "arenaBounds must contain the console and the arena trigger", st.encounterId);
      }
    }
    if (b.phases.length > 0) {
      if (c.layout !== "board") E("R15", P("stations", i, "boss", "phases"), `boss phases need a board layout (this station uses "${c.layout}")`, st.encounterId);
      const want = writerItemKeys(enc.modeKey, enc.view);
      const got = b.phases.flatMap((p) => p.itemKeys);
      const missing = want.filter((k) => !got.includes(k));
      const extra = got.filter((k) => !want.includes(k));
      const dup = got.filter((k, j) => got.indexOf(k) !== j);
      if (missing.length || extra.length || dup.length) {
        E("R15", P("stations", i, "boss", "phases"), `phases must partition the view's item keys (missing ${missing.join(", ") || "none"}; unknown ${extra.join(", ") || "none"}; repeated ${dup.join(", ") || "none"})`, st.encounterId);
      }
    }
  }

  // ================================================================ R16 · cue ids
  const cueIds = opts.cueIds ?? null;
  const cue = (id: string | null, path: Path) => {
    if (id === null) return;
    if (!ID_PATTERN.test(id)) W("R16", path, `cue "${id}" is not Id-legal (lower snake_case)`);
    else if (cueIds && !cueIds.has(id)) W("R16", path, `cue "${id}" is not in CUE_MAP (it will be silent)`);
  };
  world.cutscenes.forEach((c, ci) => c.steps.forEach((s, si) => s.do === "sfx" && cue(s.cue, P("cutscenes", ci, "steps", si, "cue"))));
  world.triggers.forEach((t, ti) => cue(t.cue, P("triggers", ti, "cue")));
  world.props.forEach((p, pi) => cue(p.touch?.cue ?? null, P("props", pi, "touch", "cue")));
  for (const { st, i, meta } of stationCtx) {
    const skin = meta ? skinOf(meta, st.skin) : undefined;
    if (!skin) continue;
    cue(skin.cues.live, P("stations", i, "skin"));
    cue(skin.cues.succeed, P("stations", i, "skin"));
    cue(skin.cues.fail, P("stations", i, "skin"));
  }

  // ================================================================ W1–W3
  world.zones.forEach((z, zi) => {
    const zs = stationsInZone(z.id);
    if (zs.length === 0) return;
    if (!zs.some((c) => c.st.payoff.vertical !== "none")) W("W1", P("zones", zi), `zone "${z.id}" has no station payoff that moves the player up or down`);
  });
  world.zones.forEach((z, zi) => {
    const verbs = new Set<string>(z.links.map((l) => `link:${l.kind}`));
    if (world.sandboxes.some((s) => s.zoneId === z.id)) verbs.add("sandbox");
    const touchedHere = world.quests.some((q) =>
      q.steps.some((s) => s.kind === "touch" && s.propIds.some((id) => world.props.some((p) => p.id === id && p.zoneId === z.id))),
    );
    if (touchedHere) verbs.add("quest_touch");
    if (verbs.size < 2) W("W2", P("zones", zi), `zone "${z.id}" offers ${verbs.size} non-walk verb(s) besides its payoffs (want ≥ 2)`);
  });
  for (const c of stationCtx) {
    const { st, meta } = c;
    if (!meta || !c.parsedOk) continue;
    let foot: { lo: number; hi: number } | null = null;
    let frame: { lo: number; hi: number } | null = null;
    try {
      const f = meta.footprint(c.parsed);
      foot = { lo: st.consoleX - f.left, hi: st.consoleX + f.right };
      const b = meta.frameBounds(c.parsed, c.enc.view);
      frame = { lo: st.anchor.x + b.x, hi: st.anchor.x + b.x + b.w };
    } catch {
      continue;
    }
    world.props.forEach((p, pi) => {
      if (p.zoneId !== st.zoneId || (p.layer !== "L4_play" && p.layer !== "L5_fore")) return;
      const w = (index[p.asset]?.width ?? 0) * p.scale;
      const lo = p.x - w / 2;
      const hi = p.x + w / 2;
      const hits = [foot, frame].some((r) => r && lo < r.hi && hi > r.lo);
      if (hits) W("W3", P("props", pi), `prop "${p.id ?? p.asset}" (${p.layer}) overlaps station "${st.encounterId}"`);
    });
  }

  return { issues, warnings };
}

// ---------------------------------------------------------------- helpers used above

function dateInAny(texts: readonly string[], date: string): boolean {
  return dateAppears(texts, date, { ranges: true });
}

/** Strings grade() can say for an encounter: its params' strings plus feedback for the solution and a few probes. */
function feedbackSpace(enc: EncInfo): string[] {
  const { mode, encounter } = enc;
  const out = stringsIn(encounter.params);
  if (!mode) return out;
  const inputs: unknown[] = [
    { value: -1e9 }, { value: 1e9 }, { keys: [] }, { assignments: [] }, { answers: [] }, { links: [] }, { edges: [] }, { hypothesisId: "" },
    ...[0, 1, 2, 3, 4, 5].flatMap((k) => [{ statementIndex: k }, { optionIndex: k }]),
  ];
  try {
    inputs.push(mode.solutionInput(encounter.params, encounter.solution));
  } catch {
    /* ignore */
  }
  for (const input of inputs) {
    try {
      out.push(mode.grade(encounter.params, input).feedback);
    } catch {
      /* not this mode's input shape */
    }
  }
  return out;
}

/** Lines (WorldLine | LineSlot) anywhere in a value, with paths (R9 and tooling). */
export function linesIn(v: unknown, path: Path = []): { path: Path; line: WorldLine | LineSlot }[] {
  const out: { path: Path; line: WorldLine | LineSlot }[] = [];
  walk(v, path, (node, p) => {
    if (typeof node.text === "string" && "speakerId" in node) out.push({ path: p, line: node as unknown as WorldLine });
  });
  return out;
}
/** Word tokens of a text (re-exported for tests). */
export { wordTokens };
