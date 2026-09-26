import type { Encounter, GameSpec } from "../../contracts/gamespec";
import type { TeachingMechanic } from "../../contracts/library";
import { emptyMastery, updateMastery, type MasteryState, type TelemetryEvent } from "../../contracts/telemetry";
import { getCard } from "../../library";
import { getMode } from "../../mechanics/registry";
import type { AnyFamilyMode, Grade } from "../../mechanics/types";

export interface Current {
  index: number;
  encounter: Encounter;
  mode: AnyFamilyMode;
  card: TeachingMechanic | undefined;
  /** What the widget renders (shuffled with the spec seed, so it's identical on replay). */
  view: unknown;
  before: { speakerId: string; text: string }[];
  after: { speakerId: string; text: string }[];
}

export interface DebriefConcept {
  conceptId: string;
  unitId: string;
  name: string;
  encounters: number;
  firstTry: number;
  score: number;
  attempts: number;
}

export interface DebriefLine {
  encounterId: string;
  teachingMechanicId: string;
  cardName: string;
  learningInsight: string;
  text: string;
}

/**
 * The game logic, with no Phaser in it. A genre host (Phaser scene) owns movement and art:
 * when the player reaches a socket it calls current(), renders the widget from `view`,
 * sends the player's answer to submit(), and animates the result. Because this class is pure
 * logic, it runs headless in tests and powers window.__GAME_DEBUG__ (skipTo, autoSolve).
 */
export class EncounterRunner {
  private index = 0;
  private attempts = 0;
  private hintsUsed = 0;
  private startedAt: number;
  private readonly events: TelemetryEvent[] = [];
  private masteryState: MasteryState;

  constructor(
    readonly spec: GameSpec,
    private readonly opts: { now?: () => number; onEvent?: (e: TelemetryEvent) => void } = {},
  ) {
    this.startedAt = this.now();
    this.masteryState = emptyMastery(
      spec.concepts.map((c) => c.id),
      spec.mastery,
    );
  }

  private now() {
    return this.opts.now?.() ?? Date.now();
  }

  get finished(): boolean {
    return this.index >= this.spec.encounters.length;
  }

  current(): Current | null {
    if (this.finished) return null;
    const encounter = this.spec.encounters[this.index];
    const mode = getMode(encounter.familyId, encounter.mode);
    if (!mode) throw new Error(`no mode "${encounter.familyId}.${encounter.mode}"; validate specs before playing them`);
    return {
      index: this.index,
      encounter,
      mode,
      card: getCard(encounter.teachingMechanicId),
      view: mode.present(encounter.params, this.spec.seed + this.index),
      before: this.spec.narrative.beats.filter((b) => b.encounterId === encounter.id && b.when === "before"),
      after: this.spec.narrative.beats.filter((b) => b.encounterId === encounter.id && b.when === "after"),
    };
  }

  /** Next rung of the hint ladder, or null when all three are used. */
  hint(): string | null {
    const cur = this.current();
    if (!cur || this.hintsUsed >= cur.encounter.hints.length) return null;
    return cur.encounter.hints[this.hintsUsed++];
  }

  get hintsUsedOnCurrent(): number {
    return this.hintsUsed;
  }

  submit(input: unknown): Grade & { advanced: boolean } {
    const cur = this.current();
    if (!cur) throw new Error("game is finished");
    this.attempts++;
    const g = cur.mode.grade(cur.encounter.params, input);
    const t = this.now();
    const event: TelemetryEvent = {
      gameId: this.spec.id,
      encounterId: cur.encounter.id,
      conceptIds: cur.encounter.conceptIds,
      teachingMechanicId: cur.encounter.teachingMechanicId,
      attempt: this.attempts,
      correct: g.correct,
      hintsUsed: this.hintsUsed,
      ms: Math.max(0, t - this.startedAt),
      at: new Date(t).toISOString(),
    };
    this.events.push(event);
    this.masteryState = updateMastery(this.masteryState, event, this.spec.mastery);
    this.opts.onEvent?.(event);
    if (g.correct) this.advance();
    return { ...g, advanced: g.correct };
  }

  /** Debug/test hook: answers the current encounter correctly using the mode's own solver. */
  autoSolve(): Grade & { advanced: boolean } {
    const cur = this.current();
    if (!cur) throw new Error("game is finished");
    const solution = cur.mode.resolve(cur.encounter.params);
    return this.submit(cur.mode.solutionInput(cur.encounter.params, solution));
  }

  skipTo(encounterId: string): void {
    const i = this.spec.encounters.findIndex((e) => e.id === encounterId);
    if (i === -1) throw new Error(`no encounter "${encounterId}"`);
    this.index = i;
    this.resetCounters();
  }

  telemetry(): readonly TelemetryEvent[] {
    return this.events;
  }

  mastery(): MasteryState {
    return this.masteryState;
  }

  /** Per-concept results plus the "what you just did" lines for the debrief screen. */
  debrief(): { mastery: DebriefConcept[]; lines: DebriefLine[] } {
    const mastery = this.spec.concepts.map((c) => {
      const mine = this.spec.encounters.filter((e) => e.conceptIds.includes(c.id));
      const firstTry = mine.filter((e) =>
        this.events.some((ev) => ev.encounterId === e.id && ev.attempt === 1 && ev.correct && ev.hintsUsed === 0),
      ).length;
      const m = this.masteryState[c.id];
      return { conceptId: c.id, unitId: c.unitId, name: c.name, encounters: mine.length, firstTry, score: m?.score ?? 0, attempts: m?.attempts ?? 0 };
    });
    const lines = this.spec.encounters.map((e) => {
      const card = getCard(e.teachingMechanicId);
      return {
        encounterId: e.id,
        teachingMechanicId: e.teachingMechanicId,
        cardName: card?.name ?? e.teachingMechanicId,
        learningInsight: card?.learningInsight ?? "",
        text: e.debriefLine,
      };
    });
    return { mastery, lines };
  }

  private advance() {
    this.index++;
    this.resetCounters();
  }

  private resetCounters() {
    this.attempts = 0;
    this.hintsUsed = 0;
    this.startedAt = this.now();
  }
}
