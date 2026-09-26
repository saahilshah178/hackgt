/**
 * tumbler_vault — investigator.elimination (docs/design/20 §4 row 12, §4.2, §4.4; civil §5.12). A vault door with
 * hypothesis tumblers that rotate by the player's OWN strikes (MatrixControl `marks`, UI-only: they never reach
 * toSubmitInput or grade()); when exactly one hypothesis is left unstruck its tumbler glows and slides toward the bolt
 * channel. Verify accuses one hypothesis. KC1: the full pure half (live-reveal rule §2.5.6: the view only).
 */
import { z } from "zod";
import type { ProbeSpec } from "../../contracts/world";
import { clamp01, lerp } from "../ease";
import { fileChip, probeWindowOf, yearReadout, type TimelineCard, type TimelinePin } from "../record-strip";
import type {
  Bounds,
  CardModel,
  ConfigCtx,
  ConfigIssue,
  ContraptionMeta,
  Described,
  Diagnosis,
  Draft,
  EliminationView,
  FailBeat,
  FailurePlan,
  Footprint2D,
  HintRung,
  HintTarget,
  PanelLive,
  PanelStatic,
  PoseInput,
  StaticInput,
  SuccessBeat,
  SuccessPlan,
  WriterCtx,
} from "../types";
import { clueIndicesOf, clueTextOf, dateAppearsIn, err, fracYearOf, findDates, probeRangeIssues, subsetOf } from "./config-parts";
import { defineSkin } from "./skin-kit";
import { wDate } from "./writer-kit";
import { TumblerVaultConfig } from "./tumbler-vault.config";
export { TumblerVaultConfig } from "./tumbler-vault.config";

const hint = (anchor: string, action: HintTarget["action"], holdMs: number): HintTarget => ({ anchor, action, holdMs });

export const TUMBLER_VAULT_SKINS = [
  defineSkin({
    id: "tumbler_vault",
    name: "Editor's Vault",
    ns: "archive_of_voices",
    nouns: ["vault", "tumblers", "tumbler", "bolts", "door", "Editor's Vault"],
    parts: [["vault_door", "H"], ["tumbler", "H"], ["bolt", "K"], ["handwheel", "K"], ["voice_grille", "K"], ["press_organ", "H"], ["console", "K"]],
    anchors: ["tumbler_0…3", "bolt_0…3", "grille", "hub", "console"],
    cues: { live: null, succeed: "bolt_slide", fail: "tumbler_grind" },
    sensitiveSafe: true,
    // civil §5.12: rung 1 the grille glows (Wick circles it), rung 2 Wick lands on the handwheel, rung 3 the matrix shades counts
    hintTargets: [[hint("grille", "circle", 1800)], [hint("hub", "land", 2000)], [hint("console", "hover", 1500)]],
  }),
] as const;

interface TumblerVaultWriter {
  clues: { index: number; date: string | null }[];
}

// ---------------------------------------------------------------- live constants (civil §5.12)

export const STRUCK_DEG = 90; // a struck tumbler turns a quarter
export const UNSTRUCK_SLIDE_PX = 8; // the last unstruck tumbler slides toward the bolt channel
export const TUMBLER_ANCHORS = 4; // tumbler_0…3, bolt_0…3 on the skin
type Mark = { clueIndex: number; hypothesisId: string };

export interface TumblerPose {
  id: string; // hypothesis id (display order = view.hypotheses order = tumbler_0…)
  rotDeg: number; // 0 upright, 90 struck
  struck: boolean; // any of the player's marks names it
  lamp: number; // 1 white, 0 dim salmon (#C4643C @ 60 %)
  glow: number; // cyan groove glow: the last unstruck tumbler (from the player's OWN marks only)
  slide: number; // px toward the bolt channel
  accused: boolean; // orange ring (input-bound)
}
/** The archetype's pose (skins import this name). */
export interface TumblerVaultPose {
  tumblers: TumblerPose[];
  struckCount: number;
  lastUnstruck: string | null;
  accused: string | null;
  bolts: number[]; // per bolt: 0 thrown … 1 retracted (success only)
  ringsDeg: number; // door rings counter-rotation (success only)
  handwheelDeg: number;
  door: number; // 0 closed … 1 open
  grille: number; // 0.35 idle, 1 from aid tier 1 (the Editor's voice grille)
  cursorU: number | null; // the mini strip cursor, fraction of the window
  solved: boolean;
}

// ---------------------------------------------------------------- view readers

function hypothesesOf(view: unknown): readonly EliminationView["hypotheses"][number][] {
  const v = view as Partial<EliminationView> | null;
  return Array.isArray(v?.hypotheses) ? v.hypotheses.filter((h) => typeof h?.id === "string") : [];
}
function cluesOf(view: unknown): readonly EliminationView["clues"][number][] {
  const v = view as Partial<EliminationView> | null;
  return Array.isArray(v?.clues) ? v.clues.filter((c) => typeof c?.index === "number") : [];
}
function accusedOf(draft: Draft | null, ids: ReadonlySet<string>): string | null {
  const raw = (draft?.input as { hypothesisId?: unknown } | null | undefined)?.hypothesisId;
  return typeof raw === "string" && ids.has(raw) ? raw : null;
}
/** The player's own marks restricted to this view's hypotheses and clues (UI-only notation). */
export function marksOf(draft: Draft | null, view: unknown): Mark[] {
  const ids = new Set(hypothesesOf(view).map((h) => h.id));
  const clues = new Set(cluesOf(view).map((c) => c.index));
  return (draft?.marks ?? []).filter((m) => ids.has(m.hypothesisId) && clues.has(m.clueIndex)).map((m) => ({ clueIndex: m.clueIndex, hypothesisId: m.hypothesisId }));
}
/** Hypotheses struck by at least one of the player's marks. */
export function struckSet(draft: Draft | null, view: unknown): Set<string> {
  return new Set(marksOf(draft, view).map((m) => m.hypothesisId));
}
/** The one hypothesis the player's marks leave unstruck, else null (never computed from the solution). */
export function lastUnstruckOf(draft: Draft | null, view: unknown): string | null {
  const hyps = hypothesesOf(view);
  if (hyps.length < 2) return null;
  const struck = struckSet(draft, view);
  const left = hyps.filter((h) => !struck.has(h.id));
  return left.length === 1 ? left[0].id : null;
}

// ---------------------------------------------------------------- pose

function poseOf(input: PoseInput<TumblerVaultConfig>): TumblerVaultPose {
  const hyps = hypothesesOf(input.view);
  const ids = new Set(hyps.map((h) => h.id));
  const struck = struckSet(input.draft, input.view);
  const last = lastUnstruckOf(input.draft, input.view);
  const accused = accusedOf(input.draft, ids);
  const tumblers = hyps.map((h) => {
    const s = struck.has(h.id);
    const aligned = input.solved && h.id === accused;
    return {
      id: h.id,
      rotDeg: s && !aligned ? STRUCK_DEG : 0,
      struck: s,
      lamp: s && !aligned ? 0 : 1,
      glow: aligned || h.id === last ? 1 : 0,
      slide: aligned || h.id === last ? UNSTRUCK_SLIDE_PX : 0,
      accused: h.id === accused,
    };
  });
  const window = input.config.miniStrip ?? probeWindowOf(input.config.probe);
  const span = window ? window.end - window.start : 0;
  return {
    tumblers,
    struckCount: struck.size,
    lastUnstruck: last,
    accused,
    bolts: Array.from({ length: input.config.bolts }, () => (input.solved ? 1 : 0)),
    ringsDeg: input.solved ? 540 : 0,
    handwheelDeg: input.solved ? 720 : 0,
    door: input.solved ? 1 : 0,
    grille: input.aidTier >= 1 ? 1 : 0.35,
    cursorU: window && span > 0 && input.probe !== null ? clamp01((input.probe - window.start) / span) : null,
    solved: input.solved,
  };
}

function lerpPose(from: TumblerVaultPose, to: TumblerVaultPose, t: number): TumblerVaultPose {
  const k = clamp01(t);
  const snap = k >= 0.5;
  const base = snap ? to : from;
  const tumblers = to.tumblers.map((b, i) => {
    const a = from.tumblers[i]?.id === b.id ? from.tumblers[i] : b;
    const d = snap ? b : a;
    return { ...d, id: b.id, rotDeg: lerp(a.rotDeg, b.rotDeg, k), lamp: lerp(a.lamp, b.lamp, k), glow: lerp(a.glow, b.glow, k), slide: lerp(a.slide, b.slide, k) };
  });
  return {
    ...base,
    tumblers,
    bolts: to.bolts.map((b, i) => lerp(from.bolts[i] ?? b, b, k)),
    ringsDeg: lerp(from.ringsDeg, to.ringsDeg, k),
    handwheelDeg: lerp(from.handwheelDeg, to.handwheelDeg, k),
    door: lerp(from.door, to.door, k),
    grille: lerp(from.grille, to.grille, k),
    cursorU: from.cursorU !== null && to.cursorU !== null ? lerp(from.cursorU, to.cursorU, k) : to.cursorU,
  };
}

function describePose(pose: TumblerVaultPose, input: PoseInput<TumblerVaultConfig>): Described {
  const hyps = hypothesesOf(input.view);
  const n = pose.tumblers.length;
  const chips = pose.tumblers.flatMap((tm, i) => (tm.accused ? [{ anchor: `tumbler_${i % TUMBLER_ANCHORS}`, text: "ACCUSED", color: "accent" as const }] : []));
  if (pose.solved) return { chips: [], pins: [], srText: "The vault stands open: the bolts are drawn and the press is printing the story.", nearMiss: null };
  const parts = [`${pose.struckCount} of ${n} tumblers struck by your marks`];
  if (pose.lastUnstruck) parts.push("one tumbler is left unstruck and glows");
  const accused = hyps.find((h) => h.id === pose.accused);
  if (accused) parts.push(`you accuse: ${accused.text}`);
  return { chips, pins: [], srText: `${parts.join("; ")}.`, nearMiss: null };
}

// ---------------------------------------------------------------- panel

function clueDate(config: TumblerVaultConfig, index: number): string | null {
  return config.clues.find((c) => c.index === index)?.date ?? null;
}

/** The vault's own mini Record Strip (vault layout keeps it; the panel may add earned pins via withEarnedPins). */
function miniStripCard(config: TumblerVaultConfig, view: unknown): TimelineCard | null {
  const w = config.miniStrip;
  if (!w) return null;
  const pins: TimelinePin[] = [];
  for (const c of cluesOf(view)) {
    const d = clueDate(config, c.index);
    const at = d ? fracYearOf(d) : null;
    if (at !== null) pins.push({ key: `clue:${c.index}`, at, label: `CLUE ${c.index + 1}`, lane: null, style: "focus", spanTo: null });
  }
  return {
    kind: "timeline",
    slot: 0,
    title: "RECORD",
    tab: "RECORD",
    from: w.start,
    to: w.end,
    unit: "year",
    lanes: [],
    pins,
    bands: [],
    arrows: [],
    axisBreak: null,
    sr: `Mini record strip, ${w.start} to ${w.end}: ${pins.length} dated ${pins.length === 1 ? "clue" : "clues"}.`,
  };
}

function matrixSlot(config: TumblerVaultConfig): number {
  return config.miniStrip ? 1 : 0;
}

function shadeCountsFor(config: TumblerVaultConfig, hintsUsed: number): boolean {
  return config.shadeCountsRung !== null && hintsUsed >= config.shadeCountsRung;
}

function matrixCard(config: TumblerVaultConfig, view: unknown, marks: readonly Mark[], accused: string | null, shadeCounts: boolean): Extract<CardModel, { kind: "matrix" }> {
  const hyps = hypothesesOf(view);
  const clues = cluesOf(view).map((c) => ({ index: c.index, text: c.text, date: clueDate(config, c.index) }));
  const struck = new Set(marks.map((m) => m.hypothesisId)).size;
  const acc = hyps.find((h) => h.id === accused);
  return {
    kind: "matrix",
    slot: matrixSlot(config),
    title: "EVIDENCE",
    clues,
    hypotheses: hyps.map((h) => ({ id: h.id, text: h.text })),
    marks,
    accused,
    shadeCounts,
    sr: `Evidence matrix: ${hyps.length} explanations by ${clues.length} clues; ${marks.length} ${marks.length === 1 ? "strike" : "strikes"} on ${struck} ${struck === 1 ? "row" : "rows"}${acc ? `; accused: ${acc.text}` : ""}.`,
  };
}

function panelStaticOf(input: StaticInput<TumblerVaultConfig>): PanelStatic {
  const cards: CardModel[] = [];
  const strip = miniStripCard(input.config, input.view);
  if (strip) cards.push(strip);
  cards.push(matrixCard(input.config, input.view, [], null, shadeCountsFor(input.config, input.hintsUsed)));
  return { cards, input: null, probe: input.config.probe, recordPins: [] };
}

function panelLiveOf(stat: PanelStatic, input: PoseInput<TumblerVaultConfig>): PanelLive {
  const ids = new Set(hypothesesOf(input.view).map((h) => h.id));
  const marks = marksOf(input.draft, input.view);
  const accused = accusedOf(input.draft, ids);
  const staticMatrix = stat.cards.find((c) => c.kind === "matrix");
  const shade = staticMatrix?.kind === "matrix" ? staticMatrix.shadeCounts : shadeCountsFor(input.config, input.hintsUsed);
  const matrix = matrixCard(input.config, input.view, marks, accused, shade);
  const highlights: PanelLive["highlights"][number][] = [...new Set(marks.map((m) => m.hypothesisId))].map((id) => ({ slot: matrix.slot, key: id, state: "struck" as const }));
  if (accused) highlights.push({ slot: matrix.slot, key: accused, state: "focus" });
  const chips: PanelLive["chips"][number][] = [];
  const strip = stat.cards.find((c) => c.kind === "timeline" && c.slot === 0);
  if (strip?.kind === "timeline" && input.probe !== null) chips.push({ slot: 0, value: input.probe, text: fileChip(strip, input.probe).text, color: "f" });
  return {
    scrubX: input.probe,
    readout: yearReadout(input.config.probe?.format ?? "number", input.probe),
    chips,
    highlights,
    liveCards: [matrix],
  };
}

// ---------------------------------------------------------------- outcomes

function failurePlanOf(d: Diagnosis, input: PoseInput<TumblerVaultConfig>): FailurePlan {
  const hyps = hypothesesOf(input.view);
  const id = d.wrongKeys[0] ?? null;
  const pos = id === null ? -1 : hyps.findIndex((h) => h.id === id);
  const clueKey = d.wrongKeys.find((k) => /^clue:\d+$/.test(k));
  const disclosed = d.disclosed.clueIndex;
  const clueIndex = clueKey ? Number(clueKey.slice(5)) : typeof disclosed === "number" ? disclosed : null;
  const anchor = pos >= 0 ? `tumbler_${pos % TUMBLER_ANCHORS}` : "hub";
  const beats: FailBeat[] = [{ atMs: 0, anchor, action: "grind", params: { deg: 4, times: 3, hypothesisId: id ?? "" } }];
  // the eliminating clue card slides beside the accused row (the panel moves the card; the world holds the tumbler lit)
  if (clueIndex !== null) beats.push({ atMs: 450, anchor, action: "hold_bright", params: { clueIndex, clueKey: `clue:${clueIndex}`, hypothesisId: id ?? "" } });
  return { beats, durationMs: 1300, cue: TUMBLER_VAULT_SKINS[0].cues.fail };
}

function successPlanOf(input: PoseInput<TumblerVaultConfig>, anim: string): SuccessPlan {
  const hyps = hypothesesOf(input.view);
  const accused = accusedOf(input.draft, new Set(hyps.map((h) => h.id)));
  const pos = accused === null ? -1 : hyps.findIndex((h) => h.id === accused);
  const n = input.config.bolts;
  const step = Math.min(180, Math.floor(720 / n));
  const beats: SuccessBeat[] = [{ atMs: 0, anchor: pos >= 0 ? `tumbler_${pos % TUMBLER_ANCHORS}` : "hub", action: "lock", params: { hypothesisId: accused ?? "" } }];
  for (let i = 0; i < n; i++) beats.push({ atMs: 300 + i * step, anchor: `bolt_${i % TUMBLER_ANCHORS}`, action: "open", params: { index: i, cue: "bolt_slide" } });
  const spinAt = 300 + n * step + 60;
  beats.push({ atMs: spinAt, anchor: "hub", action: "spin", params: { ringTurns: 1.5, handwheelTurns: 2 } });
  beats.push({ atMs: spinAt + 200, anchor: "hub", action: "open", params: { anim, swingMs: 1200 } });
  return { beats, cardEffects: [], durationMs: 2500, cue: TUMBLER_VAULT_SKINS[0].cues.succeed };
}

const FOOTPRINT: Footprint2D = { left: 600, right: 600, height: 1100 };
const FRAME: Bounds = { x: -700, y: -1150, w: 1400, h: 1250 };

export const tumblerVaultMeta: ContraptionMeta<TumblerVaultConfig, TumblerVaultPose> = {
  id: "tumbler_vault",
  name: "Tumbler Vault",
  modes: ["investigator.elimination"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["vault"],
  defaultLayout: "vault",
  payoffs: ["vault_opens", "door_opens", "gate_lifts"],
  nearMissKeys: [],
  accessories: [],
  skins: TUMBLER_VAULT_SKINS,
  control: "matrix",
  configSchema: TumblerVaultConfig,
  validateConfig(config: TumblerVaultConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
    const out: ConfigIssue[] = [];
    out.push(...subsetOf(["clues"], "clue index", clueIndicesOf(ctx.view), config.clues.map((c) => c.index)));
    config.clues.forEach((c, i) => {
      if (c.date !== null && !dateAppearsIn([clueTextOf(ctx.view, c.index)], c.date)) {
        out.push(err(["clues", i, "date"], `clue ${c.index}'s date ${c.date} does not appear in its text`));
      }
    });
    if (config.miniStrip && !(config.miniStrip.start < config.miniStrip.end)) out.push(err(["miniStrip"], "miniStrip start must be before its end"));
    out.push(...probeRangeIssues(["probe"], config.probe));
    return out;
  },
  defaultConfig(ctx: ConfigCtx): TumblerVaultConfig {
    return TumblerVaultConfig.parse({
      clues: clueIndicesOf(ctx.view).map((index) => ({ index, date: findDates(clueTextOf(ctx.view, index))[0] ?? null })),
    });
  },
  writerConfigSchema: (ctx: WriterCtx) =>
    ctx.itemKeys.length === 0
      ? null
      : z.object({
          clues: z.array(z.object({ index: z.number().int().min(0).max(9), date: wDate().nullable() })).min(0).max(10),
        }),
  fromWriterConfig(w: unknown): TumblerVaultConfig {
    return TumblerVaultConfig.parse({ clues: (w as TumblerVaultWriter).clues });
  },
  footprint: () => FOOTPRINT,
  frameBounds: () => FRAME,
  probe: (config: TumblerVaultConfig): ProbeSpec | null => config.probe,
  clock: null,
  sim: null,
  pose: poseOf,
  lerp: lerpPose,
  describe: describePose,
  panelStatic: panelStaticOf,
  panelLive: panelLiveOf,
  hintTargets: (rung: HintRung, input: StaticInput<TumblerVaultConfig>): readonly HintTarget[] =>
    (TUMBLER_VAULT_SKINS.find((s) => s.id === input.skinId) ?? TUMBLER_VAULT_SKINS[0]).hintTargets[rung - 1],
  audio: () => [],
  failurePlan: failurePlanOf,
  successPlan: (input: PoseInput<TumblerVaultConfig>, anim) => successPlanOf(input, anim),
  solvedPose: (input: PoseInput<TumblerVaultConfig>) => poseOf({ ...input, solved: true }),
  debug: (pose: TumblerVaultPose) => ({
    struckCount: pose.struckCount,
    lastUnstruck: pose.lastUnstruck ?? "",
    accused: pose.accused ?? "",
    rotations: pose.tumblers.map((t) => Math.round(t.rotDeg)).join(","),
    boltsOpen: pose.bolts.filter((b) => b >= 0.99).length,
    door: pose.door,
    grille: pose.grille,
    cursorU: pose.cursorU ?? -1,
    solved: pose.solved,
  }),
};
