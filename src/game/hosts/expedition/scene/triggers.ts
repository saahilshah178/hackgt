/**
 * src/game/hosts/expedition/scene/triggers.ts (S1, pure) — world triggers (docs/design/20 §2.4.5, amendment 15).
 *
 * A trigger fires when the player is within `radius` on its surface in its zone, its `requires` holds, and (if
 * `once`) it has not fired. Repeatable triggers latch while the player stays inside and re-arm on leaving, so they
 * fire once per entry, never per frame. `ambient` lines are non-blocking toasts, `arrival` lines are bar lines at
 * story priority, `hint` lines toast after 20 s of idle inside the radius. `setFlag` and `cue` apply when it fires;
 * a `cutsceneId` then plays (phase `cutscene`, purpose `trigger`). Express mode disables `ambient` and `hint`.
 */
import type { Trigger } from "../../../../contracts/world";
import { requirementMet } from "../../../../world/state/requirements";
import type { WorldState, WorldStateEvent } from "../../../../world/types";
import { sayRequest } from "../../../expedition/dialogue/lines";
import type { SayRequest } from "../../../expedition/dialogue/types";

export const HINT_IDLE_MS = 20_000;

export interface PlayerPos {
  zoneId: string;
  x: number;
  surface: string;
}

export interface TriggerOptions {
  /** ms since the player's last input (hint triggers need ≥ 20 s inside the radius) */
  idleMs?: number;
  /** express mode: ambient and hint triggers are off */
  express?: boolean;
  /** repeatable triggers already fired during the current stay (from `stepTriggers`) */
  latched?: ReadonlySet<string>;
}

/** The player is inside the trigger's radius on its surface in its zone. */
export function insideTrigger(t: Trigger, pos: PlayerPos): boolean {
  return t.zoneId === pos.zoneId && t.surface === pos.surface && Math.abs(pos.x - t.x) <= t.radius;
}

/** Triggers that fire this frame (stateless apart from `opts.latched`). */
export function firingTriggers(
  triggers: readonly Trigger[],
  pos: PlayerPos,
  worldState: WorldState,
  solvedIds: ReadonlySet<string>,
  opts: TriggerOptions = {},
): Trigger[] {
  const ctx = { solvedIds, state: worldState };
  const out: Trigger[] = [];
  for (const t of triggers) {
    if (opts.express && (t.kind === "ambient" || t.kind === "hint")) continue;
    if (!insideTrigger(t, pos)) continue;
    if (t.once && worldState.fired.has(t.id)) continue;
    if (!t.once && opts.latched?.has(t.id)) continue;
    if (t.kind === "hint" && (opts.idleMs ?? 0) < HINT_IDLE_MS) continue;
    if (!requirementMet(t.requires, ctx)) continue;
    out.push(t);
  }
  return out;
}

/** Latch state for repeatable triggers (the host keeps it in the scene; pure). */
export interface TriggerTracker {
  latched: ReadonlySet<string>;
}
export const emptyTriggerTracker = (): TriggerTracker => ({ latched: new Set() });

/**
 * One frame: which triggers fire, and the new latch set (a repeatable trigger stays latched while the player is
 * inside it and re-arms on leaving).
 */
export function stepTriggers(
  tracker: TriggerTracker,
  triggers: readonly Trigger[],
  pos: PlayerPos,
  worldState: WorldState,
  solvedIds: ReadonlySet<string>,
  opts: Omit<TriggerOptions, "latched"> = {},
): { tracker: TriggerTracker; fire: Trigger[] } {
  const fire = firingTriggers(triggers, pos, worldState, solvedIds, { ...opts, latched: tracker.latched });
  let changed = false;
  const latched = new Set<string>();
  for (const id of tracker.latched) {
    const t = triggers.find((x) => x.id === id);
    if (t && insideTrigger(t, pos)) latched.add(id);
    else changed = true;
  }
  for (const t of fire) {
    if (!t.once && !latched.has(t.id)) {
      latched.add(t.id);
      changed = true;
    }
  }
  return { tracker: changed ? { latched } : tracker, fire };
}

export interface TriggerEffects {
  /** apply to the world state: `trigger` (always), then `flag` when `setFlag` */
  events: WorldStateEvent[];
  /** hand to the dialogue engine */
  say: SayRequest | null;
  /** hand to the audio bus */
  cue: string | null;
  /** play after the lines are queued (phase cutscene, purpose "trigger") */
  cutsceneId: string | null;
}

/** What a fired trigger does. `guideId` resolves nothing here (WorldLines carry speakers) but keeps lines uniform. */
export function triggerEffects(t: Trigger, guideId: string): TriggerEffects {
  const events: WorldStateEvent[] = [{ type: "trigger", id: t.id }];
  if (t.setFlag) events.push({ type: "flag", id: t.setFlag, on: true });
  const source = `trigger:${t.id}`;
  const say =
    t.kind === "arrival"
      ? sayRequest(source, t.lines, "arrival", guideId, { channel: "bar", priority: "story" })
      : t.kind === "hint"
        ? sayRequest(source, t.lines, "hint", guideId, { channel: "toast", priority: "story" })
        : sayRequest(source, t.lines, "ambient", guideId, { channel: "toast", priority: "ambient" });
  return { events, say, cue: t.cue, cutsceneId: t.cutsceneId };
}
