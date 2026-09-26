/**
 * scripts/capture-scenes.ts — the visual fidelity capture loop (docs/design/20-expedition-architecture.md §7.2
 * item E1/E3, §8.3 step 2 "Capture").
 *
 * `pnpm exec tsx scripts/capture-scenes.ts [--game trig|cell|civil|all] [--round 1] [--tier P0|P1]
 *   [--base-url http://localhost:3100] [--out docs/design/fidelity]`
 *
 * Reads `docs/design/fidelity/shots.json`, drives each shot through `__GAME_DEBUG__.expedition` (§2.10:
 * `skipTo`/`openPanel`/`setProbe`/`hint`/`freeze(true)` — `skipTo` is the legacy-core `GameDebugHandle` member;
 * everything else is the Expedition extension) exactly the way the doc's e2e helpers do, and writes
 * `docs/design/fidelity/<game>/round-<n>/<shot>.png` plus a `metrics.json` (fps, draw objects, and for `scrub`
 * shots a 3-frame strip + input-to-first-reaction latency, §8.3 items 30/38/41).
 *
 * `score.json` is NOT written here — §8.3 step 3 has the critic (read-only, opus) produce that JSON; this script
 * only captures the evidence the critic reads.
 *
 * Launches Chromium the same way the `webgl` Playwright project does (playwright.config.ts:
 * `--use-gl=angle --use-angle=swiftshader`), because headless Chromium has no GPU and Phaser needs WebGL
 * (§7.5 risk "Headless Chromium has no WebGL").
 *
 * Graceful when a game's world isn't resolved yet (H1/H2 not landed, or that game's side-car has no stations):
 * logs a warning and skips the game instead of hanging on every shot's `host()?.ready` wait. Exits 0 in that
 * case so this script is safe to run — and useful to smoke-test — before every lane above E1 in the critical
 * path has shipped.
 */
import { chromium, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------------------------------------------
// shots.json shape (docs §8.3 step 1)
// ---------------------------------------------------------------------------------------------------------------

type CaptureKind = "establish" | "scrub" | "probe" | "fail" | "hint" | "success" | "payoff" | "boss" | "dialogue" | "finale" | "legibility";

interface Shot {
  id: string;
  kind: CaptureKind;
  encounterId: string | null;
  zoneId?: string;
  probe?: number;
  viewport?: { width: number; height: number };
  description: string;
}

interface GameShots {
  fixtureId: string;
  specId: string;
  biome: string;
  zones: string[];
  shots: Shot[];
}

interface ShotsFile {
  version: number;
  games: Record<string, GameShots>;
}

// ---------------------------------------------------------------------------------------------------------------
// __GAME_DEBUG__.expedition (docs §2.10) — same shape as e2e/helpers/expedition.ts, duplicated narrowly here so
// this standalone script has no dependency on the Playwright *test* runner types.
// ---------------------------------------------------------------------------------------------------------------

interface ExpeditionHostDebug {
  ready: boolean;
  fps: number;
  drawObjects: number;
  contraption: (encounterId?: string) => Record<string, number | string | boolean> | null;
}

interface ExpeditionDebugApi {
  host(): ExpeditionHostDebug | null;
  setProbe(value: number): void;
  openPanel(): void;
  applySolutionDraft(): void;
  hint(): void;
  freeze(on: boolean): void;
}

interface DebugHandle {
  skipTo(encounterId: string): void;
  expedition?: ExpeditionDebugApi;
}

type DebugWindow = Window & { __GAME_DEBUG__?: DebugHandle };

/**
 * Calls one `__GAME_DEBUG__.expedition` method by name (mirrors `callExpedition` in
 * e2e/helpers/expedition.ts). `method` and `args` are plain, JSON-serializable values Playwright can pass
 * across the page boundary — no `eval`, no function serialization.
 */
function callExpedition<K extends keyof ExpeditionDebugApi>(
  page: Page,
  method: K,
  ...args: Parameters<ExpeditionDebugApi[K]>
): Promise<ReturnType<ExpeditionDebugApi[K]> | null> {
  return page.evaluate(
    ({ method, args }) => {
      const api = (window as unknown as DebugWindow).__GAME_DEBUG__?.expedition as
        | Record<string, (...a: unknown[]) => unknown>
        | undefined;
      return api ? api[method](...(args as unknown[])) : null;
    },
    { method, args },
  ) as Promise<ReturnType<ExpeditionDebugApi[K]> | null>;
}

const hostOf = (page: Page) => callExpedition(page, "host");
const openPanel = (page: Page) => callExpedition(page, "openPanel");
const setProbe = (page: Page, v: number) => callExpedition(page, "setProbe", v);
const applySolutionDraft = (page: Page) => callExpedition(page, "applySolutionDraft");
const hintOf = (page: Page) => callExpedition(page, "hint");
const freezeOf = (page: Page, on: boolean) => callExpedition(page, "freeze", on);

async function hostReady(page: Page, timeoutMs: number): Promise<boolean> {
  try {
    await page.waitForFunction(() => (window as unknown as DebugWindow).__GAME_DEBUG__?.expedition?.host()?.ready === true, null, {
      timeout: timeoutMs,
    });
    return true;
  } catch {
    return false;
  }
}

async function hostMetrics(page: Page): Promise<{ fps: number; drawObjects: number } | null> {
  const h = await hostOf(page);
  return h ? { fps: h.fps, drawObjects: h.drawObjects } : null;
}

// ---------------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------------

const args = process.argv.slice(2);
function argVal(flag: string, fallback: string): string {
  const at = args.indexOf(flag);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
}

const gameFilter = argVal("--game", "all");
const round = Number.parseInt(argVal("--round", "1"), 10);
const tier = argVal("--tier", "P0");
const baseUrl = argVal("--base-url", "http://localhost:3100");
const outDir = argVal("--out", "docs/design/fidelity");
const READY_TIMEOUT_MS = 10_000;

async function loadShots(): Promise<ShotsFile> {
  const raw = await readFile(path.join(process.cwd(), "docs/design/fidelity/shots.json"), "utf8");
  return JSON.parse(raw) as ShotsFile;
}

async function captureGame(game: string, spec: GameShots): Promise<void> {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(`${baseUrl}/play/${spec.fixtureId}?debug=1`);
    if (!(await hostReady(page, READY_TIMEOUT_MS))) {
      console.warn(
        `capture-scenes: ${game} — __GAME_DEBUG__.expedition.host() never became ready within ${READY_TIMEOUT_MS}ms ` +
          `(the world may not be resolved yet: no stations in fixtures/worlds/*.world.json, or H1/H2 haven't landed). Skipping.`,
      );
      return;
    }

    const gameDir = path.join(process.cwd(), outDir, game, `round-${round}`);
    await mkdir(gameDir, { recursive: true });
    const metrics: Record<string, unknown> = { game, round, tier, capturedAt: new Date().toISOString() };

    for (const shot of spec.shots) {
      await page.setViewportSize(shot.viewport ?? { width: 1920, height: 1080 });
      if (shot.encounterId) {
        await page.evaluate((id) => (window as unknown as DebugWindow).__GAME_DEBUG__?.skipTo(id), shot.encounterId);
      }

      const shotMetrics: Record<string, unknown> = { kind: shot.kind, description: shot.description };

      switch (shot.kind) {
        case "establish":
          break;
        case "scrub": {
          await openPanel(page);
          await freezeOf(page, true);
          const t0 = Date.now();
          const strip: string[] = [];
          for (let i = 0; i < 3; i++) {
            await page.keyboard.press("ArrowRight");
            const framePath = `${shot.id}-frame${i}.png`;
            await page.screenshot({ path: path.join(gameDir, framePath) });
            strip.push(framePath);
            if (i === 0) shotMetrics.latencyMs = Date.now() - t0;
          }
          shotMetrics.strip = strip;
          await freezeOf(page, false);
          break;
        }
        case "probe":
          await openPanel(page);
          if (typeof shot.probe === "number") await setProbe(page, shot.probe);
          break;
        case "fail":
          await openPanel(page);
          await page.getByTestId("widget-submit").click({ trial: true }).catch(() => undefined);
          break;
        case "hint":
          await openPanel(page);
          await hintOf(page);
          break;
        case "success":
        case "payoff":
          await openPanel(page);
          await applySolutionDraft(page);
          await page.getByTestId("widget-submit").click().catch(() => undefined);
          await page.waitForTimeout(500);
          break;
        case "boss":
        case "dialogue":
        case "finale":
        case "legibility":
          break;
      }

      const finalPath = `${shot.id}.png`;
      await page.screenshot({ path: path.join(gameDir, finalPath) });
      const m = await hostMetrics(page);
      if (m) Object.assign(shotMetrics, m);
      metrics[shot.id] = shotMetrics;
    }

    metrics.consoleErrors = errors;
    await writeFile(path.join(gameDir, "metrics.json"), JSON.stringify(metrics, null, 2));
    console.log(`capture-scenes: ${game} — wrote ${spec.shots.length} shot(s) to ${gameDir}`);
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const shots = await loadShots();
  const games = gameFilter === "all" ? Object.keys(shots.games) : [gameFilter];
  for (const game of games) {
    const spec = shots.games[game];
    if (!spec) {
      console.warn(`capture-scenes: unknown game "${game}" (known: ${Object.keys(shots.games).join(", ")})`);
      continue;
    }
    await captureGame(game, spec);
  }
}

main().catch((err) => {
  console.error("capture-scenes: fatal", err);
  process.exit(1);
});
