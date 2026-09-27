import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/*
 * Extra flows beyond the golden path (instructions.md ROLE, P7 item 6):
 *  (a) home renders the four showcase cards and each link resolves to a 200 page with the game title
 *  (b) /library filters work: domain link narrows the count, status=implemented shows only "playable" badges,
 *      search finds phase_gate
 *  (c) /play/fixture-trig -> end screen -> debrief post-check -> pre/post scores render
 *  (d) /debrief/fixture-cell-transport renders with the "no telemetry" note
 *  (e) regenerate button on the debrief of a generated game POSTs and lands on /forge/<jobId> whose
 *      stream ends in a game (P11.3 "regenerate-as-genre")
 * Zero console errors in every test.
 */

declare global {
  interface Window {
    __GAME_DEBUG__?: { state(): { finished: boolean }; autoSolve(): unknown };
  }
}

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.describe("home showcase", () => {
  test("renders the four offered genres, each resolving to a playable game, and no withdrawn ones", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    const cardLinks = page.getByTestId("ways-to-play").getByRole("link", { name: "Play" });
    await expect(cardLinks).toHaveCount(4);
    await expect(page.getByText(/side-view adventures|platformer|dungeon crawler|logic board/i)).toHaveCount(0);

    const hrefs = await cardLinks.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(hrefs.length).toBe(4);
    for (const href of hrefs) {
      if (!href) continue;
      const res = await page.request.get(href);
      expect(res.status(), `${href} should be 200`).toBe(200);
      // /play/[id] renders the game title in an <h1> once the client-only Phaser canvas mounts, rather
      // than falling through to the "can't be played" validation-error branch.
      await page.goto(href);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/can.t be played/i);
    }
    expect(errors).toEqual([]);
  });
});

test.describe("library filters", () => {
  test("domain link narrows the count, status filter, and search finds phase_gate", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/library");
    await expect(page.getByTestId("library-card").first()).toBeVisible();
    const allCountText = await page.getByRole("heading", { level: 2 }).filter({ hasText: /card/ }).first().innerText();
    const allCount = Number(allCountText.match(/\d+/)?.[0]);
    expect(allCount).toBeGreaterThan(0);

    // Domain filter narrows the count.
    const domainLink = page.locator('a[href*="domain="]').first();
    const domainHref = await domainLink.getAttribute("href");
    await domainLink.click();
    await page.waitForURL(new RegExp(domainHref!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const narrowedText = await page.getByRole("heading", { level: 2 }).filter({ hasText: /card/ }).first().innerText();
    const narrowed = Number(narrowedText.match(/\d+/)?.[0]);
    expect(narrowed).toBeGreaterThan(0);
    expect(narrowed).toBeLessThanOrEqual(allCount);

    // Status = implemented shows only "playable" badges.
    await page.goto("/library?status=implemented");
    await expect(page.getByTestId("library-card").first()).toBeVisible();
    const badgeTexts = await page.getByTestId("library-card").locator("span", { hasText: /playable|catalog/ }).allInnerTexts();
    expect(badgeTexts.length).toBeGreaterThan(0);
    expect(badgeTexts.every((t) => t.trim() === "playable")).toBe(true);

    // Search finds phase_gate.
    await page.goto("/library?q=phase_gate");
    await expect(page.getByTestId("library-card").first()).toBeVisible();
    await expect(page.getByText("phase_gate")).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test.describe("fixture play through to debrief", () => {
  test("fixture-trig end screen -> debrief post-check -> pre/post scores render", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/play/fixture-trig");
    await page.waitForFunction(() => typeof window.__GAME_DEBUG__ !== "undefined", null, { timeout: 60_000 });
    for (let i = 0; i < 30; i++) {
      const finished = await page.evaluate(() => window.__GAME_DEBUG__!.state().finished);
      if (finished) break;
      await page.evaluate(() => window.__GAME_DEBUG__!.autoSolve());
      await page.waitForTimeout(150);
    }
    await expect(page.getByTestId("end-screen")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: /debrief/i }).first().click();
    await page.waitForURL(/\/debrief\//, { timeout: 30_000 });
    await expect(page.getByTestId("postcheck")).toBeVisible();
    for (let i = 0; i < 3; i++) await page.getByTestId(`postcheck-${i}`).getByRole("radio").first().check();
    await page.getByTestId("postcheck-submit").click();
    await expect(page.getByTestId("pre-score")).toBeVisible();
    await expect(page.getByTestId("post-score")).toBeVisible();
    await expect(page.getByTestId("pre-score")).toHaveText(/\d\/\d/);
    await expect(page.getByTestId("post-score")).toHaveText(/\d\/\d/);

    expect(errors).toEqual([]);
  });
});

test.describe("debrief without telemetry", () => {
  test("/debrief/fixture-cell-transport renders with the no-telemetry note", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/debrief/fixture-cell-transport");
    for (let i = 0; i < 3; i++) await page.getByTestId(`postcheck-${i}`).getByRole("radio").first().check();
    await page.getByTestId("postcheck-submit").click();
    await expect(page.getByTestId("debrief")).toBeVisible();
    await expect(page.getByText(/no play telemetry was recorded/i)).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("regenerate as genre", () => {
  test("regenerate button POSTs and lands on a forge that ends in a game", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackConsoleErrors(page);

    // Run the upload flow first (golden-path helpers) so we have a real, non-fixture game.
    await page.goto("/");
    await page.getByTestId("file-input").setInputFiles(path.join(process.cwd(), "samples/trig-notes.pdf"));
    await page.waitForURL(/\/intake\//, { timeout: 60_000 });
    await expect(page.getByTestId("intake-form")).toBeVisible({ timeout: 60_000 });

    const sliders = page.locator('input[type="range"]');
    const n = await sliders.count();
    for (let i = 0; i < n; i++) await sliders.nth(i).fill(i === 1 ? "2" : "4");
    // The quick check is optional: build straight from the concepts step.
    await page.getByTestId("forge-button").click();

    await page.waitForURL(/\/forge\//, { timeout: 30_000 });
    await expect(page.getByTestId("forge-board")).toBeVisible();
    await page.waitForURL(/\/play\//, { timeout: 180_000 });
    const gameId = page.url().split("/play/")[1];
    expect(gameId).toBeTruthy();

    await page.goto(`/debrief/${gameId}`);
    for (let i = 0; i < 3; i++) await page.getByTestId(`postcheck-${i}`).getByRole("radio").first().check();
    await page.getByTestId("postcheck-submit").click();
    await expect(page.getByTestId("regenerate-button")).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/games/${gameId}/regenerate`) && r.request().method() === "POST"),
      page.getByTestId("regenerate-button").click(),
    ]);
    expect(response.ok()).toBe(true);

    await page.waitForURL(/\/forge\//, { timeout: 30_000 });
    await expect(page.getByTestId("forge-board")).toBeVisible();
    await page.waitForURL(/\/play\//, { timeout: 180_000 });

    expect(errors).toEqual([]);
  });
});
