import type { Encounter, GameSpec } from "../../../../contracts/gamespec";
import { unlockedIds, type Progression } from "../../../runner/progression";
import { seededRandom } from "../../types";

/*
 * Cozy town (the strategy host's "life sim" skin): pure logic only, no React, no DOM.
 *
 * - villagers: one generated villager per encounter (seeded name + look), grouped into households by progression
 *   track ("the Diffusion household"); the boss is the town Festival.
 * - town layout: a 3-row x 10-column 3/4 top-down grid; each household lives on its own street (row), six build plots
 *   ring the festival square in the middle.
 * - days: up to DAY_CAPACITY requests are solved per day; the requests board holds 3 slots drawn from `available` in a
 *   seeded order per day, refilled when the board runs dry before the day's capacity is used.
 * - economy: rewards by difficulty/role (+ a first-try bonus), no fail state, building prices derived from the minimum
 *   a player can have earned before the festival unlocks, so the Festival Lanterns are ALWAYS affordable by then even
 *   if the player bought every other building first.
 * - bloom: a 0-5 prosperity level from helped villagers and buildings, which grows the illustration.
 */

export const DAY_CAPACITY = 3;
export const BOARD_SLOTS = 3;
export const FIRST_TRY_BONUS = 5;
/** the Festival Lanterns cost at most this share of the minimum coins earned before the festival unlocks */
export const LANTERN_SHARE = 0.45;
/** hard ceiling the tests hold the price to */
export const LANTERN_CEILING = 0.6;

// ---------------------------------------------------------------------------------------------------------------
// villagers

export type Accessory = "sprout" | "beret" | "bow" | "scarf" | "flower" | "cap" | "none";
export type Eyes = "dot" | "happy" | "wide";

export interface VillagerLook {
  body: string;
  accent: string;
  accessory: Accessory;
  eyes: Eyes;
}

export interface HouseSpot {
  row: number;
  col: number;
  x: number;
  y: number;
  scale: number;
  /** 0..2: house silhouette */
  variant: number;
  wall: string;
  roof: string;
  flip: boolean;
}

export interface Villager {
  encounterId: string;
  name: string;
  /** progression track; -1 for the festival */
  track: number;
  household: string;
  conceptName: string;
  /** one-line ask templated from the socket and concept */
  ask: string;
  /** first sentence of the prompt, truncated */
  snippet: string;
  reward: number;
  isFestival: boolean;
  look: VillagerLook;
  house: HouseSpot | null;
}

export interface Household {
  track: number;
  name: string;
  /** encounter ids in track order */
  members: string[];
  row: number;
  roof: string;
}

const NAMES = [
  "Hazel", "Pip", "Juniper", "Bram", "Wren", "Tansy", "Rowan", "Clover", "Fennel", "Poppy", "Basil", "Linden",
  "Marigold", "Quill", "Sorrel", "Birch", "Olive", "Sage", "Thistle", "Fern", "Barley", "Maple", "Acorn", "Bramble",
  "Posy", "Nutmeg", "Willow", "Ginger", "Parsley", "Heath", "Mallow", "Pebble", "Rosehip", "Tamsin", "Alder",
  "Bluebell", "Cress", "Dill", "Elder", "Figgy",
];

const BODY_COLORS = ["#f6c6a8", "#f7d9a0", "#bfe3c4", "#c9d8f5", "#e7c6ec", "#f5b8b8", "#d9e8a8", "#fbe3c0", "#b8e0e0", "#f0cfa8"];
const ACCENTS = ["#e07a5f", "#81b29a", "#f2cc8f", "#6d9dc5", "#c38dd6", "#e9a03b", "#7fb069", "#d65f7a"];
const ACCESSORIES: Accessory[] = ["sprout", "beret", "bow", "scarf", "flower", "cap", "none"];
const EYES: Eyes[] = ["dot", "happy", "wide"];
/** pastel roofs per household (track 0..2), then walls */
const ROOFS = ["#e08a6e", "#6f9fc8", "#b58ac9", "#d9a441"];
const WALLS = ["#fff4dc", "#fbe8cf", "#f4efe2", "#fde9d9", "#eef3df"];

/** "Tonicity: hypotonic, isotonic" -> "Tonicity"; "The sodium-potassium pump" -> "Sodium-potassium pump". */
export function shortConcept(name: string): string {
  let s = name.split(/[:(—]| - /)[0].trim();
  s = s.replace(/^(the|a|an)\s+/i, "");
  if (s.length > 26) {
    const words = s.split(/\s+/);
    let out = "";
    for (const w of words) {
      if ((out + " " + w).trim().length > 26) break;
      out = (out + " " + w).trim();
    }
    s = out || s.slice(0, 26);
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function householdName(conceptName: string): string {
  return `the ${shortConcept(conceptName)} household`;
}

/** The one-line ask on a villager's card, by socket. */
export function askFor(socket: string, conceptName: string, isFestival = false): string {
  // concept names keep their case: many are proper nouns ("Brown v. Board", "Montgomery bus boycott")
  const lc = shortConcept(conceptName);
  if (isFestival) return "The lanterns are ready. Will you open the festival?";
  switch (socket) {
    case "production_line":
      return `Could you help sort out my ${lc} order?`;
    case "market":
      return `What's a fair trade for ${lc}?`;
    case "research_node":
      return `I've been puzzling over ${lc}…`;
    case "event_card":
      return `Something odd happened with ${lc}. Can you explain it?`;
    case "policy_dial":
      return `Could you help me set the ${lc} dial just right?`;
    case "ledger":
      return `My ${lc} ledger won't balance. Would you check it?`;
    case "crisis":
      return `Oh dear, trouble with ${lc}! Can you help?`;
    default:
      return `Could you help me with ${lc}?`;
  }
}

/** First sentence of a prompt, cut at a word boundary to `max` characters. */
export function firstSentence(prompt: string, max = 96): string {
  const flat = prompt.replace(/\s+/g, " ").trim();
  const m = flat.match(/^.*?[.!?](?=\s|$)/);
  const s = m ? m[0] : flat;
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[,;:\s]+$/, "")}…`;
}

// ---------------------------------------------------------------------------------------------------------------
// economy

export type BuildingId = "cottage" | "garden" | "stall" | "bakery" | "library" | "lighthouse" | "lanterns";

export interface Building {
  id: BuildingId;
  name: string;
  price: number;
  perk: string;
}

const BUILDING_DEFS: { id: BuildingId; name: string; share: number; perk: string }[] = [
  { id: "cottage", name: "Cottage", share: 0.08, perk: "A snug home for a new neighbour." },
  { id: "garden", name: "Garden", share: 0.11, perk: "Flower beds bloom along every street." },
  { id: "stall", name: "Market Stall", share: 0.14, perk: "The journal tallies the coins each household gave." },
  { id: "bakery", name: "Bakery", share: 0.17, perk: "Warm bread and chimney smoke every morning." },
  { id: "library", name: "Library", share: 0.2, perk: "The journal shows the source passage behind each solved request." },
  { id: "lighthouse", name: "Lighthouse", share: 0.25, perk: "Spots tomorrow's visitors from the harbour." },
  { id: "lanterns", name: "Festival Lanterns", share: 0, perk: "Lights the square so the festival can begin." },
];

export function baseReward(e: Pick<Encounter, "difficulty" | "role">): number {
  const byDifficulty = e.difficulty <= 1 ? 10 : e.difficulty === 2 ? 15 : 20;
  if (e.role === "boss") return byDifficulty + 10;
  return byDifficulty + (e.role === "review" ? 5 : 0);
}

function roundPrice(v: number): number {
  return v >= 10 ? Math.floor(v / 5) * 5 : Math.floor(v);
}

/** Minimum coins a player has earned when the festival unlocks: every non-festival request, no bonuses. */
export function minEarnedBeforeFestival(encounters: readonly Encounter[], bossId: string | null): number {
  return encounters.filter((e) => e.id !== bossId).reduce((sum, e) => sum + baseReward(e), 0);
}

/**
 * Prices: the lanterns take LANTERN_SHARE of the minimum pre-festival earnings; the other six split at most 95 % of
 * what is left, so buying EVERYTHING else first still leaves the lanterns affordable when the festival unlocks.
 */
export function priceBuildings(minEarned: number): Building[] {
  const lanterns = roundPrice(LANTERN_SHARE * minEarned);
  const budget = minEarned - lanterns;
  return BUILDING_DEFS.map((d) => ({ id: d.id, name: d.name, perk: d.perk, price: d.id === "lanterns" ? lanterns : roundPrice(d.share * budget) }));
}

// ---------------------------------------------------------------------------------------------------------------
// town layout

export const SCENE_W = 1000;
export const SCENE_H = 560;
export const ROWS = 3;
export const COLS = 10;
const ROW_Y = [262, 356, 452];
const ROW_SCALE = [0.74, 0.87, 1];
const ROW_SPREAD = [0.86, 0.94, 1];
/** the festival square (row 1, the two middle columns) */
export const PLAZA = { x: 500, y: 356, rx: 118, ry: 44 };
/** build plots, in the order buildings fill them */
const PLOT_CELLS: [number, number][] = [
  [1, 3],
  [1, 6],
  [0, 4],
  [0, 5],
  [2, 3],
  [2, 6],
];
/** cells kept clear: the plaza and the avenue down to the pier */
const RESERVED: [number, number][] = [
  [1, 4],
  [1, 5],
  [2, 4],
  [2, 5],
];

export function cellXY(row: number, col: number): { x: number; y: number; scale: number } {
  return { x: Math.round(500 + (col - 4.5) * 94 * ROW_SPREAD[row]), y: ROW_Y[row], scale: ROW_SCALE[row] };
}

export interface Plot {
  index: number;
  x: number;
  y: number;
  scale: number;
}

export interface Decor {
  kind: "tree" | "pine" | "lamp" | "flower" | "bush";
  x: number;
  y: number;
  scale: number;
  /** minimum bloom level at which it shows (flowers, bushes) */
  minBloom: number;
  hue: number;
}

export interface CozyWorld {
  seed: number;
  townName: string;
  villagers: Map<string, Villager>;
  households: Household[];
  /** encounter ids in spec order */
  order: string[];
  bossId: string | null;
  buildings: Building[];
  minEarned: number;
  plots: Plot[];
  decor: Decor[];
  /** the festival villager's display name (a cast member when the boss has a speaker) */
  festivalHost: string;
}

function shuffle<T>(items: readonly T[], rnd: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type SpecLike = Pick<GameSpec, "seed" | "title" | "encounters" | "concepts" | "characters" | "narrative">;

export function buildCozyWorld(spec: SpecLike, progression: Progression): CozyWorld {
  const rnd = seededRandom(spec.seed);
  const conceptName = (id: string) => spec.concepts.find((c) => c.id === id)?.name ?? id.replace(/^c_/, "").replace(/_/g, " ");
  const bossId = progression.bossId;

  // households, one per track; the biggest takes the back row (it has the most free cells)
  const trackRows = progression.tracks
    .map((ids, track) => ({ track, size: ids.length }))
    .sort((a, b) => b.size - a.size || a.track - b.track)
    .map((t, i) => ({ track: t.track, row: i % ROWS }));
  const households: Household[] = progression.tracks.map((ids, track) => {
    const first = spec.encounters.find((e) => e.id === ids[0]);
    return {
      track,
      name: householdName(conceptName(first?.conceptIds[0] ?? "")),
      members: [...ids],
      row: trackRows.find((t) => t.track === track)?.row ?? 0,
      roof: ROOFS[track % ROOFS.length],
    };
  });

  // free cells per row, nearest the plaza first
  const taken = new Set<string>([...PLOT_CELLS, ...RESERVED].map(([r, c]) => `${r}:${c}`));
  const rowCells = (row: number) =>
    Array.from({ length: COLS }, (_, c) => c)
      .filter((c) => !taken.has(`${row}:${c}`))
      .sort((a, b) => Math.abs(a - 4.5) - Math.abs(b - 4.5) || a - b);
  const houseCell = new Map<string, [number, number]>();
  const overflow: string[] = [];
  for (const h of households) {
    const cells = rowCells(h.row);
    h.members.forEach((id, i) => {
      if (i < cells.length) {
        houseCell.set(id, [h.row, cells[i]]);
        taken.add(`${h.row}:${cells[i]}`);
      } else overflow.push(id);
    });
  }
  for (const id of overflow) {
    const free = [0, 1, 2].flatMap((r) => rowCells(r).map((c) => [r, c] as [number, number]));
    if (free.length === 0) break;
    houseCell.set(id, free[0]);
    taken.add(`${free[0][0]}:${free[0][1]}`);
  }

  const names = shuffle(NAMES, rnd);
  const bossBeat = spec.narrative.beats.find((b) => b.encounterId === bossId && b.when === "before");
  const festivalHost = bossBeat ? (spec.characters.find((c) => c.id === bossBeat.speakerId)?.name ?? "The Festival Committee") : "The Festival Committee";

  const villagers = new Map<string, Villager>();
  let n = 0;
  for (const e of spec.encounters) {
    const isFestival = e.id === bossId;
    const node = progression.byId.get(e.id);
    const track = node?.track ?? 0;
    const cell = houseCell.get(e.id);
    const look: VillagerLook = {
      body: BODY_COLORS[Math.floor(rnd() * BODY_COLORS.length)],
      accent: ACCENTS[Math.floor(rnd() * ACCENTS.length)],
      accessory: ACCESSORIES[Math.floor(rnd() * ACCESSORIES.length)],
      eyes: EYES[Math.floor(rnd() * EYES.length)],
    };
    const variant = Math.floor(rnd() * 3);
    const wall = WALLS[Math.floor(rnd() * WALLS.length)];
    const flip = rnd() < 0.5;
    const cName = conceptName(e.conceptIds[0]);
    villagers.set(e.id, {
      encounterId: e.id,
      name: isFestival ? festivalHost : (names[n++ % names.length] ?? `Neighbour ${n}`),
      track: isFestival ? -1 : track,
      household: isFestival ? "the whole town" : (households.find((h) => h.track === track)?.name ?? householdName(cName)),
      conceptName: cName,
      ask: askFor(e.socket, cName, isFestival),
      snippet: firstSentence(e.prompt),
      reward: baseReward(e),
      isFestival,
      look,
      house: cell
        ? { row: cell[0], col: cell[1], ...cellXY(cell[0], cell[1]), variant, wall, roof: ROOFS[Math.max(0, track) % ROOFS.length], flip }
        : null,
    });
  }

  const plots: Plot[] = PLOT_CELLS.map(([r, c], index) => ({ index, ...cellXY(r, c) }));
  const decor = buildDecor(rnd, taken);
  const minEarned = minEarnedBeforeFestival(spec.encounters, bossId);
  return {
    seed: spec.seed,
    townName: spec.title,
    villagers,
    households,
    order: spec.encounters.map((e) => e.id),
    bossId,
    buildings: priceBuildings(minEarned),
    minEarned,
    plots,
    decor,
    festivalHost,
  };
}

function buildDecor(rnd: () => number, taken: ReadonlySet<string>): Decor[] {
  const out: Decor[] = [];
  // a tree line along the hill behind the back row
  for (let i = 0; i < 16; i++) {
    const x = 20 + i * 64 + (rnd() - 0.5) * 30;
    out.push({ kind: rnd() < 0.4 ? "pine" : "tree", x: Math.round(x), y: Math.round(208 + rnd() * 14), scale: 0.62 + rnd() * 0.25, minBloom: 0, hue: rnd() });
  }
  // trees in empty cells at the street ends
  for (let r = 0; r < ROWS; r++)
    for (const c of [0, COLS - 1])
      if (!taken.has(`${r}:${c}`)) {
        const p = cellXY(r, c);
        out.push({ kind: rnd() < 0.5 ? "tree" : "pine", x: p.x, y: p.y, scale: p.scale * 0.95, minBloom: 0, hue: rnd() });
      }
  // lamps along the two streets
  for (const y of [306, 402]) for (const x of [150, 330, 670, 850]) out.push({ kind: "lamp", x, y, scale: y > 350 ? 1 : 0.9, minBloom: 0, hue: 0 });
  // flowers and bushes appear as the town blooms
  for (let i = 0; i < 44; i++) {
    const street = i % 3;
    const y = [300, 396, 470][street] + Math.round((rnd() - 0.5) * 8);
    const x = Math.round(40 + rnd() * 920);
    if (Math.abs(x - 500) < 60 && street === 2) continue; // keep the avenue clear
    out.push({ kind: rnd() < 0.3 ? "bush" : "flower", x, y, scale: 0.8 + rnd() * 0.5, minBloom: 1 + (i % 5), hue: rnd() });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// days

export interface DayLog {
  day: number;
  solved: string[];
  coins: number;
}

export interface CozyState {
  day: number;
  /** encounter ids solved before this day began (sorted) */
  dayStartSolved: string[];
  /** the requests board: encounter ids (or null for an empty slot) */
  slots: (string | null)[];
  /** "evening" once the player pressed End day; the capacity-reached evening is derived (see eveningDue) */
  phase: "day" | "evening";
  /** building ids in purchase order */
  built: BuildingId[];
  spent: number;
  /** first-try bonus coins per encounter */
  bonuses: Record<string, number>;
  days: DayLog[];
  /** the last LastResult.seq this state has absorbed */
  seenSeq: number;
  /** the most recent graded result, for the card's thank-you or kind line */
  reaction: Reaction | null;
}

export interface Reaction {
  encounterId: string;
  correct: boolean;
  seq: number;
  coins: number;
  line: string;
}

const THANKS = [
  "Thank you kindly! I'll tell the whole street.",
  "Oh, wonderful! You've made my day.",
  "That's exactly it. Come by for tea sometime!",
  "Brilliant! My windows are glowing already.",
  "Thank you! I knew you'd sort it out.",
  "Marvellous. The town is lucky to have you.",
];
const KIND = [
  "Not quite, but thank you for trying!",
  "Hmm, not that one. No rush, take your time.",
  "Close! Have another look, I'll put the kettle on.",
  "Not quite. Thank you for giving it a go!",
];

/** A villager's thank-you line: stable per villager, so a helped card always reads the same. */
export function thanksFor(world: CozyWorld, id: string): string {
  const i = world.order.indexOf(id);
  return THANKS[(world.seed + Math.max(0, i)) % THANKS.length];
}

/** Coins a solved request paid (reward + any first-try bonus). */
export function paidFor(world: CozyWorld, state: CozyState, id: string): number {
  return (world.villagers.get(id)?.reward ?? 0) + (state.bonuses[id] ?? 0);
}

/** Requests for a board refill: the festival first when it is available, then a seeded order for the day. */
export function pickRequests(world: CozyWorld, available: readonly string[], exclude: ReadonlySet<string>, day: number, count: number): string[] {
  if (count <= 0) return [];
  const pool = available.filter((id) => !exclude.has(id));
  const festival = pool.filter((id) => id === world.bossId);
  const rest = shuffle(
    pool.filter((id) => id !== world.bossId),
    seededRandom((world.seed ^ Math.imul(day + 1, 0x9e3779b1)) >>> 0),
  );
  return [...festival, ...rest].slice(0, count);
}

export function startDay(world: CozyWorld, prev: CozyState | null, solved: ReadonlySet<string>, available: readonly string[]): CozyState {
  const day = prev ? prev.day + 1 : 1;
  const picks = pickRequests(world, available, new Set(), day, Math.min(BOARD_SLOTS, DAY_CAPACITY));
  const days = prev ? [...prev.days, { day: prev.day, solved: solvedToday(prev, solved), coins: earnedToday(world, prev, solved) }] : [];
  return {
    day,
    dayStartSolved: [...solved].sort(),
    slots: Array.from({ length: BOARD_SLOTS }, (_, i) => picks[i] ?? null),
    phase: "day",
    built: prev?.built ?? [],
    spent: prev?.spent ?? 0,
    bonuses: prev?.bonuses ?? {},
    days,
    seenSeq: prev?.seenSeq ?? 0,
    reaction: null,
  };
}

export function solvedToday(state: CozyState, solved: ReadonlySet<string>): string[] {
  const before = new Set(state.dayStartSolved);
  return [...solved].filter((id) => !before.has(id));
}

/** The day is over: End day was pressed, or the day's capacity is used. The host shows it once the desk is closed. */
export function eveningDue(state: CozyState, solved: ReadonlySet<string>, finished: boolean): boolean {
  if (finished) return false;
  return state.phase === "evening" || solvedToday(state, solved).length >= DAY_CAPACITY;
}

/**
 * Keeps the board stocked during the day: while fewer open requests are showing than the day has capacity left,
 * newly unlocked villagers take empty slots first, then slots whose request is done. Returns `state` unchanged
 * (same object) when nothing moves.
 */
export function settle(world: CozyWorld, state: CozyState, solved: ReadonlySet<string>, available: readonly string[]): CozyState {
  if (state.phase !== "day") return state;
  const left = DAY_CAPACITY - solvedToday(state, solved).length;
  if (left <= 0) return state;
  const open = state.slots.filter((id): id is string => id !== null && !solved.has(id));
  const want = Math.min(left, BOARD_SLOTS) - open.length;
  if (want <= 0) return state;
  const onBoard = new Set(state.slots.filter((id): id is string => id !== null));
  const picks = pickRequests(world, available, onBoard, state.day * 31 + onBoard.size, want);
  if (picks.length === 0) return state;
  const slots = [...state.slots];
  const free = [...slots.keys()].filter((i) => slots[i] === null).concat([...slots.keys()].filter((i) => slots[i] !== null && solved.has(slots[i]!)));
  picks.forEach((id, k) => {
    if (k < free.length) slots[free[k]] = id;
  });
  return { ...state, slots };
}

/** Debug warp: make sure `id` has a card on the board. */
export function warp(state: CozyState, id: string | null, solved: ReadonlySet<string>): CozyState {
  if (!id || state.slots.includes(id)) return state;
  const slots = [...state.slots];
  let i = slots.indexOf(null);
  if (i === -1) i = slots.findIndex((s) => s !== null && solved.has(s));
  if (i === -1) i = slots.length - 1;
  slots[i] = id;
  return { ...state, slots, phase: "day" };
}

export function endDay(state: CozyState): CozyState {
  return state.phase === "evening" ? state : { ...state, phase: "evening" };
}

/** Absorbs a graded result: the first-try bonus on a correct first attempt, and the villager's reply. */
export function recordResult(world: CozyWorld, state: CozyState, r: { encounterId: string; correct: boolean; seq: number }, attempts: number): CozyState {
  if (r.seq === state.seenSeq) return state;
  const v = world.villagers.get(r.encounterId);
  const line = r.correct ? thanksFor(world, r.encounterId) : KIND[(world.seed + r.seq * 7 + (v?.name.length ?? 0)) % KIND.length];
  const bonus = r.correct && attempts === 1 && state.bonuses[r.encounterId] === undefined ? FIRST_TRY_BONUS : 0;
  const bonuses = bonus > 0 ? { ...state.bonuses, [r.encounterId]: bonus } : state.bonuses;
  const coins = r.correct ? (v?.reward ?? 0) + bonus : 0;
  return { ...state, seenSeq: r.seq, bonuses, reaction: { encounterId: r.encounterId, correct: r.correct, seq: r.seq, coins, line } };
}

export function earnedFrom(world: CozyWorld, state: CozyState, ids: Iterable<string>): number {
  let sum = 0;
  for (const id of ids) sum += (world.villagers.get(id)?.reward ?? 0) + (state.bonuses[id] ?? 0);
  return sum;
}

export function coinsOf(world: CozyWorld, state: CozyState, solved: ReadonlySet<string>): number {
  return earnedFrom(world, state, solved) - state.spent;
}

export function earnedToday(world: CozyWorld, state: CozyState, solved: ReadonlySet<string>): number {
  return earnedFrom(world, state, solvedToday(state, solved));
}

export function buildingById(world: CozyWorld, id: BuildingId): Building {
  return world.buildings.find((b) => b.id === id)!;
}

/** Buys a building; null when it is already built or unaffordable. */
export function buy(world: CozyWorld, state: CozyState, id: BuildingId, solved: ReadonlySet<string>): CozyState | null {
  const b = world.buildings.find((x) => x.id === id);
  if (!b || state.built.includes(id)) return null;
  if (coinsOf(world, state, solved) < b.price) return null;
  return { ...state, built: [...state.built, id], spent: state.spent + b.price };
}

/** The plot a built building stands on (lanterns hang over the festival square: -1). */
export function plotOf(state: CozyState, id: BuildingId): number {
  if (id === "lanterns") return -1;
  return state.built.filter((b) => b !== "lanterns").indexOf(id);
}

export function festivalReady(state: CozyState): boolean {
  return state.built.includes("lanterns");
}

// ---------------------------------------------------------------------------------------------------------------
// bloom and time of day

export const BLOOM_LABELS = ["Sleepy", "Waking", "Cosy", "Lively", "Blooming", "Radiant"];
/** progress needed for each bloom level: the first helped villagers wake the town quickly */
const BLOOM_STEPS = [0, 0.08, 0.25, 0.45, 0.7, 0.95];

export function bloomOf(world: CozyWorld, state: CozyState, solved: ReadonlySet<string>): { level: number; label: string; progress: number } {
  const regular = world.order.filter((id) => id !== world.bossId);
  const helped = regular.filter((id) => solved.has(id)).length;
  const solvedPart = regular.length === 0 ? (solved.size > 0 ? 1 : 0) : helped / regular.length;
  const builtPart = state.built.length / world.buildings.length;
  const progress = Math.min(1, 0.6 * solvedPart + 0.4 * builtPart);
  const level = BLOOM_STEPS.filter((x) => progress + 1e-9 >= x).length - 1;
  return { level, label: BLOOM_LABELS[level], progress };
}

export const TIME_LABELS = ["Morning", "Midday", "Afternoon", "Evening"];

/** 0 morning .. 3 evening */
export function timeOfDay(state: CozyState, solved: ReadonlySet<string>, finished: boolean): number {
  if (eveningDue(state, solved, finished) || finished) return 3;
  return Math.min(2, solvedToday(state, solved).length);
}

/** Lighthouse: locked villagers one step away (every requirement solved or open now), in spec order. */
export function upcomingVisitors(progression: Progression, solved: ReadonlySet<string>, available: readonly string[], max = 3): string[] {
  const reachable = new Set([...solved, ...available]);
  return progression.nodes
    .filter((n) => !solved.has(n.id) && !available.includes(n.id) && n.requires.every((r) => reachable.has(r)))
    .map((n) => n.id)
    .slice(0, max);
}

/** Encounter visual state. */
export function stateOf(id: string, solved: ReadonlySet<string>, available: readonly string[]): "locked" | "available" | "solved" {
  return solved.has(id) ? "solved" : available.includes(id) ? "available" : "locked";
}

// ---------------------------------------------------------------------------------------------------------------
// colour helpers (palette-derived pastels)

export function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  const full = s.length === 3 ? s.split("").map((ch) => ch + ch).join("") : s.padEnd(6, "0");
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as [number, number, number];
}

/** A simulated full playthrough (used by tests): solve every request shown each day; optionally spend greedily. */
export function simulate(
  world: CozyWorld,
  progression: Progression,
  opts: { spendGreedily?: boolean; noBonus?: boolean; maxDays?: number } = {},
): { days: number; coins: number; built: BuildingId[]; festivalAffordable: boolean; emptyDays: number; finished: boolean } {
  const solved = new Set<string>();
  let seq = 0;
  let state = startDay(world, null, solved, unlockedIds(progression, solved));
  let festivalAffordable = true;
  let emptyDays = 0;
  const total = world.order.length;
  const maxDays = opts.maxDays ?? total * 3 + 5;
  while (solved.size < total && state.day <= maxDays) {
    let available = unlockedIds(progression, solved);
    state = settle(world, state, solved, available);
    if (state.slots.every((s) => s === null || solved.has(s))) emptyDays++;
    let guard = 0;
    while (!eveningDue(state, solved, solved.size === total) && guard++ < 20) {
      const open = state.slots.find((id) => id !== null && !solved.has(id));
      if (!open) break;
      if (open === world.bossId && !festivalReady(state)) {
        const bought = buy(world, state, "lanterns", solved);
        if (!bought) {
          festivalAffordable = false;
          state = { ...state, built: [...state.built, "lanterns"] };
        } else state = bought;
      }
      solved.add(open);
      state = recordResult(world, state, { encounterId: open, correct: true, seq: ++seq }, opts.noBonus ? 2 : 1);
      if (opts.spendGreedily)
        for (const b of world.buildings) {
          if (b.id === "lanterns") continue;
          const next = buy(world, state, b.id, solved);
          if (next) state = next;
        }
      available = unlockedIds(progression, solved);
      state = settle(world, state, solved, available);
    }
    if (solved.size >= total) break;
    state = startDay(world, state, solved, unlockedIds(progression, solved));
  }
  return { days: state.day, coins: coinsOf(world, state, solved), built: state.built, festivalAffordable, emptyDays, finished: solved.size >= total };
}
