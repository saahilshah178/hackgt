// src/contracts/world.ts — STORED schema (fixtures/worlds, GameSpec.world). Never sent to a model:
// the World Writer writes a strict-mode WorldSlice (src/contracts/slices.ts, W8) and code assembles this.
//
// Source of truth: docs/design/20-expedition-architecture.md §1.3 (revision 3: one manifest shape with per-zone
// residency tags and puppets, ride `toSurface`, `HintTarget` + per-station overrides, `Hub.anims`, costume `hideOn`,
// companion `awakeFlag`, `Trigger.cutsceneId`, the type_match / any-decoy probe semantics, snake_case cue ids and a hero
// cap of 40 per namespace).
//
// Conventions:
// - Hand-authored data uses z.strictObject everywhere, so a typo in a side-car is a parse error (runtime map §0.7).
// - Coordinates are PER ZONE: x from the zone's left edge, y DOWN from the zone's top edge, 1 unit = 1 px of a
//   1080-px-tall view, protagonist H ≈ 170. The game docs' JSON is authoritative for coordinates (§4.1 is an index).
// - Anything per claim, item, wave or plank is KEYED (statementIndex, optionIndex, item key, waveIndex, hypothesis id),
//   never by display order.
// - zod 4: `.default(x)` returns x verbatim without parsing it, so an object default whose fields carry their own
//   defaults uses `.prefault({})` (verified on 4.6.5: `.default({})` yields `{}`, `.prefault({})` the filled object).
// - The only z.unknown() slots are `Station.config` and `Sandbox.config`: each is parsed later by the chosen meta's
//   configSchema (src/world/contraptions/*.meta.ts, §4.2).
import { z } from "zod";
import { Genre, Id, SourceRef, VoiceArchetype } from "./common";

export const WORLD_VERSION = 2 as const;

/** "<namespace>.<group>.<name>[.<variant>]"; namespace = "shared" or a biome id (§5.1). Checked against the asset index (R1). */
export const AssetKey = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+){2,3}$/, 'asset keys look like "orrery_terraces.part.ring_outer"');
export type AssetKey = z.infer<typeof AssetKey>;
export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "colors are #rrggbb");
export type HexColor = z.infer<typeof HexColor>;
/** A §2.12 cue-bank id. Always lowercase snake_case (Id-legal): `sfx_beam_rise`, never `sfx.beam_rise` or `success-badge`. */
export const CueId = Id;
export type CueId = z.infer<typeof CueId>;

/** Hand-authored hero SVG files allowed per namespace (02 §3a; AssetManifest.heroCount enforces it). */
export const HERO_CAP_PER_NAMESPACE = 40;
/** The namespaces the showcase ships (§5.1). A PDF-generated game adds `gen_<gameId>` later. */
export const ASSET_NAMESPACES = ["shared", "orrery_terraces", "living_gate", "archive_of_voices"] as const;
export type AssetNamespace = (typeof ASSET_NAMESPACES)[number];

// ---------------------------------------------------------------- coordinates (PER ZONE)
export const X = z.number().min(0).max(12_000);
export const Y = z.number().min(-400).max(4_320); // −400: crowns that bleed off the top
export const Ms = z.number().int().min(0).max(30_000);
export const Point = z.tuple([X, Y]);
export type Point = z.infer<typeof Point>;
/** A walkable surface: the zone heightfield ("ground") or a platform id in the same zone. */
export const SurfaceRef = z.union([z.literal("ground"), Id]);
export type SurfaceRef = z.infer<typeof SurfaceRef>;

/** An availability gate. Every set condition must hold. */
export const Requirement = z.strictObject({
  solved: Id.nullable().default(null), // this encounter is solved
  flag: Id.nullable().default(null), // this world flag is set (quests, triggers, NPC states, sandboxes, cutscenes)
  notFlag: Id.nullable().default(null), // ...and this one is NOT set
  collected: z.array(Id).max(8).default([]), // all of these collectibles are held
});
export type Requirement = z.infer<typeof Requirement>;

// ---------------------------------------------------------------- dates, probes (shared with contraption configs, §4.2)
/** Calendar dates as "YYYY", "YYYY-MM" or "YYYY-MM-DD". Year probes use fractional years (1965.167 = Mar 1965). */
export const DateString = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/, "dates are YYYY, YYYY-MM or YYYY-MM-DD");
export type DateString = z.infer<typeof DateString>;
export const ProbeFormat = z.enum(["number", "pi", "integer", "stage", "percent", "year", "month_year"]);
export type ProbeFormat = z.infer<typeof ProbeFormat>;
/** The ungraded orange scrubber (amendment 3). Declared in a contraption's config; never reaches grade(). */
export const ProbeSpec = z.strictObject({
  symbol: z.string().min(1).max(8), // input tab: "x", "d", "a", "s", "r", "k", "YEAR"
  label: z.string().min(1).max(24), // "probe depth", "dye load", "pump stage"
  min: z.number(),
  max: z.number(),
  step: z.number().positive(), // ←/→ step; Shift = 10 steps
  unit: z.string().max(12).default(""), // "nm", "mM", "%", "ATP/s", ""
  format: ProbeFormat.default("number"),
  initial: z.number().nullable().default(null), // null = min
  stops: z.array(z.strictObject({ v: z.number(), label: z.string().min(1).max(16) })).max(16).default([]), // stage names (cell e8)
  window: z.strictObject({ start: z.number(), end: z.number() }).nullable().default(null), // Record Strip window (history)
  playback: z.boolean().default(false), // auto-plays min → max during the success timeline (cell e10)
});
export type ProbeSpec = z.infer<typeof ProbeSpec>;
export type ProbeSpecInput = z.input<typeof ProbeSpec>;
export const EarnedPin = z.strictObject({
  date: DateString,
  precision: z.enum(["day", "month", "year"]),
  label: z.string().min(1).max(40),
  lane: Id, // a RecordStrip lane id
  spanTo: DateString.nullable().default(null), // bands (the 381-day boycott)
});
export type EarnedPin = z.infer<typeof EarnedPin>;

// ---------------------------------------------------------------- lines & speakers (amendments 1, 9)
/** speakerId ∈ spec.characters ∪ cast.extras ∪ {PLAYER_SPEAKER, NARRATOR_SPEAKER} (R2). */
export const PLAYER_SPEAKER = "player";
export const NARRATOR_SPEAKER = "narrator";
export const Mood = z.enum(["neutral", "excited", "worried", "solemn", "wry"]);
export type Mood = z.infer<typeof Mood>;
export const WorldLine = z.strictObject({
  speakerId: Id,
  text: z.string().min(1).max(240), // R9: authored lines ≤ 140 characters
  mood: Mood.default("neutral"),
});
export type WorldLine = z.infer<typeof WorldLine>;
/** A station dialogue slot. speakerId null = the guide (cast.guide.characterId). */
export const LineSlot = z.strictObject({
  speakerId: Id.nullable().default(null),
  text: z.string().min(1).max(240),
  mood: Mood.default("neutral"),
});
export type LineSlot = z.infer<typeof LineSlot>;

// ---------------------------------------------------------------- cast
export const EmblemGlyph = z.enum([
  "labyrinth", "orrery", "gear", "owl", "cell", "wave", "quill", "lantern", "star", "leaf", "flame", "nib",
  "slit", "crab", "reel", "slug", "maws", "triskelion", "hexagon", "hourglass", "plus", "headset", "eyeshade", "flashlight",
]);
export type EmblemGlyph = z.infer<typeof EmblemGlyph>;
export const Emblem = z.strictObject({
  glyph: EmblemGlyph,
  ring: HexColor,
  accent: HexColor,
  gaps: z.number().int().min(0).max(4).default(2), // broken-ring gaps (bible §3.9)
});
export type Emblem = z.infer<typeof Emblem>;
/** Kenney pose names are camelCase ("walk0", "cheer1"); they name atlas frames (§5.5). */
export const PoseName = z.string().regex(/^[a-z][A-Za-z0-9]{0,23}$/);
export type PoseName = z.infer<typeof PoseName>;
/** Per-frame rig anchors, COMPUTED by the rig build from the vector's transforms (§5.5; 02 §3b.3): hand_r = 02's handF
    (the hand painted in front), hand_l = handB; face and back are fixed offsets from head and torso; feet = contact point. */
export const RigAnchor = z.enum(["head", "face", "torso", "back", "hand_l", "hand_r", "feet"]);
export type RigAnchor = z.infer<typeof RigAnchor>;
/** A human character on the one Kenney rig (§5.5): a recoloured body atlas + costume overlays on per-frame anchors. */
export const CharacterLook = z.strictObject({
  atlas: AssetKey, // "shared.char.wren": manifest kind "atlas" (§5.5)
  costume: z
    .array(
      z.strictObject({
        asset: AssetKey, // "orrery_terraces.costume.wren_scarf" (a hero SVG, rot 0, its own data-pivot)
        anchor: RigAnchor,
        dx: z.number().min(-80).max(80).default(0), // offset in the anchor's local frame, design units
        dy: z.number().min(-80).max(80).default(0),
        follow: z.enum(["rigid", "spring"]).default("rigid"), // spring: scarf tails lag behind motion
        layer: z.enum(["behind", "front"]).default("front"), // swapped automatically on back-facing frames
        hideOn: z.array(PoseName).max(8).default([]), // poses where the overlay is hidden ("climb0", "climb1")
      }),
    )
    .max(4)
    .default([]),
  scale: z.number().min(0.7).max(1.3).default(1),
});
export type CharacterLook = z.infer<typeof CharacterLook>;
/** A speaker that is not a spec character: NPCs, mimics, the recorded astronomer, the narrator voice (amendment 1). */
export const Speaker = z.strictObject({
  id: Id, // unique across spec.characters, extras, "player", "narrator"
  name: z.string().min(1).max(32),
  role: z.string().min(1).max(60),
  voiceArchetype: VoiceArchetype,
  emblem: Emblem,
  portrait: AssetKey.nullable().default(null), // porthole portrait; sensitive biomes: *.doc.* / *.silhouette.* only
});
export type Speaker = z.infer<typeof Speaker>;
export const Cast = z.strictObject({
  protagonist: z.strictObject({ name: z.string().min(1).max(24), look: CharacterLook }),
  guide: z.strictObject({
    characterId: Id, // a spec.characters id; the dialogue bar's default emblem
    emblem: Emblem,
    portrait: AssetKey.nullable().default(null),
    companion: z.strictObject({
      // Cog the brass owl, Pip the mini-sub, Wick the lantern
      asset: AssetKey, // a puppet (§5.5) with anims idle, talk, cue (R1); an svg plays a procedural bob
      offset: z.tuple([z.number().min(-200).max(200), z.number().min(-300).max(0)]).default([-40, -150]),
      lagSec: z.number().min(0.05).max(1).default(0.35),
      bobPx: z.number().min(0).max(12).default(4),
      awakeFlag: Id.nullable().default(null), // null: follows from the first frame; else perched and dormant until this flag is set
    }),
  }),
  /** emblems for the other spec.characters (bosses); speakers without an entry use the guide's emblem desaturated */
  speakers: z
    .array(z.strictObject({ characterId: Id, emblem: Emblem, portrait: AssetKey.nullable().default(null) }))
    .max(4)
    .default([]),
  extras: z.array(Speaker).max(10).default([]),
});
export type Cast = z.infer<typeof Cast>;

// ---------------------------------------------------------------- story, purpose (amendment 24)
export const Meter = z.strictObject({
  id: Id,
  label: z.string().min(1).max(16), // "GRADIENT"
  unit: z.enum(["percent", "count"]),
  start: z.number().min(0).max(100),
  perEncounter: z.array(z.strictObject({ encounterId: Id, value: z.number().min(0).max(100) })).max(20), // value AFTER that solve
  drives: z.array(z.enum(["hud_bar", "ambient_particles", "saturation"])).max(3).default(["hud_bar"]),
});
export type Meter = z.infer<typeof Meter>;
export const ProgressEffect = z.discriminatedUnion("kind", [
  // a code-drawn 3-line beam in a far layer (trig L1 beams to the Orrery, civil record-light beams)
  z.strictObject({
    kind: z.literal("beam_line"),
    encounterId: Id,
    zoneId: Id,
    from: Point,
    to: Point,
    depth: z.enum(["L1_far", "L2_midfar", "L3_mid"]).default("L1_far"),
  }),
  // a prop changes state (uses PropPlacement.states alternates)
  z.strictObject({ kind: z.literal("prop_state"), encounterId: Id, propId: Id, state: z.enum(["restored", "lit", "revealed", "hidden"]) }),
  // a DOM label on a prop anchor swaps text (civil wall of front pages); after null = the encounter's debriefLine
  z.strictObject({
    kind: z.literal("label_swap"),
    encounterId: Id,
    propId: Id,
    anchor: Id,
    before: z.string().min(1).max(60),
    after: z.string().min(1).max(160).nullable().default(null),
  }),
  // one hub socket lights (cell pore sockets, civil Engine lenses, trig dome constellations)
  z.strictObject({ kind: z.literal("hub_socket"), encounterId: Id, zoneId: Id, socket: z.number().int().min(0).max(19) }),
]);
export type ProgressEffect = z.infer<typeof ProgressEffect>;
export const MapOverlay = z.strictObject({
  style: z.enum(["terraces_profile", "cell_rings", "transit_line"]),
  title: z.string().min(1).max(32),
  nodes: z
    .array(
      z.strictObject({
        id: Id,
        label: z.string().min(1).max(32),
        sub: z.string().min(1).max(24).nullable().default(null), // "1957", "Zone B"
        zoneId: Id,
        stations: z.array(Id).max(4).default([]), // encounter ids shown as seal glyphs
        at: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]), // position on the map card
      }),
    )
    .min(2)
    .max(12),
  tabs: z.array(z.enum(["map", "journal", "mastery", "shards"])).min(1).max(4),
});
export type MapOverlay = z.infer<typeof MapOverlay>;
export const JournalSpec = z.strictObject({
  title: z.string().min(1).max(24), // "Journal", "Logbook", "Clipping Case"
  style: z.enum(["parchment", "logbook", "clippings"]),
});
export type JournalSpec = z.infer<typeof JournalSpec>;
/** History games: the RECORD card's lanes and the pins each solve earns (civil §5.0.2). The panel prepends it as
 * a panel-owned timeline card (slot 0) via PanelContext (src/world/types.ts). */
export const RecordStrip = z.strictObject({
  lanes: z.array(z.strictObject({ id: Id, label: z.string().min(1).max(20) })).min(1).max(4),
  pins: z.array(z.strictObject({ encounterId: Id, pin: EarnedPin })).max(40),
});
export type RecordStrip = z.infer<typeof RecordStrip>;
export const Story = z.strictObject({
  logline: z.string().min(1).max(200),
  objective: z.string().min(1).max(80), // "Restore the orrery's starlight"
  objectiveLabel: z.string().min(1).max(20), // ring label: "RHYTHMS", "GATES", "RECORD RESTORED"
  restoredNoun: z.string().min(1).max(24), // "rhythm", "gate", "record"
  introCutsceneId: Id,
  finaleCutsceneId: Id,
  meter: Meter.nullable().default(null),
  progressEffects: z.array(ProgressEffect).max(60).default([]),
  map: MapOverlay.nullable().default(null),
  journal: JournalSpec.default({ title: "Journal", style: "parchment" }),
  recordStrip: RecordStrip.nullable().default(null),
});
export type Story = z.infer<typeof Story>;

// ---------------------------------------------------------------- zones (amendments 2, 20, 23)
export const Sky = z.strictObject({
  stops: z.array(z.strictObject({ at: z.number().min(0).max(1), color: HexColor })).min(3).max(6),
  haze: z.strictObject({ color: HexColor, alpha: z.number().min(0).max(0.6) }),
});
export type Sky = z.infer<typeof Sky>;
export const Depth = z.enum(["L1_far", "L2_midfar", "L3_mid", "L5_fore", "L6_light"]);
export type Depth = z.infer<typeof Depth>;
export const ParallaxLayer = z.strictObject({
  asset: AssetKey,
  depth: Depth,
  scrollFactor: z.number().min(0).max(1.6), // bible §5.2: L1 0.15, L2 0.35, L3 0.6, L5 1.25–1.4, L6 1.0
  scrollFactorY: z.number().min(0).max(1.6).nullable().default(null), // null = same as x (vertical parallax in tall zones)
  y: Y, // top edge of the layer
  repeatX: z.boolean().default(true),
  alpha: z.number().min(0).max(1).default(1),
  blend: z.enum(["normal", "multiply", "add", "screen"]).default("normal"),
  blurPx: z.number().min(0).max(8).default(0),
  driftPxPerSec: z.number().min(-60).max(60).default(0),
});
export type ParallaxLayer = z.infer<typeof ParallaxLayer>;
export const LayerSet = z.strictObject({ id: Id, layers: z.array(ParallaxLayer).min(3).max(10) });
export type LayerSet = z.infer<typeof LayerSet>;
export const AmbientLight = z.enum(["day", "peach", "dusk", "night", "interior", "aqua", "amber", "dawn"]);
export type AmbientLight = z.infer<typeof AmbientLight>;
export const Ambient = z.strictObject({
  light: AmbientLight,
  particles: z.enum(["none", "dust", "motes", "pollen", "spores", "bubbles", "rain", "embers", "stars", "scraps"]).default("none"),
  particleCount: z.number().int().min(0).max(120).default(24), // §2.11 caps
  shadowColor: HexColor.default("#6E7F9A"), // coloured, never black (bible §5.3)
  dapple: AssetKey.nullable().default(null),
  grade: z
    .strictObject({
      // camera ColorMatrix (finish stack §5.6)
      saturation: z.number().min(-1).max(1).default(0),
      brightness: z.number().min(-0.5).max(0.5).default(0),
      hue: z.number().min(-30).max(30).default(0),
    })
    .prefault({}),
});
export type Ambient = z.infer<typeof Ambient>;
export const Weather = z.enum(["clear", "rain_heavy", "rain_light", "paper_drift", "current", "streaming", "mist", "drip"]);
export type Weather = z.infer<typeof Weather>;
export const MusicCue = z.enum(["curious", "tense", "playful", "noir", "boss", "calm", "solemn"]);
export type MusicCue = z.infer<typeof MusicCue>;
/** A lighting/look span of a zone. Segments are contiguous, ordered and cover [0, zone.width]; 1 s crossfade at boundaries. */
export const Segment = z.strictObject({
  id: Id,
  x0: X,
  x1: X,
  layerSet: Id,
  sky: Sky,
  ambient: Ambient,
  weather: Weather.default("clear"),
  music: MusicCue.nullable().default(null),
  runEnabled: z.boolean().default(true), // false on the civil S7 bridge crossing
  /** the last variant whose requirement holds overrides these fields (civil S7: the rain stops after e9) */
  variants: z
    .array(
      z.strictObject({
        requires: Requirement,
        sky: Sky.nullable().default(null),
        weather: Weather.nullable().default(null),
        music: MusicCue.nullable().default(null),
      }),
    )
    .max(2)
    .default([]),
});
export type Segment = z.infer<typeof Segment>;
/** A cutaway interior: while the player's x is in [x0, x1] the façade fades to 20 % over 300 ms (civil §2.4). */
export const Interior = z.strictObject({
  id: Id,
  x0: X,
  x1: X,
  facade: AssetKey,
  facadeAt: Point, // façade top-left
  segment: Id.nullable().default(null), // lighting segment used while inside
});
export type Interior = z.infer<typeof Interior>;
export const Ground = z.strictObject({
  points: z.array(Point).min(2).max(96), // heightfield: x strictly ascending, spans [0, zone.width]
  surface: AssetKey,
  underside: AssetKey.nullable().default(null),
  maxStepUp: z.number().min(40).max(140).default(102), // 0.6 H: a rise above this blocks walking (walls, ledges)
});
export type Ground = z.infer<typeof Ground>;
export const Platform = z.strictObject({
  id: Id,
  points: z.array(Point).min(2).max(24), // walkable polyline, x strictly ascending
  asset: AssetKey.nullable().default(null), // null: an invisible surface over drawn art (cornice, rafters)
  requires: Requirement.nullable().default(null), // absent (not walkable, not drawn) until met
});
export type Platform = z.infer<typeof Platform>;
export const LinkEnd = z.strictObject({ surface: SurfaceRef.default("ground"), x: X });
export type LinkEnd = z.infer<typeof LinkEnd>;
const LinkBase = {
  id: Id,
  from: LinkEnd,
  to: LinkEnd,
  requires: Requirement.nullable().default(null),
};
/** Authored traversal (amendment 2). Scripted arcs; no physics engine. §2.4.2 gives the arc maths. */
export const TraversalLink = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("hop"), ...LinkBase, apex: z.number().min(20).max(400).default(120), twoWay: z.boolean().default(true) }),
  z.strictObject({ kind: z.literal("climb"), ...LinkBase, twoWay: z.boolean().default(true) }), // fire escapes, rigging, trusses
  z.strictObject({ kind: z.literal("ladder"), ...LinkBase, asset: AssetKey.nullable().default(null), twoWay: z.boolean().default(true) }),
  z.strictObject({ kind: z.literal("drop"), ...LinkBase }), // one way (S / ↓); the only way across a sheer ground descent > maxStepUp
  z.strictObject({
    kind: z.literal("timed_hop"),
    ...LinkBase,
    periodSec: z.number().min(0.5).max(12),
    phase: z.number().min(0).max(1).default(0), // cycle fraction at zone entry
    open: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]), // hop succeeds when the cycle fraction ∈ [open[0], open[1])
    missTo: LinkEnd, // a mistimed hop lands here (no damage, "!" emote)
    driverPropId: Id.nullable().default(null), // the swinging prop: x-offset = amplitude · sin(2π(t / periodSec + phase))
    amplitude: z.number().min(0).max(400).default(120),
  }),
  z.strictObject({
    kind: z.literal("ride"),
    ...LinkBase,
    vehicle: AssetKey,
    path: z.array(Point).min(2).max(16), // vehicle anchor path; the player stands on its top
    ms: Ms,
    twoWay: z.boolean().default(false),
  }),
]);
export type TraversalLink = z.infer<typeof TraversalLink>;
export type TraversalLinkKind = TraversalLink["kind"];
export const ZoneExit = z.strictObject({
  id: Id,
  x: X, // walking past x (rightward) on `surface` leaves the zone
  surface: SurfaceRef.default("ground"),
  toZoneId: Id,
  toX: X,
  toSurface: SurfaceRef.default("ground"),
  transition: z.enum(["walk", "film_seam", "fade", "vertical_up", "vertical_down"]).default("walk"),
  requires: Requirement.nullable().default(null),
  cutsceneId: Id.nullable().default(null), // optional transition cutscene (civil X-lines)
});
export type ZoneExit = z.infer<typeof ZoneExit>;
export const Hub = z.strictObject({
  asset: AssetKey, // kind "svg" (states = ColorMatrix + glow) or "puppet" (sub-part motion, A11)
  x: X,
  y: Y.nullable().default(null), // null: sits on the ground at x
  depth: z.enum(["L3_mid", "L4_back"]).default("L3_mid"),
  label: z.string().min(1).max(40),
  sockets: z.number().int().min(0).max(20).default(0), // lit by hub_socket progress effects
  restoredLine: WorldLine,
  /** puppet animations played on a `hub` cutscene step's state change (civil: the Engine rings spin, the iris opens) */
  anims: z.strictObject({ partial: Id.nullable().default(null), restored: Id.nullable().default(null) }).prefault({}),
});
export type Hub = z.infer<typeof Hub>;
export const ZoneCamera = z.strictObject({
  xDeadzone: z.number().min(0.1).max(0.5).default(0.3), // fraction of the view width
  yDeadzone: z.number().min(80).max(540).default(260), // design units of vertical freedom before the camera follows
  lerp: z.number().min(0.04).max(0.3).default(0.12),
  minZoom: z.number().min(0.5).max(1).default(0.6),
  maxZoom: z.number().min(1).max(1.5).default(1.15),
});
export type ZoneCamera = z.infer<typeof ZoneCamera>;
export const Zone = z.strictObject({
  id: Id,
  name: z.string().min(1).max(40),
  width: z.number().min(1920).max(12_000),
  height: z.number().min(1080).max(4_320),
  layerSets: z.array(LayerSet).min(1).max(4),
  segments: z.array(Segment).min(1).max(6),
  interiors: z.array(Interior).max(4).default([]),
  ground: Ground,
  platforms: z.array(Platform).max(24).default([]),
  links: z.array(TraversalLink).max(32).default([]),
  exits: z.array(ZoneExit).max(4).default([]),
  hub: Hub.nullable().default(null), // the zone's big machine (5–6 H); null for a transit zone
  entry: z.strictObject({ x: X, surface: SurfaceRef.default("ground") }),
  entryCutsceneId: Id.nullable().default(null),
  camera: ZoneCamera.prefault({}),
});
export type Zone = z.infer<typeof Zone>;

// ---------------------------------------------------------------- stations (one per encounter)
export const LayoutMode = z.enum(["scrub", "board", "vault"]); // no "sluice" (amendment 33): sluice stations use scrub
export type LayoutMode = z.infer<typeof LayoutMode>;
export const PayoffKind = z.enum(["terrain", "ride", "remove_blocker", "carry"]);
export type PayoffKind = z.infer<typeof PayoffKind>;
export const PayoffVertical = z.enum(["up", "down", "none"]);
export type PayoffVertical = z.infer<typeof PayoffVertical>;
export const PayoffAnim = z.enum([
  "stairs_rise", "bridge_forms", "ramp_forms", "steps_emerge", "stairwell_opens", // terrain
  "lift_moves", "water_rises", "tram_departs", // ride (board with E/W after success)
  "door_opens", "gate_lifts", "barrier_lifts", "barrier_dissolves", "beam_restores", "vault_opens", // remove_blocker
  "door_carries", "vesicle_carries", // carry (plays automatically)
]);
export type PayoffAnim = z.infer<typeof PayoffAnim>;
export const PAYOFF_ANIMS = PayoffAnim.options;
export const PAYOFF_KIND_OF: Readonly<Record<PayoffAnim, PayoffKind>> = {
  stairs_rise: "terrain", bridge_forms: "terrain", ramp_forms: "terrain", steps_emerge: "terrain", stairwell_opens: "terrain",
  lift_moves: "ride", water_rises: "ride", tram_departs: "ride",
  door_opens: "remove_blocker", gate_lifts: "remove_blocker", barrier_lifts: "remove_blocker",
  barrier_dissolves: "remove_blocker", beam_restores: "remove_blocker", vault_opens: "remove_blocker",
  door_carries: "carry", vesicle_carries: "carry",
};
export const Payoff = z.strictObject({
  kind: PayoffKind, // must equal PAYOFF_KIND_OF[anim] (R6)
  vertical: PayoffVertical, // W1 counts payoffs with vertical ≠ "none"
  anim: PayoffAnim, // ∈ meta.payoffs (R5)
  noun: z.string().min(1).max(32), // "spoke stair", "Echo Lift", "vesicle" (SR text, HUD)
  /** the wall/gap the player cannot pass until this station is solved (null: nothing blocks) */
  blocker: z.strictObject({ x: X, surface: SurfaceRef.default("ground"), asset: AssetKey.nullable().default(null) }).nullable(),
  /** terrain: walkable segments added on success (merged into the ground heightfield, or activating a platform).
   * May be empty when a traversal link with requires.solved = this station provides the way on (R6). */
  terrain: z.array(z.strictObject({ surface: SurfaceRef.default("ground"), points: z.array(Point).min(2).max(32) })).max(3).default([]),
  /** ride: E/W on the vehicle after success runs it; carry: runs automatically after the success animation */
  rideCutsceneId: Id.nullable().default(null),
  autoBoardMs: Ms.nullable().default(null), // ride: auto-board after this long (cell e4 raft: 6000)
  feedsHub: z.boolean().default(true),
});
export type Payoff = z.infer<typeof Payoff>;

export const AxisUnit = z.enum(["number", "pi", "year", "month", "percent", "mM", "nm", "count", "seconds", "rate", "stage"]);
export type AxisUnit = z.infer<typeof AxisUnit>;
export const Axis = z.strictObject({
  min: z.number(),
  max: z.number(),
  unit: AxisUnit,
  label: z.string().min(1).max(16).nullable().default(null),
});
export type Axis = z.infer<typeof Axis>;
/** Presentation overrides only: card DATA always comes from the contraption meta + the encounter view. */
export const CardOverride = z.strictObject({
  slot: z.number().int().min(0).max(3),
  title: z.string().min(1).max(16).nullable().default(null),
  x: Axis.nullable().default(null),
  y: Axis.nullable().default(null),
  hidden: z.boolean().default(false),
});
export type CardOverride = z.infer<typeof CardOverride>;
export const PanelOverride = z.strictObject({
  layout: LayoutMode.nullable().default(null), // null -> the contraption's default
  inputSymbol: z.string().min(1).max(8).nullable().default(null), // "T", "θ", "year", "item"
  verifyLabel: z.string().min(1).max(24), // "LOCK THE RINGS"
  successBadge: z.string().min(1).max(28), // "RINGS LOCKED"
  cards: z.array(CardOverride).max(4).default([]),
});
export type PanelOverride = z.infer<typeof PanelOverride>;

/**
 * Misconception probes (amendment 11): evaluated ONLY after a failed Verify, against the submitted Input
 * (src/world/probes.ts). Semantics per predicate:
 * - nearValue: |input.value − value| ≤ the mode's own tolerance × tolFactor (scalar modes; `value` is an exact mathjs expr).
 * - keyInSlot: `itemKey` sits in `slot` (sequencer.linear); slot null = anywhere in the submitted order.
 * - decoyPresent: the submitted input uses decoy `itemKey` (linear planks d*, chain nodes d*); itemKey null = ANY decoy.
 * - aimedIndex: the picked statementIndex (mimic) / optionIndex (predict_reveal) equals `index`.
 * - linkedTo: the submitted input links fromKey → toKey (pairs lN → rM/xM; chain nA → nB).
 * - assignedTo: sorter.bins: item `itemKey` (i*) is in bin `binId`. sorter.type_match: `itemKey` "w<i>" ↔ waveIndex i and
 *   `binId` ↔ the categoryId answered for that wave.
 */
export const MisconceptionProbe = z.discriminatedUnion("predicate", [
  z.strictObject({ predicate: z.literal("nearValue"), value: z.string().min(1).max(40), tolFactor: z.number().min(0.25).max(4).default(1), key: Id }),
  z.strictObject({ predicate: z.literal("keyInSlot"), itemKey: z.string().min(1).max(8), slot: z.number().int().min(0).max(11).nullable().default(null), key: Id }),
  z.strictObject({ predicate: z.literal("decoyPresent"), itemKey: z.string().min(1).max(8).nullable().default(null), key: Id }),
  z.strictObject({ predicate: z.literal("aimedIndex"), index: z.number().int().min(0).max(11), key: Id }),
  z.strictObject({ predicate: z.literal("linkedTo"), fromKey: z.string().min(1).max(8), toKey: z.string().min(1).max(8), key: Id }),
  z.strictObject({ predicate: z.literal("assignedTo"), itemKey: z.string().min(1).max(8), binId: Id, key: Id }),
]);
export type MisconceptionProbe = z.infer<typeof MisconceptionProbe>;
export type ProbePredicate = MisconceptionProbe["predicate"];

export const PinGlyph = z.enum(["bell", "metronome", "star", "door", "drop", "key", "chord", "lap"]);
export type PinGlyph = z.infer<typeof PinGlyph>;
export const PinPlacement = z.strictObject({
  anchor: Id, // a prefab anchor ("tally", "pylon_a", "doorway")
  text: z.string().min(1).max(12).nullable().default(null), // R8 applies; a view target, a count, never an ask answer
  glyph: PinGlyph.nullable().default(null),
});
export type PinPlacement = z.infer<typeof PinPlacement>;
export const Accessory = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("record_lens"), // civil: a brass carriage on a rail, driven by the station's year probe
    rail: z.array(Point).min(2).max(24), // polyline (e9 follows the arch)
    carriage: AssetKey,
    cone: z.strictObject({ target: Point, asset: AssetKey }).nullable().default(null),
  }),
]);
export type Accessory = z.infer<typeof Accessory>;
export type AccessoryKind = Accessory["kind"];
/** Where the companion flies on a hint rung (amendment 10, A7). Skins carry defaults; a station may override per rung. */
export const HintTarget = z.strictObject({
  anchor: Id, // a prefab anchor of this station ("lens", "slate_1", "panel_0", "apparatus")
  action: z.enum(["circle", "land", "hover", "ride"]),
  holdMs: Ms.default(1500),
});
export type HintTarget = z.infer<typeof HintTarget>;
/** Boss staging (amendments 8, 18). Presentation only: one Input, one grade(). */
export const BossStaging = z.strictObject({
  speakerId: Id, // the boss voice: a spec character (warden, gatekeeper, editor)
  arenaTriggerX: X, // crossing it (same zone) plays the arena cutscene once
  arenaCutsceneId: Id.nullable().default(null),
  arenaBounds: z.strictObject({ x0: X, x1: X }).nullable().default(null), // camera clamp while in the arena
  phases: z
    .array(
      z.strictObject({
        // board modes: batches of item keys revealed in the panel in order
        id: Id,
        itemKeys: z.array(z.string().min(1).max(8)).min(1).max(8),
        line: WorldLine.nullable().default(null), // spoken when the batch appears
      }),
    )
    .max(4)
    .default([]), // non-empty ⇒ partitions the view's item keys (R15)
  taunts: z
    .strictObject({
      approach: z.array(WorldLine).max(3).default([]),
      fail: z.array(WorldLine).max(4).default([]), // cycled by attempt when byKey has no match
      byKey: z.array(z.strictObject({ key: Id, line: WorldLine })).max(6).default([]), // R5 checks these keys too
    })
    .prefault({}),
  music: MusicCue.default("boss"),
});
export type BossStaging = z.infer<typeof BossStaging>;
export const StationDialogue = z.strictObject({
  approach: z.array(WorldLine).max(3).default([]), // once, on entering approachRadius (explore, non-blocking)
  instruction: LineSlot, // line 1 while the panel is open: imperative, names a noun (R9), ≤ 140
  tutorial: LineSlot.nullable().default(null), // line 2 on the FIRST panel open only
  insight: LineSlot.nullable().default(null), // line 2 afterwards: the PRE-success, hint-free truth (R8 applies)
  hints: z.tuple([LineSlot, LineSlot, LineSlot]).nullable().default(null), // guide-voiced rungs; null = fixture hints verbatim
  fail: z.strictObject({
    default: LineSlot,
    byKey: z.array(z.strictObject({ key: Id, line: LineSlot })).max(10).default([]), // probe keys, near-miss keys, fail keys
  }),
  success: LineSlot, // the POST-success concept statement; replaces the instruction (may state the answer)
  payoffLine: LineSlot.nullable().default(null), // toast while the payoff animates (trig "success2")
  after: z.array(WorldLine).max(3).default([]), // explore, after the payoff
});
export type StationDialogue = z.infer<typeof StationDialogue>;
export const Station = z.strictObject({
  encounterId: Id,
  zoneId: Id,
  consoleX: X, // the lectern/kiosk the player walks to (amendment 8)
  consoleSurface: SurfaceRef.default("ground"),
  consoleAsset: AssetKey.nullable().default(null), // null: the skin's default console part
  anchor: z.strictObject({ x: X, y: Y }), // contraption origin in zone units (dial centre, ring centre, chasm centre)
  approachRadius: z.number().min(150).max(1500).default(500),
  contraption: Id, // key in CONTRAPTION_LIBRARY
  skin: Id, // one of that contraption's skins
  config: z.record(z.string(), z.unknown()).default({}), // parsed by meta.configSchema (§4.2)
  objectNoun: z.string().min(1).max(40), // "Tidewheel Gate"
  partNouns: z.array(z.string().min(1).max(32)).max(6).default([]), // "carriage", "latch timer", "probe" (R9)
  pins: z.array(PinPlacement).max(4).default([]),
  accessories: z.array(Accessory).max(2).default([]),
  frameZoom: z.number().min(0.5).max(1.5).nullable().default(null), // overrides the zoom frameFor computes (amendment 32)
  probes: z.array(MisconceptionProbe).max(6).default([]),
  /** per-rung override of the skin's default hint flights (A7); null = ContraptionSkin.hintTargets via meta.hintTargets */
  hintTargets: z.tuple([z.array(HintTarget).max(3), z.array(HintTarget).max(3), z.array(HintTarget).max(3)]).nullable().default(null),
  panel: PanelOverride,
  dialogue: StationDialogue,
  payoff: Payoff,
  boss: BossStaging.nullable().default(null),
});
export type Station = z.infer<typeof Station>;

// ---------------------------------------------------------------- dressing & side content (amendments 15, 16, 17, 24)
export const PropState = z.enum(["restored", "lit", "revealed", "hidden"]);
export type PropState = z.infer<typeof PropState>;
export const PropPlacement = z.strictObject({
  id: Id.nullable().default(null), // required when referenced (touch, progress effects, timed_hop driver)
  zoneId: Id,
  asset: AssetKey,
  x: X,
  y: Y.nullable().default(null), // null: sits on `surface` at x
  surface: SurfaceRef.default("ground"),
  layer: z.enum(["L3_mid", "L4_back", "L4_play", "L5_fore"]).default("L4_back"),
  scale: z.number().min(0.1).max(4).default(1),
  flipX: z.boolean().default(false),
  sway: z.boolean().default(false),
  glow: z.boolean().default(false),
  restoredBy: Id.nullable().default(null), // dormant (desaturated, glow off) until this encounter is solved
  states: z.array(z.strictObject({ state: PropState, asset: AssetKey.nullable().default(null) })).max(3).default([]),
  touch: z
    .strictObject({
      // quest "touch" targets (Kay's lanterns)
      requires: Requirement.nullable().default(null),
      litAsset: AssetKey.nullable().default(null),
      lines: z.array(WorldLine).max(2).default([]),
      cue: CueId.nullable().default(null),
    })
    .nullable()
    .default(null),
});
export type PropPlacement = z.infer<typeof PropPlacement>;
export const NpcPose = z.enum(["idle", "talk", "think", "work", "wave", "cheer", "sit", "ride", "hidden"]);
export type NpcPose = z.infer<typeof NpcPose>;
export const NpcState = z.strictObject({
  id: Id,
  requires: Requirement.nullable().default(null), // the LAST state whose requirement holds is the active one
  zoneId: Id,
  x: X,
  surface: SurfaceRef.default("ground"),
  lines: z.array(WorldLine).min(1).max(6),
  pose: NpcPose.default("idle"),
  follow: z.enum(["none", "player", "satchel"]).default("none"), // Sucra escorts; Quill rides the satchel
  repeatable: z.boolean().default(false),
  setFlag: Id.nullable().default(null), // set when this state's lines finish
  anim: Id.nullable().default(null), // a named animation of the NPC's puppet ("arm_sync"); ∈ its anims (R12)
});
export type NpcState = z.infer<typeof NpcState>;
export const Npc = z.strictObject({
  id: Id,
  name: z.string().min(1).max(32),
  speakerId: Id, // a spec character or a cast.extras id
  look: CharacterLook.nullable().default(null), // human NPCs on the Kenney rig (an NPC atlas, §5.5) ...
  asset: AssetKey.nullable().default(null), // ... or a machine/creature puppet (group "npc"); exactly one of the two (R12)
  states: z.array(NpcState).min(1).max(6),
});
export type Npc = z.infer<typeof Npc>;
export const QuestStep = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("talk"), npcId: Id, stateId: Id.nullable().default(null) }),
  z.strictObject({ kind: z.literal("collect"), ids: z.array(Id).min(1).max(8) }),
  z.strictObject({ kind: z.literal("touch"), propIds: z.array(Id).min(1).max(8) }),
  z.strictObject({ kind: z.literal("afterSeal"), encounterId: Id }),
  z.strictObject({ kind: z.literal("visit"), triggerId: Id }),
]);
export type QuestStep = z.infer<typeof QuestStep>;
export const Quest = z.strictObject({
  id: Id,
  title: z.string().min(1).max(40),
  giverNpcId: Id.nullable().default(null),
  steps: z.array(QuestStep).min(1).max(6), // completed in order
  reward: z.strictObject({
    flag: Id, // set on completion
    lines: z.array(WorldLine).max(3).default([]),
    collectibleId: Id.nullable().default(null),
    cosmetic: AssetKey.nullable().default(null), // e.g. gold scarf trim overlay
    debriefLine: z.string().min(1).max(160).nullable().default(null),
  }),
});
export type Quest = z.infer<typeof Quest>;
export const Trigger = z.strictObject({
  id: Id,
  zoneId: Id,
  x: X,
  surface: SurfaceRef.default("ground"),
  radius: z.number().min(40).max(1500).default(240),
  kind: z.enum(["ambient", "arrival", "hint"]).default("ambient"), // ambient = toast; arrival = bar, story priority; hint = after 20 s idle
  lines: z.array(WorldLine).min(1).max(4),
  once: z.boolean().default(true),
  requires: Requirement.nullable().default(null),
  setFlag: Id.nullable().default(null),
  cue: CueId.nullable().default(null),
  cutsceneId: Id.nullable().default(null), // played when it fires (phase cutscene, purpose "trigger"; cell S7 viewpoint pan)
});
export type Trigger = z.infer<typeof Trigger>;
export const Collectible = z.strictObject({
  id: Id,
  kind: z.enum(["shard", "page", "negative"]), // wisps are "shard"s with the biome's wisp sprite
  zoneId: Id,
  x: X,
  y: Y.nullable().default(null),
  surface: SurfaceRef.default("ground"),
  asset: AssetKey.nullable().default(null), // null: the kind's shared sprite
  title: z.string().min(1).max(40),
  text: z.string().min(1).max(320),
  conceptId: Id.nullable().default(null),
  sourceRef: SourceRef.nullable().default(null), // pages and negatives quote verified text
  requires: Requirement.nullable().default(null),
});
export type Collectible = z.infer<typeof Collectible>;
export const Plaque = z.strictObject({
  // readable lore; history plaques quote verified sources
  id: Id,
  zoneId: Id,
  x: X,
  surface: SurfaceRef.default("ground"),
  asset: AssetKey,
  kind: z.enum(["plaque", "document", "photo_withheld"]).default("plaque"),
  title: z.string().min(1).max(48),
  text: z.string().min(1).max(320),
  sourceRef: SourceRef.nullable().default(null),
  requires: Requirement.nullable().default(null),
});
export type Plaque = z.infer<typeof Plaque>;
/** A contraption-like interactable with no runner, no Verify and no grade (amendment 17, §2.4b). */
export const Sandbox = z.strictObject({
  id: Id,
  zoneId: Id,
  consoleX: X,
  surface: SurfaceRef.default("ground"),
  anchor: z.strictObject({ x: X, y: Y }),
  contraption: Id, // a SANDBOX_LIBRARY id: music_box, plant_garden, darkroom
  skin: Id,
  config: z.record(z.string(), z.unknown()).default({}), // parsed by the sandbox meta's configSchema
  title: z.string().min(1).max(40),
  objectNoun: z.string().min(1).max(40),
  requires: Requirement.nullable().default(null), // hidden until met
  lines: z
    .strictObject({
      open: z.array(WorldLine).max(3).default([]),
      idle: z.array(WorldLine).max(2).default([]), // after 20 s without input
    })
    .prefault({}),
  goal: Id.nullable().default(null), // one of meta.goals; null = no reward
  reward: z
    .strictObject({
      flag: Id.nullable().default(null),
      lines: z.array(WorldLine).max(3).default([]),
      cosmetic: AssetKey.nullable().default(null),
      debriefLine: z.string().min(1).max(160).nullable().default(null),
    })
    .nullable()
    .default(null),
  frameZoom: z.number().min(0.5).max(1.5).nullable().default(null),
});
export type Sandbox = z.infer<typeof Sandbox>;

// ---------------------------------------------------------------- cutscenes (data, run by the host; amendment 25)
export const InteractRef = z.strictObject({ kind: z.enum(["npc", "prop", "station", "sandbox"]), id: Id });
export type InteractRef = z.infer<typeof InteractRef>;
export const StateTarget = z.strictObject({ kind: z.enum(["prop", "npc", "station", "hub", "flag"]), id: Id });
export type StateTarget = z.infer<typeof StateTarget>;
export const CameraShot = z.strictObject({ x: z.number(), y: z.number(), zoom: z.number().min(0.3).max(2) });
export type CameraShot = z.infer<typeof CameraShot>;
export const CutsceneStep = z.discriminatedUnion("do", [
  z.strictObject({ do: z.literal("fade"), to: z.enum(["black", "clear", "white"]), ms: Ms }),
  z.strictObject({ do: z.literal("title"), text: z.string().min(1).max(60), sub: z.string().min(1).max(80).nullable().default(null), ms: Ms }),
  z.strictObject({ do: z.literal("enter_zone"), zoneId: Id, x: X, surface: SurfaceRef.default("ground") }),
  z.strictObject({ do: z.literal("pan"), x: X, y: Y.nullable().default(null), zoom: z.number().min(0.5).max(2).default(1), ms: Ms }),
  z.strictObject({
    do: z.literal("camera"),
    x: X.nullable().default(null),
    y: Y.nullable().default(null),
    zoom: z.number().min(0.5).max(2).nullable().default(null),
    ms: Ms,
    ease: z.enum(["linear", "out_cubic", "in_out_sine"]).default("out_cubic"),
  }), // vertical tweens
  z.strictObject({ do: z.literal("walk"), actor: Id, toX: X }), // "player" | "companion" | an npc id
  z.strictObject({ do: z.literal("say"), lines: z.array(WorldLine).min(1).max(6) }),
  z.strictObject({ do: z.literal("emote"), actor: Id, glyph: z.enum(["!", "?", "♪", "…", "♥"]) }),
  z.strictObject({ do: z.literal("wait"), ms: Ms }),
  z.strictObject({ do: z.literal("station"), encounterId: Id, anim: z.enum(["wake", "succeed", "settle"]) }),
  z.strictObject({ do: z.literal("hub"), zoneId: Id, state: z.enum(["dormant", "partial", "restored"]) }), // plays Hub.anims[state] when set
  z.strictObject({
    do: z.literal("ride"),
    vehicle: AssetKey,
    toZoneId: Id,
    toX: X,
    toSurface: SurfaceRef.default("ground"), // landing surface in the destination zone (critique round 2, A8)
    ms: Ms,
    path: z.array(Point).max(16).default([]), // path in the CURRENT zone before the swap
  }),
  z.strictObject({ do: z.literal("sfx"), cue: CueId }), // §2.12 cue bank
  z.strictObject({ do: z.literal("music"), cue: MusicCue.nullable() }),
  // interactive steps: the timeline pauses until the player acts; skip() applies their end state
  z.strictObject({
    do: z.literal("await_interact"),
    target: InteractRef,
    prompt: z.string().min(1).max(40),
    timeoutMs: Ms.nullable().default(null),
  }), // trig intro: wind Cog; a prop target needs an id, not a touch block
  z.strictObject({
    do: z.literal("control_until"),
    x: X,
    surface: SurfaceRef.default("ground"),
    prompt: z.string().min(1).max(40).nullable().default(null),
    timeoutMs: Ms.default(20_000),
  }), // civil intro: walk down the stair; auto-walks on timeout
  // a composed image across zones (trig canyon, civil dawn skyline), drawn over everything while it plays
  z.strictObject({ do: z.literal("vista"), asset: AssetKey, from: CameraShot, to: CameraShot, ms: Ms, holdMs: Ms.default(1_500) }),
  z.strictObject({ do: z.literal("set_state"), target: StateTarget, state: Id }), // flag: state "on" | "off"
]);
export type CutsceneStep = z.infer<typeof CutsceneStep>;
export type CutsceneVerb = CutsceneStep["do"];
export const Cutscene = z.strictObject({ id: Id, skippable: z.boolean().default(true), steps: z.array(CutsceneStep).min(1).max(60) });
export type Cutscene = z.infer<typeof Cutscene>;

// ---------------------------------------------------------------- root
/** Display-only nouns applied to grade() feedback text (amendment 36): "chest" → "singer". Grading is untouched. */
export const FeedbackNoun = z.strictObject({
  from: z.string().min(1).max(24),
  to: z.string().min(1).max(24),
  stations: z.array(Id).max(20).nullable().default(null), // null = every station
});
export type FeedbackNoun = z.infer<typeof FeedbackNoun>;
export const WorldOverlay = z.strictObject({
  worldVersion: z.literal(WORLD_VERSION),
  biome: Id, // key in BIOME_KITS (src/world/biomes.ts)
  title: z.string().min(1).max(40), // "The Orrery Terraces"
  subtitle: z.string().min(1).max(60).nullable().default(null),
  cast: Cast,
  story: Story,
  zones: z.array(Zone).min(1).max(8), // coordinates and traversal: the game docs' JSON is authoritative (§4.1)
  stations: z.array(Station).min(1).max(20),
  props: z.array(PropPlacement).max(600).default([]),
  npcs: z.array(Npc).max(16).default([]),
  quests: z.array(Quest).max(8).default([]),
  triggers: z.array(Trigger).max(40).default([]),
  sandboxes: z.array(Sandbox).max(4).default([]),
  collectibles: z.array(Collectible).max(16).default([]),
  plaques: z.array(Plaque).max(24).default([]),
  cutscenes: z.array(Cutscene).min(2).max(24),
  feedbackNouns: z.array(FeedbackNoun).max(8).default([]),
});
export type WorldOverlay = z.infer<typeof WorldOverlay>;
export type WorldOverlayInput = z.input<typeof WorldOverlay>;

/** Side-car wrapper: which specs this overlay dresses. Not part of GameSpec.world. */
export const WorldFile = z.strictObject({
  appliesTo: z.strictObject({
    specIds: z.array(z.string().min(1)).max(8),
    sources: z.array(z.strictObject({ sourceId: z.string().min(1), genre: Genre })).max(4),
  }),
  world: WorldOverlay,
});
export type WorldFile = z.infer<typeof WorldFile>;
export type WorldFileInput = z.input<typeof WorldFile>;

// ---------------------------------------------------------------- asset manifest (public/assets/expedition/<ns>/manifest.json; §5)
// ONE manifest shape for 20 and 02 (A2, A3, A4). Written only by `pnpm art:build` (§5.2).
const Pivot = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]); // fractions of width/height (§5.1)
const ManifestAnchor = z.strictObject({ name: Id, x: z.number(), y: z.number() }); // design units, from <* id="anchor-<name>">
/** Residency bucket (A4, §5.7): "all" = resident for the whole game; otherwise the zone whose set loads it. */
export const ZoneTag = z.union([z.literal("all"), Id]);
export type ZoneTag = z.infer<typeof ZoneTag>;
/** "hero" (hand-authored; counts against heroCap), "kit:<generator>" (§5.4) or "rig:<body>" (§5.5). */
export const AssetSource = z.string().regex(/^(hero|kit:[a-z][A-Za-z]*|rig:[a-z_]+)$/);
export type AssetSource = z.infer<typeof AssetSource>;
const EntryBase = {
  key: AssetKey,
  zone: ZoneTag,
  source: AssetSource,
  sha1: z.string().regex(/^[0-9a-f]{40}$/),
  legacyId: z.string().min(1).max(40).nullable().default(null), // "A76", "cr.lamp.arc", "#135": traceability to the game docs' old ids
};
/** A puppet animation (§5.5): per-part tracks of waves or keyframes. Loaded from `<name>.anims.json` at build time. */
export const PuppetAnim = z.strictObject({
  id: Id, // "idle", "talk", "cue", "arm_sync", "partial", "restored"
  loop: z.boolean(),
  ms: Ms, // one cycle (loop) or the whole animation
  tracks: z
    .array(
      z.strictObject({
        part: Id,
        prop: z.enum(["rot", "x", "y", "scaleX", "scaleY", "alpha", "frame"]),
        wave: z.strictObject({ amp: z.number(), hz: z.number().min(0).max(30), phase: z.number().default(0) }).nullable().default(null),
        keys: z.array(z.tuple([Ms, z.number()])).max(16).default([]), // [t ms, value], used when wave is null
      }),
    )
    .min(1)
    .max(16),
});
export type PuppetAnim = z.infer<typeof PuppetAnim>;
export const CharacterBody = z.enum(["female_adventurer", "female_person", "male_adventurer", "male_person"]);
export type CharacterBody = z.infer<typeof CharacterBody>;
export const ManifestEntry = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("svg"),
    ...EntryBase, // layers, ground, props, parts, costumes, fx, ui, vistas, docs
    file: z.string().min(1), // relative to public/assets/expedition/
    width: z.number().int().min(1).max(8192),
    height: z.number().int().min(1).max(4096),
    /** texture size = design size × k, k = ceil4(rasterScale × min(devicePixelRatio, 1.5)) (§5.1) */
    rasterScale: z.number().min(0.25).max(2).default(1),
    tileWidth: z.number().int().min(64).max(2048).nullable().default(null), // split wide layers into tiles
    pivot: Pivot.default([0.5, 1]),
    anchors: z.array(ManifestAnchor).max(32).default([]),
    scroll: z.number().min(0).max(1.6).nullable().default(null), // layers: the authored parallax factor (informational)
    seed: z.number().int().min(0).max(4_294_967_295).nullable().default(null), // kit entries
    engraved: z.array(z.string().min(1).max(80)).max(16).default([]), // engraved strings (tests/art-engrave.test.ts)
  }),
  z.strictObject({
    kind: z.literal("puppet"),
    ...EntryBase, // ≤ 8-part puppet (§5.5): guides, creature/machine NPCs, animated hubs
    file: z.string().min(1), // the packed part sheet: load.svg, then Texture.add per part frame
    restFile: z.string().min(1), // the assembled rest pose as one SVG (DOM host, dialogue portraits, snapshots)
    width: z.number().int().min(1).max(4096), // rest-pose design size
    height: z.number().int().min(1).max(4096),
    rasterScale: z.number().min(0.25).max(2).default(1.5),
    pivot: Pivot.default([0.5, 1]),
    parts: z
      .array(
        z.strictObject({
          name: Id,
          frames: z.number().int().min(1).max(8),
          rest: z.tuple([z.number(), z.number()]), // the part's pivot point in the rest pose, design units
          pivot: Pivot, // within the part's own box
          z: z.number().int().min(-8).max(8),
          box: z.tuple([z.number(), z.number(), z.number(), z.number()]), // frame 0's rect in the sheet; frame i is offset by i × w
        }),
      )
      .min(1)
      .max(8),
    anims: z.array(PuppetAnim).min(1).max(12), // always "idle"; companions also "talk" and "cue" (R1)
    anchors: z.array(ManifestAnchor).max(16).default([]),
  }),
  z.strictObject({
    kind: z.literal("atlas"),
    ...EntryBase, // one recoloured Kenney character (§5.5); key "shared.char.<id>", source "rig:<body>"
    body: CharacterBody,
    image: z.string().min(1), // "shared/char/wren.png"
    frames: z.string().min(1), // "shared/char/wren.json": Phaser JSON hash, frame names = pose names
    frameWidth: z.literal(192), // texels: 2× the Kenney 1× cell
    frameHeight: z.literal(256),
    displayWidth: z.literal(168), // design units: the 96-px figure = 168 = 1 H
    displayHeight: z.literal(224),
    poses: z.array(PoseName).min(1).max(28), // protagonists 28, NPCs 12 (§5.5)
    pivot: Pivot.default([0.5, 1]),
    anchors: z
      .array(
        z.strictObject({
          pose: PoseName,
          facing: z.enum(["front", "back"]),
          // display units from the frame's top-left; rot in degrees
          points: z.array(z.strictObject({ name: RigAnchor, x: z.number(), y: z.number(), rot: z.number().default(0) })).length(7),
        }),
      )
      .max(28),
    fallback: z.strictObject({
      // untinted Kenney HD sheet via load.atlasXML (?charfallback=1, or the atlas failed to load)
      image: z.string().min(1),
      xml: z.string().min(1),
      frameNames: z.record(PoseName, z.string().min(1)), // pose → the Kenney XML SubTexture name
    }),
  }),
]);
export type ManifestEntry = z.infer<typeof ManifestEntry>;
export type ManifestEntryKind = ManifestEntry["kind"];
export const AssetManifest = z.strictObject({
  namespace: Id, // "shared" or a biome id
  paletteId: Id,
  heroCap: z.number().int().min(0).max(HERO_CAP_PER_NAMESPACE), // §5.1, §5.8
  heroCount: z.number().int().min(0).max(HERO_CAP_PER_NAMESPACE), // distinct hero files in use; the build fails above heroCap
  entries: z.array(ManifestEntry).max(800),
  totalBytes: z.number().int().min(0),
  gzipBytes: z.number().int().min(0),
  vram: z.array(z.strictObject({ zone: ZoneTag, mb: z.number().min(0) })).max(9), // resident set per zone ("all" + that zone) at dpr 1.5
  swapPeakMb: z.number().min(0), // the worst adjacent zone pair + "all" at dpr 1.5
});
export type AssetManifest = z.infer<typeof AssetManifest>;
