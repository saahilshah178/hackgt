import { describe, expect, it } from "vitest";
import {
  DialogueEngine,
  ariaPolitenessFor,
  graphemes,
  preempts,
  toastDurationMs,
  typingMs,
  visibleChars,
} from "./engine";
import type { DialogueLine, Priority, SayRequest } from "./types";

function clock(start = 0) {
  let t = start;
  return { now: () => t, set: (v: number) => void (t = v), add: (dt: number) => void (t += dt) };
}
const ln = (id: string, text: string, kind: DialogueLine["kind"] = "line"): DialogueLine => ({ id, speakerId: "cog", text, kind, mood: "neutral" });
const req = (source: string, texts: string[], priority: Priority, over: Partial<SayRequest> = {}): SayRequest => ({
  lines: texts.map((t, i) => ln(`${source}:${i}`, t)),
  channel: "bar",
  priority,
  blocking: true,
  source,
  ...over,
});

describe("pure helpers", () => {
  it("types on at 45 cps", () => {
    const text = "a".repeat(90);
    expect(visibleChars(text, 0, 45)).toBe(0);
    expect(visibleChars(text, 1000, 45)).toBe(45);
    expect(visibleChars(text, 500, 45)).toBe(22);
    expect(visibleChars(text, 2000, 45)).toBe(90);
    expect(visibleChars(text, 99_999, 45)).toBe(90);
    expect(typingMs(text, 45)).toBe(2000);
  });

  it("is grapheme-safe: never splits emoji, flags or combining marks", () => {
    const text = "é👩‍🔬🇺🇸ok"; // é (2 units), scientist ZWJ (5 units), flag (4 units), o, k
    expect(graphemes(text)).toHaveLength(5);
    const cuts = [1, 2, 3, 4, 5].map((n) => visibleChars(text, (n * 1000) / 45, 45));
    expect(cuts).toEqual([2, 7, 11, 12, 13]);
    for (const c of cuts) {
      const head = text.slice(0, c);
      expect(graphemes(head).join("")).toBe(head);
      expect(text.startsWith(head)).toBe(true);
    }
  });

  it("shows everything at once for an infinite rate (reduced motion)", () => {
    expect(visibleChars("hello", 0, Number.POSITIVE_INFINITY)).toBe(5);
  });

  it("toast duration is max(min, words / 3.3 s)", () => {
    expect(toastDurationMs("two words", 2500)).toBe(2500);
    const long = Array.from({ length: 33 }, () => "w").join(" ");
    expect(toastDurationMs(long, 2500)).toBe(10_000);
  });

  it("priorities preempt strictly upward", () => {
    expect(preempts("critical", "instruction")).toBe(true);
    expect(preempts("instruction", "story")).toBe(true);
    expect(preempts("story", "ambient")).toBe(true);
    expect(preempts("story", "story")).toBe(false);
    expect(preempts("ambient", "critical")).toBe(false);
  });

  it("taunt, feedback and critical lines are assertive", () => {
    expect(ariaPolitenessFor(ln("a", "x", "taunt"), "story")).toBe("assertive");
    expect(ariaPolitenessFor(ln("a", "x", "feedback"), "story")).toBe("assertive");
    expect(ariaPolitenessFor(ln("a", "x", "line"), "critical")).toBe("assertive");
    expect(ariaPolitenessFor(ln("a", "x", "line"), "story")).toBe("polite");
  });
});

describe("DialogueEngine", () => {
  it("types, completes on advance, then moves to the next line; say resolves at the end", async () => {
    const c = clock();
    const e = new DialogueEngine({ now: c.now });
    let done = false;
    const p = e.say(req("cutscene:intro", ["Hello there.", "Wind me up."], "story")).then(() => void (done = true));
    let s = e.snapshot();
    expect(s.active?.line.text).toBe("Hello there.");
    expect(s.active?.typing).toBe(true);
    expect(s.blocking).toBe(true);
    expect(s.queued).toBe(1);
    c.set(100);
    e.tick(c.now());
    expect(e.snapshot().active?.visibleChars).toBe(4);
    e.advance(); // completes the typing
    s = e.snapshot();
    expect(s.active?.typing).toBe(false);
    expect(s.active?.visibleChars).toBe("Hello there.".length);
    e.advance(); // next line
    expect(e.snapshot().active?.line.text).toBe("Wind me up.");
    e.advance();
    e.advance();
    await p;
    expect(done).toBe(true);
    expect(e.snapshot().active).toBeNull();
    expect(e.snapshot().blocking).toBe(false);
  });

  it("blocking lines wait for advance; non-blocking lines and toasts auto-dismiss", () => {
    const c = clock();
    const e = new DialogueEngine({ now: c.now, minToastMs: 2500 });
    void e.say(req("npc:kay", ["Hi."], "story", { blocking: true }));
    c.set(60_000);
    e.tick(c.now());
    expect(e.snapshot().active?.line.text).toBe("Hi."); // still there
    e.advance();
    void e.say(req("trigger:t1", ["A toast."], "ambient", { channel: "toast", blocking: true }));
    expect(e.snapshot().blocking).toBe(false); // toasts never block
    c.add(1000);
    e.tick(c.now()); // typed (8 chars < 1 s)
    expect(e.snapshot().active?.typing).toBe(false);
    c.add(2499);
    e.tick(c.now());
    expect(e.snapshot().active).not.toBeNull();
    c.add(1);
    e.tick(c.now());
    expect(e.snapshot().active).toBeNull();
  });

  it("a higher priority interrupts; the interrupted line and its rest go back to the queue front", () => {
    const c = clock();
    const e = new DialogueEngine({ now: c.now });
    void e.say(req("npc:ida", ["One.", "Two."], "story"));
    void e.say(req("npc:otis", ["Later."], "story"));
    expect(e.snapshot().active?.line.text).toBe("One.");
    void e.say(req("station:e1", ["Now!"], "instruction"));
    expect(e.snapshot().active?.line.text).toBe("Now!");
    e.advance();
    e.advance();
    const order: string[] = [];
    while (e.snapshot().active) {
      order.push(e.snapshot().active!.line.text);
      e.advance();
      e.advance();
    }
    expect(order).toEqual(["One.", "Two.", "Later."]);
  });

  it("ambient lines are dropped when interrupted (their promise still resolves)", async () => {
    const c = clock();
    const e = new DialogueEngine({ now: c.now });
    const amb = e.say(req("trigger:a", ["Birds.", "Wind."], "ambient", { channel: "toast" }));
    void e.say(req("station:e1", ["Look."], "story"));
    await amb;
    expect(e.snapshot().active?.line.text).toBe("Look.");
    expect(e.snapshot().queued).toBe(0);
  });

  it("equal priority queues FIFO; lower priority queues behind", () => {
    const c = clock();
    const e = new DialogueEngine({ now: c.now });
    void e.say(req("a", ["A"], "instruction"));
    void e.say(req("b", ["B"], "story"));
    void e.say(req("c", ["C"], "instruction"));
    const order: string[] = [];
    while (e.snapshot().active) {
      order.push(e.snapshot().active!.line.text);
      e.advance();
      e.advance();
    }
    expect(order).toEqual(["A", "C", "B"]);
  });

  it("dedupes a replayed request by line id", async () => {
    const c = clock();
    const e = new DialogueEngine({ now: c.now });
    const p1 = e.say(req("station:e2:approach", ["Hm."], "story"));
    const p2 = e.say(req("station:e2:approach", ["Hm."], "story"));
    expect(e.snapshot().queued).toBe(0);
    let second = false;
    void p2.then(() => void (second = true));
    e.advance();
    e.advance();
    await p1;
    await p2;
    expect(second).toBe(true);
  });

  it("skipAll(source) removes only that source's lines and resolves them; skipAll() clears everything", async () => {
    const c = clock();
    const e = new DialogueEngine({ now: c.now });
    const intro = e.say(req("cutscene:intro", ["1", "2", "3"], "story"));
    void e.say(req("npc:x", ["other"], "story"));
    e.skipAll("cutscene:intro");
    await intro;
    expect(e.snapshot().active?.line.text).toBe("other");
    const rest = e.say(req("y", ["y"], "story"));
    e.skipAll();
    await rest;
    expect(e.snapshot().active).toBeNull();
    expect(e.snapshot().queued).toBe(0);
  });

  it("pins merge, clear, and never disturb the active line", () => {
    const c = clock();
    const e = new DialogueEngine({ now: c.now });
    e.pin({ primary: { kind: "instruction", text: "Rotate the ring.", speakerId: "cog" } });
    e.pin({ secondary: { kind: "tutorial", text: "Drag the knob." } });
    expect(e.snapshot().pinned.primary?.text).toBe("Rotate the ring.");
    expect(e.snapshot().pinned.secondary?.text).toBe("Drag the knob.");
    e.pin({ secondary: { kind: "feedback", text: "Too short." } });
    expect(e.snapshot().pinned.primary?.kind).toBe("instruction");
    expect(e.snapshot().pinned.secondary?.kind).toBe("feedback");
    e.clearPins();
    expect(e.snapshot().pinned).toEqual({ primary: null, secondary: null });
  });

  it("snapshots are stable between changes and versioned (useSyncExternalStore)", () => {
    const c = clock();
    const e = new DialogueEngine({ now: c.now });
    const s0 = e.snapshot();
    expect(e.snapshot()).toBe(s0);
    let calls = 0;
    const off = e.subscribe(() => calls++);
    void e.say(req("a", ["abc"], "story"));
    expect(calls).toBe(1);
    const s1 = e.snapshot();
    expect(s1).not.toBe(s0);
    expect(s1.version).toBeGreaterThan(s0.version);
    e.tick(0); // no visible change -> no notify
    expect(calls).toBe(1);
    off();
    e.advance();
    expect(calls).toBe(1);
  });

  it("instant mode (reduced motion) shows lines complete at once", () => {
    const c = clock();
    const e = new DialogueEngine({ now: c.now, instant: true });
    void e.say(req("a", ["All at once."], "story"));
    expect(e.snapshot().active?.typing).toBe(false);
    expect(e.snapshot().active?.visibleChars).toBe("All at once.".length);
  });

  it("pause freezes the typewriter clock", () => {
    const c = clock();
    const e = new DialogueEngine({ now: c.now });
    void e.say(req("a", ["x".repeat(90)], "story"));
    c.set(1000);
    e.tick(c.now());
    expect(e.snapshot().active?.visibleChars).toBe(45);
    e.setPaused(true);
    c.set(5000);
    e.tick(c.now());
    expect(e.snapshot().active?.visibleChars).toBe(45);
    e.setPaused(false);
    c.set(5500);
    e.tick(c.now());
    expect(e.snapshot().active?.visibleChars).toBe(67);
    expect(e.current()).toEqual({ speakerId: "cog", text: "x".repeat(90), typing: true });
  });
});
