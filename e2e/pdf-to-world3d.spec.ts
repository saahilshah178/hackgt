import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { client, collectErrors, expectPhase, type World3DDebug } from "./helpers/world3d";

/*
 * PDF → 3D game, end to end in mock mode (docs/design/60): upload a chapter on the home page, walk the intake (concepts,
 * then the quick check where the genre is chosen), pick "3D open world", watch the forge, and play the generated world3d
 * game to the end screen and the debrief. The Egypt chapter reproduces the demo in its hand-authored world; any other
 * chapter (cell transport here) gets a world from the composer. Zero console errors.
 */

type Win = Window & { __GAME_DEBUG__?: World3DDebug };

async function uploadAndChoose3D(page: Page, pdf: string) {
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles(path.join(process.cwd(), "samples", pdf));
  await page.waitForURL(/\/intake\//, { timeout: 90_000 });
  await expect(page.getByTestId("intake-form")).toBeVisible({ timeout: 90_000 });
  // a chapter with more concepts than the game length covers asks the student to tick which ones (pdf → game)
  if (await page.getByTestId("step-next").isDisabled()) {
    const boxes = page.locator('input[data-testid^="concept-"]');
    for (let i = 0; i < 5; i++) await boxes.nth(i).check();
  }
  await page.getByTestId("step-next").click();
  await expect(page.getByTestId("clarify-step")).toBeVisible();
  const option = page.getByTestId("genre-world3d");
  await option.scrollIntoViewIfNeeded();
  await option.getByRole("radio").check();
  for (let i = 0; i < 3; i++) await page.getByTestId(`precheck-${i}`).getByRole("radio").first().check();
  const request = page.waitForRequest((r) => r.url().endsWith("/api/games") && r.method() === "POST");
  await page.getByTestId("forge-button").click();
  const body = (await request).postDataJSON() as { intake: { genre: string } };
  expect(body.intake.genre).toBe("world3d");
  await page.waitForURL(/\/play\//, { timeout: 240_000 });
  await expect(client(page)).toBeVisible({ timeout: 120_000 });
  await page.waitForFunction(() => typeof (window as Win).__GAME_DEBUG__?.world3d !== "undefined", null, { timeout: 60_000 });
}

async function beginExploring(page: Page) {
  await expectPhase(page, "intro", 90_000);
  await page.evaluate(() => (window as Win).__GAME_DEBUG__!.world3d.begin());
  await page.evaluate(() => (window as Win).__GAME_DEBUG__!.world3d.choose("go"));
  await expectPhase(page, "explore");
  await expect(page.getByTestId("w3-tracker")).toBeVisible();
  const leads = await page.evaluate(() => (window as Win).__GAME_DEBUG__!.world3d.leads());
  expect(leads.length).toBeGreaterThan(0);
}

test.describe("PDF → 3D open world", () => {
  test.setTimeout(420_000);

  test("the Egypt chapter becomes the demo world, played to the debrief", async ({ page }) => {
    const errors = collectErrors(page);
    await uploadAndChoose3D(page, "ancient-egypt.pdf");
    await beginExploring(page);
    // the world names the demo's places: the Great Pyramid is the goal
    await expect(page.getByTestId("w3-tracker")).toContainText(/Great Pyramid/);

    for (let i = 0; i < 40; i++) {
      if ((await client(page).getAttribute("data-phase")) === "ended") break;
      await page.evaluate(() => (window as Win).__GAME_DEBUG__!.autoSolve());
      await page.waitForTimeout(150);
    }
    await expect(page.getByTestId("end-screen")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: /debrief/i }).first().click();
    await page.waitForURL(/\/debrief\//, { timeout: 30_000 });
    await expect(page.getByTestId("postcheck")).toBeVisible();
    for (let i = 0; i < 3; i++) await page.getByTestId(`postcheck-${i}`).getByRole("radio").first().check();
    await page.getByTestId("postcheck-submit").click();
    await expect(page.getByTestId("post-score")).toHaveText(/\d\/3/);
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("another chapter (cell transport) gets a composed 3D world", async ({ page }) => {
    const errors = collectErrors(page);
    await uploadAndChoose3D(page, "cell-transport.pdf");
    await beginExploring(page);
    // talk to the nearest lead the way a player would: warp next to it and press E
    const lead = await page.evaluate(() => (window as Win).__GAME_DEBUG__!.world3d.leads()[0]);
    await page.evaluate((id) => (window as Win).__GAME_DEBUG__!.world3d.warpTo(id), lead);
    await expect(page.getByTestId("w3-prompt")).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("e");
    await expect(page.getByTestId("w3-dialogue")).toBeVisible();
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });
});
