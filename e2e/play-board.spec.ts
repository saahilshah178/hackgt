import { expect, test, type Page } from "@playwright/test";

/*
 * Board genres (src/game/genre): the five showcase games that do NOT progress by walking right. Each one must boot its
 * own host, open a challenge through the free-order runner, play to the end screen with zero console errors, and let
 * the player pick a route that differs from the spec order.
 */

type BoardDebug = {
  state(): { finished: boolean; encounterId: string | null };
  autoSolve(): void;
  board: { available(): string[]; solved(): string[]; active(): string | null; open(id: string): void };
};

const GAMES = [
  { fixture: "trig-puzzle", host: "puzzle-host" },
  { fixture: "cell-transport-cozy", host: "cozy-host" },
  { fixture: "cell-transport-casefile", host: "casefile-host" },
  { fixture: "civil-rights-explorer", host: "explorer-host" },
  { fixture: "civil-rights-story", host: "story-host" },
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/WebSocket|_next\/hmr/.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function boot(page: Page, fixture: string) {
  await page.goto(`/play/fixture-${fixture}?debug=1`);
  await page.waitForFunction(() => !!(window as unknown as { __GAME_DEBUG__?: { board?: unknown } }).__GAME_DEBUG__?.board, null, { timeout: 60_000 });
}

for (const game of GAMES) {
  test(`${game.fixture}: board host boots, opens a challenge off the spec order, and plays to the end`, async ({ page }) => {
    const errors = collectErrors(page);
    await boot(page, game.fixture);
    await expect(page.getByTestId(game.host)).toBeVisible();
    await expect(page.getByTestId("board-client")).toBeVisible();

    // non-linear: more than one encounter is open at the start, and we deliberately take the last one
    const open = await page.evaluate(() => (window as unknown as { __GAME_DEBUG__: BoardDebug }).__GAME_DEBUG__.board.available());
    expect(open.length).toBeGreaterThan(1);
    const pick = open[open.length - 1];
    await page.evaluate((id) => (window as unknown as { __GAME_DEBUG__: BoardDebug }).__GAME_DEBUG__.board.open(id), pick);
    await expect(page.getByTestId("challenge-panel")).toBeVisible();
    await expect(page.getByTestId("challenge-panel")).toHaveAttribute("data-encounter", pick);
    await expect(page.getByTestId("widget-root")).toBeVisible();

    // leaving keeps the game going; the encounter stays available
    await page.getByTestId("challenge-close").click();
    await expect(page.getByTestId("challenge-panel")).toHaveCount(0);

    for (let i = 0; i < 40; i++) {
      const finished = await page.evaluate(() => {
        const dbg = (window as unknown as { __GAME_DEBUG__: BoardDebug }).__GAME_DEBUG__;
        if (dbg.state().finished) return true;
        dbg.autoSolve();
        return dbg.state().finished;
      });
      if (finished) break;
    }
    await page.evaluate(() => (window as unknown as { __GAME_DEBUG__: BoardDebug }).__GAME_DEBUG__.autoSolve());
    await expect(page.getByTestId("end-screen")).toBeVisible({ timeout: 15_000 });
    expect(errors, `console/page errors:\n${errors.join("\n")}`).toEqual([]);
  });
}

test("trig-puzzle: a wrong answer keeps the challenge open with feedback, and Try again returns to the widget", async ({ page }) => {
  const errors = collectErrors(page);
  await boot(page, "trig-puzzle");
  // e1_radians is a number line open from the start; its untouched marker sits at π, not the 5π/6 target → wrong
  await page.evaluate(() => (window as unknown as { __GAME_DEBUG__: BoardDebug }).__GAME_DEBUG__.board.open("e1_radians"));
  await expect(page.getByTestId("challenge-panel")).toBeVisible();
  await page.getByTestId("widget-root").getByTestId("widget-submit").click();
  await expect(page.getByTestId("challenge-result")).toHaveAttribute("data-correct", "false");
  await page.getByTestId("challenge-retry").click();
  await expect(page.getByTestId("widget-root")).toBeVisible();
  expect(errors).toEqual([]);
});

test("home page shows the non-side-scroller showcase", async ({ page }) => {
  await page.goto("/");
  const ways = page.getByTestId("ways-to-play");
  await expect(ways).toBeVisible();
  for (const g of GAMES) await expect(ways.locator(`a[href="/play/fixture-${g.fixture}"]`)).toBeVisible();
});
