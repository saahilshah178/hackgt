/**
 * stage_machine — linker.pairs with a stage probe (docs/design/20 §4 row 10, §4.2, §4.4, §7.4; cell §5.8 e8). A machine
 * with typed sockets (the lefts); linking a cartridge (a right) LOADS exactly what the cartridge says and shows the
 * neutral label "loaded: …" (never "?", never dimmed, identical whatever socket it sits in). The stage scrubber k plays
 * the cycle through what you loaded: the drum turns 60°·k, the jaws open inward or outward by stage, loaded ions snap
 * in at their socket's stage and release toward their cartridge's direction, ATP sparks enter the port, the beacon
 * pulses with the net charge moved. A `bars` ledger sums q = Σ ±n over the ion sockets. Only the playback reveals what
 * a load does (an ATP spark where ions should bind binds nothing; ions pressing on a shut jaw never bind); correctness
 * itself waits for Verify, and the failure plan jams the playback at the stage of `wrongKeys[0]`'s socket. KB3.
 *
 * ## The pose contract (skins read these fields; zone units relative to station.anchor, x right, y DOWN)
 * - `k` (the stage, eased), `drumAngle` = (π/3)·k, `jawUpper` / `jawLower` 0 shut … 1 open (35°), `side` the facing.
 * - `sockets[]` in view order (the control plinth, anchors `socket_<i>` and label plates `tag_<i>`): kind, ion, stage,
 *   the linked cartridge, the neutral `loaded` label, `lamp` (off · white = seated, never a verdict · cyan solved only).
 * - `cartridges[]` in DISPLAY order (the rack, anchors `cartridge_<j>`): what each IS (count n + dir, n ATP, a signal).
 * - `cables[]` socket → cartridge, `loads[]` what each linked socket does at this k (ions / sparks / stray / signal),
 *   `q`, `needle`, `beacon` 0…1, `beaconText`, `port` (ATP port glow), `gate` 0…1 (the payoff), `captions` (aid tier 2).
 *
 * Live-reveal rule (§2.5.6): metas see the view only; nothing here reads params or the solution. Discrete fields take
 * the target as soon as t > 0 (the controller eases with a small per-frame t), numbers ease.
 */
import { z } from "zod";
import type { PayoffAnim, ProbeSpec } from "../../contracts/world";
import { clamp, clamp01, lerp } from "../ease";
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
  FnColor,
  Footprint2D,
  HintRung,
  HintTarget,
  PairsView,
  PanelLive,
  PanelStatic,
  PoseInput,
  SchematicPrim,
  StaticInput,
  SuccessBeat,
  SuccessPlan,
  WriterCtx,
} from "../types";
import { coverExactlyOnce, err, leftKeysOf, probeRangeIssues, rightKeysOf, viewTextOf } from "./config-parts";
import { defineSkin } from "./skin-kit";
import { StageMachineConfig, type StageSemantic } from "./stage-machine.config";
export { StageMachineConfig, StageSemantic } from "./stage-machine.config";

const ht = (anchor: string, action: HintTarget["action"], holdMs: number): HintTarget => ({ anchor, action, holdMs });

export const STAGE_MACHINE_SKINS = [
  defineSkin({
    id: "pump_rewiring",
    name: "Sodium Pump",
    ns: "living_gate",
    nouns: ["pump", "Sodium Pump", "sockets", "cartridges", "drum", "stage", "cycle"],
    parts: [
      ["pump_housing", "H"], ["drum", "H"], ["jaw_upper", "H"], ["jaw_lower", "K"], ["cartridge", "K"], ["socket", "K"],
      ["beacon_tower", "K"], ["hall_gate", "K"], ["console", "K"],
    ],
    anchors: ["socket_0…3", "cartridge_0…4", "drum", "atp_port", "beacon", "crank", "console"],
    cues: { live: "current_hum", succeed: "beacon_ignite", fail: "tumbler_grind" },
    // cell §5.8: rung 1 Pip circles the charge-ledger needle on the drum; rung 2 hovers at socket 0; rung 3 lands on the ATP port
    hintTargets: [[ht("drum", "circle", 2000)], [ht("socket_0", "hover", 1800)], [ht("atp_port", "land", 2000)]],
  }),
] as const;

function digitIn(text: string, n: number): boolean {
  return new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(text);
}

export function validateStageMachine(config: StageMachineConfig, ctx: ConfigCtx): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  out.push(...coverExactlyOnce(["lefts"], "left key", leftKeysOf(ctx.view), config.lefts.map((l) => l.key)));
  out.push(...coverExactlyOnce(["rights"], "right key", rightKeysOf(ctx.view), config.rights.map((r) => r.key)));
  config.rights.forEach((r, i) => {
    const text = viewTextOf(ctx.view, r.key);
    if (r.semantic.kind === "count") {
      if (!digitIn(text, r.semantic.n)) out.push(err(["rights", i, "semantic", "n"], `count ${r.semantic.n} does not appear as a digit in "${text}"`));
      const dirOk = r.semantic.dir === "out" ? /\bout\b/i.test(text) : /\b(in|into)\b/i.test(text);
      if (!dirOk) out.push(err(["rights", i, "semantic", "dir"], `direction "${r.semantic.dir}" is not stated in "${text}"`));
    } else if (r.semantic.kind === "atp") {
      if (!digitIn(text, r.semantic.n)) out.push(err(["rights", i, "semantic", "n"], `ATP count ${r.semantic.n} does not appear in "${text}"`));
    }
  });
  const s = config.stages;
  if (s.format !== "stage") out.push(err(["stages", "format"], 'the stage scrubber must use format "stage"'));
  if (!Number.isInteger(s.min) || !Number.isInteger(s.max)) out.push(err(["stages"], "stage min and max must be integers"));
  else {
    const stops = new Set(s.stops.map((x) => x.v));
    for (let k = s.min; k <= s.max; k++) if (!stops.has(k)) out.push(err(["stages", "stops"], `stage ${k} has no named stop`));
  }
  out.push(...probeRangeIssues(["stages"], s));
  return out;
}

interface StageMachineWriter {
  lefts: { key: string; stage: number; socketKind: "ion" | "energy" | "beacon"; ion: "Na" | "K" | null }[];
  rights: { key: string; kind: "count" | "atp" | "beacon"; n: number | null; dir: "in" | "out" | null }[];
}

// ================================================================ geometry (zone units relative to station.anchor, y down)

export interface XY {
  x: number;
  y: number;
}
/** One stage turns the drum 60°. */
export const STAGE_ANGLE = Math.PI / 3;
/** A jaw opens 35° when the pump faces its side. */
export const JAW_OPEN_DEG = 35;
/** The playback speed of the failure run and the success cycles (cell §5.8: 170 ms per stage). */
export const MS_PER_STAGE = 170;
/** Cables hang with a catenary sag of 40 units (cell §5.8). */
export const CABLE_SAG = 40;
/**
 * The Na⁺/K⁺ pump, 3.5 H (595 units) tall, spanning the deck floor at y 0 (cell §5.8): the housing, the drum at its
 * waist, the upper (extracellular) and lower (cytoplasm) jaws, the ATP port on its right flank, the crank chained to
 * the Hall Gate, the control plinth (the sockets) at its left, the cartridge rack at its right, the beacon tower behind.
 */
export const PUMP = {
  housing: { x: 0, top: -455, bottom: 140, halfW: 132 },
  drum: { x: 0, y: -170, r: 92 },
  jawUpper: { x: 0, y: -372 },
  jawLower: { x: 0, y: 32 },
  atpPort: { x: 138, y: -88 },
  crank: { x: 150, y: 96 },
  plinthX: -290,
  socketTop: -382,
  socketGap: 88,
  rackX: 300,
  cartridgeTop: -372,
  cartridgeGap: 66,
  beacon: { x: 470, y: -430 },
} as const;
/** Control-plinth socket i (view order, top to bottom). */
export function socketAt(i: number): XY {
  return { x: PUMP.plinthX, y: PUMP.socketTop + i * PUMP.socketGap };
}
/** The label plate just above socket i: its neutral "loaded: …" chip rides there (chips sit above their anchor). */
export function tagAt(i: number): XY {
  const s = socketAt(i);
  return { x: s.x, y: s.y - 28 };
}
/** Rack slot j (display order, top to bottom). */
export function cartridgeAt(j: number): XY {
  return { x: PUMP.rackX, y: PUMP.cartridgeTop + j * PUMP.cartridgeGap };
}
/** Where an ion waits on a side of the membrane before it binds (above the upper jaw / below the lower jaw). */
export function sideHome(side: Side, slot: number, n: number, group = 0): XY {
  const dx = (slot - (n - 1) / 2) * 40 + (group % 2 === 0 ? -46 : 46);
  return side === "out" ? { x: dx, y: PUMP.jawUpper.y - 96 } : { x: dx, y: PUMP.jawLower.y + 96 };
}
/** A drum socket for ion slot `slot` of `n` of one group, rotating with the drum. */
export function drumSlotAt(group: number, slot: number, n: number, drumAngle: number): XY {
  const base = group * Math.PI + (slot - (n - 1) / 2) * 0.66;
  const a = base + drumAngle;
  const r = PUMP.drum.r * 0.64;
  return { x: PUMP.drum.x + r * Math.cos(a), y: PUMP.drum.y + r * Math.sin(a) };
}

// ================================================================ the stage physics (pure)

/** "in" = the cytoplasm side (below), "out" = the extracellular side (above). */
export type Side = "in" | "out";
const opposite = (s: Side): Side => (s === "in" ? "out" : "in");

/**
 * The side the pump opens to at each integer stage min…max, read from the named stops: a stop saying "flip out" (or
 * "outward") turns it outward, "flip in" (or "inward") turns it back; the pump starts inward-open. Without any such
 * stop the middle third of the stages faces out (the Na⁺/K⁺ table: 0, 1, 2, 6 inward; 3, 4, 5 outward).
 */
export function conformations(stages: Pick<ProbeSpec, "min" | "max" | "stops">): Side[] {
  const lo = Math.ceil(stages.min);
  const hi = Math.max(lo, Math.floor(stages.max));
  const out: Side[] = [];
  let side: Side = "in";
  let named = false;
  for (let v = lo; v <= hi; v++) {
    const label = stages.stops.find((s) => Math.abs(s.v - v) < 1e-9)?.label ?? "";
    if (/flip\s*out|outward|open\s*out/i.test(label)) {
      side = "out";
      named = true;
    } else if (/flip\s*in|inward|open\s*in/i.test(label)) {
      side = "in";
      named = true;
    }
    out.push(side);
  }
  if (named) return out;
  const n = out.length;
  return out.map((_, i) => (i >= Math.ceil(n / 3) && i < Math.ceil((2 * n) / 3) ? "out" : "in"));
}
/** The side at an integer stage (clamped to the scrubber's range). */
export function sideAt(stages: Pick<ProbeSpec, "min" | "max" | "stops">, k: number): Side {
  const sides = conformations(stages);
  const i = clamp(Math.round(k) - Math.ceil(stages.min), 0, sides.length - 1);
  return sides[i]!;
}
/** Jaw openness at a (fractional) stage: the facing jaw opens fully, blending between neighbouring stages. */
export function jawsAt(stages: Pick<ProbeSpec, "min" | "max" | "stops">, k: number): { upper: number; lower: number; side: Side } {
  const kk = clamp(k, stages.min, stages.max);
  const k0 = Math.floor(kk);
  const k1 = Math.ceil(kk);
  const f = kk - k0;
  const out0 = sideAt(stages, k0) === "out" ? 1 : 0;
  const out1 = sideAt(stages, k1) === "out" ? 1 : 0;
  const upper = lerp(out0, out1, f);
  return { upper, lower: 1 - upper, side: upper >= 0.5 ? "out" : "in" };
}
/**
 * The stage at which ions bound at `bindStage` release toward `dir`: one stage after the pump next flips to face
 * `dir` (clamped to the last stage), or null when it never does (the ions stay in the drum). Na⁺ bound at 1 flips out
 * at 3 and releases at 4 (swap); K⁺ bound at 4 flips in at 6, the last stage, and releases there.
 */
export function releaseStage(stages: Pick<ProbeSpec, "min" | "max" | "stops">, bindStage: number, dir: Side): number | null {
  const lo = Math.ceil(stages.min);
  const hi = Math.floor(stages.max);
  for (let r = Math.max(lo + 1, bindStage + 1); r <= hi; r++) {
    if (sideAt(stages, r) === dir && sideAt(stages, r - 1) !== dir) return Math.min(hi, r + 1);
  }
  return null;
}
/** 0 at stage s − 1, 1 at stage s (the load of a socket acting at s). */
export function stageProgress(k: number, s: number): number {
  return clamp01(k - (s - 1));
}

/** The neutral label on a loaded socket: what the CARTRIDGE says, the same in any socket (never "?", never dimmed). */
export function loadedLabel(semantic: StageSemantic, text: string): string {
  switch (semantic.kind) {
    case "count":
      return `loaded: ${semantic.n} ${semantic.dir}`;
    case "atp":
      return `loaded: ${semantic.n} ATP`;
    case "beacon": {
      const t = text.trim();
      return `loaded: ${t.length > 22 ? `${t.slice(0, 21).trimEnd()}…` : t || "signal"}`;
    }
  }
}
/** The charge a link moves out of the cell per cycle: +n out, −n in, 0 for anything but a count on an ion socket. */
export function chargeOf(socketKind: StageMachineConfig["lefts"][number]["socketKind"], semantic: StageSemantic): number {
  if (socketKind !== "ion" || semantic.kind !== "count") return 0;
  return semantic.dir === "out" ? semantic.n : -semantic.n;
}

// ================================================================ pose

export type SocketLamp = "off" | "white" | "cyan";
export interface PumpSocket {
  key: string;
  index: number;
  kind: StageMachineConfig["lefts"][number]["socketKind"];
  ion: "Na" | "K" | null;
  stage: number;
  x: number;
  y: number;
  linked: string | null; // the right key seated here
  loaded: string | null; // the neutral label
  lamp: SocketLamp;
  focus: boolean;
}
export interface PumpCartridge {
  key: string;
  index: number; // display order
  kind: StageSemantic["kind"];
  n: number;
  dir: Side | null;
  x: number;
  y: number;
  seatedIn: string | null; // the socket key
  focus: boolean;
}
export interface PumpCable {
  leftKey: string;
  rightKey: string;
  leftIndex: number;
  rightIndex: number;
  a: XY;
  b: XY;
  sag: number;
}
/** What one linked socket does at the current stage (the playback through what you loaded). */
export type PumpLoad =
  | {
      kind: "ions";
      socket: string;
      socketIndex: number;
      group: number; // drum group (0, 1, …: which arc of the drum its slots sit on)
      ion: "Na" | "K";
      n: number;
      from: Side;
      to: Side;
      bindStage: number;
      releaseStage: number | null;
      blocked: boolean; // the jaw on `from` is shut at bindStage: the ions press on it and never bind
      bind: number; // 0 → 1 over the bind stage
      release: number; // 0 → 1 over the release stage
    }
  | { kind: "sparks"; socket: string; socketIndex: number; n: number; into: "port" | "drum"; stage: number; u: number }
  | { kind: "stray"; socket: string; socketIndex: number; n: number; stage: number; u: number }
  | { kind: "signal"; socket: string; socketIndex: number; stage: number; u: number };

/** The archetype's pose (skins import this name). */
export interface StageMachinePose {
  k: number;
  stageLabel: string;
  drumAngle: number;
  jawUpper: number;
  jawLower: number;
  side: Side;
  sockets: PumpSocket[];
  cartridges: PumpCartridge[];
  cables: PumpCable[];
  loads: PumpLoad[];
  linked: number;
  complete: boolean;
  q: number;
  needle: number; // radians: −30°·clamp(q, −1, 1)
  beacon: number; // 0 dark … 1 lit
  beaconText: string | null;
  port: number; // ATP port glow 0…1
  gate: number; // payoff 0 closed … 1 open
  captions: boolean; // aid tier 2: the stage names are shown on the schematic
  focusKey: string | null;
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
/** The draft's links between known sockets and cartridges: one per socket and one per cartridge (the later wins). */
export function draftLinks(draft: PoseInput<StageMachineConfig>["draft"], view: unknown): Link[] {
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
function semanticOf(config: StageMachineConfig, rightKey: string): StageSemantic | null {
  return config.rights.find((r) => r.key === rightKey)?.semantic ?? null;
}
function socketOf(config: StageMachineConfig, leftKey: string): StageMachineConfig["lefts"][number] | null {
  return config.lefts.find((l) => l.key === leftKey) ?? null;
}
function stageLabelOf(stages: ProbeSpec, k: number): string {
  const v = Math.round(clamp(k, stages.min, stages.max));
  return stages.stops.find((s) => Math.abs(s.v - v) < 1e-9)?.label ?? `stage ${v}`;
}
/** The charge ledger q for a set of links: Σ over ion sockets of +n (out) or −n (in). */
export function ledgerQ(config: StageMachineConfig, links: readonly Link[]): number {
  let q = 0;
  for (const l of links) {
    const socket = socketOf(config, l.leftKey);
    const sem = semanticOf(config, l.rightKey);
    if (socket && sem) q += chargeOf(socket.socketKind, sem);
  }
  return q;
}
/** The ledger needle: −30°·clamp(q, −1, 1) (radians). */
export function needleOf(q: number): number {
  return (-30 * Math.PI * clamp(q, -1, 1)) / 180;
}

/**
 * Everything the stage k does with a set of links: the pure playback (the skin replays it during the failure run and
 * the success cycles, so the world never shows anything the pose would not).
 */
export function pumpPlayback(config: StageMachineConfig, view: unknown, links: readonly Link[], k: number): Pick<StageMachinePose, "loads" | "beacon" | "beaconText" | "port" | "q" | "needle"> {
  const stages = config.stages;
  const lefts = leftsOf(view);
  const rights = rightsOf(view);
  const q = ledgerQ(config, links); // the beacon pulses with the net charge moved, ledger card or not
  const loads: PumpLoad[] = [];
  let beacon = 0;
  let beaconText: string | null = null;
  let port = 0;
  let group = 0;
  lefts.forEach((left, socketIndex) => {
    const socket = socketOf(config, left.key);
    const link = links.find((l) => l.leftKey === left.key);
    if (!socket || !link) return;
    const sem = semanticOf(config, link.rightKey);
    if (!sem) return;
    const s = socket.stage;
    const u = stageProgress(k, s);
    if (socket.socketKind === "beacon") {
      beaconText = rights.find((r) => r.key === link.rightKey)?.text ?? null;
      beacon = u * (0.15 + 0.85 * Math.min(1, Math.abs(q)));
      return;
    }
    if (sem.kind === "count") {
      if (socket.socketKind === "ion") {
        const to: Side = sem.dir;
        const from = opposite(to);
        const blocked = sideAt(stages, s) !== from;
        const r = blocked ? null : releaseStage(stages, s, to);
        loads.push({
          kind: "ions", socket: left.key, socketIndex, group: group++, ion: socket.ion ?? "Na", n: sem.n, from, to,
          bindStage: s, releaseStage: r, blocked, bind: u, release: r === null ? 0 : stageProgress(k, r),
        });
      } else loads.push({ kind: "stray", socket: left.key, socketIndex, n: sem.n, stage: s, u });
    } else if (sem.kind === "atp") {
      const into = socket.socketKind === "energy" ? "port" : "drum";
      loads.push({ kind: "sparks", socket: left.key, socketIndex, n: sem.n, into, stage: s, u });
      if (into === "port") port = Math.max(port, u);
    } else loads.push({ kind: "signal", socket: left.key, socketIndex, stage: s, u });
  });
  return { loads, beacon, beaconText, port, q, needle: needleOf(q) };
}

/** Solved poses keep cycling: 2.5 stages a second through the whole table. */
export const SOLVED_STAGES_PER_S = 2.5;
function solvedK(stages: ProbeSpec, t: number, reducedMotion: boolean): number {
  if (reducedMotion) return stages.min;
  const span = stages.max - stages.min + 1;
  const v = (Math.max(0, t) * SOLVED_STAGES_PER_S) % span;
  return stages.min + Math.min(v, stages.max - stages.min);
}

function poseOf(input: PoseInput<StageMachineConfig>): StageMachinePose {
  const { config, view } = input;
  const stages = config.stages;
  const lefts = leftsOf(view);
  const rights = rightsOf(view);
  const links = draftLinks(input.draft, view);
  const byLeft = new Map(links.map((l) => [l.leftKey, l.rightKey]));
  const byRight = new Map(links.map((l) => [l.rightKey, l.leftKey]));
  const focusKey = typeof input.draft?.focus === "string" ? input.draft.focus : typeof input.draft?.hover === "string" ? input.draft.hover : null;
  const k = input.solved ? solvedK(stages, input.t, input.reducedMotion) : clamp(input.probe ?? stages.initial ?? stages.min, stages.min, stages.max);
  const jaws = jawsAt(stages, k);
  const rightIndex = new Map(rights.map((r, j) => [r.key, j]));
  const sockets: PumpSocket[] = lefts.map((l, i) => {
    const socket = socketOf(config, l.key);
    const linked = byLeft.get(l.key) ?? null;
    const sem = linked ? semanticOf(config, linked) : null;
    const text = linked ? (rights.find((r) => r.key === linked)?.text ?? "") : "";
    const at = socketAt(i);
    return {
      key: l.key, index: i, kind: socket?.socketKind ?? "beacon", ion: socket?.ion ?? null, stage: socket?.stage ?? 0, ...at,
      linked, loaded: sem ? loadedLabel(sem, text) : null, lamp: input.solved ? "cyan" : linked ? "white" : "off", focus: l.key === focusKey,
    };
  });
  const cartridges: PumpCartridge[] = rights.map((r, j) => {
    const sem = semanticOf(config, r.key);
    return {
      key: r.key, index: j, kind: sem?.kind ?? "beacon", n: sem && sem.kind !== "beacon" ? sem.n : 0, dir: sem?.kind === "count" ? sem.dir : null,
      ...cartridgeAt(j), seatedIn: byRight.get(r.key) ?? null, focus: r.key === focusKey,
    };
  });
  const cables: PumpCable[] = links.map((l) => {
    const i = lefts.findIndex((x) => x.key === l.leftKey);
    const j = rightIndex.get(l.rightKey) ?? 0;
    return { leftKey: l.leftKey, rightKey: l.rightKey, leftIndex: i, rightIndex: j, a: socketAt(i), b: cartridgeAt(j), sag: CABLE_SAG };
  });
  const play = pumpPlayback(config, view, links, k);
  return {
    k,
    stageLabel: stageLabelOf(stages, k),
    drumAngle: STAGE_ANGLE * (k - stages.min),
    jawUpper: jaws.upper,
    jawLower: jaws.lower,
    side: jaws.side,
    sockets,
    cartridges,
    cables,
    ...play,
    beacon: input.solved ? Math.max(play.beacon, 0.85) : play.beacon,
    linked: links.length,
    complete: lefts.length > 0 && links.length === lefts.length,
    captions: input.aidTier >= 2,
    gate: input.solved ? 1 : 0,
    focusKey,
    solved: input.solved,
  };
}

function lerpLoads(from: readonly PumpLoad[], to: readonly PumpLoad[], t: number): PumpLoad[] {
  return to.map((b) => {
    const a = from.find((x) => x.socket === b.socket && x.kind === b.kind);
    if (!a) return b;
    if (a.kind === "ions" && b.kind === "ions") return a.n === b.n && a.from === b.from ? { ...b, bind: lerp(a.bind, b.bind, t), release: lerp(a.release, b.release, t) } : b;
    if (a.kind !== "ions" && b.kind !== "ions") return { ...b, u: lerp(a.u, b.u, t) };
    return b;
  });
}
/** Numbers ease; discrete fields (links, labels, lamps, loads' structure) take the target as soon as t > 0. */
function lerpPose(from: StageMachinePose, to: StageMachinePose, t: number): StageMachinePose {
  const k = clamp01(t);
  if (k <= 0) return from;
  if (k >= 1) return to;
  // a solved pose wraps from the last stage back to the first: never sweep the drum backwards
  const wrap = from.solved && to.solved && to.k < from.k - 2;
  if (wrap) return to;
  return {
    ...to,
    k: lerp(from.k, to.k, k),
    drumAngle: lerp(from.drumAngle, to.drumAngle, k),
    jawUpper: lerp(from.jawUpper, to.jawUpper, k),
    jawLower: lerp(from.jawLower, to.jawLower, k),
    loads: lerpLoads(from.loads, to.loads, k),
    needle: lerp(from.needle, to.needle, k),
    beacon: lerp(from.beacon, to.beacon, k),
    port: lerp(from.port, to.port, k),
    gate: lerp(from.gate, to.gate, k),
  };
}

const IONS: Readonly<Record<"Na" | "K", string>> = { Na: "Na⁺", K: "K⁺" };
function signed(q: number): string {
  return q > 0 ? `+${q}` : q < 0 ? `−${Math.abs(q)}` : "0";
}

function describePose(pose: StageMachinePose, input: PoseInput<StageMachineConfig>): Described {
  const chips: ChipSpec[] = [];
  for (const s of pose.sockets) if (s.loaded) chips.push({ anchor: `tag_${s.index}`, text: s.loaded, color: "f" });
  if (input.config.ledger === "charge" && pose.loads.some((l) => l.kind === "ions")) chips.push({ anchor: "drum", text: `charge q: ${signed(pose.q)}`, color: "f" });
  if (pose.beaconText) chips.push({ anchor: "beacon", text: pose.beaconText.length > 28 ? `${pose.beaconText.slice(0, 27).trimEnd()}…` : pose.beaconText, color: "g" });
  const kk = Math.round(pose.k);
  let srText: string;
  if (pose.solved) srText = "The pump is cycling: sodium jets out, potassium draws in, the ledger ticks and the Hall Gate is up.";
  else {
    srText = `Stage ${kk}, ${pose.stageLabel}: the pump opens ${pose.side === "out" ? "outward" : "inward"} and the drum has turned ${Math.round((pose.drumAngle * 180) / Math.PI)}°.`;
    srText += ` ${pose.linked} of ${pose.sockets.length} sockets are loaded.`;
    const now = pose.loads.filter((l) => (l.kind === "ions" ? l.bindStage : l.stage) === kk);
    for (const l of now) {
      if (l.kind === "ions") srText += l.blocked ? ` ${l.n} ${IONS[l.ion]} press on a shut jaw and do not bind.` : ` ${l.n} ${IONS[l.ion]} bind in the drum.`;
      else if (l.kind === "sparks") srText += l.into === "port" ? ` ${l.n} ATP spark${l.n === 1 ? "" : "s"} enter the port.` : ` An ATP spark reaches an ion socket and binds nothing.`;
      else if (l.kind === "stray") srText += ` Loose ions drift past a socket that cannot hold them.`;
    }
    const released = pose.loads.filter((l) => l.kind === "ions" && l.releaseStage === kk);
    for (const l of released) if (l.kind === "ions") srText += ` ${l.n} ${IONS[l.ion]} leave ${l.to === "out" ? "into the tide" : "into the cell"}.`;
    if (input.config.ledger === "charge") srText += ` The charge ledger reads ${signed(pose.q)}.`;
  }
  return { chips, pins: [], srText, nearMiss: null };
}

// ================================================================ panel (§2.5.2; cell §5.8: wiring, pump, charge)

type LinkBoard = Extract<CardModel, { kind: "link_board" }>;
type Schematic = Extract<CardModel, { kind: "schematic" }>;
type Bars = Extract<CardModel, { kind: "bars" }>;
export const WIRING_SLOT = 0;
export const PUMP_SLOT = 1;
export const LEDGER_SLOT = 2;

function wiringCard(view: unknown, links: readonly Link[], focus: string | null): LinkBoard {
  const lefts = leftsOf(view);
  const rights = rightsOf(view);
  return {
    kind: "link_board",
    slot: WIRING_SLOT,
    title: "wiring",
    lefts: lefts.map((l) => ({ key: l.key, label: l.text })),
    rights: rights.map((r) => ({ key: r.key, label: r.text, sub: null })),
    links: links.map((l) => ({ ...l, state: l.leftKey === focus || l.rightKey === focus ? "focus" : "seated" })),
    sr: `${lefts.length} sockets and ${rights.length} cartridges; ${links.length} of ${lefts.length} sockets loaded.`,
  };
}

/**
 * The pump cross-section at stage k with the loaded ions, drawn wide and short so it reads in a short card
 * (viewBox 480 × 150: outside above the membrane band y 62–88, inside below).
 */
export function pumpSchematic(config: StageMachineConfig, view: unknown, links: readonly Link[], k: number, captions: boolean): Schematic {
  const stages = config.stages;
  const jaws = jawsAt(stages, k);
  const play = pumpPlayback(config, view, links, k);
  const cx = 300;
  const cy = 75;
  const prims: SchematicPrim[] = [
    { p: "rect", x: 0, y: 62, w: 480, h: 26, color: "h", fill: true },
    { p: "text", x: 4, y: 30, text: "outside", size: 18, color: "f", anchor: "start" },
    { p: "text", x: 4, y: 146, text: "inside", size: 18, color: "f", anchor: "start" },
  ];
  // the housing's two walls; the facing jaw splays open (35°)
  const open = (u: number) => 16 * u;
  for (const side of [-1, 1] as const) {
    const x0 = cx + side * 22;
    const x1 = cx + side * 34;
    prims.push({
      p: "poly",
      points: [[x0 + side * open(jaws.upper), 14], [x1 + side * open(jaws.upper), 14], [x1, 62], [x1, 88], [x1 + side * open(jaws.lower), 136], [x0 + side * open(jaws.lower), 136], [x0, 88], [x0, 62]],
      color: "f",
      fill: true,
      w: 2,
    });
  }
  prims.push({ p: "circle", cx, cy, r: 15, color: "gold", fill: false });
  const a = STAGE_ANGLE * (k - stages.min);
  prims.push({ p: "line", x1: cx, y1: cy, x2: cx + 14 * Math.sin(a), y2: cy - 14 * Math.cos(a), color: "gold", w: 3, dash: false });
  // ions: waiting beyond a jaw, bound in the drum, or released beyond the other jaw
  const colorOf = (ion: "Na" | "K"): FnColor => (ion === "Na" ? "f" : "g");
  const yOut = 18;
  const yIn = 132;
  for (const l of play.loads) {
    if (l.kind !== "ions") continue;
    for (let i = 0; i < l.n; i++) {
      const dx = (i - (l.n - 1) / 2) * 14 + (l.group % 2 === 0 ? -64 : 64);
      const yFrom = l.from === "out" ? yOut : yIn;
      const yTo = l.to === "out" ? yOut : yIn;
      let x = cx + dx;
      let y = yFrom;
      if (l.blocked) y = lerp(yFrom, l.from === "out" ? 44 : 106, Math.sin(Math.PI * l.bind));
      else if (l.release > 0) {
        x = lerp(cx + dx * 0.15, cx + dx, l.release);
        y = lerp(cy, yTo, l.release);
      } else if (l.bind > 0) {
        x = lerp(cx + dx, cx + dx * 0.15, l.bind);
        y = lerp(yFrom, cy, l.bind);
      }
      prims.push({ p: "circle", cx: x, cy: y, r: 6, color: colorOf(l.ion), fill: true });
    }
  }
  for (const l of play.loads) {
    if (l.kind !== "sparks" || l.u <= 0) continue;
    const tx = l.into === "port" ? cx + 44 : cx;
    prims.push({ p: "circle", cx: lerp(cx + 150, tx, l.u), cy: lerp(120, cy + 6, l.u), r: 7, color: "gold", fill: l.into === "port" });
  }
  const v = Math.round(clamp(k, stages.min, stages.max));
  if (captions) prims.push({ p: "text", x: 476, y: 30, text: `${v} · ${stageLabelOf(stages, v)}`, size: 20, color: "f", anchor: "end" });
  return {
    kind: "schematic",
    slot: PUMP_SLOT,
    title: "pump",
    viewBox: [480, 150],
    prims,
    sr: `The pump at stage ${v} (${stageLabelOf(stages, v)}), open ${jaws.side === "out" ? "outward" : "inward"}.`,
  };
}

function ledgerCard(config: StageMachineConfig, links: readonly Link[], aidTier: number): Bars {
  const bars: Bars["bars"][number][] = [];
  const counts = config.rights.map((r) => (r.semantic.kind === "count" ? r.semantic.n : 0));
  const max = Math.max(3, ...counts);
  config.lefts.forEach((left, i) => {
    if (left.socketKind !== "ion") return;
    const link = links.find((l) => l.leftKey === left.key);
    const sem = link ? semanticOf(config, link.rightKey) : null;
    const ion = IONS[left.ion ?? "Na"];
    const n = sem?.kind === "count" ? sem.n : 0;
    const dir = sem?.kind === "count" ? ` ${sem.dir}` : "";
    bars.push({ id: left.key, label: `${ion}${dir}`, value: n, max, color: i % 2 === 0 ? "f" : "g" });
  });
  const q = ledgerQ(config, links);
  return {
    kind: "bars",
    slot: LEDGER_SLOT,
    title: aidTier >= 1 ? "charge · inside charge" : "charge",
    bars,
    sparkline: null,
    timer: null,
    arrow: null,
    sr: `Charge ledger: ${bars.map((b) => `${b.label} ${b.value}`).join(", ") || "nothing loaded"}; net q = ${signed(q)}.`,
  };
}

function cardsFor(config: StageMachineConfig, view: unknown, links: readonly Link[], focus: string | null, k: number, aidTier: number): CardModel[] {
  const cards: CardModel[] = [wiringCard(view, links, focus), pumpSchematic(config, view, links, k, aidTier >= 2)];
  if (config.ledger === "charge") cards.push(ledgerCard(config, links, aidTier));
  return cards;
}

function panelStaticOf(input: StaticInput<StageMachineConfig>): PanelStatic {
  const k = input.config.stages.initial ?? input.config.stages.min;
  return { cards: cardsFor(input.config, input.view, [], null, k, input.aidTier), input: null, probe: input.config.stages, recordPins: [] };
}

function formatStage(v: number, stages: ProbeSpec): string {
  const r = Math.round(clamp(v, stages.min, stages.max));
  return `stage ${r} · ${stageLabelOf(stages, r)}`;
}

function panelLiveOf(_stat: PanelStatic, input: PoseInput<StageMachineConfig>): PanelLive {
  const { config, view } = input;
  const links = draftLinks(input.draft, view);
  const focus = typeof input.draft?.focus === "string" ? input.draft.focus : null;
  const k = clamp(input.probe ?? config.stages.initial ?? config.stages.min, config.stages.min, config.stages.max);
  const liveCards = cardsFor(config, view, links, focus, k, input.aidTier);
  const chips: PanelLive["chips"][number][] = [];
  if (config.ledger === "charge") {
    const q = ledgerQ(config, links);
    chips.push({ slot: LEDGER_SLOT, value: q, text: `q = ${signed(q)}`, color: "f" });
  }
  const highlights: PanelLive["highlights"][number][] = links.map((l) => ({ slot: WIRING_SLOT, key: l.leftKey, state: l.leftKey === focus ? "focus" : "placed" }));
  if (focus !== null && !links.some((l) => l.leftKey === focus)) highlights.push({ slot: WIRING_SLOT, key: focus, state: "focus" });
  return { scrubX: k, readout: formatStage(k, config.stages), chips, highlights, liveCards };
}

// ================================================================ outcomes

/**
 * The failure plan acts ONLY on `wrongKeys[0]` (the left grade() names): the playback runs 170 ms per stage from the
 * first stage and jams at that socket's stage (the drum grinds with a 3 px shake); an energy socket's spark misfires; a
 * beacon socket lets the cycle complete while the beacon's plaque flickers and stays dark. Other sockets show nothing.
 */
function failurePlanOf(d: Diagnosis, input: PoseInput<StageMachineConfig>): FailurePlan {
  const { config, view } = input;
  const stages = config.stages;
  const lefts = leftsOf(view);
  const key = d.wrongKeys[0];
  const i = key === undefined ? -1 : lefts.findIndex((l) => l.key === key);
  const socket = key === undefined ? null : socketOf(config, key);
  const cue = STAGE_MACHINE_SKINS[0].cues.fail;
  if (d.failKey === "wrong_link" && i >= 0 && socket) {
    const beats: FailBeat[] = [];
    if (socket.socketKind === "beacon") {
      const runMs = (stages.max - stages.min) * MS_PER_STAGE;
      beats.push({ atMs: 0, anchor: "drum", action: "stall", params: { fromK: stages.min, toK: stages.max, msPerStage: MS_PER_STAGE } });
      beats.push({ atMs: runMs, anchor: "beacon", action: "flash", params: { flicker: 3, dark: 1 } });
      beats.push({ atMs: runMs, anchor: `socket_${i}`, action: "dim", params: { key: socket.key } });
      return { beats, durationMs: Math.min(1600, runMs + 500), cue };
    }
    const jamAt = clamp(socket.stage, stages.min, stages.max);
    const runMs = (jamAt - stages.min) * MS_PER_STAGE;
    beats.push({ atMs: 0, anchor: "drum", action: "stall", params: { fromK: stages.min, toK: jamAt, msPerStage: MS_PER_STAGE } });
    if (socket.socketKind === "energy") beats.push({ atMs: runMs, anchor: "atp_port", action: "spark", params: { misfire: 1 } });
    beats.push({ atMs: runMs, anchor: "drum", action: "grind", params: { stage: jamAt, shakePx: 3, ms: 300 } });
    beats.push({ atMs: runMs, anchor: `socket_${i}`, action: "jam", params: { key: socket.key, stage: jamAt } });
    return { beats, durationMs: Math.min(1600, runMs + 520), cue };
  }
  // incomplete (Verify is normally disabled until every socket is loaded): the first empty socket blinks
  const links = draftLinks(input.draft, view);
  const empty = lefts.findIndex((l) => !links.some((x) => x.leftKey === l.key));
  return { beats: [{ atMs: 0, anchor: empty >= 0 ? `socket_${empty}` : "console", action: "flash", params: { flicker: 2 } }], durationMs: 800, cue };
}

/**
 * Two automatic cycles (170 ms per stage): each cycle's ATP spark enters the port, the ions jet, the crank lifts the
 * Hall Gate half-way per cycle; then the beacon fires and the gate locks open (cell §5.8, ≈ 2.4 s).
 */
function successPlanOf(input: PoseInput<StageMachineConfig>, anim: PayoffAnim): SuccessPlan {
  const { config } = input;
  const stages = config.stages;
  const cycleMs = (stages.max - stages.min + 1) * MS_PER_STAGE;
  const beats: SuccessBeat[] = [{ atMs: 0, anchor: "drum", action: "cycle", params: { fromK: stages.min, toK: stages.max, msPerStage: MS_PER_STAGE, cycles: 2 } }];
  const energy = config.lefts.find((l) => l.socketKind === "energy");
  for (let c = 0; c < 2; c++) {
    if (energy) beats.push({ atMs: c * cycleMs + (energy.stage - stages.min) * MS_PER_STAGE, anchor: "atp_port", action: "ignite", params: { cycle: c } });
    beats.push({ atMs: (c + 1) * cycleMs - MS_PER_STAGE, anchor: "crank", action: "rise", params: { gate: (c + 1) / 2 } });
  }
  const end = 2 * cycleMs;
  beats.push({ atMs: Math.min(2300, end - 80), anchor: "beacon", action: "ignite", params: { pulse: 1 } });
  beats.push({ atMs: Math.min(2350, end), anchor: "gate", action: anim === "door_opens" ? "open" : "rise", params: { anim } });
  return { beats: beats.sort((a, b) => a.atMs - b.atMs), cardEffects: [], durationMs: clamp(end + 120, 1200, 2500), cue: STAGE_MACHINE_SKINS[0].cues.succeed };
}

function audioOf(pose: StageMachinePose): readonly AudioParam[] {
  if (pose.solved) return [{ cue: "current_hum", pitch: 1.2, gain: 0.06 }];
  if (pose.linked === 0) return [];
  return [{ cue: "current_hum", pitch: 1 + 0.08 * pose.k, gain: 0.04 + 0.01 * pose.linked }];
}

// ================================================================ geometry for the host

const FOOTPRINT: Footprint2D = { left: 520, right: 520, height: 640 };
/** The pump, its plinth, its rack and the beacon; the Hall Gate below is seen when the camera returns to explore. */
const FRAME: Bounds = { x: -560, y: -560, w: 1160, h: 800 };

export const stageMachineMeta: ContraptionMeta<StageMachineConfig, StageMachinePose> = {
  id: "stage_machine",
  name: "Stage Machine",
  modes: ["linker.pairs"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["scrub"],
  defaultLayout: "scrub",
  payoffs: ["gate_lifts", "door_opens", "barrier_lifts", "beam_restores"],
  nearMissKeys: [],
  accessories: [],
  skins: STAGE_MACHINE_SKINS,
  control: "cables",
  configSchema: StageMachineConfig,
  validateConfig: (config, ctx) => validateStageMachine(config, ctx),
  defaultConfig(ctx: ConfigCtx): StageMachineConfig {
    // never auto-picked (§4.4); this default is only a structurally valid starting point for authors
    const lefts = leftKeysOf(ctx.view);
    const max = Math.max(1, lefts.length - 1);
    return StageMachineConfig.parse({
      lefts: lefts.map((key, stage) => ({ key, stage, socketKind: "beacon" })),
      rights: rightKeysOf(ctx.view).map((key) => ({ key, semantic: { kind: "beacon" } })),
      stages: {
        symbol: "k",
        label: "stage",
        min: 0,
        max,
        step: 1,
        format: "stage",
        stops: Array.from({ length: max + 1 }, (_, v) => ({ v, label: `stage ${v}` })),
      },
      ledger: "none",
    });
  },
  writerConfigSchema: (ctx: WriterCtx) =>
    ctx.itemKeys.length === 0
      ? null
      : z.object({
          lefts: z
            .array(z.object({ key: z.string(), stage: z.number().int().min(0).max(12), socketKind: z.enum(["ion", "energy", "beacon"]), ion: z.enum(["Na", "K"]).nullable() }))
            .min(1)
            .max(6),
          rights: z
            .array(
              z.object({
                key: z.string(),
                kind: z.enum(["count", "atp", "beacon"]),
                n: z.number().int().min(0).max(9).nullable(),
                dir: z.enum(["in", "out"]).nullable(),
              }),
            )
            .min(1)
            .max(8),
        }),
  fromWriterConfig(w: unknown, ctx: ConfigCtx): StageMachineConfig {
    const wc = w as StageMachineWriter;
    const base = stageMachineMeta.defaultConfig(ctx);
    const maxStage = Math.max(1, ...wc.lefts.map((l) => l.stage));
    return StageMachineConfig.parse({
      lefts: wc.lefts,
      rights: wc.rights.map((r) => ({
        key: r.key,
        semantic:
          r.kind === "count" ? { kind: "count", n: r.n ?? 0, dir: r.dir ?? "in" } : r.kind === "atp" ? { kind: "atp", n: r.n ?? 0 } : { kind: "beacon" },
      })),
      stages: { ...base.stages, max: maxStage, stops: Array.from({ length: maxStage + 1 }, (_, v) => ({ v, label: `stage ${v}` })) },
      ledger: "charge",
    });
  },
  footprint: () => FOOTPRINT,
  frameBounds: () => FRAME,
  probe: (config: StageMachineConfig): ProbeSpec | null => config.stages,
  clock: { resetOn: ["open"] },
  sim: null,
  pose: poseOf,
  lerp: lerpPose,
  describe: describePose,
  panelStatic: panelStaticOf,
  panelLive: panelLiveOf,
  hintTargets: (rung: HintRung, input: StaticInput<StageMachineConfig>): readonly HintTarget[] =>
    (STAGE_MACHINE_SKINS.find((s) => s.id === input.skinId) ?? STAGE_MACHINE_SKINS[0]).hintTargets[rung - 1],
  audio: (pose: StageMachinePose) => audioOf(pose),
  failurePlan: failurePlanOf,
  successPlan: successPlanOf,
  solvedPose: (input: PoseInput<StageMachineConfig>) => poseOf({ ...input, solved: true }),
  debug: (pose: StageMachinePose) => ({
    k: Math.round(pose.k * 1000) / 1000,
    stage: pose.stageLabel,
    drumDeg: Math.round((pose.drumAngle * 180) / Math.PI),
    side: pose.side,
    jawUpper: Math.round(pose.jawUpper * 1000) / 1000,
    jawLower: Math.round(pose.jawLower * 1000) / 1000,
    linked: pose.linked,
    cables: pose.cables.map((c) => `${c.leftKey}>${c.rightKey}`).join(","),
    loaded: pose.sockets.map((s) => s.loaded ?? "_").join("|"),
    white: pose.sockets.filter((s) => s.lamp === "white").length,
    cyan: pose.sockets.filter((s) => s.lamp === "cyan").length,
    blocked: pose.loads.filter((l) => l.kind === "ions" && l.blocked).length,
    q: pose.q,
    needleDeg: Math.round((pose.needle * 180) / Math.PI),
    beacon: Math.round(pose.beacon * 1000) / 1000,
    port: Math.round(pose.port * 1000) / 1000,
    gate: Math.round(pose.gate * 1000) / 1000,
    focus: pose.focusKey ?? "",
    solved: pose.solved,
  }),
};
