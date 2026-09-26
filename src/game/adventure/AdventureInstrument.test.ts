import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GameSpec } from "../../contracts/gamespec";
import { EncounterRunner } from "../runner/encounter-runner";
import { AdventureInstrument } from "./AdventureInstrument";
import type { AdventureKind } from "./campaigns";

const fixtures: [string, AdventureKind][] = [
  ["trig-dungeon", "observatory"],
  ["trig-platformer", "observatory"],
  ["cell-transport-dungeon", "cell"],
  ["civil-rights-mystery", "archive"],
  ["wave2-dungeon", "station"],
];

describe("adventure apparatus fixture coverage", () => {
  for (const [fixture, kind] of fixtures) {
    const spec = JSON.parse(readFileSync(new URL(`../../../fixtures/${fixture}.json`, import.meta.url), "utf8")) as GameSpec;
    for (const encounter of spec.encounters) {
      it(`${fixture}: ${encounter.id} renders its public presentation with a submission control`, () => {
        const runner = new EncounterRunner(spec);
        runner.skipTo(encounter.id);
        const html = renderToStaticMarkup(createElement(AdventureInstrument, {
          kind, current: runner.current()!, onSubmit: () => {}, onLive: () => {},
        }));
        expect(html).toContain('data-testid="adventure-instrument"');
        expect(html).toMatch(/data-testid="widget-submit"|role="radio"/);
        expect(html).not.toContain("isn&#x27;t built yet");
        expect(html).not.toContain("NaN");
        expect(html).not.toContain("Infinity");
        if (encounter.mode === "mimic") {
          expect(html).toContain("Exactly one claim is false");
          expect(html).toMatch(/Flag misleading account|Remove faulty calibration plate/);
        }
        if (encounter.mode === "type_match" || encounter.mode === "rapid") expect(html).not.toContain('data-testid="rapid-timer"');
      });
    }
  }
});
