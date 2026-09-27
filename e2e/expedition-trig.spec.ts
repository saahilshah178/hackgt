import { expect, test, type Page } from "@playwright/test";
import {
  applySolutionDraft,
  collectConsoleErrors,
  contraptionDebug,
  dialogueSnapshot,
  expectNoErrors,
  gotoExpedition,
  hint,
  hostDebug,
  interact,
  isDomProject,
  phase,
  useLink,
  walkTo,
  walkUntilOrBlocked,
} from "./helpers/expedition";

/*
 * e2e/expedition-trig.spec.ts (E2, docs/design/20-expedition-architecture.md §7.2 item E2, §8.2).
 *
 * Drives the REAL trig fixture (`/play/fixture-trig`, `fixtures/worlds/trig.world.json`, zone `z1_sunward`)
 * through the §8.2 step table for its first two stations, e1_radians (Vesper Dial: emitter_rail/vesper_dial,
 * mapper.number_line, scrub layout, target 5π/6) and e2_period (Tidewheel Gate: ring_gate/ring_gate,
 * tuner.oscillator, scrub layout, target π). Both are native by KA2 (docs/design/w1a-report.md §"KA2").
 *
 * Steps are implemented "as they become possible" (§7.2 E2): the intro cutscene's mid-sequence `control_until` /
 * `await_interact` choreography (step 2's harder half) is exercised only up to what the documented debug API can
 * drive deterministically without hand-modelling the runner's internal timing; the always-available `cutscene-skip`
 * escape hatch (decision 12) is used to reach `explore` reliably, since flaking there would cost the whole file.
 * Every test ends with `expect(errors).toEqual([])` (§8.2).
 */

const TRIG_PATH = "/play/fixture-trig";

// e1_radians (fixtures/worlds/trig.world.json): consoleX 4300. `host().near` (the E/interact target) is keyed to a
// window of a little over 100 units either side of consoleX, NOT the station's broader `approachRadius` (500,
// which drives the approach dialogue toast, a separate channel) — measured empirically: `near` is a station at
// x in about [4250, 4400] and null outside it. Its payoff blocker sits at x 5380 (a "terrain" payoff: stairs up).
const E1_ID = "e1_radians";
const E1_CONSOLE_X = 4300;
const E1_BLOCKER_X = 5380;

// e2_period: consoleX 6900. Payoff is remove_blocker @ 7330.
const E2_ID = "e2_period";
const E2_CONSOLE_X = 6900;
const E2_BLOCKER_X = 7330;

async function holdKey(page: Page, code: string, ms: number): Promise<void> {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

/**
 * Step 5 (§8.2): focus the scrubber, step it with the keyboard, and return `aria-valuenow` sampled 3 times as it
 * strictly increases.
 *
 * NOT `host().contraption(id)?.value`/`.theta` for the per-press samples: that debug snapshot only catches up to
 * the scrubber's true position after the control's 300 ms key-settle window (`SETTLE_MS`,
 * `src/game/expedition/panel/controls/scrub.logic.ts`) elapses with no further key presses — reading it between
 * presses sent faster than that (as a keyboard-driven test naturally does) returns a stale value frozen at
 * whichever press last got a full settle window. `aria-valuenow` (a plain React-driven DOM attribute) and the
 * world's live `value-chip` both advance on every press with no such lag, so they are what this samples; callers
 * still wait out one settle window (`settleScrub`) before treating the panel's value as caught up for a Verify.
 */
async function scrubAndSample(page: Page, steps: number): Promise<number[]> {
  const scrubber = page.getByTestId("scrubber");
  const samples: number[] = [];
  for (let i = 0; i < steps; i++) {
    await scrubber.focus();
    await page.keyboard.press("ArrowRight");
    if (i === 2 || i === 5 || i === steps - 1) {
      const now = await scrubber.getAttribute("aria-valuenow");
      samples.push(Number(now));
    }
  }
  return samples;
}

/** Waits out the scrubber's 300 ms key-settle window (see `scrubAndSample`) after the last key press. */
async function settleScrub(page: Page): Promise<void> {
  await page.waitForTimeout(500);
}

test.describe("expedition trig: e1 (Vesper Dial) and e2 (Tidewheel Gate), §8.2 steps 1-9", () => {
  test.setTimeout(180_000); // the traversal-heavy tests re-poll walkTo through the shared, actively-edited dev server

  test("step 1: loads and shows the zone title and title card", async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await gotoExpedition(page, testInfo, TRIG_PATH);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sunward Terrace");
    // the title card shows during the intro's `title` step; skip is always available from the first frame
    await expect(page.getByTestId("cutscene-skip")).toBeVisible();
    expect(await phase(page)).toBe("intro");
    expectNoErrors(errors);
  });

  test("step 2: intro shows a dialogue line, then the skip escape hatch reaches explore", async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await gotoExpedition(page, testInfo, TRIG_PATH);

    // the dialogue bar carries the opening narrator/Cog lines before any interactive step is reachable (the bar
    // sits in its "idle" toast styling, functionally hidden, until the runner's first `say` step actually starts,
    // so the text itself — not a bare visibility check on the idle bar — is the reliable signal here)
    await expect.poll(async () => (await dialogueSnapshot(page))?.text ?? "", { timeout: 30_000 }).not.toBe("");
    await expect(page.getByTestId("dialogue-bar")).toBeVisible();

    // decision 12: `?express` aside, `cutscene-skip` always ends the cutscene at once and applies its end state
    await page.getByTestId("cutscene-skip").click();
    await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("explore");

    expectNoErrors(errors);
  });

  test("steps 3-9: traversal, approach, live control, hint, wrong/right verify, payoff traversal (e1)", async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await gotoExpedition(page, testInfo, TRIG_PATH);
    await page.getByTestId("cutscene-skip").click();
    await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("explore");

    // --- step 3: walk and traverse ---------------------------------------------------------------------------
    const x0 = (await hostDebug(page))!.playerX;
    await holdKey(page, "KeyD", 500);
    await expect.poll(async () => (await hostDebug(page))!.playerX).toBeGreaterThan(x0);

    // useLink crosses the canal onto the stone platform: ground -> canal_stone, and the height changes with it
    await walkTo(page, 2100);
    const beforeLink = (await hostDebug(page))!;
    await useLink(page, "s0_stone_in");
    const afterLink = (await hostDebug(page))!;
    expect(afterLink.surface).toBe("canal_stone");
    expect(afterLink.playerY).not.toBe(beforeLink.playerY);

    // e1 is unsolved: walking toward e2 crosses every remaining canal link (walkUntilOrBlocked fires each one
    // as it comes into range) but halts at e1's payoff blocker (a "terrain" payoff — the stairs up don't exist
    // until e1 is solved)
    await walkUntilOrBlocked(page, 6000);
    await expect.poll(async () => (await hostDebug(page))!.playerX).toBeLessThan(E1_BLOCKER_X);

    // --- step 4: approach and interact -------------------------------------------------------------------
    await walkUntilOrBlocked(page, E1_CONSOLE_X);
    await expect.poll(async () => (await hostDebug(page))!.near?.kind, { timeout: 20_000 }).toBe("station");

    await page.keyboard.press("KeyE"); // §8.2 step 4: "E -> instrument-panel visible"
    const panel = page.getByTestId("instrument-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("data-encounter", E1_ID);
    // the pinned instruction names a part noun (R9): e1's partNouns are "carriage" and "rail"
    await expect(page.getByTestId("dialogue-pin-primary")).toContainText(/carriage|rail/i);

    // --- step 5: live binding ------------------------------------------------------------------------------
    // the world's live value chip (WorldLabelLayer) is the readout that actually tracks every keyed step for
    // this station's format (its bracket-format scrubber readout only changes at quadrant boundaries, not per
    // arrow press — see scrubAndSample's note on which signals are and are not live per press)
    const chip = page.getByTestId("value-chip").first();
    const chipBefore = await chip.textContent();
    const samples = await scrubAndSample(page, 10);
    expect(samples[1]).toBeGreaterThan(samples[0]);
    expect(samples[2]).toBeGreaterThan(samples[1]);
    await expect(chip).not.toHaveText(chipBefore ?? "");
    await settleScrub(page);

    // --- step 6: hint in the world -------------------------------------------------------------------------
    await hint(page);
    await expect(page.getByTestId("hint-button")).toHaveAttribute("aria-label", /1 of 3 used/);
    // decision 20: the DOM fallback is static snapshots; the contraption controller's own live debug state
    // (`host().contraption(id)`) isn't populated there (measured: `aidTier`/`state` read back `undefined` on the
    // `dom` project even though the panel and hint-button — real React overlay elements — update correctly), so
    // this reads it only on `webgl`, where animated contraption behaviour is the documented target for testing.
    if (!isDomProject(testInfo)) await expect.poll(async () => (await contraptionDebug(page, E1_ID))?.aidTier).toBe(1);

    // --- step 7: wrong verify -------------------------------------------------------------------------------
    // the scrubber is still at the "moved but wrong" value step 5 left it at (target is 5*pi/6 ~= 2.618)
    const wrongValue = await page.getByTestId("scrubber").getAttribute("aria-valuenow");
    await page.getByTestId("widget-submit").click();
    await expect(panel).toBeVisible(); // resolving -> back to the SAME panel, never explore
    await expect(page.getByTestId("dialogue-pin-secondary")).toHaveAttribute("data-kind", "feedback");
    await expect(page.getByTestId("scrubber")).toHaveAttribute("aria-valuenow", wrongValue ?? "");

    // --- step 8: correct verify ------------------------------------------------------------------------------
    // the panel is visible again (resolving -> panel), but the FAILED verify's own resolving -> ready transition
    // (re-enabling the control and Verify, `props.busy`/`VerifyButton`'s `disabled`) trails that by an amount tied
    // to real frame rate, not wall-clock time (measured directly: `busy` can still read true a full second-plus
    // later under load from this repo's other concurrently-building lanes) — a fixed wait flakes under that load,
    // so this polls the actual, real condition instead: Verify re-enabled. Without it, applySolutionDraft()
    // (itself gated the same way as every other control input) and the click land on the still-disabled button
    // and are silently dropped, leaving the fail state showing forever.
    await expect(page.getByTestId("widget-submit")).toBeEnabled({ timeout: 30_000 });
    await applySolutionDraft(page);
    await page.getByTestId("widget-submit").click();
    await expect(page.getByTestId("success-badge")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => phase(page), { timeout: 15_000 }).toBe("explore");
    if (!isDomProject(testInfo)) await expect.poll(async () => (await contraptionDebug(page, E1_ID))?.state).toBe("solved");

    // --- step 9: traversal payoff ---------------------------------------------------------------------------
    // the stairs the payoff added are now real ground: the former blocker no longer halts the route
    await walkUntilOrBlocked(page, 6000, { maxTries: 60 });
    await expect.poll(async () => (await hostDebug(page))!.playerX, { timeout: 15_000 }).toBeGreaterThan(E1_BLOCKER_X);

    expectNoErrors(errors);
  });

  test("e2: approach, live control, wrong/right verify, payoff traversal (steps 4-9, after e1)", async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await gotoExpedition(page, testInfo, TRIG_PATH);
    await page.getByTestId("cutscene-skip").click();
    await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("explore");

    // solve e1 quickly (its own flow is exercised in full above) so e2's blocker at 7330 is reachable
    await walkUntilOrBlocked(page, E1_CONSOLE_X);
    await page.keyboard.press("KeyE");
    await expect(page.getByTestId("instrument-panel")).toHaveAttribute("data-encounter", E1_ID, { timeout: 20_000 });
    await applySolutionDraft(page);
    await page.getByTestId("widget-submit").click();
    await expect(page.getByTestId("success-badge")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => phase(page), { timeout: 15_000 }).toBe("explore");

    // --- step 4: approach and interact -------------------------------------------------------------------
    await walkUntilOrBlocked(page, E2_CONSOLE_X, { maxTries: 60 });
    await expect.poll(async () => (await hostDebug(page))!.near?.kind, { timeout: 20_000 }).toBe("station");
    await interact(page);
    const panel = page.getByTestId("instrument-panel");
    await expect(panel).toHaveAttribute("data-encounter", E2_ID);
    // e2's partNouns are "latch timer", "ring", "notch"
    await expect(page.getByTestId("dialogue-pin-primary")).toContainText(/latch timer|ring|notch/i);

    // --- step 5: live binding ------------------------------------------------------------------------------
    const samples = await scrubAndSample(page, 8);
    expect(samples[1]).toBeGreaterThan(samples[0]);
    expect(samples[2]).toBeGreaterThan(samples[1]);
    await settleScrub(page);

    // --- step 7: wrong verify -------------------------------------------------------------------------------
    const wrongValue = await page.getByTestId("scrubber").getAttribute("aria-valuenow");
    await page.getByTestId("widget-submit").click();
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("dialogue-pin-secondary")).toHaveAttribute("data-kind", "feedback");
    await expect(page.getByTestId("scrubber")).toHaveAttribute("aria-valuenow", wrongValue ?? "");

    // --- step 8: correct verify ------------------------------------------------------------------------------
    await expect(page.getByTestId("widget-submit")).toBeEnabled({ timeout: 30_000 }); // see the note in the e1 test above
    await applySolutionDraft(page);
    await page.getByTestId("widget-submit").click();
    await expect(page.getByTestId("success-badge")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => phase(page), { timeout: 15_000 }).toBe("explore");
    if (!isDomProject(testInfo)) await expect.poll(async () => (await contraptionDebug(page, E2_ID))?.state).toBe("solved"); // see the note in the e1 test above

    // --- step 9: traversal payoff (remove_blocker: the Tidewheel doorway opens) ------------------------------
    await walkUntilOrBlocked(page, E2_BLOCKER_X + 200, { maxTries: 20 });
    await expect.poll(async () => (await hostDebug(page))!.playerX, { timeout: 15_000 }).toBeGreaterThan(E2_BLOCKER_X);

    expectNoErrors(errors);
  });
});
