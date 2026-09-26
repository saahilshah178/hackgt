/**
 * switchboard — linker.pairs (docs/design/20 §4 row 9, §4.2, §4.4, §7.4; civil §5.7 e7). Verlet cords seat between
 * jacks; jack and step lamps light WHITE (seated, not correct) before Verify; a document's lines fill by LEFT key.
 * After Verify the lamps turn cyan in sequence, the program prints and the steps solidify. KC2: the full pure half.
 *
 * ## The pose contract (skins read these fields; zone units relative to station.anchor, x right, y DOWN)
 * - `lefts[]` in view order (name jacks, anchors `left_<i>`), `rights[]` in DISPLAY order (role jacks incl. decoys,
 *   anchors `right_<j>`): `x`/`y` from `jackPositions`, `lamp` (`off` · `white` = a cord is seated, never correctness ·
 *   `cyan` solved only · `dim` = the rung-3 decoy dim, only at `hintsUsed = 3` with `decoyDimRung: 3`), `alpha`.
 * - `cords[]` in draft order: `a` (the left jack) → `b` (the right jack), `shape` (`verlet` | `catenary`), `sag`.
 * - `stepLamps[]` one per left (by left index): `off` · `white` when that left is patched · `cyan` solved; empty when
 *   `stepLamps` is false. `lines[]` one per left (by left index): `"<name> — <role>"` or null. `title`: the document.
 * - `steps` (0 wireframe → 1 solid, solved only), `printed` (solved), `lensU`, `solved`, `focusKey`.
 *
 * Dynamic anchors every switchboard PoseView exposes (besides skin.anchors): `jack_<key>` (any left or right key).
 * Live-reveal rule (§2.5.6): discrete, so the world shows what each cord does (a seated cord, a white lamp, a program
 * line) and nothing about whether it is right until Verify; metas see the view only.
 */
import { z } from "zod";
import type { HintTarget, PayoffAnim, ProbeSpec } from "../../contracts/world";
import { clamp01, lerp } from "../ease";
import { fileCard, fileChip, fileDatePins, lensU, probeWindowOf, yearReadout, type TimelineCard } from "../record-strip";
import type {
  AudioParam,
  Bounds,
  CardModel,
  ChipSpec,
  ConfigCtx,
  ConfigIssue,
  ContraptionMeta,
  Described,
  Diagnosis,
  FailBeat,
  FailurePlan,
  Footprint2D,
  HintRung,
  PairsView,
  PanelLive,
  PanelStatic,
  PoseInput,
  StaticInput,
  SuccessBeat,
  SuccessPlan,
} from "../types";
import { err, findDates, findYears, probeRangeIssues, viewRows, yearProbeFor } from "./config-parts";
import { defineSkin } from "./skin-kit";
import { probeFromWriter, wProbe, type WriterProbe } from "./writer-kit";
import { SwitchboardConfig } from "./switchboard.config";
export { SwitchboardConfig } from "./switchboard.config";

const hint = (anchor: string, action: HintTarget["action"], holdMs: number): HintTarget => ({ anchor, action, holdMs });

export const SWITCHBOARD_SKINS = [
  defineSkin({
    id: "switchboard",
    name: "Switchboard",
    ns: "archive_of_voices",
    nouns: ["switchboard", "cords", "cord", "jacks", "jack", "program", "steps"],
    parts: [
      ["switchboard_cabinet", "H"], ["jack", "K"], ["plug", "K"], ["program_sheet", "K"], ["step_lamp", "K"], ["steps", "K"], ["console", "K"],
    ],
    anchors: ["left_0…3", "right_0…4", "sheet", "steps", "console"],
    cues: { live: null, succeed: "cord_seat", fail: "relay_click" },
    sensitiveSafe: true,
    // civil §5.7: rung 1 circles the program sheet, rung 2 lands on the first name jack, rung 3 hovers the console
    // while the decoy role jack dims (decoyDimRung: 3; the companion never points at a pairing)
    hintTargets: [[hint("sheet", "circle", 1800)], [hint("left_0", "land", 2000)], [hint("console", "hover", 1500)]],
  }),
] as const;

const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "the", "of", "to", "in", "on", "at", "by", "for", "with", "from", "into", "as", "is", "was", "were",
  "be", "it", "its", "that", "this", "or", "but", "not", "no", "their", "his", "her", "they", "he", "she", "we", "you",
]);
function contentTokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOPWORDS.has(t)));
}
/**
 * True when hint 3 names a decoy right (docs/design/20 §4.4): its full text, or at least two of its non-stopword tokens
 * (civil O8: e7's "signed the act" shares `signed`, `act` with "Signed the Civil Rights Act into law").
 */
export function hintNamesDecoy(hint3: string, view: unknown): boolean {
  const h = hint3.toLowerCase();
  const hintTokens = contentTokens(hint3);
  return viewRows(view, "rights")
    .filter((r) => r.key.startsWith("x"))
    .some((r) => {
      const t = r.text.trim().toLowerCase();
      if (t.length > 0 && h.includes(t)) return true;
      let shared = 0;
      for (const tok of contentTokens(r.text)) if (hintTokens.has(tok)) shared++;
      return shared >= 2;
    });
}

interface SwitchboardWriter {
  documentTitle: string | null;
  probe: WriterProbe | null;
}

// ---------------------------------------------------------------- live constants (civil §5.7)

export interface XY {
  x: number;
  y: number;
}
/** The cabinet (zone units, relative to the anchor at the pool's edge): the jack field and the program sheet. */
export const CABINET = { x: 0, y: -380, w: 560, h: 620 } as const;
export const JACK_FIELD = { top: -600, height: 420, leftX: -170, rightX: 170 } as const;
export const SHEET_AT: XY = { x: -470, y: -430 };
/** The memorial steps rise to the right of the cabinet; one step lamp per name on the landing. */
export const STEPS_FROM: XY = { x: 200, y: 0 };
export const STEPS_TO: XY = { x: 1500, y: -260 };
/** A cord hangs `0.12·|Δx| + 24` (the catenary option; the verlet option settles from the same start). */
export const CORD_SAG_K = 0.12;
export const CORD_SAG_MIN = 24;
/** Rung 3: the decoy role jack's lamp dims to 30 %. */
export const DECOY_DIM_ALPHA = 0.3;
/** Verlet cords (prefab, cosmetic): 12 points, gravity 900, settle in about 0.5 s. */
export const CORD_SEGMENTS = 12;
export const CORD_GRAVITY = 900;

/** Rows of one jack column: evenly spaced within the jack field, index order. */
export function jackRowY(i: number, n: number): number {
  const rows = Math.max(1, n);
  return JACK_FIELD.top + ((i + 0.5) * JACK_FIELD.height) / rows;
}
export function leftJackAt(i: number, n: number): XY {
  return { x: JACK_FIELD.leftX, y: jackRowY(i, n) };
}
export function rightJackAt(j: number, n: number): XY {
  return { x: JACK_FIELD.rightX, y: jackRowY(j, n) };
}
/** Step lamp i of n along the steps' rise (left index order). */
export function stepLampAt(i: number, n: number): XY {
  const u = n <= 1 ? 0.5 : (i + 0.5) / n;
  return { x: lerp(STEPS_FROM.x, STEPS_TO.x, u), y: lerp(STEPS_FROM.y, STEPS_TO.y, u) - 40 };
}
export function cordSag(a: XY, b: XY): number {
  return CORD_SAG_K * Math.abs(b.x - a.x) + CORD_SAG_MIN;
}

// ---------------------------------------------------------------- pose

export type JackLamp = "off" | "white" | "cyan" | "dim";
export interface SwitchJack {
  key: string;
  index: number;
  side: "left" | "right";
  text: string;
  x: number;
  y: number;
  lamp: JackLamp;
  alpha: number; // lamp alpha (DECOY_DIM_ALPHA when dimmed)
  seated: boolean;
  focus: boolean;
}
export interface SwitchCord {
  leftKey: string;
  rightKey: string;
  leftIndex: number;
  rightIndex: number;
  a: XY;
  b: XY;
  shape: SwitchboardConfig["cord"];
  sag: number;
}
/** The archetype's pose (skins import this name). */
export interface SwitchboardPose {
  lefts: SwitchJack[];
  rights: SwitchJack[];
  cords: SwitchCord[];
  stepLamps: ("off" | "white" | "cyan")[];
  lines: (string | null)[];
  title: string | null;
  linked: number;
  steps: number;
  printed: boolean;
  focusKey: string | null;
  decoyDim: boolean;
  lensU: number | null;
  solved: boolean;
}

interface Link {
  leftKey: string;
  rightKey: string;
}
function leftsOf(view: unknown): readonly PairsView["lefts"][number][] {
  const v = view as Partial<PairsView> | null;
  return Array.isArray(v?.lefts) ? v.lefts.filter((l) => typeof l?.key === "string") : [];
}
function rightsOf(view: unknown): readonly PairsView["rights"][number][] {
  const v = view as Partial<PairsView> | null;
  return Array.isArray(v?.rights) ? v.rights.filter((r) => typeof r?.key === "string") : [];
}
/** The draft's links between known jacks: one cord per left and one per right (the later one wins, like CableControl). */
export function draftLinks(draft: PoseInput<SwitchboardConfig>["draft"], view: unknown): Link[] {
  const L = new Set(leftsOf(view).map((l) => l.key));
  const R = new Set(rightsOf(view).map((r) => r.key));
  const raw = (draft?.input as { links?: unknown } | null | undefined)?.links;
  if (!Array.isArray(raw)) return [];
  let out: Link[] = [];
  for (const e of raw as unknown[]) {
    const r = e as { leftKey?: unknown; rightKey?: unknown } | null;
    const l = typeof r?.leftKey === "string" ? r.leftKey : null;
    const rk = typeof r?.rightKey === "string" ? r.rightKey : null;
    if (l === null || rk === null || !L.has(l) || !R.has(rk)) continue;
    out = out.filter((x) => x.leftKey !== l && x.rightKey !== rk);
    out.push({ leftKey: l, rightKey: rk });
  }
  return out;
}
/** Decoy rights (keys `x…`): read ONLY for the rung-3 dim, which the config must opt into (validateConfig, §4.4). */
function isDecoyKey(key: string): boolean {
  return key.startsWith("x");
}
/** The rung-3 dim applies only when configured AND the third hint has been taken. */
export function decoyDimActive(config: SwitchboardConfig, hintsUsed: number): boolean {
  return config.decoyDimRung === 3 && hintsUsed >= 3;
}
export function programLine(name: string, role: string): string {
  return `${name} — ${role}`;
}

function poseOf(input: PoseInput<SwitchboardConfig>): SwitchboardPose {
  const { view, config } = input;
  const lefts = leftsOf(view);
  const rights = rightsOf(view);
  const links = draftLinks(input.draft, view);
  const byLeft = new Map(links.map((l) => [l.leftKey, l.rightKey]));
  const byRight = new Map(links.map((l) => [l.rightKey, l.leftKey]));
  const focusKey = typeof input.draft?.focus === "string" ? input.draft.focus : null;
  const dim = decoyDimActive(config, input.hintsUsed);
  const seatedLamp = (seated: boolean): JackLamp => (input.solved ? "cyan" : seated ? "white" : "off");

  const L: SwitchJack[] = lefts.map((l, i) => {
    const at = leftJackAt(i, lefts.length);
    const seated = byLeft.has(l.key);
    return { key: l.key, index: i, side: "left", text: l.text, ...at, lamp: seatedLamp(seated), alpha: 1, seated, focus: l.key === focusKey };
  });
  const R: SwitchJack[] = rights.map((r, j) => {
    const at = rightJackAt(j, rights.length);
    const seated = byRight.has(r.key);
    const dimmed = dim && !input.solved && isDecoyKey(r.key);
    const lamp: JackLamp = dimmed ? "dim" : seatedLamp(seated);
    return { key: r.key, index: j, side: "right", text: r.text, ...at, lamp, alpha: dimmed ? DECOY_DIM_ALPHA : 1, seated, focus: r.key === focusKey };
  });
  const leftIdx = new Map(L.map((j) => [j.key, j]));
  const rightIdx = new Map(R.map((j) => [j.key, j]));
  const cords: SwitchCord[] = links.map((lk) => {
    const a = leftIdx.get(lk.leftKey)!;
    const b = rightIdx.get(lk.rightKey)!;
    const pa = { x: a.x, y: a.y };
    const pb = { x: b.x, y: b.y };
    return { leftKey: lk.leftKey, rightKey: lk.rightKey, leftIndex: a.index, rightIndex: b.index, a: pa, b: pb, shape: config.cord, sag: cordSag(pa, pb) };
  });
  const lines = lefts.map((l) => {
    const rk = byLeft.get(l.key);
    const role = rk !== undefined ? rightIdx.get(rk)?.text : undefined;
    return role !== undefined ? programLine(l.text, role) : null;
  });
  const window = probeWindowOf(config.probe);
  return {
    lefts: L,
    rights: R,
    cords,
    stepLamps: config.stepLamps ? L.map((j) => (input.solved ? "cyan" : j.seated ? "white" : "off")) : [],
    lines,
    title: config.document?.title ?? null,
    linked: links.length,
    steps: input.solved ? 1 : 0,
    printed: input.solved,
    focusKey,
    decoyDim: dim && !input.solved,
    lensU: window && input.probe !== null ? lensU(window, input.probe) : null,
    solved: input.solved,
  };
}

/** Continuous fields ease (steps, lamp alpha, the lens); discrete fields take the target as soon as t > 0. */
function lerpPose(from: SwitchboardPose, to: SwitchboardPose, t: number): SwitchboardPose {
  const k = clamp01(t);
  if (k <= 0) return from;
  const prevAlpha = new Map(from.rights.map((r) => [r.key, r.alpha]));
  return {
    ...to,
    rights: to.rights.map((r) => ({ ...r, alpha: lerp(prevAlpha.get(r.key) ?? r.alpha, r.alpha, k) })),
    steps: lerp(from.steps, to.steps, k),
    lensU: from.lensU !== null && to.lensU !== null ? lerp(from.lensU, to.lensU, k) : to.lensU,
  };
}

function describePose(pose: SwitchboardPose): Described {
  const chips: ChipSpec[] = [
    ...pose.lefts.map((j) => ({ anchor: `left_${j.index}`, text: j.text, color: "f" as const })),
    ...pose.rights.map((j) => ({ anchor: `right_${j.index}`, text: j.text, color: "f" as const })),
  ];
  if (pose.title) chips.push({ anchor: "sheet", text: `${pose.linked} / ${pose.lefts.length} LINES`, color: "accent" });
  let srText: string;
  if (pose.solved) srText = "The program is connected: every jack lamp glows cyan, the program has printed and the steps are solid.";
  else if (pose.linked === 0) srText = `The switchboard waits: ${pose.lefts.length} name jacks and ${pose.rights.length} role jacks, no cords seated.`;
  else srText = `${pose.linked} of ${pose.lefts.length} cords seated; their jack lamps glow white.`;
  if (pose.decoyDim) srText += " One role jack's lamp has dimmed.";
  return { chips, pins: [], srText, nearMiss: null };
}

// ---------------------------------------------------------------- panel

const FILE_SLOT = 0;
function titleDates(config: SwitchboardConfig): { date: string; label: string }[] {
  const t = config.document?.title;
  if (!t) return [];
  const d = findDates(t)[0];
  return d ? [{ date: d, label: t.split("·")[0].trim().slice(0, 40) || "program" }] : [];
}
function hasFile(input: Pick<StaticInput<SwitchboardConfig>, "record" | "config">): boolean {
  return input.record || titleDates(input.config).length > 0;
}
interface Slots {
  file: number | null;
  board: number;
  doc: number | null;
}
function slotsOf(input: Pick<StaticInput<SwitchboardConfig>, "record" | "config">): Slots {
  const file = hasFile(input) ? FILE_SLOT : null;
  const board = file === null ? 0 : 1;
  return { file, board, doc: input.config.document ? board + 1 : null };
}

function fileFor(config: SwitchboardConfig): TimelineCard {
  return fileCard({ slot: FILE_SLOT, window: probeWindowOf(config.probe), marks: [], pins: fileDatePins(titleDates(config)) });
}

function boardFor(view: unknown, slot: number, links: readonly Link[], focus: string | null): Extract<CardModel, { kind: "link_board" }> {
  const lefts = leftsOf(view);
  const rights = rightsOf(view);
  return {
    kind: "link_board",
    slot,
    title: "SWITCHBOARD",
    lefts: lefts.map((l) => ({ key: l.key, label: l.text })),
    rights: rights.map((r) => ({ key: r.key, label: r.text, sub: null })),
    links: links.map((l) => ({ ...l, state: l.leftKey === focus || l.rightKey === focus ? "focus" : "seated" })),
    sr: `${lefts.length} names and ${rights.length} roles. ${links.length} of ${lefts.length} cords seated.`,
  };
}

function documentFor(config: SwitchboardConfig, slot: number, lines: readonly (string | null)[], solved: boolean): Extract<CardModel, { kind: "document" }> {
  const title = config.document?.title ?? "PROGRAM";
  const body = lines.map((l, i) => `${i + 1}. ${l ?? "…"}`).join("\n");
  const filled = lines.filter((l) => l !== null).length;
  return { kind: "document", slot, title, body, stamp: solved ? "PRINTED" : null, sr: `${title}: ${filled} of ${lines.length} lines filled.` };
}

function panelStaticOf(input: StaticInput<SwitchboardConfig>): PanelStatic {
  const s = slotsOf(input);
  const cards: CardModel[] = [];
  if (s.file !== null) cards.push(fileFor(input.config));
  cards.push(boardFor(input.view, s.board, [], null));
  if (s.doc !== null) cards.push(documentFor(input.config, s.doc, leftsOf(input.view).map(() => null), false));
  return { cards, input: null, probe: input.config.probe, recordPins: [] };
}

function panelLiveOf(stat: PanelStatic, input: PoseInput<SwitchboardConfig>): PanelLive {
  const file = stat.cards.some((c) => c.slot === FILE_SLOT && c.kind === "timeline");
  const board = file ? 1 : 0;
  const links = draftLinks(input.draft, input.view);
  const focus = typeof input.draft?.focus === "string" ? input.draft.focus : null;
  const pose = poseOf(input);
  const liveCards: CardModel[] = [boardFor(input.view, board, links, focus)];
  if (input.config.document) liveCards.push(documentFor(input.config, board + 1, pose.lines, input.solved));
  const chips: PanelLive["chips"][number][] = [
    { slot: board, value: pose.lefts.length ? links.length / pose.lefts.length : 0, text: `${links.length} / ${pose.lefts.length} CORDS`, color: "accent" },
  ];
  if (file) {
    const card = fileFor(input.config);
    liveCards.unshift(card);
    if (input.probe !== null) chips.unshift({ slot: FILE_SLOT, value: input.probe, text: fileChip(card, input.probe).text, color: "g" });
  }
  const highlights: PanelLive["highlights"][number][] = links.map((l) => ({ slot: board, key: l.leftKey, state: l.leftKey === focus ? "focus" : "placed" }));
  if (focus !== null && !links.some((l) => l.leftKey === focus)) highlights.push({ slot: board, key: focus, state: "focus" });
  return { scrubX: input.probe, readout: yearReadout(input.config.probe?.format ?? "number", input.probe), chips, highlights, liveCards };
}

// ---------------------------------------------------------------- outcomes

/**
 * The failure plan acts ONLY on `wrongKeys[0]` (the left grade() names): that cord unseats (the plug pops out of its
 * role jack and the cord drops), the name jack's lamp flickers amber, and the grade's clue prints as a margin note.
 */
function failurePlanOf(d: Diagnosis, input: PoseInput<SwitchboardConfig>): FailurePlan {
  const key = d.wrongKeys[0];
  const lefts = leftsOf(input.view);
  const li = key === undefined ? -1 : lefts.findIndex((l) => l.key === key);
  if (d.failKey === "wrong_link" && li >= 0) {
    const rk = draftLinks(input.draft, input.view).find((l) => l.leftKey === key)?.rightKey ?? null;
    const ri = rk === null ? -1 : rightsOf(input.view).findIndex((r) => r.key === rk);
    const beats: FailBeat[] = [
      { atMs: 0, anchor: ri >= 0 ? `right_${ri}` : `left_${li}`, action: "unseat", params: { leftKey: key, rightKey: rk ?? "", end: "to" } },
      { atMs: 120, anchor: `left_${li}`, action: "flash", params: { key, color: "amber", flicker: 3 } },
      { atMs: 600, anchor: "sheet", action: "flash", params: { note: "feedback", line: li } },
    ];
    return { beats, durationMs: 1400, cue: "relay_click" };
  }
  return { beats: [{ atMs: 0, anchor: "sheet", action: "flash", params: { note: "feedback" } }], durationMs: 800, cue: "relay_click" };
}

function successPlanOf(input: PoseInput<SwitchboardConfig>, anim: PayoffAnim): SuccessPlan {
  const pose = poseOf({ ...input, solved: true });
  const beats: SuccessBeat[] = [];
  const step = 160;
  pose.cords.forEach((c, i) => {
    beats.push({ atMs: i * step, anchor: `left_${c.leftIndex}`, action: "light_sequence", params: { color: "cyan", to: `right_${c.rightIndex}` } });
  });
  const printAt = pose.cords.length * step + 150;
  beats.push({ atMs: printAt, anchor: "sheet", action: "print", params: { lines: pose.lines.length } });
  beats.push({ atMs: printAt + 350, anchor: "steps", action: "rise", params: { anim } });
  pose.stepLamps.forEach((_, i) => beats.push({ atMs: printAt + 600 + i * 150, anchor: "steps", action: "ignite", params: { lamp: i, color: "cyan" } }));
  const end = beats.reduce((m, b) => Math.max(m, b.atMs), 0) + 400;
  return { beats, cardEffects: [], durationMs: Math.min(2500, Math.max(2200, end)), cue: "cord_seat" };
}

function audioOf(): readonly AudioParam[] {
  return []; // the skin has no live loop; cord_seat is a one-shot the client plays on seat
}

// ---------------------------------------------------------------- geometry

const FOOTPRINT: Footprint2D = { left: 560, right: 380, height: 700 };
const FRAME: Bounds = { x: -640, y: -720, w: 1500, h: 820 };

export const switchboardMeta: ContraptionMeta<SwitchboardConfig, SwitchboardPose> = {
  id: "switchboard",
  name: "Switchboard",
  modes: ["linker.pairs"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["board"],
  defaultLayout: "board",
  payoffs: ["stairs_rise", "steps_emerge", "bridge_forms", "door_opens"],
  nearMissKeys: [],
  accessories: ["record_lens"],
  skins: SWITCHBOARD_SKINS,
  control: "cables",
  configSchema: SwitchboardConfig,
  validateConfig(config: SwitchboardConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
    const out: ConfigIssue[] = [];
    if (config.decoyDimRung !== null && !hintNamesDecoy(ctx.encounter.hints[2] ?? "", ctx.view)) {
      out.push(err(["decoyDimRung"], "decoyDimRung is only allowed when the fixture's third hint names the decoy"));
    }
    out.push(...probeRangeIssues(["probe"], config.probe));
    if (config.probeWorld === "record_lens" && !config.probe) out.push(err(["probeWorld"], "record_lens needs a probe"));
    return out;
  },
  defaultConfig(ctx: ConfigCtx): SwitchboardConfig {
    const probe = ctx.biome === "archive_of_voices" ? yearProbeFor(ctx.texts.flatMap(findYears)) : null;
    return SwitchboardConfig.parse({ probe, probeWorld: probe ? "record_lens" : "none" });
  },
  writerConfigSchema: () =>
    z.object({
      documentTitle: z.string().nullable().describe("The title printed on the program sheet, in caps, or null"),
      probe: wProbe(),
    }),
  fromWriterConfig(w: unknown): SwitchboardConfig {
    const wc = w as SwitchboardWriter;
    const probe = probeFromWriter(wc.probe);
    return SwitchboardConfig.parse({
      document: wc.documentTitle ? { title: wc.documentTitle.slice(0, 80) } : null,
      probe,
      probeWorld: probe && (probe.format === "year" || probe.format === "month_year") ? "record_lens" : "none",
    });
  },
  footprint: () => FOOTPRINT,
  frameBounds: () => FRAME,
  probe: (config: SwitchboardConfig): ProbeSpec | null => config.probe,
  clock: null,
  sim: null,
  pose: poseOf,
  lerp: lerpPose,
  describe: (pose: SwitchboardPose) => describePose(pose),
  panelStatic: panelStaticOf,
  panelLive: panelLiveOf,
  hintTargets: (rung: HintRung, input: StaticInput<SwitchboardConfig>): readonly HintTarget[] =>
    (SWITCHBOARD_SKINS.find((s) => s.id === input.skinId) ?? SWITCHBOARD_SKINS[0]).hintTargets[rung - 1],
  audio: () => audioOf(),
  failurePlan: failurePlanOf,
  successPlan: (input: PoseInput<SwitchboardConfig>, anim: PayoffAnim) => successPlanOf(input, anim),
  solvedPose: (input: PoseInput<SwitchboardConfig>) => poseOf({ ...input, solved: true }),
  debug: (pose: SwitchboardPose) => ({
    linked: pose.linked,
    cords: pose.cords.map((c) => `${c.leftKey}>${c.rightKey}`).join(","),
    white: [...pose.lefts, ...pose.rights].filter((j) => j.lamp === "white").length,
    cyan: [...pose.lefts, ...pose.rights].filter((j) => j.lamp === "cyan").length,
    dimmed: pose.rights.filter((j) => j.lamp === "dim").map((j) => j.key).join(","),
    stepLampsLit: pose.stepLamps.filter((s) => s !== "off").length,
    lines: pose.lines.filter((l) => l !== null).length,
    steps: Math.round(pose.steps * 1000) / 1000,
    printed: pose.printed,
    focus: pose.focusKey ?? "",
    lensU: pose.lensU ?? -1,
    solved: pose.solved,
  }),
};
