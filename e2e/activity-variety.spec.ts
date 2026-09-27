import { expect, test, type APIRequestContext } from "@playwright/test";

async function regenerate(request: APIRequestContext, genre: string): Promise<string> {
  const response = await request.post("/api/games/fixture-cell-transport/regenerate", { data: { genre }, timeout: 120_000 });
  expect(response.status(), await response.text()).toBe(202);
  const { jobId } = await response.json();
  let gameId = "";
  await expect.poll(async () => {
    const job = await (await request.get(`/api/jobs/${jobId}`)).json();
    if (job.error) throw new Error(job.error);
    gameId = job.gameId;
    return job.status;
  }, { timeout: 90_000 }).toBe("done");
  return gameId;
}

test("exploration uses a bird's-eye map and moves north as well as east", async ({ page }, info) => {
  await page.goto("/play/fixture-trig");
  await expect(page.getByTestId("activity-game")).toHaveAttribute("data-play-style", "top-down");
  const map = page.getByRole("group", { name: /Exploration map/ });
  await map.focus();
  await page.keyboard.press("ArrowUp");
  await expect(map).toHaveAttribute("aria-label", /column 3, row 2/);
  await page.keyboard.press("ArrowRight");
  await expect(map).toHaveAttribute("aria-label", /column 4, row 2/);
  await page.screenshot({ path: info.outputPath("top-down.png"), fullPage: true });
});

test("mysteries support inspecting evidence and switching to a text-driven journal", async ({ page }, info) => {
  await page.goto("/play/fixture-civil-rights-mystery");
  await expect(page.getByTestId("activity-game")).toHaveAttribute("data-play-style", "investigation");
  await page.getByRole("region", { name: "Case desk", exact: true }).getByRole("button").filter({ hasText: "Investigate" }).first().click();
  await expect(page.getByRole("heading", { name: "Inspect the file" })).toBeVisible();
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.getByTestId("widget-root")).toBeVisible();
  await page.getByRole("button", { name: "Story journal", exact: true }).click();
  await expect(page.getByTestId("activity-game")).toHaveAttribute("data-play-style", "narrative");
  await page.screenshot({ path: info.outputPath("narrative.png"), fullPage: true });
});

test("puzzles open directly on a board without traversal or an avatar", async ({ page, request }, info) => {
  const id = await regenerate(request, "puzzle");
  await page.goto(`/play/${id}`);
  await expect(page.getByTestId("activity-game")).toHaveAttribute("data-play-style", "puzzle");
  await page.getByRole("region", { name: "Puzzle workshop", exact: true }).getByRole("button").filter({ hasText: "Work on tile" }).first().click();
  await expect(page.getByTestId("widget-root")).toBeVisible();
  await expect(page.getByTestId("phaser-host")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("puzzle.png"), fullPage: true });
});

test("cozy management spends water on projects and replenishes it by resting", async ({ page, request }, info) => {
  const id = await regenerate(request, "strategy");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/play/${id}`);
  await expect(page.getByTestId("activity-game")).toHaveAttribute("data-play-style", "management");
  await page.getByRole("region", { name: "Learning garden", exact: true }).getByRole("button").filter({ hasText: "Tend project" }).first().click();
  await expect(page.getByText("Water 1 / 4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Rest until tomorrow/ }).click();
  await expect(page.getByText("Water 3 / 4", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("management-mobile.png"), fullPage: true });
});
