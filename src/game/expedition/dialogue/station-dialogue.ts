/**
 * src/game/expedition/dialogue/station-dialogue.ts (S1) — the station slot flow (docs/design/20 §2.7), pure.
 *
 * | Moment                 | What is said or pinned                                                                 |
 * | approach (once)        | `approach` lines, toast, story priority                                                |
 * | boss arena             | `boss.taunts.approach`, bar, blocking, then the arena cutscene                         |
 * | panel opens            | primary = instruction; secondary = tutorial on the FIRST open, otherwise insight       |
 * | boss phase appears     | `boss.phases[i].line`, bar, instruction priority                                       |
 * | (i) hint rung r        | `hints[r − 1]` (or the fixture hint verbatim in the guide's voice), kind `hint`        |
 * | failed Verify          | fail lines (boss taunt?, guide line); secondary = diagnosis.displayFeedback (feedback) |
 * | correct Verify         | primary = success; `payoffLine` toast during the payoff; `after` lines in explore      |
 *
 * `insight` is the pre-success, hint-free truth (never the answer); `success` replaces the instruction and may state it.
 */
import type { LineSlot, Station, WorldLine } from "../../../contracts/world";
import type { Diagnosis, HintRung } from "../../../world/types";
import { sayRequest, toDialogueLine } from "./lines";
import type { DialogueKind, PinnedLines, SayRequest } from "./types";

type StationLike = Pick<Station, "encounterId" | "dialogue" | "boss">;
type Authored = WorldLine | LineSlot;

export const stationSource = (encounterId: string) => `station:${encounterId}`;

// ---------------------------------------------------------------- explore

/** Entering `approachRadius` (explore, once): the approach lines as a toast. */
export function approachSay(st: StationLike, guideId: string): SayRequest | null {
  return sayRequest(`${stationSource(st.encounterId)}:approach`, st.dialogue.approach, "line", guideId, {
    channel: "toast",
    priority: "story",
  });
}

/** Crossing the boss arena trigger: the approach taunts, bar, blocking (before the arena cutscene). */
export function arenaSay(st: StationLike, guideId: string): SayRequest | null {
  if (!st.boss) return null;
  return sayRequest(`arena:${st.encounterId}`, st.boss.taunts.approach, "taunt", guideId, {
    channel: "bar",
    priority: "instruction",
    blocking: true,
  });
}

/** A solved station's console replays its success and after lines (a review). */
export function replaySay(st: StationLike, guideId: string): SayRequest | null {
  const lines: Authored[] = [st.dialogue.success, ...st.dialogue.after];
  return sayRequest(`${stationSource(st.encounterId)}:review`, lines, (_l, i) => (i === 0 ? "success" : "line"), guideId, {
    channel: "bar",
    priority: "story",
  });
}

// ---------------------------------------------------------------- panel

function pinFrom(slot: LineSlot, kind: DialogueKind, guideId: string): NonNullable<PinnedLines["primary"]> {
  return { kind, text: slot.text, speakerId: slot.speakerId ?? guideId };
}

/** Panel opens: instruction on line 1; tutorial on the first open only (falls back to insight), insight afterwards. */
export function panelOpenPins(st: StationLike, guideId: string, firstOpen: boolean): PinnedLines {
  const d = st.dialogue;
  const second: { slot: LineSlot; kind: DialogueKind } | null =
    firstOpen && d.tutorial
      ? { slot: d.tutorial, kind: "tutorial" }
      : d.insight
        ? { slot: d.insight, kind: "insight" }
        : null;
  return {
    primary: pinFrom(d.instruction, "instruction", guideId),
    secondary: second ? { kind: second.kind, text: second.slot.text } : null,
  };
}

/** A boss board phase appears (its batch of items is revealed): its line, bar, instruction priority. */
export function bossPhaseSay(st: StationLike, phaseIndex: number, guideId: string): SayRequest | null {
  const phase = st.boss?.phases[phaseIndex];
  if (!phase?.line) return null;
  return sayRequest(`${stationSource(st.encounterId)}:phase:${phaseIndex}`, [phase.line], "taunt", guideId, {
    channel: "bar",
    priority: "instruction",
  });
}

// ---------------------------------------------------------------- hints

/**
 * The text of hint rung r: the authored guide-voiced rung, else the fixture hint verbatim (the guide speaks it).
 * null when neither exists (the runner had no hint left).
 */
export function hintLine(st: StationLike, rung: HintRung, fixtureHints: readonly string[], guideId: string): { speakerId: string; text: string } | null {
  const authored = st.dialogue.hints?.[rung - 1];
  if (authored) return { speakerId: authored.speakerId ?? guideId, text: authored.text };
  const fixture = fixtureHints[rung - 1];
  return fixture ? { speakerId: guideId, text: fixture } : null;
}

/** Every hint unlocked so far (the Brief sheet's Hints tab): guide rungs, then the fixture hints verbatim. */
export function unlockedHints(
  st: StationLike,
  hintsUsed: number,
  fixtureHints: readonly string[],
  guideId: string,
): { guide: { rung: HintRung; speakerId: string; text: string }[]; fixture: string[] } {
  const guide: { rung: HintRung; speakerId: string; text: string }[] = [];
  for (let r = 1; r <= Math.min(3, hintsUsed); r++) {
    const l = hintLine(st, r as HintRung, fixtureHints, guideId);
    if (l) guide.push({ rung: r as HintRung, ...l });
  }
  return { guide, fixture: fixtureHints.slice(0, Math.max(0, hintsUsed)) };
}

export function hintSay(st: StationLike, rung: HintRung, fixtureHints: readonly string[], guideId: string): SayRequest | null {
  const l = hintLine(st, rung, fixtureHints, guideId);
  if (!l) return null;
  return sayRequest(`${stationSource(st.encounterId)}:hint:${rung}`, [l], "hint", guideId, { channel: "bar", priority: "instruction" });
}

// ---------------------------------------------------------------- failure

/** The lookup key of a failed Verify: probe key, else near-miss key, else fail key (§2.5.4). */
export function failKeyOf(d: Pick<Diagnosis, "probeKeys" | "nearMiss" | "failKey">): { key: string | null; kind: DialogueKind } {
  if (d.probeKeys.length > 0) return { key: d.probeKeys[0], kind: "probe" };
  if (d.nearMiss) return { key: d.nearMiss, kind: "near_miss" };
  return { key: d.failKey, kind: "line" };
}

/**
 * Lines for a failed Verify: [boss taunt?, guide line] (the documented algorithm of src/world/fail-line.ts, §2.5.4).
 * TODO(w1): delegate to V1's `failLines` from src/world/fail-line.ts once it lands; the client may already inject it
 * through `failResponse(…, { failLines })`.
 */
export function defaultFailLines(st: StationLike, d: Diagnosis, attempt: number): (WorldLine | LineSlot)[] {
  const { key } = failKeyOf(d);
  const guide = (key !== null ? st.dialogue.fail.byKey.find((b) => b.key === key)?.line : undefined) ?? st.dialogue.fail.default;
  const out: (WorldLine | LineSlot)[] = [];
  if (st.boss) {
    const byKey = key !== null ? st.boss.taunts.byKey.find((b) => b.key === key)?.line : undefined;
    const fails = st.boss.taunts.fail;
    const taunt = byKey ?? (fails.length > 0 ? fails[((attempt % fails.length) + fails.length) % fails.length] : undefined);
    if (taunt) out.push({ ...taunt, speakerId: taunt.speakerId ?? st.boss.speakerId });
  }
  out.push(guide);
  return out;
}

export interface FailResponse {
  say: SayRequest | null;
  pin: Partial<PinnedLines>;
}

/** A failed Verify: the fail lines on the bar (instruction priority) and the display feedback as line 2. */
export function failResponse(
  st: StationLike,
  d: Diagnosis,
  attempt: number,
  guideId: string,
  opts?: { failLines?: (st: StationLike, d: Diagnosis, attempt: number) => readonly (WorldLine | LineSlot)[] },
): FailResponse {
  const lines = (opts?.failLines ?? defaultFailLines)(st, d, attempt);
  const { kind } = failKeyOf(d);
  const bossId = st.boss?.speakerId ?? null;
  const source = `${stationSource(st.encounterId)}:fail:${attempt}`;
  const say: SayRequest | null =
    lines.length === 0
      ? null
      : {
          lines: lines.map((l, i) => {
            const speaker = l.speakerId ?? guideId;
            return toDialogueLine(l, `${source}:${i}`, bossId !== null && speaker === bossId ? "taunt" : kind, guideId);
          }),
          channel: "bar",
          priority: "instruction",
          blocking: false,
          source,
        };
  return { say, pin: { secondary: d.displayFeedback ? { kind: "feedback", text: d.displayFeedback } : null } };
}

// ---------------------------------------------------------------- success

export interface SuccessResponse {
  /** success replaces the instruction; line 2 clears */
  pin: PinnedLines;
  /** toast while the payoff animates */
  payoff: SayRequest | null;
  /** explore, after the payoff */
  after: SayRequest | null;
}

export function successResponse(st: StationLike, guideId: string): SuccessResponse {
  const src = stationSource(st.encounterId);
  return {
    pin: { primary: pinFrom(st.dialogue.success, "success", guideId), secondary: null },
    payoff: st.dialogue.payoffLine
      ? sayRequest(`${src}:payoff`, [st.dialogue.payoffLine], "payoff", guideId, { channel: "toast", priority: "story" })
      : null,
    after: sayRequest(`${src}:after`, st.dialogue.after, "line", guideId, { channel: "bar", priority: "story" }),
  };
}

// ---------------------------------------------------------------- the stateful wrapper (still pure: no IO)

/**
 * Remembers what the flow needs across moments: approached stations, first opens and failed attempts.
 * The client owns one per game session (in a ref).
 */
export class StationSlotFlow {
  private approached = new Set<string>();
  private opened = new Set<string>();
  private attempts = new Map<string, number>();

  constructor(private readonly guideId: string) {}

  approach(st: StationLike): SayRequest | null {
    if (this.approached.has(st.encounterId)) return null;
    this.approached.add(st.encounterId);
    return approachSay(st, this.guideId);
  }

  open(st: StationLike): PinnedLines {
    const first = !this.opened.has(st.encounterId);
    this.opened.add(st.encounterId);
    return panelOpenPins(st, this.guideId, first);
  }

  hint(st: StationLike, rung: HintRung, fixtureHints: readonly string[]): SayRequest | null {
    return hintSay(st, rung, fixtureHints, this.guideId);
  }

  fail(st: StationLike, d: Diagnosis, opts?: Parameters<typeof failResponse>[4]): FailResponse {
    const attempt = this.attempts.get(st.encounterId) ?? 0;
    this.attempts.set(st.encounterId, attempt + 1);
    return failResponse(st, d, attempt, this.guideId, opts);
  }

  success(st: StationLike): SuccessResponse {
    return successResponse(st, this.guideId);
  }

  failedAttempts(encounterId: string): number {
    return this.attempts.get(encounterId) ?? 0;
  }
}
