import type { Encounter, GameSpec } from "../contracts/gamespec";
import { getMechanic } from "../mechanics/registry";
import type { AnyMechanic, Grade } from "../mechanics/types";

export interface TelemetryEvent {
  gameId: string;
  encounterId: string;
  conceptIds: string[];
  attempt: number;
  correct: boolean;
  hintsUsed: number;
  ms: number;
}

export interface Current {
  index: number;
  encounter: Encounter;
  mechanic: AnyMechanic;
  /** What the widget renders (shuffled with the spec seed, so it's identical on replay). */
  view: unknown;
  before: { speakerId: string; text: string }[];
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

  constructor(
    readonly spec: GameSpec,
    private readonly opts: { now?: () => number; onEvent?: (e: TelemetryEvent) => void } = {},
  ) {
    this.startedAt = this.now();
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
    const mechanic = getMechanic(encounter.mechanicId);
    if (!mechanic) throw new Error(`no mechanic "${encounter.mechanicId}"; validate specs before playing them`);
    return {
      index: this.index,
      encounter,
      mechanic,
      view: mechanic.present(encounter.params, this.spec.seed + this.index),
      before: this.spec.narrative.beats.filter((b) => b.encounterId === encounter.id && b.when === "before"),
    };
  }

  /** Next rung of the hint ladder, or null when all three are used. */
  hint(): string | null {
    const cur = this.current();
    if (!cur || this.hintsUsed >= cur.encounter.hints.length) return null;
    return cur.encounter.hints[this.hintsUsed++];
  }

  submit(input: unknown): Grade & { advanced: boolean } {
    const cur = this.current();
    if (!cur) throw new Error("game is finished");
    this.attempts++;
    const g = cur.mechanic.grade(cur.encounter.params, input);
    const event: TelemetryEvent = {
      gameId: this.spec.id,
      encounterId: cur.encounter.id,
      conceptIds: cur.encounter.conceptIds,
      attempt: this.attempts,
      correct: g.correct,
      hintsUsed: this.hintsUsed,
      ms: this.now() - this.startedAt,
    };
    this.events.push(event);
    this.opts.onEvent?.(event);
    if (g.correct) this.advance();
    return { ...g, advanced: g.correct };
  }

  /** Debug/test hook: answers the current encounter correctly using the mechanic's own solver. */
  autoSolve(): Grade & { advanced: boolean } {
    const cur = this.current();
    if (!cur) throw new Error("game is finished");
    const solution = cur.mechanic.resolve(cur.encounter.params);
    return this.submit(cur.mechanic.solutionInput(cur.encounter.params, solution));
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

  /** Per-concept results plus the "what you just did" lines for the debrief screen. */
  debrief() {
    const mastery = this.spec.concepts.map((c) => {
      const mine = this.spec.encounters.filter((e) => e.conceptIds.includes(c.id));
      const firstTry = mine.filter((e) =>
        this.events.some((ev) => ev.encounterId === e.id && ev.attempt === 1 && ev.correct && ev.hintsUsed === 0),
      ).length;
      return { conceptId: c.id, name: c.name, encounters: mine.length, firstTry };
    });
    const lines = this.spec.encounters.map((e) => ({
      encounterId: e.id,
      mechanic: getMechanic(e.mechanicId)?.name ?? e.mechanicId,
      text: e.debriefLine,
    }));
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
