import { expect, test } from "@playwright/test";

/*
 * Engine smoke test (MEGAPROMPT P3.7): load the trig fixture directly, drive it to completion with the
 * debug hook's autoSolve (so it passes whether Phaser boots or the DOM fallback carries the run), and
 * assert the end screen appears with zero console errors.
 */

// Not a `declare global` augmentation of Window: other e2e specs declare their own (different) shape
// for window.__GAME_DEBUG__, and TS requires every merged declaration to match exactly.
type DebugHandle = {
  state(): { finished: boolean; index: number; encounterId: string | null };
  autoSolve(): void;
};

async function autoSolveFixture(page: import("@playwright/test").Page, fixtureId: string) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`/play/${fixtureId}?debug=1`);
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
}

test("fixture-trig: autoSolve to the end screen with zero console errors", async ({ page }) => {
  await autoSolveFixture(page, "fixture-trig");
});

test("fixture-cell-transport: autoSolve to the end screen with zero console errors", async ({ page }) => {
  await autoSolveFixture(page, "fixture-cell-transport");
});
