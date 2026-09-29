import { expect, type Locator, type Page } from "@playwright/test";

/*
 * Shared helpers for the world3d (3D open world) e2e specs. The game is driven the way a player would (keyboard, testids,
 * data-phase) wherever that is reliable, and through `window.__GAME_DEBUG__` (World3DClient.tsx) for teleporting, which
 * a real player does by walking. Wait on data-phase and testids, never on timeouts.
 */

export const EGYPT = "/play/fixture-ancient-egypt-world3d";

export interface World3DDebug {
  state(): { finished: boolean; encounterId: string | null };
  autoSolve(): void;
  board: { available(): string[]; solved(): string[]; open(id: string): void; dismissLesson(): void };
  world3d: {
    phase(): string;
    begin(): void;
    choose(id: string): void;
    warpTo(id: string): boolean;
    interact(): void;
    leads(): string[];
    dialogue(): { lines: string[]; choices: string[] } | null;
    target(): { kind: string; id: string; label?: string } | null;
  };
}

/** Page and console errors, minus the dev server's HMR socket noise. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/WebSocket|_next\/hmr/.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

export const client = (page: Page): Locator => page.getByTestId("world3d-client");

export async function expectPhase(page: Page, phase: string, timeout = 60_000) {
  await expect(client(page)).toHaveAttribute("data-phase", phase, { timeout });
}

/** Runs `fn` against the debug handle in the page. */
export function debug<T, A = undefined>(page: Page, fn: (g: World3DDebug, arg: A) => T, arg?: A): Promise<T> {
  return page.evaluate(
    ([src, a]) => new Function("g", "a", `return (${src})(g, a)`)((window as unknown as { __GAME_DEBUG__: World3DDebug }).__GAME_DEBUG__, a) as T,
    [fn.toString(), arg] as const,
  );
}

/** Load the game and wait until the debug handle and the intro are up. */
export async function boot(page: Page, path = EGYPT) {
  await page.goto(`${path}?debug=1`);
  await page.waitForFunction(() => !!(window as unknown as { __GAME_DEBUG__?: { world3d?: unknown } }).__GAME_DEBUG__?.world3d, null, { timeout: 90_000 });
  await expectPhase(page, "intro", 90_000);
  await expect(page.getByTestId("w3-intro")).toBeVisible();
}

/** Space through the lines until the choices show (the typewriter finishes, then the next line, then the choices). */
export async function reachChoices(page: Page) {
  const choice = page.locator('[data-testid^="w3-choice-"]').first();
  for (let i = 0; i < 40 && !(await choice.isVisible()); i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(80);
  }
  await expect(choice).toBeVisible();
}

/** Skip the flyover if it is running, press Begin, and take the opening dialogue's "Let's begin". */
export async function beginJourney(page: Page) {
  const skip = page.getByRole("button", { name: /skip/i });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.getByTestId("w3-begin").click();
  await expect(page.getByTestId("w3-dialogue")).toBeVisible();
  await reachChoices(page);
  await page.getByTestId("w3-choice-go").click();
  await expectPhase(page, "explore");
}
