/**
 * src/game/expedition/dialogue/engine.ts (S1) — the pure dialogue core (docs/design/20 §2.7). Tested in node;
 * React only renders it (DialogueBar.tsx via useSyncExternalStore).
 *
 * One stream of lines. Each `say()` request queues its lines by priority (critical > instruction > story > ambient,
 * FIFO within a priority). A higher-priority request interrupts: the interrupted line and its request's remaining
 * lines go back to the queue front, except ambient lines, which are dropped. Toasts never block. Non-blocking lines
 * auto-dismiss after `toastDurationMs`; blocking lines wait for `advance()`. Lines with an id already pending are
 * deduped (the new request waits for the pending one).
 */
import {
  DEFAULT_CPS,
  DEFAULT_MIN_TOAST_MS,
  PRIORITY_ORDER,
  type ActiveLine,
  type DialogueEngineApi,
  type DialogueEngineOptions,
  type DialogueLine,
  type DialogueSnapshot,
  type PinnedLines,
  type Priority,
  type SayRequest,
} from "./types";

// ---------------------------------------------------------------- pure helpers

type Segmenter = { segment(input: string): Iterable<{ segment: string }> };
let segmenter: Segmenter | null | undefined;
function getSegmenter(): Segmenter | null {
  if (segmenter !== undefined) return segmenter;
  const Ctor = (Intl as unknown as { Segmenter?: new (locale?: string, opts?: { granularity: "grapheme" }) => Segmenter }).Segmenter;
  segmenter = Ctor ? new Ctor(undefined, { granularity: "grapheme" }) : null;
  return segmenter;
}

/** The text's graphemes (user-perceived characters). Falls back to code points without Intl.Segmenter. */
export function graphemes(text: string): string[] {
  const seg = getSegmenter();
  if (!seg) return Array.from(text);
  const out: string[] = [];
  for (const s of seg.segment(text)) out.push(s.segment);
  return out;
}

/**
 * How much of `text` is visible after `elapsedMs` at `cps` graphemes per second, as a UTF-16 offset that always
 * lands on a grapheme boundary (so `text.slice(0, n)` never splits an emoji, a flag or a combining accent).
 * `cps` of Infinity (reduced motion) shows everything at once.
 */
export function visibleChars(text: string, elapsedMs: number, cps: number): number {
  if (!Number.isFinite(cps) || cps <= 0) return cps <= 0 ? 0 : text.length;
  const count = Math.max(0, Math.floor((Math.max(0, elapsedMs) * cps) / 1000 + 1e-9));
  if (count === 0) return 0;
  const gs = graphemes(text);
  if (count >= gs.length) return text.length;
  let offset = 0;
  for (let i = 0; i < count; i++) offset += gs[i].length;
  return offset;
}

/** ms needed to type the whole line at `cps`. */
export function typingMs(text: string, cps: number): number {
  if (!Number.isFinite(cps)) return 0;
  return Math.ceil((graphemes(text).length * 1000) / cps);
}

/** How long a finished non-blocking line stays: max(min, words / 3.3 per second). */
export function toastDurationMs(text: string, minMs: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(minMs, Math.round((words / 3.3) * 1000));
}

export function priorityRank(p: Priority): number {
  return PRIORITY_ORDER.indexOf(p);
}

/** critical > instruction > story > ambient; equal priorities never preempt. */
export function preempts(incoming: Priority, current: Priority): boolean {
  return priorityRank(incoming) > priorityRank(current);
}

/** Screen-reader politeness per line: critical, taunt and feedback lines are assertive (§2.7). */
export function ariaPolitenessFor(line: DialogueLine, priority: Priority): "polite" | "assertive" {
  if (priority === "critical") return "assertive";
  return line.kind === "taunt" || line.kind === "feedback" ? "assertive" : "polite";
}

// ---------------------------------------------------------------- engine

interface Ticket {
  pending: number;
  resolve: () => void;
}
interface Item {
  line: DialogueLine;
  request: SayRequest;
  tickets: Ticket[];
}
interface Active {
  item: Item;
  startedAt: number;
  visible: number;
  typing: boolean;
  completedAt: number | null;
}

export interface DialogueEngineConfig extends DialogueEngineOptions {
  /** reduced motion: every line appears complete (typewriter off) */
  instant?: boolean;
}

const EMPTY_PINS: PinnedLines = { primary: null, secondary: null };

export class DialogueEngine implements DialogueEngineApi {
  private readonly cps: number;
  private readonly minToastMs: number;
  private readonly now: () => number;
  private instant: boolean;
  private queue: Item[] = [];
  private active: Active | null = null;
  private pins: PinnedLines = EMPTY_PINS;
  private version = 0;
  private cached: DialogueSnapshot | null = null;
  private listeners = new Set<() => void>();
  private pausedAt: number | null = null;

  constructor(opts: DialogueEngineConfig) {
    this.cps = opts.cps ?? DEFAULT_CPS;
    this.minToastMs = opts.minToastMs ?? DEFAULT_MIN_TOAST_MS;
    this.now = opts.now;
    this.instant = opts.instant ?? false;
  }

  // -------------------------------------------------------------- public API

  say(req: SayRequest): Promise<void> {
    const request: SayRequest = req.channel === "toast" && req.blocking ? { ...req, blocking: false } : req;
    return new Promise<void>((resolve) => {
      const ticket: Ticket = { pending: 0, resolve };
      const fresh: Item[] = [];
      for (const line of request.lines) {
        const existing = this.findPending(line.id);
        if (existing) {
          existing.tickets.push(ticket);
          ticket.pending++;
        } else {
          fresh.push({ line, request, tickets: [ticket] });
          ticket.pending++;
        }
      }
      if (ticket.pending === 0) {
        resolve();
        return;
      }
      if (fresh.length === 0) return; // waits on the pending duplicates
      const cur = this.active;
      if (cur && preempts(request.priority, cur.item.request.priority)) {
        this.interrupt();
        this.queue.unshift(...fresh);
      } else {
        this.insert(fresh);
      }
      if (!this.active) this.startNext();
      this.changed();
    });
  }

  advance(): void {
    const a = this.active;
    if (!a) return;
    if (a.typing) {
      a.visible = a.item.line.text.length;
      a.typing = false;
      a.completedAt = this.now();
    } else {
      this.finish(a.item);
      this.active = null;
      this.startNext();
    }
    this.changed();
  }

  skipAll(source?: string): void {
    const match = (it: Item) => source === undefined || it.request.source === source;
    const dropped = this.queue.filter(match);
    this.queue = this.queue.filter((it) => !match(it));
    let activeDropped = false;
    if (this.active && match(this.active.item)) {
      dropped.unshift(this.active.item);
      this.active = null;
      activeDropped = true;
    }
    if (dropped.length === 0) return;
    for (const it of dropped) this.finish(it);
    if (activeDropped) this.startNext();
    this.changed();
  }

  pin(p: Partial<PinnedLines>): void {
    this.pins = { ...this.pins, ...p };
    this.changed();
  }

  clearPins(): void {
    if (this.pins.primary === null && this.pins.secondary === null) return;
    this.pins = EMPTY_PINS;
    this.changed();
  }

  tick(now: number): void {
    if (this.pausedAt !== null) return;
    const a = this.active;
    if (!a) return;
    let dirty = false;
    if (a.typing) {
      const v = this.instant ? a.item.line.text.length : visibleChars(a.item.line.text, now - a.startedAt, this.cps);
      if (v !== a.visible) {
        a.visible = v;
        dirty = true;
      }
      if (v >= a.item.line.text.length) {
        a.typing = false;
        a.completedAt = now;
        dirty = true;
      }
    }
    if (!a.typing && a.completedAt !== null && !a.item.request.blocking) {
      if (now - a.completedAt >= toastDurationMs(a.item.line.text, this.minToastMs)) {
        this.finish(a.item);
        this.active = null;
        this.startNext(now);
        dirty = true;
      }
    }
    if (dirty) this.changed();
  }

  snapshot(): DialogueSnapshot {
    if (this.cached && this.cached.version === this.version) return this.cached;
    const a = this.active;
    const active: ActiveLine | null = a
      ? { line: a.item.line, request: a.item.request, startedAt: a.startedAt, visibleChars: a.visible, typing: a.typing }
      : null;
    this.cached = {
      active,
      pinned: this.pins,
      queued: this.queue.length,
      blocking: a !== null && a.item.request.blocking,
      version: this.version,
    };
    return this.cached;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  // -------------------------------------------------------------- extras (debug, reduced motion)

  /** `__GAME_DEBUG__.expedition.dialogue()` */
  current(): { speakerId: string; text: string; typing: boolean } | null {
    const a = this.active;
    return a ? { speakerId: a.item.line.speakerId, text: a.item.line.text, typing: a.typing } : null;
  }

  /** Pending lines (active + queued) of a source, for tests and debug. */
  pendingFor(source: string): number {
    return this.queue.filter((it) => it.request.source === source).length + (this.active?.item.request.source === source ? 1 : 0);
  }

  /** Reduced motion toggles instant lines; a typing line completes at once. */
  setInstant(on: boolean): void {
    this.instant = on;
    if (on && this.active?.typing) {
      this.active.visible = this.active.item.line.text.length;
      this.active.typing = false;
      this.active.completedAt = this.now();
      this.changed();
    }
  }

  /** `__GAME_DEBUG__.expedition.freeze`: pause the typewriter and toast clocks; resume shifts them. */
  setPaused(on: boolean): void {
    if (on) {
      if (this.pausedAt === null) this.pausedAt = this.now();
      return;
    }
    if (this.pausedAt === null) return;
    const dt = this.now() - this.pausedAt;
    this.pausedAt = null;
    if (this.active) {
      this.active.startedAt += dt;
      if (this.active.completedAt !== null) this.active.completedAt += dt;
    }
  }

  // -------------------------------------------------------------- internals

  private findPending(id: string): Item | null {
    if (this.active && this.active.item.line.id === id) return this.active.item;
    return this.queue.find((it) => it.line.id === id) ?? null;
  }

  /** Inserts after every queued item of equal or higher priority (FIFO within a priority). */
  private insert(items: Item[]): void {
    const rank = priorityRank(items[0].request.priority);
    let at = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityRank(this.queue[i].request.priority) < rank) {
        at = i;
        break;
      }
    }
    this.queue.splice(at, 0, ...items);
  }

  /** The active line yields: back to the queue front (it restarts), or dropped with its request if ambient. */
  private interrupt(): void {
    const a = this.active;
    if (!a) return;
    this.active = null;
    if (a.item.request.priority === "ambient") {
      const req = a.item.request;
      const rest = this.queue.filter((it) => it.request === req);
      this.queue = this.queue.filter((it) => it.request !== req);
      this.finish(a.item);
      for (const it of rest) this.finish(it);
    } else {
      this.queue.unshift(a.item);
    }
  }

  private startNext(at?: number): void {
    const next = this.queue.shift();
    if (!next) {
      this.active = null;
      return;
    }
    const now = at ?? this.now();
    const full = this.instant || !Number.isFinite(this.cps) || next.line.text.length === 0;
    this.active = {
      item: next,
      startedAt: now,
      visible: full ? next.line.text.length : 0,
      typing: !full,
      completedAt: full ? now : null,
    };
  }

  private finish(it: Item): void {
    for (const t of it.tickets) {
      t.pending--;
      if (t.pending === 0) t.resolve();
    }
    it.tickets = [];
  }

  private changed(): void {
    this.version++;
    for (const fn of [...this.listeners]) fn();
  }
}
