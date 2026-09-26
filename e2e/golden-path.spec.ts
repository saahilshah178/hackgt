import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/*
 * The golden path in mock mode: upload samples/trig-notes.pdf → intake → forge → play (autoSolve via the
 * debug hook) → debrief shows a pre→post score. Zero console errors. One screenshot per page lands in
 * docs/overnight/screens/. Requires P5b (intake API) and P6 (job + SSE) to be in place.
 */

const SCREENS = path.join(process.cwd(), "docs/overnight/screens");
// caret: "initial" keeps Playwright from injecting a caret-color style mid-hydration (it shows up as a React
// hydration mismatch in the console, which would fail the zero-console-errors assertion).
const shot = async (page: Page, name: string) => {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.screenshot({ path: path.join(SCREENS, `${name}.png`), fullPage: true, caret: "initial" });
};

declare global {
  interface Window {
    __GAME_DEBUG__?: { state(): { finished: boolean }; autoSolve(): unknown };
  }
}

test.use({ viewport: { width: 1440, height: 900 } });

test("upload → intake → forge → play → debrief", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(page, "01-home");

  await page.getByTestId("file-input").setInputFiles(path.join(process.cwd(), "samples/trig-notes.pdf"));
  await page.waitForURL(/\/intake\//, { timeout: 60_000 });
  await expect(page.getByTestId("intake-form")).toBeVisible({ timeout: 60_000 });
  await shot(page, "02-intake");

  // Confidence: mark the graphs unit as weak; answer the three pre-check questions (any choice).
  const sliders = page.locator('input[type="range"]');
  const n = await sliders.count();
  for (let i = 0; i < n; i++) await sliders.nth(i).fill(i === 1 ? "2" : "4");
  for (let i = 0; i < 3; i++) await page.getByTestId(`precheck-${i}`).getByRole("radio").first().check();
  await page.getByTestId("forge-button").click();

  await page.waitForURL(/\/forge\//, { timeout: 30_000 });
  await expect(page.getByTestId("forge-board")).toBeVisible();
  await expect(page.getByTestId("agent-card").first()).toBeVisible({ timeout: 60_000 });
  await shot(page, "03-forge");

  await page.waitForURL(/\/play\//, { timeout: 180_000 });
  await page.waitForFunction(() => typeof window.__GAME_DEBUG__ !== "undefined", null, { timeout: 60_000 });
  await shot(page, "04-play");
  for (let i = 0; i < 30; i++) {
    const finished = await page.evaluate(() => window.__GAME_DEBUG__!.state().finished);
    if (finished) break;
    await page.evaluate(() => window.__GAME_DEBUG__!.autoSolve());
    await page.waitForTimeout(150);
  }
  await expect(page.getByTestId("end-screen")).toBeVisible({ timeout: 30_000 });
  await shot(page, "05-end-screen");

  await page.getByRole("link", { name: /debrief/i }).first().click();
  await page.waitForURL(/\/debrief\//, { timeout: 30_000 });
  await expect(page.getByTestId("postcheck")).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByTestId(`postcheck-${i}`).getByRole("radio").first().check();
  await page.getByTestId("postcheck-submit").click();
  await expect(page.getByTestId("pre-score")).toBeVisible();
  await expect(page.getByTestId("post-score")).toBeVisible();
  await expect(page.getByTestId("pre-score")).toHaveText(/\d\/3/);
  await shot(page, "06-debrief");

  await page.goto("/library");
  await expect(page.getByTestId("library-card").first()).toBeVisible();
  await shot(page, "07-library");

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});
