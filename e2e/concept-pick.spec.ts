import { expect, test } from "@playwright/test";
import path from "node:path";

/*
 * The student picks exactly which concepts the game covers. The length caps how many (5 → 4, 10 → 7,
 * 15 → 10, CONCEPTS_PER_GAME): past the cap the remaining boxes lock, shortening the game past the
 * current selection blocks Next until some are unticked, and the game is built on precisely the
 * ticked concepts (no server-side focusing). Mock mode: the cell-transport sample has 9 concepts.
 */

test.use({ viewport: { width: 1440, height: 900 } });

test("the length caps the pick, and the game covers exactly the ticked concepts", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles(path.join(process.cwd(), "samples/cell-transport.pdf"));
  await page.waitForURL(/\/intake\//, { timeout: 60_000 });
  await expect(page.getByTestId("intake-form")).toBeVisible({ timeout: 60_000 });

  // 9 concepts > 7 for the default 10 minutes: nothing is pre-ticked, the student chooses.
  await expect(page.getByTestId("big-upload-note")).toBeVisible();
  const boxes = page.locator('input[data-testid^="concept-"]');
  await expect(boxes).toHaveCount(9);
  for (let i = 0; i < 9; i++) await expect(boxes.nth(i)).not.toBeChecked();
  await expect(page.getByTestId("step-next")).toBeDisabled();

  for (let i = 0; i < 7; i++) await boxes.nth(i).check();
  await expect(page.getByTestId("selection-summary")).toContainText("7 of up to 7 picked");
  await expect(boxes.nth(7)).toBeDisabled();
  await expect(boxes.nth(8)).toBeDisabled();

  // Shorter game than the selection: blocked until three come off.
  await page.getByTestId("minutes-5").check();
  await expect(page.getByTestId("over-cap-note")).toBeVisible();
  await expect(page.getByTestId("step-next")).toBeDisabled();
  for (const i of [0, 2, 4]) await boxes.nth(i).uncheck();
  await expect(page.getByTestId("over-cap-note")).toHaveCount(0);
  const picked: string[] = [];
  for (let i = 0; i < 9; i++) {
    if (await boxes.nth(i).isChecked()) picked.push((await boxes.nth(i).getAttribute("data-testid"))!.replace(/^concept-/, ""));
  }
  expect(picked).toHaveLength(4);

  await page.getByTestId("step-next").click();
  await page.getByTestId("step-next").click();
  for (let i = 0; i < 3; i++) await page.getByTestId(`precheck-${i}`).getByRole("radio").first().check({ timeout: 30_000 });
  const gamesRequest = page.waitForRequest((r) => r.url().endsWith("/api/games") && r.method() === "POST");
  await page.getByTestId("forge-button").click();
  const body = (await gamesRequest).postDataJSON() as { intake: { minutes: number; conceptIds: string[] } };
  expect(body.intake.minutes).toBe(5);
  expect([...body.intake.conceptIds].sort()).toEqual([...picked].sort());

  await page.waitForURL(/\/play\//, { timeout: 180_000 });
  const gameId = page.url().split("/play/")[1].split(/[?#]/)[0];
  const game = await (await page.request.get(`/api/games/${gameId}`)).json();
  expect(game.spec.concepts.map((c: { id: string }) => c.id).sort()).toEqual([...picked].sort());
});
