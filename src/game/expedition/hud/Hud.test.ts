import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Story } from "../../../contracts/world";
import { AudioBus } from "../audio/bus";
import { Hud } from "./Hud";
import { TitleCard } from "./TitleCard";
import { TouchPad } from "./TouchPad";

const story = Story.parse({
  logline: "Wake the orrery.",
  objective: "Restore the orrery's starlight",
  objectiveLabel: "RHYTHMS",
  restoredNoun: "rhythm",
  introCutsceneId: "intro",
  finaleCutsceneId: "finale",
  meter: { id: "gradient", label: "GRADIENT", unit: "percent", start: 10, perEncounter: [{ encounterId: "e1", value: 40 }] },
});
const stations = [
  { encounterId: "e1", zoneId: "z1" },
  { encounterId: "e2", zoneId: "z1" },
  { encounterId: "e3", zoneId: "z2" },
];

describe("Hud (server render)", () => {
  it("renders the zone <h1>, the ring with its SR summary, the objective line, meter and mute toggle", () => {
    const bus = new AudioBus({ enabled: false, storage: null });
    const html = renderToStaticMarkup(
      createElement(Hud, { story, zone: { id: "z1", name: "Sunward Terrace" }, stations, solvedIds: ["e1"], bus }),
    );
    expect(html).toMatch(/<h1[^>]*data-testid="zone-title"[^>]*>Sunward Terrace<\/h1>/);
    expect(html).toContain('data-testid="objective-ring"');
    expect(html).toContain("Restore the orrery&#x27;s starlight · 1 of 2 rhythms");
    expect(html).toContain(">RHYTHMS 1/2<");
    expect(html).toContain('data-testid="meter"');
    expect(html).toContain('aria-valuenow="40"');
    expect(html).toContain('data-testid="mute-toggle"');
    expect(html).toContain('aria-label="Sound is off"');
    expect(html).not.toContain('data-testid="counters"');
  });

  it("shows counters after a pickup; the ring is a button only when a map exists", () => {
    const withMap = Story.parse({
      ...story,
      map: {
        style: "terraces_profile",
        title: "Orrery Map",
        nodes: [
          { id: "a", label: "A", zoneId: "z1", at: [0.1, 0.1] },
          { id: "b", label: "B", zoneId: "z2", at: [0.5, 0.5] },
        ],
        tabs: ["map"],
      },
    });
    const html = renderToStaticMarkup(
      createElement(Hud, {
        story: withMap,
        zone: { id: "z1", name: "Sunward Terrace" },
        stations,
        solvedIds: [],
        bus: null,
        collectibles: [
          { id: "p1", kind: "page" },
          { id: "p2", kind: "page" },
        ],
        collected: new Set(["p1"]),
        onOpenMap: () => undefined,
      }),
    );
    expect(html).toContain(">Pages 1/2<");
    expect(html).toMatch(/<button[^>]*data-testid="objective-ring"/);
  });

  it("title card and touch pad", () => {
    expect(renderToStaticMarkup(createElement(TitleCard, { title: null }))).toBe("");
    const card = renderToStaticMarkup(createElement(TitleCard, { title: { text: "The Orrery Terraces", sub: "Zone 1", ms: 2400 } }));
    expect(card).toContain('data-testid="title-card"');
    expect(card).toContain("--title-ms:2400ms");
    const pad = renderToStaticMarkup(createElement(TouchPad, { onAction: () => undefined }));
    for (const a of ["left", "right", "up", "down", "interact", "hop"]) expect(pad).toContain(`data-testid="touch-${a}"`);
  });
});
