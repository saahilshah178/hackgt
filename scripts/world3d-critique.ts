import { chromium, type Page } from "@playwright/test";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModel } from "ai";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getCriticModel } from "../src/pipeline/models";
import {
  mockVisionSlice,
  runVisionCritic,
  toVisionReport,
  toVisionVerdict,
  visionMarkdown,
  type VisionShot,
} from "../src/pipeline/world3d/vision-critic";
import { getEnv, loadLocalEnvFile } from "../src/server/env";

/*
 * The Vision Critic runner (docs/design/60 §2.5): screenshots a running world3d game in headless Chrome and has a vision
 * model grade the pixels.
 *
 *   pnpm world3d:critique [url] [--out dir] [--mock] [--finale <encounterId>] [--wait <ms>]
 *
 * Needs a dev server (debug handle installed): default url http://localhost:3450/play/fixture-ancient-egypt-world3d.
 * Chromium is launched like scripts/world3d-shot.ts (real GPU via ANGLE/Metal) at 1280x720 and the game is driven through
 * `window.__GAME_DEBUG__`. Shots: 01-flyover, 02-explore, 03-conversation, 04-lesson (when one is due), 05-challenge,
 * 06-map, 07-goal-view. PNGs, report.md and report.json land in --out (default .data/world3d-critique/<timestamp>/, which
 * is gitignored). The model is getCriticModel() (CRITIC_MODEL or the SMART tier); with LLM_MODE=mock or --mock a canned
 * passing verdict is used instead (labelled "mock" in the report) so the whole flow runs offline with no API call.
 * Console errors from the page are collected and included in the report.
 */

// High quality: headless Chrome reports navigator.webdriver, which the game's auto quality treats as a slow machine
const DEFAULT_URL = "http://localhost:3450/play/fixture-ancient-egypt-world3d?quality=high";

interface Debug {
  world3d: {
    begin(): void;
    choose(id: string): void;
    warpTo(id: string): boolean;
    interact(): void;
    leads(): string[];
    phase(): string;
    dialogue(): { lines: string[]; choices: string[] } | null;
    target(): { label?: string } | null;
  };
  board: { open(id: string): void; available(): string[]; dismissLesson(): void; lesson?(): string[] };
}
const dbg = (js: string) => `(() => { const g = window.__GAME_DEBUG__; ${js} })()`;

async function waitPhase(page: Page, phase: string, timeout = 30_000) {
  await page.waitForFunction((p) => document.querySelector('[data-testid="world3d-client"]')?.getAttribute("data-phase") === p, phase, { timeout });
}

function parseArgs(argv: string[]) {
  const o = { url: DEFAULT_URL, out: "", mock: false, finale: "", wait: 3500 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") o.out = argv[++i];
    else if (a === "--mock") o.mock = true;
    else if (a === "--finale") o.finale = argv[++i];
    else if (a === "--wait") o.wait = Number(argv[++i]);
    else if (!a.startsWith("--")) o.url = a;
  }
  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  loadLocalEnvFile();
  const env = getEnv();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = resolve(opts.out || join(".data/world3d-critique", stamp));
  mkdirSync(out, { recursive: true });

  const url = new URL(opts.url);
  url.searchParams.set("debug", "1");
  const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/WebSocket|_next\/hmr/.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  const shots: (VisionShot & { file: string })[] = [];
  const snap = async (id: string, label: string) => {
    await page.waitForTimeout(opts.wait);
    const png = await page.screenshot();
    const file = `${String(shots.length + 1).padStart(2, "0")}-${id}.png`;
    writeFileSync(join(out, file), png);
    shots.push({ id, label, png, file });
    console.log(`  shot ${file}`);
  };

  try {
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForSelector("canvas", { timeout: 120_000 });
    await page.waitForFunction(() => !!(window as unknown as { __GAME_DEBUG__?: { world3d?: unknown } }).__GAME_DEBUG__?.world3d, null, { timeout: 60_000 });
    await waitPhase(page, "intro");

    // 1. the flyover / title
    await snap("flyover", "The opening flyover with the title and caption, a few seconds after load");

    // 2. explore at the spawn
    await page.evaluate(dbg("g.world3d.begin();"));
    await page.waitForFunction(() => (window as unknown as { __GAME_DEBUG__: Debug }).__GAME_DEBUG__.world3d.dialogue() !== null, null, { timeout: 30_000 });
    await page.evaluate(dbg("g.world3d.choose('go');"));
    await waitPhase(page, "explore");
    await snap("explore-spawn", "Exploring at the spawn point, HUD visible (quest tracker, leads, compass, minimap)");

    // 3. a conversation: the first lead whose interact prompt says "Talk to"
    const leads: string[] = await page.evaluate(dbg("return g.board.available();"));
    let talkLead: string | null = null;
    const order = [...leads, "e3_signs"]; // an available lead first; e3_signs (Nebet) as a conversation-only fallback
    for (const id of order) {
      const ok = await page.evaluate(dbg(`return g.world3d.warpTo(${JSON.stringify(id)});`));
      if (!ok) continue;
      await page.waitForTimeout(600);
      const label: string | null = await page.evaluate(dbg("return g.world3d.target()?.label ?? null;"));
      if (label && /talk/i.test(label)) {
        talkLead = id;
        break;
      }
    }
    if (talkLead) {
      await page.evaluate(dbg("g.world3d.interact();"));
      await waitPhase(page, "dialogue");
      await snap("conversation", `A conversation at ${talkLead}: the dialogue box with the character's name, line and choices`);
      const choices: string[] = await page.evaluate(dbg("return g.world3d.dialogue()?.choices ?? [];"));
      if (choices.includes("take")) await page.evaluate(dbg("g.world3d.choose('take');"));
      else {
        // that character had no challenge open yet: leave, and open the first lead's challenge directly
        await page.evaluate(dbg(`g.world3d.choose(${JSON.stringify(choices[0] ?? "leave")}); g.world3d.warpTo(${JSON.stringify(leads[0])}); g.board.open(${JSON.stringify(leads[0])});`));
      }
    } else {
      console.warn("  no conversation lead found: opening the first lead's challenge directly");
      await page.evaluate(dbg(`g.world3d.warpTo(${JSON.stringify(leads[0])}); g.board.open(${JSON.stringify(leads[0])});`));
    }

    // 4. the lesson card, then the challenge sheet
    await waitPhase(page, "challenge");
    const lesson = page.getByTestId("lesson-card");
    if (await lesson.isVisible().catch(() => false)) {
      await snap("lesson-card", "The lesson card shown before the first challenge on a concept");
      await page.evaluate(dbg("g.board.dismissLesson();"));
    }
    await page.getByTestId("widget-root").waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    await snap("challenge-sheet", "The challenge sheet open over the world with the challenge widget");
    await page.keyboard.press("Escape");
    await waitPhase(page, "explore").catch(() => undefined);

    // 5. the full map
    await page.keyboard.press("m");
    await page.getByTestId("w3-map").waitFor({ state: "visible", timeout: 10_000 });
    await snap("map", "The full map overlay");
    await page.keyboard.press("Escape");
    await page.getByTestId("w3-map").waitFor({ state: "detached", timeout: 10_000 }).catch(() => undefined);

    // 6. a wide view of the goal: a vantage a few radii back toward the spawn, facing it (falls back to the finale's anchor)
    const finale = opts.finale || "e10_capstone";
    const vantaged: boolean = await page.evaluate(dbg(`const v = g.world3d.goalVantage?.(); return v ? g.world3d.warpAt(v.x, v.z, v.faceX, v.faceZ) : false;`));
    if (!vantaged) {
      const warped: boolean = await page.evaluate(dbg(`return g.world3d.warpTo(${JSON.stringify(finale)});`));
      if (!warped) console.warn(`  warpTo(${finale}) failed: pass --finale <encounterId>`);
    }
    await page.waitForTimeout(1500);
    await snap("goal-view", `The goal landmark seen from a wide vantage in explore mode, the HUD up`);
  } finally {
    await browser.close();
  }

  // ---- the vision model
  const useMock = opts.mock || env.LLM_MODE === "mock";
  let model: LanguageModel;
  let modelId: string;
  if (useMock) {
    modelId = "mock-vision";
    model = new MockLanguageModelV4({
      modelId,
      doGenerate: async () => ({
        content: [{ type: "text" as const, text: JSON.stringify(mockVisionSlice(shots.map((s) => s.id))) }],
        finishReason: { unified: "stop" as const, raw: "stop" },
        usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } },
        warnings: [],
      }),
    });
  } else {
    const c = getCriticModel();
    model = c.model;
    modelId = c.id;
  }
  console.log(`grading ${shots.length} shots with ${modelId}${useMock ? " (mock)" : ""}...`);
  const slice = await runVisionCritic(model, shots, `Game page: ${opts.url}`);
  const verdict = toVisionVerdict(slice);
  const consoleErrors = [...new Set(errors)].slice(0, 30);
  const meta = { url: opts.url, model: modelId, mock: useMock, when: new Date().toISOString(), shots: shots.map((s) => ({ id: s.id, label: s.label, file: s.file })), consoleErrors };
  writeFileSync(join(out, "report.md"), visionMarkdown(verdict, meta));
  writeFileSync(join(out, "report.json"), JSON.stringify({ meta, verdict, report: toVisionReport(verdict, useMock ? `${modelId} (mock)` : modelId) }, null, 2));

  console.log(`\nVision critique ${useMock ? "(MOCK verdict) " : ""}: ${verdict.pass ? "PASS" : "FAIL"}, mean ${verdict.mean}/5`);
  console.log(verdict.scores.map((s) => `  ${s.criterion.padEnd(28)} ${s.score}/5`).join("\n"));
  if (verdict.issues.length) console.log(`top issues:\n${verdict.issues.slice(0, 5).map((i) => `  [${i.shot}] ${i.problem}`).join("\n")}`);
  if (consoleErrors.length) console.log(`console errors (${consoleErrors.length}):\n  ${consoleErrors.slice(0, 8).join("\n  ")}`);
  console.log(`report: ${join(out, "report.md")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
