import { expect, test } from "@playwright/test";
import { collectConsoleErrors, expectNoErrors, gotoExpedition, hostDebug, TESTIDS } from "./helpers/expedition";

/*
 * TODO(w1): H1 ("Host core", docs/design/20-expedition-architecture.md §7.2) has not landed yet — there is no
 * `src/game/hosts/expedition/ExpeditionHost.tsx` and no `src/game/hosts/expedition/__fixtures__/dev-world.ts`
 * (the two-zone dev world with "one station per control kind on stub prefabs" H1 owns) at the time E1 ran. This
 * spec is written against the DOCUMENTED interface only:
 *   - the dev world's station-per-control-kind layout and testids (§7.2 H1's "Owns"/"Deliverables" row);
 *   - `__GAME_DEBUG__.expedition` (§2.10, mirrored in e2e/helpers/expedition.ts);
 *   - the panel/control testids (§3, `TESTIDS` in the helpers file);
 *   - the F9 rule (§7.5, §8.2): "one WebGL keyboard e2e per control kind", Tab/arrows/digits/Enter only.
 *
 * Every test below is `test.skip` until H1 lands the dev world and exposes its route/testids for real. When it
 * does: (1) fill in `DEV_WORLD_PATH` below with the route H1 actually serves the dev world at (H1's deliverable
 * doesn't name one explicitly — it may be a debug-only path off `/play/fixture-<dev-world-id>` or a dedicated
 * `/dev/expedition` page; check `src/game/hosts/expedition/__fixtures__/dev-world.ts` and H1's PR/report for the
 * exact id/route), (2) fill in each control kind's station testid/anchor from the dev world's actual data,
 * (3) remove the `.skip` and this TODO block. Acceptance (§7.2 E1 row): "the keyboard spec written against H1's
 * dev world and green on `webgl` once H2 lands (T0 + 8)".
 */

// The dev world's presumed route (TODO(w1): confirm against H1's actual dev-world fixture id/route).
const DEV_WORLD_PATH = "/play/fixture-dev-world";

/**
 * §1.3 `ControlKind` → the dev world's one-station-per-control-kind list (H1's "Deliverables" row). TODO(w1):
 * replace each `stationTestId` with the real testid H1's dev world assigns once it exists — these are best
 * guesses at the `data-testid` convention already used elsewhere in the codebase (`instrument-panel`,
 * `widget-submit`, ...), not confirmed values.
 */
const CONTROL_KIND_STATIONS: { kind: string; stationTestId: string }[] = [
  { kind: "scrub", stationTestId: "station-scrub" },
  { kind: "aim", stationTestId: "station-aim" },
  { kind: "slots", stationTestId: "station-slots" },
  { kind: "bins", stationTestId: "station-bins" },
  { kind: "waves", stationTestId: "station-waves" },
  { kind: "cables", stationTestId: "station-cables" },
  { kind: "tubes", stationTestId: "station-tubes" },
  { kind: "matrix", stationTestId: "station-matrix" },
];

test.describe("expedition keyboard (F9: one WebGL keyboard e2e per control kind)", () => {
  test.skip(true, "TODO(w1): H1's dev world has not landed yet; written against the documented interface only.");

  for (const { kind, stationTestId } of CONTROL_KIND_STATIONS) {
    test(`${kind} station: completed with Tab/arrows/digits/Enter only`, async ({ page }, testInfo) => {
      const errors = collectConsoleErrors(page);

      await gotoExpedition(page, testInfo, DEV_WORLD_PATH);

      // Reach the station by keyboard alone (Tab to focus the world, arrows to walk/aim, no mouse).
      await page.keyboard.press("Tab");
      const station = page.getByTestId(stationTestId);
      await expect(station).toBeVisible();

      // Approach and open its panel with keyboard only, then focus the control slot.
      await page.keyboard.press("Enter"); // interact() equivalent, per doc §8.2 step 4 ("E" -> instrument-panel)
      await expect(page.getByTestId(TESTIDS.instrumentPanel)).toBeVisible();

      // Every control kind is operable with Tab (focus), ArrowLeft/Right/Up/Down (adjust), digits (some
      // controls, e.g. matrix/slots) and Enter (commit/Verify) only — never a mouse (§7.5 D4, F9).
      await page.keyboard.press("Tab");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");

      await expect(page.getByTestId(TESTIDS.successBadge)).toBeVisible({ timeout: 15_000 });

      const dbg = await hostDebug(page);
      expect(dbg?.contraption()?.state).toBe("solved");

      expectNoErrors(errors);
    });
  }
});
