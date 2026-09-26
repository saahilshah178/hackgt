import { expect, test } from "@playwright/test";
import { readAdventureFixture, solveRelay } from "./adventure-helpers";

/*
 * Archive showcase grading regression plus real relay and evidence-apparatus opening.
 * Human-input evidence submission and departure are covered in adventure.spec.ts.
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

test("fixture-civil-rights-mystery: archive exploration opens the first evidence apparatus", async ({ page }) => {
  await page.goto("/play/fixture-civil-rights-mystery?debug=1");

  await expect(page.getByTestId("adventure-game")).toBeVisible();
  await page.getByRole("button", { name: /Begin expedition/ }).click();
  await solveRelay(page, readAdventureFixture("civil-rights-mystery").seed);
  await page.getByRole("button", { name: "Inspect apparatus", exact: true }).click();
  await expect(page.getByTestId("adventure-instrument")).toBeVisible();
  await expect(page.locator(".ai-claim-plate")).toHaveCount(3);
});
