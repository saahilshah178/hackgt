import { expect, test } from "@playwright/test";

/*
 * Showcase grading regression plus real keyboard movement and jumping checks.
 * Human-input relay and apparatus progression is covered in adventure.spec.ts.
 */

type DebugHandle = {
  state(): { finished: boolean; index: number; encounterId: string | null };
  autoSolve(): void;
};

test("fixture-trig-platformer: autoSolve to the end screen with zero console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/play/fixture-trig-platformer?debug=1");
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

test("fixture-trig-platformer: ArrowRight moves the player to the right", async ({ page }) => {
  await page.goto("/play/fixture-trig-platformer?debug=1");
  await page.waitForFunction(() => typeof (window as unknown as { __GAME_DEBUG__?: unknown }).__GAME_DEBUG__ !== "undefined", null, {
    timeout: 30_000,
  });

  await page.getByRole("button", { name: /Begin expedition/ }).click();
  const world = page.getByRole("group", { name: /exploration\./ }).first();
  const actor = page.locator(".adventure-player");
  const startX = await actor.evaluate(element => parseFloat((element as HTMLElement).style.left));
  await world.focus();
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => actor.evaluate(element => parseFloat((element as HTMLElement).style.left))).toBeGreaterThan(startX + 3);
  await page.keyboard.up("ArrowRight");
  const startY = await actor.evaluate(element => parseFloat((element as HTMLElement).style.top));
  await page.keyboard.press("Space");
  await expect.poll(async () => actor.evaluate(element => parseFloat((element as HTMLElement).style.top))).toBeLessThan(startY - 2);
});
