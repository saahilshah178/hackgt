import { expect, test } from "@playwright/test";

/*
 * Platformer host smoke test (MEGAPROMPT P10.2, checkpoint genre-platformer): the trig-platformer
 * fixture drives PlatformerScene end to end (autoSolve to the end screen, zero console errors), plus
 * a keyboard-path check that ArrowRight actually moves the player right (LIBRARY §1 platformer:
 * "run and jump to the exit").
 */

type DebugHandle = {
  state(): { finished: boolean; index: number; encounterId: string | null };
  autoSolve(): void;
  host?: { playerX(): number };
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
  // the trig side-car dresses trig_platformer_001 in the Expedition (whose intro holds input); this checks the legacy PlatformerScene
  await page.goto("/play/fixture-trig-platformer?debug=1&host=legacy");
  await page.waitForFunction(() => typeof (window as unknown as { __GAME_DEBUG__?: unknown }).__GAME_DEBUG__ !== "undefined", null, {
    timeout: 30_000,
  });

  const phaserHost = page.getByTestId("phaser-host");
  const domHost = page.getByTestId("dom-host");
  const gotPhaser = await phaserHost
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (!gotPhaser) {
    // Headless Chromium without WebGL: falls back to the DOM host, which has no player-x concept.
    // The autoSolve test above still covers the full run end to end in that environment.
    await expect(domHost).toBeVisible();
    return;
  }

  await page.waitForFunction(
    () => typeof (window as unknown as { __GAME_DEBUG__: DebugHandle }).__GAME_DEBUG__.host?.playerX === "function",
    null,
    { timeout: 15_000 },
  );

  const startX = await page.evaluate(() => (window as unknown as { __GAME_DEBUG__: DebugHandle }).__GAME_DEBUG__.host!.playerX());

  await phaserHost.click();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(1000);
  await page.keyboard.up("ArrowRight");

  const endX = await page.evaluate(() => (window as unknown as { __GAME_DEBUG__: DebugHandle }).__GAME_DEBUG__.host!.playerX());
  expect(endX).toBeGreaterThan(startX);
});
