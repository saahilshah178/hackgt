import { expect, test } from "@playwright/test";
import { activateControl, adventureRoutes, readAdventureFixture, solveRelay, submitFirstEncounter } from "./adventure-helpers";

for (const demo of adventureRoutes) {
  test(`${demo.route}: explore, collect, converse, repair relay and apparatus, then depart`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const spec = readAdventureFixture(demo.fixture);
    await page.goto(`/play/${demo.route}`);
    await expect(page.getByRole("heading", { name: demo.title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Begin expedition/ }).click();
    await page.getByRole("button", { name: "Collect field note", exact: true }).click();
    await expect(page.getByRole("button", { name: /Note collected/ })).toBeVisible();
    await page.getByRole("button", { name: "Open field journal" }).click();
    await expect(page.locator(".adventure-journal-entry")).toHaveCount(1);
    await page.getByRole("button", { name: "Return to exploration" }).click();
    await page.getByRole("button", { name: "Talk to guide", exact: true }).click();
    await expect(page.getByRole("button", { name: "What needs to happen here?" })).toBeVisible();
    await page.getByRole("button", { name: /Back to the expedition/ }).click();
    await solveRelay(page, spec.seed);
    await page.getByRole("button", { name: "Inspect apparatus", exact: true }).click();
    await expect(page.getByTestId("adventure-instrument")).toBeVisible();
    await submitFirstEncounter(page, spec, false);
    await expect(page.locator(".adventure-feedback")).toBeVisible();
    await page.getByRole("button", { name: "Return to exploration" }).click();
    await expect(page.getByTestId("adventure-instrument")).toBeHidden();
    await page.getByRole("button", { name: "Inspect apparatus", exact: true }).click();
    await submitFirstEncounter(page, spec, true);
    await expect(page.getByText("MISSION COMPLETE", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${demo.route}-restored.png`), fullPage: true });
    await page.getByRole("button", { name: /^Continue/ }).last().click();
    await expect(page.locator(".adventure-location-number")).toContainText("02");
    await expect(page.getByRole("button", { name: /Note collected/ })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("keyboard movement, relay rotations, apparatus submission and departure", async ({ page }) => {
  const spec = readAdventureFixture("trig-dungeon");
  await page.goto("/play/fixture-trig");
  await activateControl(page.getByRole("button", { name: /Begin expedition/ }), true);
  const world = page.getByRole("group", { name: /exploration\./ }).first();
  await world.focus();
  const actor = page.locator(".adventure-player");
  const initial = await actor.evaluate(element => parseFloat((element as HTMLElement).style.left));
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => actor.evaluate(element => parseFloat((element as HTMLElement).style.left))).toBeGreaterThan(initial + 3);
  await page.keyboard.up("ArrowRight");
  await solveRelay(page, spec.seed, true);
  await activateControl(page.getByRole("button", { name: "Inspect apparatus", exact: true }), true);
  await submitFirstEncounter(page, spec, true, true);
  await activateControl(page.getByRole("button", { name: /^Continue/ }).last(), true);
  await expect(page.locator(".adventure-location-number")).toContainText("02");
});

test("mobile reduced-motion scene and membrane apparatus remain usable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const spec = readAdventureFixture("cell-transport-dungeon");
  await page.goto("/play/fixture-cell-transport");
  await page.getByRole("button", { name: /Begin expedition/ }).click();
  await solveRelay(page, spec.seed);
  await page.getByRole("button", { name: "Inspect apparatus", exact: true }).click();
  await expect(page.getByTestId("adventure-instrument")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("cell-mobile-instrument.png"), fullPage: true });
  await submitFirstEncounter(page, spec, true);
  await expect(page.getByText("MISSION COMPLETE", { exact: true })).toBeVisible();
});
