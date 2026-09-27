import type { Encounter, GameSpec } from "../../contracts/gamespec";
import type { TeachingMechanic } from "../../contracts/library";
import { emptyMastery, updateMastery, type MasteryState, type TelemetryEvent } from "../../contracts/telemetry";
import { getCard } from "../../library";
import { getMode } from "../../mechanics/registry";
import type { AnyFamilyMode, Grade } from "../../mechanics/types";
import { buildProgression, prerequisitesOf, unlockedIds, type Progression } from "./progression";

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

/** "linear": the spec order, one encounter at a time (side-view hosts). "free": any unlocked encounter (board hosts). */
export type RunnerOrder = "linear" | "free";

export interface RunnerOptions {
  now?: () => number;
  onEvent?: (e: TelemetryEvent) => void;
  /** default "linear" */
  order?: RunnerOrder;
}

/**
 * The game logic, with no Phaser in it. A genre host (Phaser scene) owns movement and art:
 * when the player reaches a socket it calls current(), renders the widget from `view`,
 * sends the player's answer to submit(), and animates the result. Because this class is pure
 * logic, it runs headless in tests and powers window.__GAME_DEBUG__ (skipTo, autoSolve).
 *
 * In "free" order (board genres: mystery, puzzle, strategy, explorer, story) the player picks among the unlocked
 * encounters of the progression graph (./progression.ts): `available()` lists them, `focus(id)` opens one, and
 * `current()` is the focused encounter (or the first unlocked one). Attempts and hints are counted per encounter,
 * so switching away and back never resets a first-try.
 */
export class EncounterRunner {
  readonly order: RunnerOrder;
  readonly progression: Progression;
  private index = 0;
  private focusId: string | null = null;
  private readonly solvedIds = new Set<string>();
  private readonly attemptsById = new Map<string, number>();
  private readonly hintsById = new Map<string, number>();
  private readonly startedById = new Map<string, number>();
  private readonly events: TelemetryEvent[] = [];
  private masteryState: MasteryState;

  constructor(
    readonly spec: GameSpec,
    private readonly opts: RunnerOptions = {},
  ) {
    this.order = opts.order ?? "linear";
    this.progression = buildProgression(spec);
    this.masteryState = emptyMastery(
      spec.concepts.map((c) => c.id),
      spec.mastery,
    );
    const first = spec.encounters[0];
    if (first) this.startedById.set(first.id, this.now());
  }

  private now() {
    return this.opts.now?.() ?? Date.now();
  }

  get finished(): boolean {
    if (this.order === "free") return this.solvedIds.size >= this.spec.encounters.length;
    return this.index >= this.spec.encounters.length;
  }

  /** Encounter ids solved so far. */
  solved(): ReadonlySet<string> {
    return this.solvedIds;
  }

  /** Encounters the player may open now: the unlocked ones (free), or just the current one (linear). */
  available(): string[] {
    if (this.finished) return [];
    if (this.order === "free") return unlockedIds(this.progression, this.solvedIds);
    return [this.spec.encounters[this.index].id];
  }

  /** The encounter the player explicitly opened (free order), or null. */
  get focused(): string | null {
    return this.focusId;
  }

  /** Free order: open an unlocked encounter. Throws if it is locked, solved or unknown (hosts only offer available()). */
  focus(encounterId: string): void {
    if (this.order !== "free") throw new Error("focus() is only for free-order runners");
    if (!this.available().includes(encounterId)) throw new Error(`encounter "${encounterId}" is not available`);
    this.focusId = encounterId;
    if (!this.startedById.has(encounterId)) this.startedById.set(encounterId, this.now());
  }

  /** Free order: close the focused encounter without answering (counters are kept). */
  unfocus(): void {
    this.focusId = null;
  }

  private currentIndex(): number {
    if (this.order === "linear") return this.index;
    const id = this.focusId ?? this.available()[0];
    return this.spec.encounters.findIndex((e) => e.id === id);
  }

  current(): Current | null {
    if (this.finished) return null;
    const index = this.currentIndex();
    const encounter = this.spec.encounters[index];
    const mode = getMode(encounter.familyId, encounter.mode);
    if (!mode) throw new Error(`no mode "${encounter.familyId}.${encounter.mode}"; validate specs before playing them`);
    return {
      index,
      encounter,
      mode,
      card: getCard(encounter.teachingMechanicId),
      view: mode.present(encounter.params, this.spec.seed + index),
      before: this.spec.narrative.beats.filter((b) => b.encounterId === encounter.id && b.when === "before"),
      after: this.spec.narrative.beats.filter((b) => b.encounterId === encounter.id && b.when === "after"),
    };
  }

  /** The Current for any encounter (free-order hosts preview locked or solved ones); null for an unknown id. */
  peek(encounterId: string): Current | null {
    const index = this.spec.encounters.findIndex((e) => e.id === encounterId);
    if (index === -1) return null;
    const encounter = this.spec.encounters[index];
    const mode = getMode(encounter.familyId, encounter.mode);
    if (!mode) return null;
    return {
      index,
      encounter,
      mode,
      card: getCard(encounter.teachingMechanicId),
      view: mode.present(encounter.params, this.spec.seed + index),
      before: this.spec.narrative.beats.filter((b) => b.encounterId === encounter.id && b.when === "before"),
      after: this.spec.narrative.beats.filter((b) => b.encounterId === encounter.id && b.when === "after"),
    };
  }

  /** Next rung of the hint ladder, or null when all three are used. */
  hint(): string | null {
    const cur = this.current();
    if (!cur) return null;
    const used = this.hintsById.get(cur.encounter.id) ?? 0;
    if (used >= cur.encounter.hints.length) return null;
    this.hintsById.set(cur.encounter.id, used + 1);
    return cur.encounter.hints[used];
  }

  get hintsUsedOnCurrent(): number {
    const cur = this.finished ? null : this.spec.encounters[this.currentIndex()];
    return cur ? (this.hintsById.get(cur.id) ?? 0) : 0;
  }

  /** Hints used on any encounter. */
  hintsUsedOn(encounterId: string): number {
    return this.hintsById.get(encounterId) ?? 0;
  }

  /** Graded attempts on any encounter. */
  attemptsOn(encounterId: string): number {
    return this.attemptsById.get(encounterId) ?? 0;
  }

  submit(input: unknown): Grade & { advanced: boolean } {
    const cur = this.current();
    if (!cur) throw new Error("game is finished");
    const id = cur.encounter.id;
    const attempt = (this.attemptsById.get(id) ?? 0) + 1;
    this.attemptsById.set(id, attempt);
    const g = cur.mode.grade(cur.encounter.params, input);
    const t = this.now();
    const startedAt = this.startedById.get(id) ?? t;
    const event: TelemetryEvent = {
      gameId: this.spec.id,
      encounterId: id,
      conceptIds: cur.encounter.conceptIds,
      teachingMechanicId: cur.encounter.teachingMechanicId,
      attempt,
      correct: g.correct,
      hintsUsed: this.hintsById.get(id) ?? 0,
      ms: Math.max(0, t - startedAt),
      at: new Date(t).toISOString(),
    };
    this.events.push(event);
    this.masteryState = updateMastery(this.masteryState, event, this.spec.mastery);
    this.opts.onEvent?.(event);
    if (g.correct) this.advance(id);
    return { ...g, advanced: g.correct };
  }

  /** Debug/test hook: answers the current encounter correctly using the mode's own solver. */
  autoSolve(): Grade & { advanced: boolean } {
    const cur = this.current();
    if (!cur) throw new Error("game is finished");
    const solution = cur.mode.resolve(cur.encounter.params);
    return this.submit(cur.mode.solutionInput(cur.encounter.params, solution));
  }

  /**
   * Linear: jump to an encounter. Free: mark its prerequisites solved (no telemetry) and focus it. Either way the
   * target's attempt and hint counters restart.
   */
  skipTo(encounterId: string): void {
    const i = this.spec.encounters.findIndex((e) => e.id === encounterId);
    if (i === -1) throw new Error(`no encounter "${encounterId}"`);
    this.resetCounters(encounterId);
    if (this.order === "linear") {
      this.index = i;
      for (const e of this.spec.encounters.slice(0, i)) this.solvedIds.add(e.id);
      for (const e of this.spec.encounters.slice(i)) this.solvedIds.delete(e.id);
      return;
    }
    this.solvedIds.delete(encounterId);
    for (const r of prerequisitesOf(this.progression, encounterId)) this.solvedIds.add(r);
    this.focusId = encounterId;
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

  private advance(solvedId: string) {
    this.solvedIds.add(solvedId);
    if (this.order === "linear") {
      this.index++;
      const next = this.spec.encounters[this.index];
      if (next) this.resetCounters(next.id);
      return;
    }
    this.focusId = null;
  }

  private resetCounters(encounterId: string) {
    this.attemptsById.delete(encounterId);
    this.hintsById.delete(encounterId);
    this.startedById.set(encounterId, this.now());
  }
}
