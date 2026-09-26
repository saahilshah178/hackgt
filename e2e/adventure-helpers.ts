import { readFileSync } from "node:fs";
import { expect, type Locator, type Page } from "@playwright/test";
import type { GameSpec } from "../src/contracts/gamespec";
import { createRelayBoard } from "../src/game/adventure/relay-board";

export const adventureRoutes = [
  { route: "fixture-trig", fixture: "trig-dungeon", title: "The Last Light of Meridian" },
  { route: "fixture-cell-transport", fixture: "cell-transport-dungeon", title: "The Living Sanctuary" },
  { route: "fixture-civil-rights-mystery", fixture: "civil-rights-mystery", title: "The Unfinished Public Record" },
  { route: "fixture-trig-platformer", fixture: "trig-platformer", title: "Meridian's Skywalk" },
  { route: "fixture-wave2", fixture: "wave2-dungeon", title: "The Nine Systems of Aurora" },
] as const;

export function readAdventureFixture(name: string): GameSpec {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8")) as GameSpec;
}

export async function activateControl(control: Locator, keyboard = false) {
  if (keyboard) { await control.focus(); await control.press("Enter"); }
  else await control.click();
}

/** All puzzle actions use UI; the known seeded board provides repeatable fixture rotations. */
export async function solveRelay(page: Page, seed: number, keyboard = false) {
  await activateControl(page.getByRole("button", { name: "Activate relay", exact: true }), keyboard);
  const puzzle = page.getByRole("region", { name: "Relay routing challenge" });
  await expect(puzzle).toBeVisible();
  const send = puzzle.getByRole("button", { name: /Send light|Release nutrients|Switch on lamp|Send power/ });
  await activateControl(send, keyboard);
  await expect(puzzle.getByRole("status")).toContainText("stops before the receiver");
  const board = createRelayBoard(seed);
  for (let index = 0; index < board.length; index++) {
    const tile = puzzle.getByRole("button", { name: new RegExp(`^Rotate conduit row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1};`) });
    for (let turn = 0; turn < (4 - board[index].rotation) % 4; turn++) await activateControl(tile, keyboard);
  }
  await expect(puzzle.getByText("Receiver reached", { exact: false })).toBeVisible();
  await activateControl(send, keyboard);
  await expect(page.getByRole("button", { name: /Relay linked/ })).toBeVisible();
}

export async function submitFirstEncounter(page: Page, spec: GameSpec, correct: boolean, keyboard = false) {
  const encounter = spec.encounters[0];
  if (encounter.mode === "mimic") {
    const params = encounter.params as { statements: { text: string; isTrue: boolean }[] };
    const statement = params.statements.find(entry => entry.isTrue !== correct)!;
    await activateControl(page.getByTestId("adventure-instrument").getByRole("button").filter({ hasText: statement.text }), keyboard);
  } else if (encounter.mode === "number_line") {
    await page.getByTestId("number-line-slider").fill(correct ? String(5 / 12) : "0");
  } else if (encounter.mode === "slope") {
    await page.getByTestId("adventure-instrument").locator('input[type="range"]').fill(correct ? "0.705" : "0");
  } else throw new Error(`Unsupported first encounter ${encounter.mode}`);
  await activateControl(page.getByTestId("widget-submit"), keyboard);
}
