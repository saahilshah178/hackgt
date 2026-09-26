import { expect, test } from "@playwright/test";

/*
 * Mystery host smoke test (MEGAPROMPT P10 part 1, checkpoint genre-mystery): the civil-rights-mystery
 * fixture drives MysteryHost end to end (autoSolve to the end screen, zero console errors), plus a
 * keyboard-path check that the first room's socket-specific frame and widget actually render.
 */

type DebugHandle = {
  state(): { finished: boolean; index: number; encounterId: string | null };
  autoSolve(): void;
};

test("fixture-civil-rights-mystery: autoSolve to the end screen with zero console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/play/fixture-civil-rights-mystery?debug=1");
  await page.waitForFunction(() => typeof (window as unknown as { __GAME_DEBUG__?: unknown }).__GAME_DEBUG__ !== "undefined", null, {
    timeout: 30_000,
  });

  for (let i = 0; i < 50; i++) {
    const finished = await page.evaluate(() => {
      const dbg = (window as unknown as { __GAME_DEBUG__: DebugHandle }).__GAME_DEBUG__;
      if (dbg.state().finished) return true;
      dbg.autoSolve();
      return dbg.state().finished;
    });
    if (finished) break;
  }

  const finalState = await page.evaluate(() => (window as unknown as { __GAME_DEBUG__: DebugHandle }).__GAME_DEBUG__.state());
  expect(finalState.finished).toBe(true);

  await expect(page.getByTestId("end-screen")).toBeVisible({ timeout: 15_000 });

  expect(errors, `console/page errors:\n${errors.join("\n")}`).toEqual([]);
});

test("fixture-civil-rights-mystery: ArrowRight from arrival opens the first room's cross_exam frame", async ({ page }) => {
  // the civil side-car dresses history_mystery_001 in the Expedition now; the arrival frame is the legacy MysteryHost (§8.2)
  await page.goto("/play/fixture-civil-rights-mystery?debug=1&host=legacy");

  const host = page.getByTestId("mystery-host");
  await expect(host).toBeVisible();
  await expect(page.getByTestId("scene-arrival")).toBeVisible();

  await host.focus();
  await page.keyboard.press("ArrowRight");

  // First encounter in the fixture (e1_brown) is a truth_finder.mimic on the cross_exam socket.
  await expect(page.getByTestId("scene-cross_exam")).toBeVisible();
  await expect(page.getByTestId("widget-first-option")).toBeVisible();
});
