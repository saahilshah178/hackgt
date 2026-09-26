import { describe, expect, it } from "vitest";
import { implementedModes } from "../../mechanics/registry";
import { widgetFor } from "./registry";
import { COVERAGE_PARAMS } from "./coverage-params";

/*
 * Reviewer finding C1 ("never crash"): every implemented mode's `present()` view must be recognized by
 * its widget's `supports()` (src/game/widgets/registry.ts's `widgetFor`), or the play page renders the
 * Fallback "isn't built yet" card instead of a mode-specific widget. This test calls every implemented
 * mode's `present(params, 1)` with a known-valid params object (COVERAGE_PARAMS, from fixtures where one
 * exists and hand-written from the mode's Params schema otherwise) and asserts `widgetFor` picks the
 * mode's real widget component, not the Fallback. `EXPECTED_FALLBACK` lists exactly which modes (if any)
 * are still expected to land on the fallback card; the goal is an empty list.
 */

import { Fallback } from "./Fallback";

/** Modes intentionally still on the fallback card (checkpoint TODOs). Empty when every mode is covered. */
const EXPECTED_FALLBACK = new Set<string>([]);

describe("widget coverage", () => {
  const modes = implementedModes();

  it("has a COVERAGE_PARAMS entry for every implemented mode", () => {
    const missing = modes.map((m) => m.key).filter((key) => !(key in COVERAGE_PARAMS));
    expect(missing, `COVERAGE_PARAMS is missing: ${missing.join(", ")}`).toEqual([]);
  });

  for (const { mode, key } of modes) {
    it(`${key} (widget: ${mode.widget}) is supported, or is an acknowledged fallback`, () => {
      const params = COVERAGE_PARAMS[key];
      expect(params, `no COVERAGE_PARAMS entry for ${key}`).toBeDefined();

      const parsed = mode.paramsSchema.safeParse(params);
      expect(parsed.success, `COVERAGE_PARAMS[${key}] fails its own paramsSchema: ${!parsed.success && JSON.stringify(parsed.error.issues)}`).toBe(true);
      if (!parsed.success) return;

      const view = mode.present(parsed.data, 1);
      const Widget = widgetFor(mode.widget, view);

      if (EXPECTED_FALLBACK.has(key)) {
        expect(Widget, `${key} was expected to still be on the fallback card, but a real widget now supports it — remove it from EXPECTED_FALLBACK`).toBe(Fallback);
      } else {
        expect(Widget, `${key}'s view ${JSON.stringify(view)} was not recognized by the "${mode.widget}" widget and fell back to the "isn't built yet" card`).not.toBe(Fallback);
      }
    });
  }

  it("EXPECTED_FALLBACK lists exactly the modes still on the fallback card", () => {
    const stillFallback = modes
      .filter(({ mode, key }) => {
        const parsed = mode.paramsSchema.safeParse(COVERAGE_PARAMS[key]);
        if (!parsed.success) return false;
        const view = mode.present(parsed.data, 1);
        return widgetFor(mode.widget, view) === Fallback;
      })
      .map((m) => m.key);
    expect(stillFallback.sort()).toEqual([...EXPECTED_FALLBACK].sort());
  });
});
