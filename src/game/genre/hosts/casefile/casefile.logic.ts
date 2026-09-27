import type { Encounter, GameSpec } from "../../../../contracts/gamespec";
import type { Progression } from "../../../runner/progression";
import { seededRandom } from "../../types";

/*
 * Pure logic for the casefile (mystery) host: no React, no DOM, deterministic from the spec seed.
 *
 * - LOCATIONS: one scene per progression track (named from the theme's place and the track's first concept) plus the
 *   accusation room for the boss. Each scene is a room composed from a small prop kit in fixed slots; 4–8 props are
 *   searchable HOTSPOTS.
 * - CLUES: every non-boss encounter hides exactly two clues in its track's scene: a TAG ("Case file: <concept>") and
 *   a piece of EVIDENCE (its source quote, else the concept's learning objective, else its prompt's first sentence),
 *   with the concept's own name blanked out so matching evidence to idea is the player's job.
 * - REVEAL: a clue can be found once its encounter is available, solved, or one requirement away from available.
 * - COMBINE: an evidence clue plus a tag clue for one of that encounter's concepts forms a LEAD for that encounter.
 * - CASE BOARD: every encounter as a pinned card, lanes per track, red string along progression.requires.
 */

export const SCENE_W = 1000;
export const SCENE_H = 500;

export type PropKind =
  | "window"
  | "corkboard"
  | "shelves"
  | "clock"
  | "cabinet"
  | "bookcase"
  | "coatrack"
  | "fridge"
  | "drip"
  | "safe"
  | "plant"
  | "bin"
  | "desk"
  | "microscope"
  | "typewriter"
  | "phone"
  | "filebox"
  | "mug"
  | "beakers"
  | "books";

export type SlotId = "wallL" | "wallC" | "tallR" | "floorL" | "floorM" | "desk" | "deskL" | "deskR";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where each slot sits in the 1000×500 scene (the desk and its lamp are always present). */
export const SLOTS: Record<SlotId, Box> = {
  wallL: { x: 50, y: 42, w: 220, h: 196 },
  wallC: { x: 330, y: 34, w: 270, h: 160 },
  tallR: { x: 806, y: 96, w: 156, h: 318 },
  floorL: { x: 58, y: 256, w: 132, h: 200 },
  floorM: { x: 212, y: 372, w: 74, h: 88 },
  desk: { x: 300, y: 300, w: 430, h: 172 },
  deskL: { x: 338, y: 196, w: 136, h: 104 },
  deskR: { x: 498, y: 232, w: 118, h: 68 },
};

const SLOT_ORDER: SlotId[] = ["wallL", "wallC", "tallR", "floorL", "floorM", "desk", "deskL", "deskR"];

type Theme = "lab" | "paper" | "any";

/** Props each slot may hold; `theme` biases the pick towards the setting (a lab gets microscopes, an archive typewriters). */
const SLOT_PROPS: Record<SlotId, { kind: PropKind; theme: Theme }[]> = {
  wallL: [
    { kind: "window", theme: "any" },
    { kind: "corkboard", theme: "paper" },
  ],
  wallC: [
    { kind: "shelves", theme: "any" },
    { kind: "corkboard", theme: "any" },
    { kind: "clock", theme: "paper" },
    { kind: "window", theme: "any" },
  ],
  tallR: [
    { kind: "cabinet", theme: "any" },
    { kind: "bookcase", theme: "paper" },
    { kind: "fridge", theme: "lab" },
    { kind: "coatrack", theme: "any" },
  ],
  floorL: [
    { kind: "drip", theme: "lab" },
    { kind: "safe", theme: "paper" },
    { kind: "plant", theme: "any" },
  ],
  floorM: [
    { kind: "bin", theme: "any" },
    { kind: "filebox", theme: "paper" },
  ],
  desk: [{ kind: "desk", theme: "any" }],
  deskL: [
    { kind: "microscope", theme: "lab" },
    { kind: "typewriter", theme: "paper" },
    { kind: "books", theme: "any" },
    { kind: "phone", theme: "any" },
  ],
  deskR: [
    { kind: "mug", theme: "any" },
    { kind: "filebox", theme: "paper" },
    { kind: "beakers", theme: "lab" },
    { kind: "phone", theme: "paper" },
  ],
};

export const PROP_LABEL: Record<PropKind, string> = {
  window: "Rain-streaked window",
  corkboard: "Old corkboard",
  shelves: "Wall shelves",
  clock: "Wall clock",
  cabinet: "Filing cabinet",
  bookcase: "Bookcase",
  coatrack: "Coat rack",
  fridge: "Sample fridge",
  drip: "Drip stand",
  safe: "Floor safe",
  plant: "Potted plant",
  bin: "Wastebasket",
  desk: "Desk drawer",
  microscope: "Microscope",
  typewriter: "Typewriter",
  phone: "Telephone",
  filebox: "Box of files",
  mug: "Coffee mug",
  beakers: "Beaker rack",
  books: "Stack of books",
};

const FLAVOUR: Record<PropKind, string[]> = {
  window: ["Only rain, and your own tired reflection.", "The rain hasn't let up since midnight."],
  corkboard: ["Old notices. Nothing that matters tonight.", "Pins, but no answers."],
  shelves: ["Dusty jars and a dead fly.", "Nothing up here but dust."],
  clock: ["Ten past two. Late, even for you.", "It ticks. That's all it does."],
  cabinet: ["Drawer after drawer of old invoices.", "Somebody else's paperwork."],
  bookcase: ["Manuals nobody has opened in years.", "Spines, dust, and a bookmark from 1987."],
  coatrack: ["An umbrella, still dripping.", "A coat that smells of rain."],
  fridge: ["Cold, humming, and empty.", "Nothing in here but the hum."],
  drip: ["The line is clear. For now.", "Just a drip, keeping time."],
  safe: ["Empty, except for a spare key to nothing.", "Locked, and it stays that way."],
  plant: ["A thirsty plant. No clues in the soil.", "Leaves, dirt, nothing else."],
  bin: ["Crumpled drafts. Nothing useful.", "Pencil shavings and regret."],
  desk: ["Paper clips and a stale sandwich.", "Rubber bands. So many rubber bands."],
  microscope: ["The slide is clean.", "Nothing under the lens but light."],
  typewriter: ["A half-typed sentence that goes nowhere.", "The ribbon is almost dry."],
  phone: ["Dial tone. Nobody's calling back tonight.", "It doesn't ring. It won't."],
  filebox: ["Somebody else's case.", "Receipts, mostly."],
  mug: ["Just old coffee.", "Cold coffee, and a ring on the desk."],
  beakers: ["Rinsed and dried. Nothing to see.", "Clean glass, and nothing else."],
  books: ["A thick book, mostly about other things.", "Heavy reading. Not tonight."],
};

const SPOTS = ["bench", "desk", "files", "corner", "cabinet", "table"];

const SOCKET_LINE: Record<string, string> = {
  conversation: "Talk it through",
  evidence: "Examine the evidence",
  corkboard: "Pin it together",
  cross_exam: "Cross-examine",
  archive: "Check the records",
  lab: "Run the test",
  accusation: "The accusation",
};

export interface PropPlacement {
  slot: SlotId;
  kind: PropKind;
  box: Box;
  /** the hotspot id when this prop can be searched, else null (decor) */
  hotspotId: string | null;
}

export interface Hotspot {
  id: string;
  locationIndex: number;
  slot: SlotId;
  kind: PropKind;
  label: string;
  box: Box;
  flavour: string;
  /** clue ids hidden here, in reveal order */
  clueIds: string[];
}

export interface CaseLocation {
  index: number;
  id: string;
  kind: "scene" | "accusation";
  /** the progression track this scene holds (-1 for the accusation room) */
  track: number;
  /** "The Hospital Lab" */
  place: string;
  /** "Osmosis bench" / "The accusation" */
  title: string;
  /** "The Hospital Lab — Osmosis bench" */
  name: string;
  encounterIds: string[];
  props: PropPlacement[];
  hotspots: Hotspot[];
  /** 0..1 shade variation so the scenes don't all look alike */
  shade: number;
}

export type ClueKind = "tag" | "evidence";

export interface Clue {
  id: string;
  encounterId: string;
  kind: ClueKind;
  /** small caps label on the card: "Case file", "Torn page, p. 3", "Scribbled note" */
  label: string;
  /** tag: the concept name; evidence: the sanitised evidence text */
  text: string;
  /** tag only: the socket line ("Cross-examine"); evidence: "" */
  sub: string;
  /** concept ids this clue speaks to (tag: its one concept; evidence: the encounter's concepts) */
  conceptIds: string[];
  locationIndex: number;
  hotspotId: string;
  /** degrees, for the paper card's tilt */
  tilt: number;
}

export interface BoardPos {
  /** 0..1 across the case board */
  x: number;
  /** 0..1 down the case board */
  y: number;
}

export interface Casefile {
  place: string;
  locations: CaseLocation[];
  /** index into `locations` of the accusation room, or -1 without a boss */
  accusationIndex: number;
  clues: Clue[];
  clueById: ReadonlyMap<string, Clue>;
  /** encounter id → [tag clue id, evidence clue id] (non-boss encounters only) */
  cluesOf: ReadonlyMap<string, readonly [string, string]>;
  /** encounter id → location index (the boss → the accusation room) */
  locationOf: ReadonlyMap<string, number>;
  bossId: string | null;
  partnerId: string;
  suspectId: string | null;
  /** red string on the case board: `from` must be cracked before `to` */
  edges: { from: string; to: string }[];
  boardPos: ReadonlyMap<string, BoardPos>;
  /** columns on the case board (the widest lane) */
  boardCols: number;
}

// ---------------------------------------------------------------------------------------------------------------
// text helpers

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Letters and digits in a string (to tell a real sentence from a husk of ellipses and punctuation). */
function substance(s: string): number {
  return (s.match(/[\p{L}\p{N}]/gu) ?? []).length;
}

/** The spellings of a concept name worth blanking: the name, without a leading article, and the head before ":" / "(". */
export function nameVariants(name: string): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length >= 3) out.add(t);
  };
  add(name);
  add(name.replace(/^(the|a|an)\s+/i, ""));
  for (const sep of [":", "(", " - ", " – ", " — "]) {
    const i = name.indexOf(sep);
    if (i > 0) {
      add(name.slice(0, i));
      add(name.slice(0, i).replace(/^(the|a|an)\s+/i, ""));
    }
  }
  return [...out].sort((a, b) => b.length - a.length);
}

/** Tidies text for a clue card: no template husks, no "undefined", single spaces, collapsed ellipses. */
export function tidy(text: string): string {
  return text
    .replace(/\{\{[^}]*\}\}/g, "…")
    .replace(/\{\{|\}\}/g, "")
    .replace(/\bundefined\b/gi, "…")
    .replace(/\s+/g, " ")
    .replace(/(…\s*){2,}/g, "… ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * Blanks every spelling of the given concept names (case-insensitive) with "…". Returns null when nothing readable
 * is left, so callers can fall back to another source.
 */
export function sanitizeEvidence(text: string, conceptNames: readonly string[]): string | null {
  let out = tidy(text);
  const variants = [...new Set(conceptNames.flatMap(nameVariants))].sort((a, b) => b.length - a.length);
  for (const v of variants) {
    const edge = /^\w/.test(v) ? "\\b" : "";
    const tail = /\w$/.test(v) ? "\\b" : "";
    out = out.replace(new RegExp(`${edge}${escapeRe(v)}${tail}`, "gi"), "…");
  }
  out = tidy(out);
  // a leading ellipsis reads fine ("… uses channel proteins"); a card that is only ellipses and commas does not
  if (substance(out) < 12) return null;
  return out;
}

/** "The student can describe the bilayer…" → "Describe the bilayer…" */
export function objectiveAsNote(lo: string): string {
  const s = lo.replace(/^\s*(the\s+)?(student|learner|player|reader)s?\s+(can|will|should|must|is able to|are able to)\s+/i, "").trim();
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : lo;
}

/** The first sentence of a prompt (up to the first . ! ? followed by a space), capped at `max` characters on a word. */
export function firstSentence(text: string, max = 180): string {
  const t = tidy(text);
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  const s = m ? m[1] : t;
  return clip(s, max);
}

/** Cuts on a word boundary and adds an ellipsis when longer than `max`. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/**
 * A short place name from the theme's setting: "A hospital lab at night: a ruptured…" → "The Hospital Lab";
 * "A rain-soaked newspaper morgue where…" → "The Newspaper Morgue". Falls back to "The Scene".
 */
export function placeName(setting: string): string {
  let s = setting.split(/[:;,.—–(]/)[0] ?? "";
  s = s.replace(/^\s*(a|an|the)\s+/i, "");
  s = s.split(/\s+(?:at|in|on|of|with|where|during|beneath|under|inside|along|that|whose|built|full|near|by|for|from|and|which|to)\s+/i)[0];
  const words = s
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.replace(/'s$/i, ""));
  const pick = words.slice(-2);
  if (pick.length === 0 || pick.join("").length < 3) return "The Scene";
  return `The ${pick.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ")}`;
}

/** A concept name short enough for a tab: at most `max` characters, cut at the head before ":" when long. */
export function shortConcept(name: string, max = 28): string {
  let head = name.replace(/\s*\([^)]*\)\s*/g, " ").trim() || name;
  if (head.includes(":") && head.length > max) head = head.slice(0, head.indexOf(":"));
  return clip(head.trim(), max);
}

/** How strongly a prop's theme fits the room's (0 = never: no microscopes in a newspaper archive). */
function propWeight(prop: Theme, room: Theme): number {
  if (prop === room) return 3;
  if (prop === "any") return 2;
  return room === "paper" ? 0 : 1;
}

function themeOf(spec: Pick<GameSpec, "theme" | "title" | "premise">): Theme {
  const t = `${spec.theme.setting} ${spec.title} ${spec.premise}`.toLowerCase();
  if (/\b(lab|laborator|hospital|clinic|cell|chem|bio|science|molecul|microscope|specimen|patholog|medic)/.test(t)) return "lab";
  if (/\b(newspaper|archive|library|office|morgue|editor|records?|court|study|detective|agency|typewriter|files?)\b/.test(t)) return "paper";
  return "any";
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// building the case

type SpecLike = Pick<GameSpec, "seed" | "encounters" | "concepts" | "characters" | "theme" | "title" | "premise" | "narrative">;

/** How many searchable props a scene with `clueCount` clues gets (4–8). */
export function hotspotCount(clueCount: number): number {
  return Math.max(4, Math.min(8, Math.ceil(clueCount / 2) + 3));
}

export function buildCasefile(spec: SpecLike, progression: Progression): Casefile {
  const conceptById = new Map(spec.concepts.map((c) => [c.id, c]));
  const conceptName = (id: string) => conceptById.get(id)?.name ?? id.replace(/_/g, " ");
  const place = placeName(spec.theme.setting);
  const theme = themeOf(spec);
  const bossId = progression.bossId;

  // scenes: one per track; a spec whose only encounter is the boss still gets one (empty) scene to stand in
  const tracks = progression.tracks.length > 0 ? progression.tracks : [[]];
  const locations: CaseLocation[] = [];
  const clues: Clue[] = [];
  const cluesOf = new Map<string, readonly [string, string]>();
  const locationOf = new Map<string, number>();
  const usedSpots = new Set<string>();
  const tagCount = new Map<string, number>();

  tracks.forEach((trackIds, t) => {
    const rand = seededRandom((spec.seed ^ hashString(`casefile-scene-${t}`)) >>> 0);
    const first = spec.encounters.find((e) => e.id === trackIds[0]);
    const firstConcept = first ? shortConcept(conceptName(first.conceptIds[0])) : "Loose ends";
    let spot = SPOTS[Math.floor(rand() * SPOTS.length)];
    for (let k = 0; usedSpots.has(spot) && k < SPOTS.length; k++) spot = SPOTS[(SPOTS.indexOf(spot) + 1) % SPOTS.length];
    usedSpots.add(spot);
    const title = `${firstConcept[0].toUpperCase()}${firstConcept.slice(1)} ${spot}`;

    // props: one per slot, biased to the setting's theme
    const props: PropPlacement[] = SLOT_ORDER.map((slot) => {
      const options = SLOT_PROPS[slot];
      const weighted = options.flatMap((o) => Array.from({ length: propWeight(o.theme, theme) }, () => o));
      const choice = weighted[Math.floor(rand() * weighted.length)];
      return { slot, kind: choice.kind, box: SLOTS[slot], hotspotId: null };
    });
    // every room gets its rain-streaked window
    if (!props.some((p) => p.kind === "window")) props[0].kind = "window";
    // no two identical props in one room (a phone on both desk slots, a corkboard twice)
    const seen = new Set<PropKind>();
    for (const p of props) {
      if (seen.has(p.kind)) {
        const alt = SLOT_PROPS[p.slot].find((o) => !seen.has(o.kind) && propWeight(o.theme, theme) > 0);
        if (alt) p.kind = alt.kind;
      }
      seen.add(p.kind);
    }

    const encounterIds = trackIds.filter((id) => id !== bossId);
    const n = hotspotCount(encounterIds.length * 2);
    // the desk is always searchable; the other hotspots are a seeded choice of slots
    const others = shuffle(
      SLOT_ORDER.filter((s) => s !== "desk"),
      rand,
    ).slice(0, n - 1);
    const hotSlots = SLOT_ORDER.filter((s) => s === "desk" || others.includes(s));
    const hotspots: Hotspot[] = hotSlots.map((slot, i) => {
      const prop = props.find((p) => p.slot === slot)!;
      const id = `h${t}_${i}`;
      prop.hotspotId = id;
      const lines = FLAVOUR[prop.kind];
      return { id, locationIndex: t, slot, kind: prop.kind, label: PROP_LABEL[prop.kind], box: hitBox(slot, prop.kind), flavour: lines[Math.floor(rand() * lines.length)], clueIds: [] };
    });

    // clue placement: walk the hotspots in a seeded order, tag then evidence, so an encounter's two clues always
    // land in different props (n ≥ 4 and they are consecutive in the walk)
    const walk = shuffle(hotspots, rand);
    encounterIds.forEach((id, k) => {
      const e = spec.encounters.find((x) => x.id === id)!;
      const tagHot = walk[(2 * k) % walk.length];
      const evHot = walk[(2 * k + 1) % walk.length];
      const primary = e.conceptIds[0];
      const nth = (tagCount.get(primary) ?? 0) + 1;
      tagCount.set(primary, nth);
      const tag: Clue = {
        id: `${id}__tag`,
        encounterId: id,
        kind: "tag",
        label: e.role === "review" || nth > 1 ? "Follow-up file" : "Case file",
        text: e.conceptIds.map(conceptName).join(" + "),
        sub: SOCKET_LINE[e.socket] ?? "Open it up",
        conceptIds: [primary],
        locationIndex: t,
        hotspotId: tagHot.id,
        tilt: Math.round((rand() * 5 - 2.5) * 10) / 10,
      };
      const ev = evidenceFor(e, spec, conceptName);
      const evidence: Clue = {
        id: `${id}__ev`,
        encounterId: id,
        kind: "evidence",
        label: ev.label,
        text: ev.text,
        sub: "",
        conceptIds: [...e.conceptIds],
        locationIndex: t,
        hotspotId: evHot.id,
        tilt: Math.round((rand() * 5 - 2.5) * 10) / 10,
      };
      tagHot.clueIds.push(tag.id);
      evHot.clueIds.push(evidence.id);
      clues.push(tag, evidence);
      cluesOf.set(id, [tag.id, evidence.id]);
      locationOf.set(id, t);
    });

    locations.push({ index: t, id: `scene_${t}`, kind: "scene", track: t, place, title, name: `${place} — ${title}`, encounterIds, props, hotspots, shade: tracks.length > 1 ? t / (tracks.length - 1) : 0 });
  });

  let accusationIndex = -1;
  if (bossId) {
    accusationIndex = locations.length;
    locations.push({ index: accusationIndex, id: "accusation", kind: "accusation", track: -1, place, title: "The accusation", name: `${place} — The accusation`, encounterIds: [bossId], props: [], hotspots: [], shade: 0 });
    locationOf.set(bossId, accusationIndex);
  }

  const partnerId = spec.characters[0]?.id ?? "";
  const bossBeat = bossId ? spec.narrative.beats.find((b) => b.encounterId === bossId && b.speakerId !== partnerId) : undefined;
  const suspectId = bossBeat?.speakerId && spec.characters.some((c) => c.id === bossBeat.speakerId) ? bossBeat.speakerId : (spec.characters.find((c) => c.id !== partnerId)?.id ?? null);

  const { edges, boardPos, boardCols } = caseBoard(progression);
  return {
    place,
    locations,
    accusationIndex,
    clues,
    clueById: new Map(clues.map((c) => [c.id, c])),
    cluesOf,
    locationOf,
    bossId,
    partnerId,
    suspectId,
    edges,
    boardPos,
    boardCols,
  };
}

/** The clickable area of a prop (a little tighter than its slot for the tall and wall props). */
function hitBox(slot: SlotId, kind: PropKind): Box {
  const b = SLOTS[slot];
  if (slot === "desk") return { x: b.x + 10, y: b.y + 22, w: b.w - 20, h: 110 };
  if (slot === "tallR" && kind === "coatrack") return { x: b.x + 30, y: b.y, w: b.w - 60, h: b.h };
  if (slot === "floorL" && (kind === "plant" || kind === "safe")) return { x: b.x, y: b.y + 60, w: b.w, h: b.h - 60 };
  return b;
}

function evidenceFor(e: Encounter, spec: SpecLike, conceptName: (id: string) => string): { label: string; text: string } {
  const names = e.conceptIds.map(conceptName);
  const concept = spec.concepts.find((c) => c.id === e.conceptIds[0]);
  const candidates: { label: string; text: string | undefined }[] = [
    { label: e.sourceRef ? `Torn page, p. ${e.sourceRef.page}` : "", text: e.sourceRef?.quote },
    { label: "Scribbled note", text: concept ? objectiveAsNote(concept.learningObjective) : undefined },
    { label: "Overheard", text: firstSentence(e.prompt) },
  ];
  for (const c of candidates) {
    if (!c.text) continue;
    const s = sanitizeEvidence(c.text, names);
    if (s) return { label: c.label || "Evidence", text: clip(s, 240) };
  }
  return { label: "Smudged note", text: "Half the words are smudged, but it clearly belongs to this case." };
}

function caseBoard(p: Progression): { edges: { from: string; to: string }[]; boardPos: Map<string, BoardPos>; boardCols: number } {
  const edges: { from: string; to: string }[] = [];
  const bossId = p.bossId;
  const dependents = new Set<string>();
  for (const n of p.nodes) {
    if (n.isBoss) continue;
    for (const r of n.requires) {
      if (r === bossId) continue;
      edges.push({ from: r, to: n.id });
      dependents.add(r);
    }
  }
  if (bossId) for (const n of p.nodes) if (!n.isBoss && !dependents.has(n.id)) edges.push({ from: n.id, to: bossId });

  const lanes = p.tracks.length;
  const cols = Math.max(1, ...p.tracks.map((t) => t.length));
  const boardPos = new Map<string, BoardPos>();
  const right = bossId ? 0.8 : 0.97;
  const left = 0.03;
  p.tracks.forEach((ids, lane) => {
    ids.forEach((id, col) => {
      boardPos.set(id, { x: left + ((col + 0.5) / cols) * (right - left), y: (lane + 0.5) / Math.max(1, lanes) });
    });
  });
  if (bossId) boardPos.set(bossId, { x: 0.9, y: 0.5 });
  return { edges, boardPos, boardCols: cols + (bossId ? 1 : 0) };
}

// ---------------------------------------------------------------------------------------------------------------
// play state (derived)

/** Unsolved requirements of an encounter, in spec order. */
export function missingRequirements(p: Progression, id: string, solved: ReadonlySet<string>): string[] {
  return (p.byId.get(id)?.requires ?? []).filter((r) => !solved.has(r));
}

/**
 * Encounters whose clues can be found now: solved, available, or one crack away (exactly one unsolved requirement,
 * and that requirement is itself available). Monotonic in `solved`, so a clue never disappears once it has appeared.
 */
export function revealedEncounters(cf: Casefile, p: Progression, solved: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  const ready = (id: string) => !solved.has(id) && missingRequirements(p, id, solved).length === 0;
  for (const id of cf.cluesOf.keys()) {
    if (solved.has(id)) out.add(id);
    else {
      const missing = missingRequirements(p, id, solved);
      if (missing.length === 0 || (missing.length === 1 && ready(missing[0]))) out.add(id);
    }
  }
  return out;
}

export function revealedClueIds(cf: Casefile, p: Progression, solved: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  for (const id of revealedEncounters(cf, p, solved)) for (const c of cf.cluesOf.get(id) ?? []) out.add(c);
  return out;
}

/** Found clues as the player sees them: what they found, plus both clues of anything solved or open (debug paths). */
export function effectiveFound(cf: Casefile, found: ReadonlySet<string>, solved: ReadonlySet<string>, activeId: string | null): Set<string> {
  const out = new Set(found);
  for (const id of solved) for (const c of cf.cluesOf.get(id) ?? []) out.add(c);
  if (activeId) for (const c of cf.cluesOf.get(activeId) ?? []) out.add(c);
  return out;
}

/** Formed leads as the player sees them: combined pairs, plus anything solved or open. */
export function effectiveLeads(formed: ReadonlySet<string>, solved: ReadonlySet<string>, activeId: string | null): Set<string> {
  const out = new Set(formed);
  for (const id of solved) out.add(id);
  if (activeId) out.add(activeId);
  return out;
}

/** Searching a hotspot: the revealed clues hidden there that haven't been found yet (empty → a flavour line). */
export function searchHotspot(cf: Casefile, hotspotId: string, revealed: ReadonlySet<string>, found: ReadonlySet<string>): string[] {
  const h = cf.locations.flatMap((l) => l.hotspots).find((x) => x.id === hotspotId);
  if (!h) return [];
  return h.clueIds.filter((c) => revealed.has(c) && !found.has(c));
}

/** Revealed clues still hidden in a location (for the "N clues left here" badge). */
export function cluesLeftIn(cf: Casefile, locationIndex: number, revealed: ReadonlySet<string>, found: ReadonlySet<string>): number {
  let n = 0;
  for (const h of cf.locations[locationIndex]?.hotspots ?? []) for (const c of h.clueIds) if (revealed.has(c) && !found.has(c)) n++;
  return n;
}

export type CombineResult =
  | { kind: "lead"; encounterId: string }
  | { kind: "blocked"; encounterId: string; missing: string[] }
  | { kind: "solved"; encounterId: string }
  | { kind: "same_kind"; clueKind: ClueKind }
  | { kind: "same" }
  | { kind: "mismatch" };

/**
 * Two clues → a lead? An evidence clue pairs with a tag clue for one of its encounter's concepts (tags for the same
 * concept are interchangeable, so a spec that teaches a concept twice never strands a pair). The lead is the
 * evidence's encounter: `lead` when it is available, `blocked` (with the unsolved requirements) when it isn't yet.
 */
export function combine(cf: Casefile, p: Progression, a: string, b: string, available: readonly string[], solved: ReadonlySet<string>): CombineResult {
  if (a === b) return { kind: "same" };
  const ca = cf.clueById.get(a);
  const cb = cf.clueById.get(b);
  if (!ca || !cb) return { kind: "mismatch" };
  if (ca.kind === cb.kind) return { kind: "same_kind", clueKind: ca.kind };
  const ev = ca.kind === "evidence" ? ca : cb;
  const tag = ca.kind === "tag" ? ca : cb;
  const target = encounterConcepts(p, ev.encounterId);
  if (!tag.conceptIds.some((c) => target.includes(c))) return { kind: "mismatch" };
  const id = ev.encounterId;
  if (solved.has(id)) return { kind: "solved", encounterId: id };
  if (available.includes(id)) return { kind: "lead", encounterId: id };
  return { kind: "blocked", encounterId: id, missing: missingRequirements(p, id, solved) };
}

function encounterConcepts(p: Progression, id: string): string[] {
  return p.byId.get(id)?.encounter.conceptIds ?? [];
}

/** Clues found and still loose (not part of a formed lead or a solved deduction), in spec order. */
export function looseClues(cf: Casefile, found: ReadonlySet<string>, leads: ReadonlySet<string>): Clue[] {
  return cf.clues.filter((c) => found.has(c.id) && !leads.has(c.encounterId));
}

/** Which location a new batch of revealed clues landed in (the first one, in spec order), or -1. */
export function newlyRevealedLocation(cf: Casefile, before: ReadonlySet<string>, after: ReadonlySet<string>): number {
  for (const c of cf.clues) if (after.has(c.id) && !before.has(c.id)) return c.locationIndex;
  return -1;
}

// ---------------------------------------------------------------------------------------------------------------
// partner lines and finale text

const CORRECT_LINES = [
  "That fits. Pin it to the board.",
  "Good. {concept}: now we know how that part works.",
  "Another thread tied off: {concept}.",
  "Write that down. {concept} explains more than it did an hour ago.",
];
const WRONG_LINES = ["Hmm. Something doesn't add up. Look again.", "Not that. Read the evidence one more time.", "Close, but the clue says otherwise.", "Hmm. Try it from the other side."];

export function correctLine(seq: number, concept: string): string {
  return CORRECT_LINES[seq % CORRECT_LINES.length].replace("{concept}", concept);
}

export function wrongLine(seq: number): string {
  return WRONG_LINES[seq % WRONG_LINES.length];
}

/** "3 false leads along the way" flavour for the finale. */
export function falseLeadsLine(mismatches: number): string {
  if (mismatches === 0) return "Not one false pairing along the way.";
  if (mismatches === 1) return "One false lead along the way, quickly dropped.";
  return `${mismatches} false leads along the way, each one ruled out.`;
}

/** Joins names as "a", "a and b", "a, b and c". */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// ---------------------------------------------------------------------------------------------------------------
// colour helpers (hex in, hex out)

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** Mixes `a` towards `b` by t (0 = a, 1 = b). */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * Math.max(0, Math.min(1, t)));
  return `#${[m(ar, br), m(ag, bg), m(ab, bb)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Relative luminance 0..1. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
