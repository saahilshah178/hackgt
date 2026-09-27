import { expect, test, type Page, type TestInfo } from "@playwright/test";

/*
 * H2 acceptance (docs/design/20 §7.2): the dev world (H1's devWorld(): two zones, one station per control kind, a
 * boss, a sandbox) played through the REAL ExpeditionClient at /dev/expedition/client, on both projects:
 *   intro → explore → panel → wrong (draft kept) → right → payoff → finale → EndScreen,
 * plus express (the client walks to each console and opens it) and the `?host=legacy` escape hatch.
 * Every test ends with zero console errors (§8.2).
 */

type Phase = "loading" | "intro" | "explore" | "cutscene" | "panel" | "resolving" | "payoff" | "sandbox" | "finale" | "finished";
interface Debug {
  state(): { finished: boolean; index: number; encounterId: string | null };
  autoSolve(): void;
  expedition?: {
    host(): { ready: boolean; zoneId: string; playerX: number; contraption(id?: string): Record<string, number | string | boolean> | null } | null;
    phase(): Phase;
    dialogue(): { speakerId: string; text: string; typing: boolean } | null;
    openPanel(): void;
    applySolutionDraft(): void;
    setProbe(v: number): void;
    hint(): void;
  };
}
/** Not an intersection with Window: other specs declare their own global `__GAME_DEBUG__` shape (see src/game/debug.ts). */
type W = { __GAME_DEBUG__?: Debug };

const dom = (t: TestInfo) => t.project.name === "dom";
const url = (t: TestInfo, path: string) => `${path}${path.includes("?") ? "&" : "?"}debug=1${dom(t) ? "&renderer=dom" : ""}`;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const phase = (page: Page) => page.evaluate(() => (window as unknown as W).__GAME_DEBUG__?.expedition?.phase() ?? null);
const call = (page: Page, fn: "openPanel" | "applySolutionDraft" | "hint") => page.evaluate((f) => (window as unknown as W).__GAME_DEBUG__!.expedition![f](), fn);

/** Waits for one of `want`, advancing blocking lines with Space the way a player would. */
async function until(page: Page, want: Phase[], ms = 45_000): Promise<Phase> {
  const t0 = Date.now();
  for (;;) {
    const p = await phase(page);
    if (p && want.includes(p)) return p;
    if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${want.join("|")}; phase is ${p}`);
    const d = await page.evaluate(() => (window as unknown as W).__GAME_DEBUG__?.expedition?.dialogue() ?? null);
    if (d && !d.typing) await page.keyboard.press("Space");
    await page.waitForTimeout(250);
  }
}

async function boot(page: Page, testInfo: TestInfo, path = "/dev/expedition/client") {
  // the dev spec is not stored, so the end screen's telemetry POST would 404 (a console error): answer it here
  await page.route("**/api/games/*/telemetry", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"count":0}' }));
  await page.goto(url(testInfo, path));
  await expect(page.getByTestId(dom(testInfo) ? "dom-host" : "phaser-host")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => (window as unknown as W).__GAME_DEBUG__?.expedition?.host()?.ready === true, null, { timeout: 30_000 });
}

test.describe("expedition client: the dev world", () => {
  test.setTimeout(180_000);

  test("intro → explore → panel → wrong (draft kept) → right → payoff → finale → end screen", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await boot(page, testInfo);

    // intro: the guide speaks on the bar (blocking), then the player is free
    await until(page, ["intro"]);
    await expect(page.getByTestId("cutscene-skip")).toBeVisible();
    await expect.poll(async () => (await page.evaluate(() => (window as unknown as W).__GAME_DEBUG__!.expedition!.dialogue()))?.speakerId, { timeout: 30_000 }).toBe("cog");
    await until(page, ["explore"]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/dev meadow/i);

    // explore: D walks right
    const x0 = await page.evaluate(() => (window as unknown as W).__GAME_DEBUG__!.expedition!.host()!.playerX);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(700);
    await page.keyboard.up("KeyD");
    await expect.poll(() => page.evaluate(() => (window as unknown as W).__GAME_DEBUG__!.expedition!.host()!.playerX)).toBeGreaterThan(x0);

    // panel: the first station (a scrub control) with its instruction pinned
    await call(page, "openPanel");
    await until(page, ["panel"]);
    const panel = page.getByTestId("instrument-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("dialogue-pin-primary")).toContainText("Vesper Dial");
    const slider = page.getByRole("slider").and(page.getByTestId("scrubber"));

    // wrong: resolving → back to the SAME panel; the fail line and the feedback show; the draft is kept
    await page.evaluate(() => (window as unknown as W).__GAME_DEBUG__!.expedition!.setProbe(0));
    await expect(slider).toHaveAttribute("aria-valuenow", "0");
    await page.getByTestId("widget-submit").click();
    await until(page, ["panel"]);
    await expect(page.getByTestId("dialogue-pin-secondary")).toHaveAttribute("data-kind", "feedback");
    await expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect((await page.evaluate(() => (window as unknown as W).__GAME_DEBUG__!.state())).index).toBe(0);

    // a hint rung reaches the world (aid tier) and the (i) label
    await call(page, "hint");
    await expect(page.getByTestId("hint-button")).toHaveAttribute("aria-label", /1 of 3 used/);
    if (!dom(testInfo)) {
      await expect.poll(() => page.evaluate(() => (window as unknown as W).__GAME_DEBUG__!.expedition!.host()!.contraption("e1_radians")?.aidTier)).toBe(1);
    }

    // right: the success badge, the payoff, then explore with the runner advanced
    await call(page, "applySolutionDraft");
    await page.getByTestId("widget-submit").click();
    await expect(page.getByTestId("success-badge")).toBeVisible({ timeout: 15_000 });
    expect(await until(page, ["payoff", "explore"])).toBeTruthy();
    await until(page, ["explore"]);
    await expect(panel).toBeHidden();
    expect((await page.evaluate(() => (window as unknown as W).__GAME_DEBUG__!.state())).encounterId).toBe("e2_period");

    // autoSolve to the boss (D3: the world follows the runner without animating)
    for (let i = 0; i < 12; i++) {
      const s = await page.evaluate(() => (window as unknown as W).__GAME_DEBUG__!.state());
      if (s.encounterId === "e12_boss") break;
      await page.evaluate(() => (window as unknown as W).__GAME_DEBUG__!.autoSolve());
    }
    expect((await page.evaluate(() => (window as unknown as W).__GAME_DEBUG__!.state())).encounterId).toBe("e12_boss");

    // the boss: the vault panel, solved → the FINALE plays before the end screen (D2)
    await call(page, "openPanel");
    await until(page, ["panel"]);
    await expect(panel).toHaveAttribute("data-layout", "vault");
    await call(page, "applySolutionDraft");
    await page.getByTestId("widget-submit").click();
    await expect(page.getByTestId("success-badge")).toBeVisible({ timeout: 15_000 });
    await until(page, ["finale"]);
    await expect(page.getByTestId("end-screen")).toBeHidden();
    await until(page, ["finished"], 60_000);
    await expect(page.getByTestId("end-screen")).toBeVisible();
    expect((await page.evaluate(() => (window as unknown as W).__GAME_DEBUG__!.state())).finished).toBe(true);

    expect(errors, `console/page errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("express: the client walks to each console and opens it; Verify is the only input", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await boot(page, testInfo, "/dev/expedition/client?express=1");
    await expect(page.getByTestId("express-badge")).toBeVisible();
    // the intro is trimmed and its lines advance on their own; the player walks to the first console
    await until(page, ["panel"], 60_000);
    await expect(page.getByTestId("instrument-panel")).toHaveAttribute("data-encounter", "e1_radians");
    await call(page, "applySolutionDraft");
    await page.getByTestId("widget-submit").click();
    await expect(page.getByTestId("success-badge")).toBeVisible({ timeout: 15_000 });
    // …and on to the next station without a key press
    await expect(page.getByTestId("instrument-panel")).toHaveAttribute("data-encounter", "e2_period", { timeout: 60_000 });
    expect(errors, `console/page errors:\n${errors.join("\n")}`).toEqual([]);
  });
});

test.describe("play page: world resolution and the legacy escape hatch", () => {
  test.setTimeout(120_000);

  test("/play/fixture-trig boots the Expedition; ?host=legacy is the old client", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await boot(page, testInfo, "/play/fixture-trig");
    await expect(page.getByTestId("expedition-layout")).toBeVisible();
    await expect(page.getByTestId("zone-title")).toHaveCount(1);

    await page.goto("/play/fixture-trig?debug=1&host=legacy");
    await page.waitForFunction(() => typeof (window as unknown as W).__GAME_DEBUG__ !== "undefined", null, { timeout: 30_000 });
    await expect(page.getByTestId("expedition-layout")).toHaveCount(0);
    expect(await page.evaluate(() => typeof (window as unknown as W).__GAME_DEBUG__?.expedition)).toBe("undefined");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Sky Clock");
    expect(errors, `console/page errors:\n${errors.join("\n")}`).toEqual([]);
  });
});
