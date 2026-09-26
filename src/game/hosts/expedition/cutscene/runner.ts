/**
 * src/game/hosts/expedition/cutscene/runner.ts (S1) — executes a cutscene's steps against the scene's
 * `CutsceneStage` (bridge.ts; H1 implements the verbs), one at a time (docs/design/20 §2.8).
 *
 * - `skip()` (Esc, the Skip button, express trim) cancels the running step, drops the cutscene's pending lines and
 *   applies `endState` at once. Non-skippable cutscenes ignore it.
 * - `cancel()` (`warpTo`, `skipTo`, `autoSolve`, DEBUG_SYNC) stops without applying anything.
 * - Express (`trim: true`): after the first `say` completes, the rest is skipped (the finale is run untrimmed).
 * Written against interfaces only (no Phaser import), so it runs in node tests with a fake stage.
 */
import type { Cutscene, CutsceneStep } from "../../../../contracts/world";
import { NARRATOR_SPEAKER } from "../../../../contracts/world";
import { toDialogueLine } from "../../../expedition/dialogue/lines";
import type { SayRequest } from "../../../expedition/dialogue/types";
import type { CutsceneEndState, CutsceneStage } from "../bridge";
import { endState, type PlayerStart } from "./timeline";

export type RunResult = "done" | "skipped" | "cancelled";

export interface CutsceneRunnerDeps {
  stage: CutsceneStage;
  /** the dialogue engine's `say` (its promise resolves when the last line is dismissed) */
  say(req: SayRequest): Promise<void> | void;
  /** the dialogue engine's `skipAll(source)` */
  skipDialogue?(source: string): void;
  /** world-state flag events for `set_state {kind: "flag"}` (the client's reducer) */
  onFlag?(id: string, on: boolean): void;
  /** step start / end (phase bookkeeping, debug) */
  onStep?(cutsceneId: string, index: number, step: CutsceneStep): void;
  /** timer for `wait`; default setTimeout */
  wait?(ms: number): Promise<void>;
  /** the guide's speaker id (unused by WorldLines, kept for uniform line conversion) */
  guideId?: string;
}

export interface RunOptions {
  /** where the player stands when the cutscene starts (endState needs it for player walks) */
  start?: PlayerStart | null;
  /** express trim: skip everything after the first completed `say` */
  trim?: boolean;
}

export const cutsceneSource = (id: string) => `cutscene:${id}`;

/** A cutscene `say` step → a blocking bar request (narrator lines are narration). Ids carry the step index. */
export function cutsceneSay(cutsceneId: string, stepIndex: number, step: Extract<CutsceneStep, { do: "say" }>, guideId = "narrator"): SayRequest {
  const source = cutsceneSource(cutsceneId);
  return {
    lines: step.lines.map((l, i) =>
      toDialogueLine(l, `${source}:${stepIndex}:${i}`, l.speakerId === NARRATOR_SPEAKER ? "narration" : "line", guideId),
    ),
    channel: "bar",
    priority: "story",
    blocking: true,
    source,
  };
}

type Interrupt = "skip" | "cancel";
interface Running {
  cutscene: Cutscene;
  start: PlayerStart | null;
  interrupt: (why: Interrupt) => void;
  interrupted: Promise<Interrupt>;
  index: number;
}

const defaultWait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class CutsceneRunner {
  private cur: Running | null = null;

  constructor(private readonly deps: CutsceneRunnerDeps) {}

  /** The running cutscene's id (debug: `ExpeditionHostDebug.cutscene`). */
  get running(): string | null {
    return this.cur?.cutscene.id ?? null;
  }

  get stepIndex(): number | null {
    return this.cur?.index ?? null;
  }

  /** Runs a cutscene to its end. A cutscene already running is cancelled first. */
  async run(c: Cutscene, opts: RunOptions = {}): Promise<RunResult> {
    if (this.cur) this.cancel();
    let interrupt!: (why: Interrupt) => void;
    const interrupted = new Promise<Interrupt>((r) => (interrupt = r));
    const me: Running = { cutscene: c, start: opts.start ?? null, interrupt, interrupted, index: 0 };
    this.cur = me;
    try {
      for (let i = 0; i < c.steps.length; i++) {
        me.index = i;
        const step = c.steps[i];
        this.deps.onStep?.(c.id, i, step);
        const outcome = await Promise.race([this.exec(c, i, step).then(() => null), interrupted]);
        if (this.cur !== me) return "cancelled";
        if (outcome === "cancel") return this.finishCancel(me);
        if (outcome === "skip") return this.finishSkip(me);
        if (opts.trim && step.do === "say" && i < c.steps.length - 1) return this.finishSkip(me);
      }
      return "done";
    } finally {
      if (this.cur === me) this.cur = null;
    }
  }

  /** Esc / Skip button / express: jump to the end state. Ignored when nothing runs or the cutscene is not skippable. */
  skip(): void {
    if (!this.cur || !this.cur.cutscene.skippable) return;
    this.cur.interrupt("skip");
  }

  /** warpTo / skipTo / autoSolve / DEBUG_SYNC: stop without applying the end state. */
  cancel(): void {
    const me = this.cur;
    if (!me) return;
    me.interrupt("cancel");
    this.deps.skipDialogue?.(cutsceneSource(me.cutscene.id));
    this.cur = null;
  }

  // -------------------------------------------------------------- internals

  private finishCancel(me: Running): RunResult {
    this.deps.skipDialogue?.(cutsceneSource(me.cutscene.id));
    return "cancelled";
  }

  private finishSkip(me: Running): RunResult {
    this.deps.skipDialogue?.(cutsceneSource(me.cutscene.id));
    const end: CutsceneEndState = endState(me.cutscene, me.start);
    this.deps.stage.applyEndState(end);
    for (const [id, on] of Object.entries(end.flags)) this.deps.onFlag?.(id, on);
    return "skipped";
  }

  private async exec(c: Cutscene, index: number, step: CutsceneStep): Promise<void> {
    const s = this.deps.stage;
    switch (step.do) {
      case "fade":
        return s.fade(step.to, step.ms);
      case "title":
        return s.title(step.text, step.sub, step.ms);
      case "enter_zone":
        return s.enterZone(step.zoneId, step.x, step.surface);
      case "pan":
        return s.pan(step.x, step.y, step.zoom, step.ms);
      case "camera":
        return s.camera(step.x, step.y, step.zoom, step.ms, step.ease);
      case "walk":
        return s.walk(step.actor, step.toX);
      case "say":
        await this.deps.say(cutsceneSay(c.id, index, step, this.deps.guideId));
        return;
      case "emote":
        s.emote(step.actor, step.glyph);
        return;
      case "wait":
        return (this.deps.wait ?? defaultWait)(step.ms);
      case "station":
        return s.station(step.encounterId, step.anim);
      case "hub":
        return s.hub(step.zoneId, step.state);
      case "ride":
        return s.ride({ vehicle: step.vehicle, toZoneId: step.toZoneId, toX: step.toX, toSurface: step.toSurface, ms: step.ms, path: step.path });
      case "sfx":
        s.sfx(step.cue);
        return;
      case "music":
        s.music(step.cue);
        return;
      case "await_interact":
        return s.awaitInteract(step.target, step.prompt, step.timeoutMs);
      case "control_until":
        return s.controlUntil(step.x, step.surface, step.prompt, step.timeoutMs);
      case "vista":
        return s.vista(step.asset, step.from, step.to, step.ms, step.holdMs);
      case "set_state":
        s.setState(step.target, step.state);
        if (step.target.kind === "flag") this.deps.onFlag?.(step.target.id, step.state === "on");
        return;
    }
  }
}
