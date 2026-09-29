import { expect, test } from "@playwright/test";
import path from "node:path";
import type { World3DDebug } from "./helpers/world3d";
import { beginJourney, boot, client, collectErrors, debug, expectPhase, reachChoices } from "./helpers/world3d";

/*
 * The 3D open world (docs/design/60): the Ancient Egypt demo (fixture-ancient-egypt-world3d, mock mode) end to end, the
 * key bindings and panels, and the intake option. Runs in the `webgl` project (headless Chromium + SwiftShader, so the
 * three.js canvas really renders; slow, hence the long timeouts). Waits on data-phase and testids, not sleeps; the only
 * short settle is before the screenshots. Zero console errors is asserted on the golden path.
 *
 *   EXPEDITION_E2E_URL=http://localhost:3450 pnpm exec playwright test e2e/world3d.spec.ts --project=webgl
 */

test.describe("Ancient Egypt 3D world", () => {
  test.setTimeout(300_000);

  test("golden path: intro, explore, talk to Nebet, take a challenge, play to the end screen", async ({ page }) => {
    const errors = collectErrors(page);
    await boot(page);

    // intro -> begin -> opening dialogue -> explore, with the HUD up
    await beginJourney(page);
    for (const id of ["w3-tracker", "w3-compass", "w3-minimap"]) await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId("w3-leads")).toBeVisible();

    // Nebet the scribe (e3_signs): E opens her dialogue. Her challenge may still be locked at this point in the story.
    expect(await debug(page, (g) => g.world3d.warpTo("e3_signs"))).toBe(true);
    await expect(page.getByTestId("w3-prompt")).toContainText(/Talk to Nebet/i);
    await page.keyboard.press("e");
    await expectPhase(page, "dialogue");
    await expect(page.getByTestId("w3-dialogue")).toContainText("Nebet");
    await reachChoices(page);
    const nebetChoices = await debug(page, (g) => g.world3d.dialogue()?.choices ?? []);

    // take a challenge with key "1": Nebet's if her moment is open, else the first open lead that is a conversation
    if (!nebetChoices.includes("take")) {
      await page.keyboard.press("1"); // "Goodbye"
      await expectPhase(page, "explore");
      const talkLead = await (async () => {
        for (const id of await debug(page, (g) => g.world3d.leads())) {
          await debug(page, (g, i) => g.world3d.warpTo(i as string), id);
          // the target finder runs in the render loop (slow under SwiftShader): give it a few seconds to see the new position
          const found = await page
            .waitForFunction(() => {
              const t = (window as unknown as { __GAME_DEBUG__: World3DDebug }).__GAME_DEBUG__.world3d.target();
              return t?.kind === "npc" && t.id !== "nebet";
            }, null, { timeout: 4_000 })
            .then(() => true, () => false);
          if (found) return id;
        }
        return null;
      })();
      expect(talkLead, "an open lead with a character to talk to").not.toBeNull();
      await page.keyboard.press("e");
      await expectPhase(page, "dialogue");
      await reachChoices(page);
    }
    await expect(page.getByTestId("w3-choice-take")).toBeVisible();
    await page.keyboard.press("1"); // Take on the challenge
    await expectPhase(page, "challenge");
    await expect(page.getByTestId("w3-sheet")).toBeVisible();
    await expect(page.getByTestId("challenge-panel")).toBeVisible();
    await expect(page.getByTestId("lesson-card").or(page.getByTestId("widget-root")).first()).toBeVisible();
    await page.waitForTimeout(1_000); // settle before the screenshot
    await page.screenshot({ path: path.join("test-results", "world3d-challenge-sheet.png") });

    // leave it and let autoSolve play the rest of the ten encounters
    await page.keyboard.press("Escape");
    await expectPhase(page, "explore");
    for (let i = 0; i < 12; i++) {
      if ((await client(page).getAttribute("data-phase")) === "ended") break;
      await debug(page, (g) => g.autoSolve());
      await expect(client(page)).toHaveAttribute("data-phase", /explore|ended/);
    }
    await expectPhase(page, "ended");
    await expect(page.getByTestId("end-screen")).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("interaction details: E prompt, journal (J), map (M), pause (Esc)", async ({ page }) => {
    const errors = collectErrors(page);
    await boot(page);
    await beginJourney(page);

    // the E prompt names the character in reach
    await debug(page, (g) => g.world3d.warpTo("e3_signs"));
    await expect(page.getByTestId("w3-prompt")).toContainText(/^E\s*Talk to /i);

    // J opens the journal, Escape closes it
    await page.keyboard.press("j");
    await expect(page.getByTestId("w3-journal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("w3-journal")).toHaveCount(0);

    // M opens the full map, Escape closes it
    await page.keyboard.press("m");
    await expect(page.getByTestId("w3-map")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("w3-map")).toHaveCount(0);

    // Escape in explore opens the pause menu; Escape again resumes
    await expectPhase(page, "explore");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("w3-pause")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("w3-pause")).toHaveCount(0);
    await expectPhase(page, "explore");

    expect(errors).toEqual([]);
  });
});

test.describe("intake: 3D open world option", () => {
  test.setTimeout(120_000);

  test("the genre step offers the 3D open world and it is selectable", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && !/WebSocket|_next\/hmr/.test(m.text()) && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await page.getByTestId("file-input").setInputFiles(path.join(process.cwd(), "samples/trig-notes.pdf"));
    await page.waitForURL(/\/intake\//, { timeout: 60_000 });
    await expect(page.getByTestId("intake-form")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("step-next").click(); // concepts -> quick check, where the genre picker lives
    await expect(page.getByTestId("clarify-step")).toBeVisible();

    const option = page.getByTestId("genre-world3d");
    await option.scrollIntoViewIfNeeded();
    await expect(option).toBeVisible();
    await expect(option).toContainText(/3D/);
    const radio = option.getByRole("radio");
    await expect(radio).toBeEnabled(); // WebGL2 is on in this project, so the option is not greyed out
    await radio.check();
    await expect(radio).toBeChecked();

    // the choice goes into the build request as genre "world3d" (the request is aborted: this test only checks the intake)
    let genre: string | undefined;
    await page.route("**/api/games", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      genre = (route.request().postDataJSON() as { intake: { genre: string } }).intake.genre;
      await route.abort();
    });
    for (let i = 0; i < 3; i++) await page.getByTestId(`precheck-${i}`).getByRole("radio").first().check();
    await page.getByTestId("forge-button").click();
    await expect.poll(() => genre, { timeout: 15_000 }).toBe("world3d");
  });
});
