/**
 * src/game/expedition/audio/cues.ts (S1) — the procedural cue bank as data (docs/design/20 §2.12, amendment 35).
 * Pure: the recipe table (what to synthesize) and `CUE_MAP` (every cue id → recipe + params). `synth.ts` renders
 * a recipe with WebAudio; `bus.ts` decides whether anything plays at all.
 *
 * Every cue id is snake_case and `Id`-legal (A10): `Trigger.cue`, `PropPlacement.touch.cue` and the cutscene `sfx`
 * step take an `Id`. The coverage test parses trig §6.8, cell §6.7 and civil §5.0.6 and checks every id is here.
 */

export const RECIPE_IDS = [
  "tick", "select", "verify", "badge", "whoosh", "hum", "bell", "chord", "clunk", "thunk",
  "latch", "spark", "water", "stamp", "teletype", "page", "rumble", "pop", "chime", "grind",
] as const;
export type RecipeId = (typeof RECIPE_IDS)[number];

export type Wave = "sine" | "triangle" | "sawtooth" | "square";
export type FilterKind = "lowpass" | "highpass" | "bandpass";

/** One sounding layer of a recipe. Times in ms from the recipe start; frequencies in Hz before the cue's pitch. */
export type Voice =
  | {
      kind: "osc";
      atMs: number;
      durMs: number;
      wave: Wave;
      freq: number;
      freqEnd?: number; // exponential glide to this frequency
      gain: number;
      attackMs?: number;
      comb?: { delayMs: number; feedback: number }; // the grind recipe's comb filter
    }
  | {
      kind: "noise";
      atMs: number;
      durMs: number;
      filter: FilterKind;
      freq: number;
      freqEnd?: number;
      q?: number;
      gain: number;
      attackMs?: number;
      swell?: boolean; // rise to the middle, then fall (water)
    }
  | {
      kind: "fm";
      atMs: number;
      durMs: number;
      freq: number; // carrier
      ratio: number; // modulator = ratio × carrier
      indexStart: number;
      indexEnd: number;
      gain: number;
    };

export interface Recipe {
  id: RecipeId;
  voices: readonly Voice[];
  /** loop recipes sustain until stopped; their pitch/gain are live params (meta.audio) */
  loop: boolean;
  /** gap between repeats when a cue asks for `repeat` */
  repeatGapMs: number;
}

const r = (id: RecipeId, voices: Voice[], opts: { loop?: boolean; repeatGapMs?: number } = {}): Recipe => ({
  id,
  voices,
  loop: opts.loop ?? false,
  repeatGapMs: opts.repeatGapMs ?? 90,
});

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;

/** The synthesis table (§2.12's "Synthesis" column). */
export const RECIPES: Readonly<Record<RecipeId, Recipe>> = {
  tick: r("tick", [{ kind: "osc", atMs: 0, durMs: 25, wave: "sine", freq: 1800, gain: 0.35 }], { repeatGapMs: 70 }),
  select: r("select", [
    { kind: "osc", atMs: 0, durMs: 30, wave: "sine", freq: 660, gain: 0.3 },
    { kind: "osc", atMs: 30, durMs: 30, wave: "sine", freq: 990, gain: 0.3 },
  ]),
  verify: r("verify", [
    { kind: "osc", atMs: 0, durMs: 140, wave: "triangle", freq: 440, gain: 0.3 },
    { kind: "osc", atMs: 0, durMs: 140, wave: "triangle", freq: 880, gain: 0.18 },
  ]),
  badge: r("badge", [
    { kind: "osc", atMs: 0, durMs: 220, wave: "triangle", freq: C5, gain: 0.28 },
    { kind: "osc", atMs: 90, durMs: 220, wave: "triangle", freq: E5, gain: 0.28 },
    { kind: "osc", atMs: 180, durMs: 320, wave: "triangle", freq: G5, gain: 0.28 },
  ]),
  whoosh: r("whoosh", [{ kind: "noise", atMs: 0, durMs: 280, filter: "bandpass", freq: 400, freqEnd: 2000, q: 1.2, gain: 0.35, attackMs: 60 }]),
  hum: r("hum", [
    { kind: "osc", atMs: 0, durMs: 0, wave: "sine", freq: 220, gain: 0.22, attackMs: 50 },
    { kind: "osc", atMs: 0, durMs: 0, wave: "sine", freq: 440, gain: 0.022, attackMs: 50 },
  ], { loop: true }),
  bell: r("bell", [{ kind: "fm", atMs: 0, durMs: 1200, freq: 660, ratio: 3.5, indexStart: 4, indexEnd: 0, gain: 0.3 }]),
  chord: r("chord", [
    { kind: "fm", atMs: 0, durMs: 1200, freq: C5, ratio: 3.5, indexStart: 3, indexEnd: 0, gain: 0.2 },
    { kind: "fm", atMs: 0, durMs: 1200, freq: E5, ratio: 3.5, indexStart: 3, indexEnd: 0, gain: 0.2 },
    { kind: "fm", atMs: 0, durMs: 1200, freq: G5, ratio: 3.5, indexStart: 3, indexEnd: 0, gain: 0.2 },
  ]),
  clunk: r("clunk", [
    { kind: "osc", atMs: 0, durMs: 180, wave: "sine", freq: 90, freqEnd: 45, gain: 0.5 },
    { kind: "noise", atMs: 0, durMs: 120, filter: "lowpass", freq: 600, gain: 0.25 },
  ], { repeatGapMs: 140 }),
  thunk: r("thunk", [{ kind: "osc", atMs: 0, durMs: 120, wave: "sine", freq: 60, gain: 0.55 }]),
  latch: r("latch", [
    { kind: "noise", atMs: 0, durMs: 12, filter: "highpass", freq: 2500, gain: 0.35 },
    { kind: "noise", atMs: 40, durMs: 12, filter: "highpass", freq: 2500, gain: 0.35 },
  ], { repeatGapMs: 120 }),
  spark: r("spark", [{ kind: "noise", atMs: 0, durMs: 70, filter: "highpass", freq: 3000, gain: 0.3 }]),
  water: r("water", [{ kind: "noise", atMs: 0, durMs: 1200, filter: "lowpass", freq: 700, freqEnd: 350, gain: 0.3, swell: true }]),
  stamp: r("stamp", [
    { kind: "noise", atMs: 0, durMs: 25, filter: "bandpass", freq: 1500, q: 0.8, gain: 0.4 },
    { kind: "osc", atMs: 0, durMs: 110, wave: "sine", freq: 150, freqEnd: 110, gain: 0.45 },
  ], { repeatGapMs: 180 }),
  // a 14 Hz train of ticks for 1 s
  teletype: r(
    "teletype",
    Array.from({ length: 14 }, (_, i): Voice => ({ kind: "osc", atMs: Math.round((i * 1000) / 14), durMs: 25, wave: "sine", freq: 1800, gain: 0.25 })),
  ),
  page: r("page", [
    { kind: "noise", atMs: 0, durMs: 60, filter: "bandpass", freq: 2200, q: 2, gain: 0.2 },
    { kind: "noise", atMs: 70, durMs: 60, filter: "bandpass", freq: 1800, q: 2, gain: 0.16 },
    { kind: "noise", atMs: 140, durMs: 80, filter: "bandpass", freq: 1500, q: 2, gain: 0.12 },
  ]),
  rumble: r("rumble", [
    { kind: "osc", atMs: 0, durMs: 800, wave: "sine", freq: 40, gain: 0.55, attackMs: 80 },
    { kind: "noise", atMs: 0, durMs: 800, filter: "lowpass", freq: 180, gain: 0.35, attackMs: 80 },
  ]),
  pop: r("pop", [{ kind: "osc", atMs: 0, durMs: 50, wave: "sine", freq: 400, freqEnd: 900, gain: 0.3 }], { repeatGapMs: 110 }),
  chime: r("chime", [
    { kind: "osc", atMs: 0, durMs: 600, wave: "sine", freq: 1300, gain: 0.22 },
    { kind: "osc", atMs: 0, durMs: 600, wave: "sine", freq: 2600, gain: 0.1 },
  ]),
  grind: r("grind", [
    { kind: "osc", atMs: 0, durMs: 400, wave: "sawtooth", freq: 70, gain: 0.22, attackMs: 40, comb: { delayMs: 7, feedback: 0.6 } },
  ]),
};

export interface CueEntry {
  recipe: RecipeId;
  pitch?: number; // frequency multiplier (hum loops: the live pitch multiplies this)
  gain?: number; // 0..1 multiplier
  repeat?: number; // total plays (≥ 2), spaced by the recipe's repeatGapMs
}

const many = (recipe: RecipeId, ids: readonly string[], extra: Omit<CueEntry, "recipe"> = {}): [string, CueEntry][] =>
  ids.map((id) => [id, { recipe, ...extra }]);

/**
 * Every cue id → recipe (§2.12's table, the union of trig §6.8, cell §6.7 and civil §5.0.6). A skin's new cue id is
 * a row here first. Conflicts resolved by §2.12: `lift_hum` is a one-shot whoosh (pitch 0.5); `warden_bow_rumble` is
 * rumble; the cue id `clunk` plays the grind recipe.
 */
export const CUE_MAP: Readonly<Record<string, CueEntry>> = Object.fromEntries([
  ...many("tick", ["ui_knob_tick", "stud_tick", "tally_click", "pendulum_tick", "relay_click"]),
  ...many("tick", ["mimic_scuttle"], { repeat: 6 }),
  ...many("tick", ["cog_wind"], { pitch: 0.8, repeat: 6 }),
  ...many("select", ["ui_select", "cord_seat", "pip_chirp"]),
  ...many("verify", ["ui_verify"]),
  ...many("badge", ["ui_badge"]),
  ...many("whoosh", ["ui_panel_in", "ui_panel_out", "tube_whoosh", "beam_rise", "beam_surge", "fog_part", "stone_float", "shield_swoosh", "slip"]),
  ...many("whoosh", ["pod_fog"], { pitch: 0.6 }),
  ...many("whoosh", ["lamp_swing"], { pitch: 0.6, gain: 0.4 }),
  ...many("whoosh", ["printing_sweep"], { pitch: 1.6, gain: 0.3 }),
  ...many("whoosh", ["lift_hum"], { pitch: 0.5 }),
  ...many("hum", ["beam_hum", "bell_hum", "sync_hum", "current_hum", "dial_carriage_roll", "ring_turn", "mb_tone"]),
  ...many("bell", ["bell_honest"]),
  ...many("chord", ["chord_true", "resonance_lock", "pore_open"]),
  ...many("clunk", ["latch_clack", "stone_lock_thunk", "spoke_extend_clunk", "drawer_thunk", "gate_open", "breaker_throw"]),
  ...many("clunk", ["bolt_slide"], { repeat: 4 }),
  ...many("thunk", ["slab_set", "halcyon_settle"]),
  ...many("latch", ["latch_click", "latch", "chest_unlock", "cable_snap_taut"]),
  ...many("latch", ["latch_slip"], { repeat: 2 }),
  ...many("spark", ["beam_scatter", "mimic_hiss", "thread_snap", "fuse_pop", "atp_spark"]),
  ...many("water", ["water_rush", "raft_flood", "sluice_drain", "falls_part"]),
  ...many("stamp", ["slide_retract"]),
  ...many("stamp", ["press_roll"], { repeat: 3 }),
  ...many("teletype", ["teletype"]),
  ...many("page", ["ui_page_turn", "page_turn", "pickup_page"]),
  ...many("rumble", ["gatekeeper_rumble", "warden_bow_rumble", "stone_crumble", "engine_spin"]),
  ...many("pop", ["mote_pop", "pod_crack", "boing_soft", "vesicle_pinch"]),
  ...many("pop", ["spit_back"], { repeat: 3 }),
  ...many("chime", ["node_ignite", "lantern_lit", "beacon_ignite", "beacon_fire", "conduit_on", "relief_glint", "lamp_chime"]),
  ...many("chime", ["ridge_thaw"], { pitch: 0.8 }),
  ...many("grind", ["stone_grind", "tumbler_grind", "clunk", "lift_chain", "door_slide", "door_turn"]),
  // ---- the shared core set: the same handful of sounds in every world, so the games feel like one instrument.
  // Movement (the hosts emit these as cue events), dialogue, pickups and hints, navigation, the finale. Quiet on
  // purpose: they play constantly, the skins' own cues are the loud moments.
  ...many("pop", ["ui_hop"], { pitch: 0.9, gain: 0.45 }),
  ...many("thunk", ["ui_land"], { pitch: 1.3, gain: 0.4 }),
  ...many("thunk", ["ui_bump"], { pitch: 0.9, gain: 0.3 }),
  ...many("tick", ["ui_advance"], { pitch: 0.7, gain: 0.6 }),
  ...many("select", ["ui_talk"], { pitch: 0.8, gain: 0.55 }),
  ...many("select", ["ui_hint"], { pitch: 1.2, gain: 0.7 }),
  ...many("chime", ["ui_pickup"], { pitch: 1.25, gain: 0.6 }),
  ...many("whoosh", ["ui_zone"], { pitch: 0.5, gain: 0.6 }),
  ...many("chord", ["ui_finale"], { gain: 0.8 }),
]);

/** The cue's entry, or null (an unmapped cue is silent; validateWorld R16 warns about it). */
export function cueFor(id: string): CueEntry | null {
  return Object.prototype.hasOwnProperty.call(CUE_MAP, id) ? CUE_MAP[id] : null;
}

export function isLoopCue(id: string): boolean {
  const c = cueFor(id);
  return c !== null && RECIPES[c.recipe].loop;
}

/** Total length of a one-shot cue including repeats (ms); loops return Infinity. */
export function cueDurationMs(id: string): number {
  const c = cueFor(id);
  if (!c) return 0;
  const rec = RECIPES[c.recipe];
  if (rec.loop) return Number.POSITIVE_INFINITY;
  const one = Math.max(...rec.voices.map((v) => v.atMs + v.durMs));
  const n = Math.max(1, c.repeat ?? 1);
  return one + (n - 1) * rec.repeatGapMs;
}

/** Time offsets (ms) of each repeat of a one-shot cue. */
export function repeatOffsets(id: string): number[] {
  const c = cueFor(id);
  if (!c) return [];
  const n = Math.max(1, c.repeat ?? 1);
  return Array.from({ length: n }, (_, i) => i * RECIPES[c.recipe].repeatGapMs);
}

/** Music cues (`Segment.music`, cutscene `music` step) are not cue ids; the bus renders them as a quiet pad. */
export const MUSIC_PADS: Readonly<Record<string, { root: number; third: number; gain: number } | null>> = {
  curious: { root: 196, third: 246.94, gain: 0.05 },
  tense: { root: 185, third: 220, gain: 0.05 },
  playful: { root: 261.63, third: 329.63, gain: 0.04 },
  noir: { root: 146.83, third: 174.61, gain: 0.05 },
  boss: { root: 110, third: 130.81, gain: 0.06 },
  calm: { root: 220, third: 277.18, gain: 0.04 },
  solemn: { root: 164.81, third: 196, gain: 0.04 },
};
