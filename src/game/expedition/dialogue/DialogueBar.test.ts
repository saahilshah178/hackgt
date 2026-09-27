import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SpeakerDirectory, SpeakerInfo } from "../../../world/types";
import { DialogueBar } from "./DialogueBar";
import { DialogueEngine } from "./engine";
import type { SayRequest } from "./types";

const cog: SpeakerInfo = {
  id: "cog",
  name: "Cog",
  role: "guide",
  voiceArchetype: null,
  emblem: { glyph: "owl", ring: "#9FE6F2", accent: "#E2892C", gaps: 2 },
  portrait: null,
  kind: "character",
};
const warden: SpeakerInfo = { ...cog, id: "warden", name: "The Warden", emblem: null };
const speakers: SpeakerDirectory = new Map([
  ["cog", cog],
  ["warden", warden],
  ["narrator", { ...cog, id: "narrator", name: "Narrator", emblem: null, kind: "narrator" }],
]);
const say = (text: string, over: Partial<SayRequest> = {}, kind: SayRequest["lines"][number]["kind"] = "line", speakerId = "cog"): SayRequest => ({
  lines: [{ id: `t:${text}`, speakerId, text, kind, mood: "neutral" }],
  channel: "bar",
  priority: "story",
  blocking: true,
  source: "t",
  ...over,
});
const render = (engine: DialogueEngine, layout: Parameters<typeof DialogueBar>[0]["layout"], extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(DialogueBar, { engine, speakers, guideId: "cog", layout, onHint: () => undefined, onBrief: () => undefined, ...extra }));

describe("DialogueBar (server render)", () => {
  it("renders the speaker, the emblem, the typed prefix aria-hidden and the FULL line in a polite live region", () => {
    let t = 0;
    const e = new DialogueEngine({ now: () => t });
    void e.say(say("Wind me up, friend."));
    t = 100;
    e.tick(t);
    const html = render(e, "explore");
    expect(html).toContain('data-testid="dialogue-bar"');
    expect(html).toContain(">Cog<");
    expect(html).toContain('data-glyph="owl"');
    expect(html).toMatch(/aria-live="polite"[^>]*>Cog: Wind me up, friend\.</);
    expect(html).toMatch(/aria-hidden="true" data-testid="dialogue-text"[^>]*>Wind<span/); // 4 graphemes typed
    expect(html).toContain('data-state="typing"');
  });

  it("taunts go to the assertive region; unknown-emblem speakers are desaturated", () => {
    const e = new DialogueEngine({ now: () => 0, instant: true });
    void e.say(say("You again?", { priority: "instruction" }, "taunt", "warden"));
    const html = render(e, "board");
    expect(html).toMatch(/aria-live="assertive"[^>]*>The Warden: You again\?</);
    expect(html).toContain("grayscale");
  });

  it("while the panel is open: directions stay out of the bar", () => {
    const e = new DialogueEngine({ now: () => 0 });
    e.pin({ primary: { kind: "instruction", text: "Tune the latch timer.", speakerId: "cog" }, secondary: { kind: "tutorial", text: "Drag the knob." } });
    const html = render(e, "scrub", { hintLabel: "Hint (0 of 3 used)" });
    expect(html).not.toContain("Tune the latch timer.");
    expect(html).not.toContain("Drag the knob.");
    expect(html).not.toContain('data-testid="hint-button"');
    expect(html).toContain('role="group"');
  });

  it("feedback pins are announced assertively", () => {
    const e = new DialogueEngine({ now: () => 0 });
    e.pin({ primary: { kind: "instruction", text: "Tune it.", speakerId: "cog" }, secondary: { kind: "feedback", text: "Too long a wait." } });
    const html = render(e, "scrub");
    expect(html).toMatch(/aria-live="assertive"[^>]*>Too long a wait\.</);
  });

  it("toasts render as the bottom strip in explore; narrator lines use the caption style without a name", () => {
    const e = new DialogueEngine({ now: () => 0, instant: true });
    void e.say(say("The owl creaks.", { channel: "toast", blocking: false }, "narration", "narrator"));
    const html = render(e, "explore");
    expect(html).toContain('data-state="toast"');
    expect(html).toContain('data-testid="dialogue-toast"');
    expect(html).not.toContain("Narrator:");
    expect(html).toMatch(/aria-live="polite"[^>]*>The owl creaks\.</);
  });

  it("renders nothing visible (only the live regions) when idle in explore", () => {
    const html = render(new DialogueEngine({ now: () => 0 }), "explore");
    expect(html).toContain('data-state="idle"');
    expect(html).not.toContain("hint-button");
  });
});
