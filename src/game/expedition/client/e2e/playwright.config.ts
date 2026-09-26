/**
 * Playwright config for the H2 client specs (docs/design/20 §7.2 H2): the root config (mock-mode dev server on
 * :3100, the `webgl` swiftshader and `dom` projects) with this directory as the test dir, so both projects run every
 * spec here. `pnpm exec playwright test -c src/game/expedition/client/e2e/playwright.config.ts`.
 * `EXPEDITION_E2E_URL=http://localhost:3000` points it at an already-running server instead (no webServer start).
 * TODO(w1): E3 adopts dev-world.spec.ts into e2e/ (outside diff in the H2 report); this config then goes away.
 */
import { defineConfig } from "@playwright/test";
import base from "../../../../../playwright.config";

const external = process.env.EXPEDITION_E2E_URL;

export default defineConfig({
  ...base,
  testDir: ".",
  outputDir: "../../../../../test-results/expedition-client",
  use: { ...base.use, baseURL: external ?? base.use?.baseURL },
  webServer: external ? undefined : base.webServer,
  projects: (base.projects ?? []).map((p) => ({ ...p, testMatch: /\.spec\.ts$/ })),
});
