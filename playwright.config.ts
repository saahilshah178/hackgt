import { defineConfig, devices } from "@playwright/test";

/*
 * E2E runs the app in mock mode: no keys, no network calls to paid APIs.
 *
 * Two projects (docs/design/20-expedition-architecture.md §7.0, §7.5 risk "Headless Chromium has no WebGL"):
 *  - `webgl` — Phaser's real path. Headless Chromium has no GPU, so we force ANGLE's SwiftShader software
 *    rasterizer (`--use-gl=angle --use-angle=swiftshader`) so `phaser-host` actually renders instead of the
 *    legacy hosts' own WebGL-detection fallback silently swapping in `dom-host`. Every existing spec plus the
 *    keyboard spec (F9: one WebGL keyboard e2e per control kind, doc §7.5) runs only here.
 *  - `dom` — the documented `?renderer=dom` escape hatch (decision 12) that forces the DOM fallback host
 *    (static snapshots + the full panel) for the Expedition path. Only the Expedition game specs need a DOM
 *    run; the legacy fixtures (dungeon/platformer/mystery) have no `world` to resolve, so `?renderer=dom` is a
 *    no-op for them (Appendix B: "the legacy path is untouched when `world` is null") and they are not
 *    duplicated onto this project.
 *
 * `e2e/helpers/expedition.ts` reads `testInfo.project.name` to append `renderer=dom` and to pick the right
 * host testid (`phaser-host` vs `dom-host`) so the same `expedition-{trig,cell,civil,express}.spec.ts` files
 * run unmodified on both projects (§8.2).
 */
const EXPEDITION_SPEC_PATTERN = /expedition-(trig|cell|civil|express|client)\.spec\.ts$/;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "webgl",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] },
      },
    },
    {
      name: "dom",
      testMatch: EXPEDITION_SPEC_PATTERN,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      LLM_MODE: "mock",
      STORAGE_DRIVER: "local",
      AUDIO_MODE: "off",
      EXPEDITION_SFX: "off",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
