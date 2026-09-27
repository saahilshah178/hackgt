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
  // The end screen keeps the top-left exit so a finished run can still go home without the debrief.
  await expect(page.getByTestId("end-screen").getByTestId("exit-game")).toHaveAttribute("href", "/");

  expect(errors, `console/page errors:\n${errors.join("\n")}`).toEqual([]);
}

for (const [label, entry] of [
  ["expedition", "/play/fixture-trig"],
  ["legacy host", "/play/fixture-trig?host=legacy"],
] as const) {
test(`exit button (${label}) asks for confirmation, then returns to the home page`, async ({ page }) => {
  await page.goto(entry);
  const exit = page.getByTestId("exit-game");
  await expect(exit).toBeVisible({ timeout: 30_000 });

  // Cancelling keeps the run: the dialog closes and we are still on the play page.
  await exit.click();
  await expect(page.getByTestId("exit-confirm")).toBeVisible();
  await page.getByTestId("exit-cancel").click();
  await expect(page.getByTestId("exit-confirm")).toBeHidden();
  await expect(page).toHaveURL(new RegExp("[/]play[/]fixture-trig"));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Confirming leaves for the home page (upload panel + showcase games).
  await exit.click();
  await expect(page.getByTestId("exit-confirm")).toBeVisible();
  await page.getByTestId("exit-confirm-link").click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 2, name: /showcase games/i })).toBeVisible();
});
}

test("the can't-be-played page has an exit link home", async ({ page }) => {
  await page.goto("/play/no-such-game-id");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/can.t be played/i);
  const exit = page.getByTestId("exit-game");
  await expect(exit).toHaveAttribute("href", "/");
  await exit.click();
  await expect(page).toHaveURL("/");
});

test("fixture-trig: autoSolve to the end screen with zero console errors", async ({ page }) => {
  await autoSolveFixture(page, "fixture-trig");
});

test("fixture-cell-transport: autoSolve to the end screen with zero console errors", async ({ page }) => {
  await autoSolveFixture(page, "fixture-cell-transport");
});

test("fixture-wave2: autoSolve every wave-2 widget (balance/transformer/recall/function_world) to the end screen", async ({ page }) => {
  await autoSolveFixture(page, "fixture-wave2");
});
