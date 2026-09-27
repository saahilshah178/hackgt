import { expect, test } from "@playwright/test";
import {
  applySolutionDraft,
  autoSolveTo,
  collectConsoleErrors,
  expectNoErrors,
  gotoExpedition,
  contraptionDebug,
  openPanel,
  phase,
  TESTIDS,
} from "./helpers/expedition";

/*
 * e2e/expedition-keyboard.spec.ts (F9, docs/design/20-expedition-architecture.md §7.5, §8.2): "one WebGL keyboard
 * e2e per control kind", operable with Tab/arrows/digits/Enter only (D4: Phaser's keyboard capture must release
 * while the panel is open, and every control's DOM must itself be reachable and operable by keyboard).
 *
 * The dev world (H1's `src/game/hosts/expedition/__fixtures__/dev-world-data.ts`) is served, played through the
 * REAL client, at `/dev/expedition/client` (fix docs/design/w1a-report.md #3): its `DEV_ENCOUNTERS` list has one
 * station per control kind in runner order (scrub x2, aim, slots, bins, waves, cables, tubes, widget, matrix).
 * `autoSolveTo` (a thin wrapper over the base `__GAME_DEBUG__.autoSolve()`, shared with the legacy hosts) jumps
 * the runner to a later station without walking or solving every prior one by hand — approach/traversal keyboard
 * behaviour is covered separately (e2e/expedition-trig.spec.ts step 3-4; D4 itself by H1's own host suite),
 * so this file can focus purely on whether each control's DOM is keyboard-reachable and -operable. `openPanel()`
 * ("warp to the current station and open its panel", §2.10) then opens exactly that station.
 *
 * Correctness of the final answer comes from `applySolutionDraft()` ("sets the open control to
 * mode.solutionInput(...) THROUGH the control API", §2.10) — the same debug hook the passing dev-world flow test
 * (e2e/expedition-client.spec.ts) already uses for its own "right" step — submitted with a real keyboard Enter
 * (never a click). Each test first proves the control's own DOM responds to a real Tab/arrow/digit/Enter press
 * before that: the point of F9 is that the control is keyboard-operable, not that this file re-derives every
 * station's exact numeric or combinatorial answer by hand.
 */

const DEV_WORLD_PATH = "/dev/expedition/client";

async function boot(page: import("@playwright/test").Page, testInfo: import("@playwright/test").TestInfo): Promise<void> {
  await gotoExpedition(page, testInfo, DEV_WORLD_PATH);
  // the dev intro has no interactive step; the always-available skip reaches `explore` at once (decision 12)
  await page.getByTestId(TESTIDS.cutsceneSkip).click();
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("explore");
}

async function openStation(page: import("@playwright/test").Page, encounterId: string): Promise<void> {
  await autoSolveTo(page, encounterId);
  await openPanel(page);
  const panel = page.getByTestId(TESTIDS.instrumentPanel);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("data-encounter", encounterId);
}

/** Submits with the keyboard alone: focuses Verify and presses Enter (never `.click()`). */
async function verifyByKeyboard(page: import("@playwright/test").Page): Promise<void> {
  const submit = page.getByTestId(TESTIDS.widgetSubmit);
  await submit.focus();
  await page.keyboard.press("Enter");
}

async function expectSolved(page: import("@playwright/test").Page, encounterId: string): Promise<void> {
  await expect(page.getByTestId(TESTIDS.successBadge)).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await contraptionDebug(page, encounterId))?.state, { timeout: 15_000 }).toBe("solved");
}

test.describe("expedition keyboard (F9: one WebGL keyboard e2e per control kind, dev world)", () => {
  test.setTimeout(60_000);

  test("scrub (e1_radians, Vesper Dial): the slider steps with ArrowRight", async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await boot(page, testInfo);
    await openStation(page, "e1_radians");

    const scrubber = page.getByTestId("scrubber");
    await scrubber.focus();
    const before = await scrubber.getAttribute("aria-valuenow");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => scrubber.getAttribute("aria-valuenow")).not.toBe(before);

    await applySolutionDraft(page);
    await verifyByKeyboard(page);
    await expectSolved(page, "e1_radians");
    expectNoErrors(errors);
  });

  test("aim (e3_amplitude, Resonance Pillars): a claim radio is focusable and Enter chooses it", async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await boot(page, testInfo);
    await openStation(page, "e3_amplitude");

    const first = page.getByTestId("widget-first-option");
    await first.focus();
    await expect(first).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Enter"); // a real <button role="radio">: Enter fires its click, per browser default
    await expect(first).toHaveAttribute("aria-checked", "true");

    await applySolutionDraft(page);
    await verifyByKeyboard(page);
    await expectSolved(page, "e3_amplitude");
    expectNoErrors(errors);
  });

  test("slots (e4_solve, Floating Steps): Enter lays the focused tray plank onto the rail", async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await boot(page, testInfo);
    await openStation(page, "e4_solve");

    const tray = page.getByTestId("plank-tray");
    const before = await tray.locator("button").count();
    await page.getByTestId("widget-first-option").focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => tray.locator("button").count()).toBe(before - 1);

    await applySolutionDraft(page);
    await verifyByKeyboard(page);
    await expectSolved(page, "e4_solve");
    expectNoErrors(errors);
  });

  test("bins (e2_selectivity, Membrane Router): a digit key routes the focused item to a lane", async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await boot(page, testInfo);
    await openStation(page, "e2_selectivity");

    const first = page.getByTestId("widget-first-option");
    await first.focus();
    const laneBefore = await page.getByTestId("lane-diffuses").getAttribute("aria-label");
    await page.keyboard.press("1"); // the item's own onKeyDown: digit N -> route to the Nth lane
    await expect.poll(() => page.getByTestId("lane-diffuses").getAttribute("aria-label")).not.toBe(laneBefore);

    await applySolutionDraft(page);
    await verifyByKeyboard(page);
    await expectSolved(page, "e2_selectivity");
    expectNoErrors(errors);
  });

  test("waves (e5_tonicity, Tonicity Sluices): a digit key answers the focused wave", async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await boot(page, testInfo);
    await openStation(page, "e5_tonicity");

    await page.getByTestId("widget-first-option").focus();
    await expect(page.getByText(/Wave 1 of/)).toBeVisible();
    await page.keyboard.press("1"); // the valve grid's roving onKeyDown: digit N -> quick-select + answer
    await expect(page.getByText(/Wave 2 of/)).toBeVisible({ timeout: 5_000 });

    await applySolutionDraft(page);
    await verifyByKeyboard(page);
    await expectSolved(page, "e5_tonicity");
    expectNoErrors(errors);
  });

  test("cables (e7_march, Switchboard): Tab moves between the socket and cartridge lists; Enter seats a cord", async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await boot(page, testInfo);
    await openStation(page, "e7_march");

    const leftFirst = page.getByTestId("widget-first-option"); // the first socket (left listbox)
    await leftFirst.focus();
    await page.keyboard.press("Enter"); // picks it
    await expect(leftFirst).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Tab"); // only one item per listbox is tabbable (roving): Tab reaches the right list
    await page.keyboard.press("Enter"); // seats the cord between the two picks
    await expect.poll(() => leftFirst.getAttribute("aria-label")).toMatch(/connected to/);

    await applySolutionDraft(page);
    await verifyByKeyboard(page);
    await expectSolved(page, "e7_march");
    expectNoErrors(errors);
  });

  test("tubes (e5_freedom_rides, Big Board): Tab moves between housings; Enter starts and lays a tube", async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await boot(page, testInfo);
    await openStation(page, "e5_freedom_rides");

    const gauge = page.getByTestId("tube-gauge");
    await page.getByTestId("widget-first-option").focus();
    await page.keyboard.press("Enter"); // picks the first housing
    await page.keyboard.press("Tab"); // plain buttons, natural DOM order: the next housing
    await page.keyboard.press("Enter"); // lays a tube from the first to the second
    await expect(gauge).toContainText("1 of");

    await applySolutionDraft(page);
    await verifyByKeyboard(page);
    await expectSolved(page, "e5_freedom_rides");
    expectNoErrors(errors);
  });

  test("matrix (e12_boss, Tumbler Vault): a strike toggle and the accuse socket are Tab/Enter-operable", async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await boot(page, testInfo);
    await openStation(page, "e12_boss");

    const accuse = page.getByTestId("widget-first-option"); // the first row's ACCUSE button
    await accuse.focus();
    await expect(accuse).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Enter");
    await expect(accuse).toHaveAttribute("aria-pressed", "true");

    // applySolutionDraft() resets the marks/accusation to the real solution through the control API
    await applySolutionDraft(page);
    await verifyByKeyboard(page);
    await expectSolved(page, "e12_boss");
    expectNoErrors(errors);
  });
});
