import { expect, type Page, type TestInfo } from "@playwright/test";

/*
 * Shared Expedition e2e helpers (docs/design/20-expedition-architecture.md §7.2 item E1, §8.2).
 *
 * `__GAME_DEBUG__` gains an optional `expedition` object (doc §2.10) once the Expedition host (H1) and client
 * (H2) land. This file's types mirror that documented shape exactly so `expedition-{trig,cell,civil,express,
 * keyboard}.spec.ts` can be written and typechecked today against the interface, before those lanes ship.
 *
 * Not a `declare global` augmentation of `Window`: other e2e specs (flows.spec.ts, play-smoke.spec.ts, ...)
 * declare their own narrower `window.__GAME_DEBUG__` shape, and TS global-interface merging requires every
 * declaration to match exactly (src/game/debug.ts's own comment). Callers here cast through `unknown` instead,
 * same as those specs do.
 */

// ---------------------------------------------------------------------------------------------------------------
// Types mirroring docs/design/20-expedition-architecture.md §2.10 and src/game/hosts/types.ts's ExpeditionHostDebug.
// ---------------------------------------------------------------------------------------------------------------

export interface ExpeditionInteractTarget {
  kind: string;
  [key: string]: unknown;
}

export interface ExpeditionHostDebug {
  ready: boolean;
  zoneId: string;
  segmentId: string;
  playerX: number;
  playerY: number;
  surface: string;
  cameraX: number;
  cameraY: number;
  zoom: number;
  /** resident texture count (A4: drops after a zone swap) */
  textures: number;
  near: ExpeditionInteractTarget | null;
  links: readonly { id: string; kind: string; inRange: boolean; open: boolean | null }[];
  contraption: (encounterId?: string) => Record<string, number | string | boolean> | null;
  cutscene: string | null;
  fps: number;
  drawObjects: number;
}

export interface ExpeditionDialogueSnapshot {
  speakerId: string;
  text: string;
  typing: boolean;
}

export interface ExpeditionWorldStateSnapshot {
  flags: string[];
  collected: string[];
  touched: string[];
}

/** docs §2.10 code block: the optional `expedition` field `__GAME_DEBUG__` gains. */
export interface ExpeditionDebugApi {
  host(): ExpeditionHostDebug | null;
  phase(): string;
  dialogue(): ExpeditionDialogueSnapshot | null;
  worldState(): ExpeditionWorldStateSnapshot;
  /** same as pressing E */
  interact(): void;
  /** drives the controller (not a teleport) until x or a blocker */
  walkTo(x: number, surface?: string): Promise<void>;
  /** runs a traversal link as a key press would */
  useLink(id: string): Promise<void>;
  /** warp to the current station and open its panel */
  openPanel(): void;
  /** sets the open control to mode.solutionInput(...) THROUGH the control API */
  applySolutionDraft(): void;
  /** moves the probe scrubber through its control API */
  setProbe(value: number): void;
  /** same as pressing (i) */
  hint(): void;
  openSandbox(id: string): void;
  express(on: boolean): void;
  skipCutscene(): void;
  /** pause tweens/typewriter/particles/clocks for deterministic screenshots */
  freeze(on: boolean): void;
}

/** The legacy core (src/game/debug.ts `GameDebugHandle`) plus the optional Expedition extension. */
export interface ExpeditionDebugHandle {
  state(): { finished: boolean; index: number; encounterId: string | null };
  skipTo(encounterId: string): void;
  autoSolve(): void;
  expedition?: ExpeditionDebugApi;
}

type DebugWindow = Window & { __GAME_DEBUG__?: ExpeditionDebugHandle };

// ---------------------------------------------------------------------------------------------------------------
// Project / URL helpers (playwright.config.ts's `webgl` and `dom` projects)
// ---------------------------------------------------------------------------------------------------------------

/** True on the `dom` project — the documented `?renderer=dom` escape hatch (doc §0 decision 12). */
export function isDomProject(testInfo: TestInfo): boolean {
  return testInfo.project.name === "dom";
}

/** The host root testid for the active project (§8.2 step 1: `phaser-host` on `webgl`, `dom-host` on `dom`). */
export function hostTestId(testInfo: TestInfo): "phaser-host" | "dom-host" {
  return isDomProject(testInfo) ? "dom-host" : "phaser-host";
}

/** Appends `debug=1` (and, on the `dom` project, `renderer=dom`) to a play path. */
export function expeditionUrl(testInfo: TestInfo, path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  const renderer = isDomProject(testInfo) ? "&renderer=dom" : "";
  return `${path}${sep}debug=1${renderer}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Console/page error collection (§8.2: "Every test ends with `expect(errors).toEqual([])`")
// ---------------------------------------------------------------------------------------------------------------

/** Installs console/page error collectors. Call `expectNoErrors(errors)` at the end of the test. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

export function expectNoErrors(errors: readonly string[]): void {
  expect(errors, `console/page errors:\n${errors.join("\n")}`).toEqual([]);
}

// ---------------------------------------------------------------------------------------------------------------
// Navigation + the shared "wait for host().ready" helper (§8.2)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Navigates to a play path and waits for `__GAME_DEBUG__.expedition.host()?.ready` (the §8.2 shared helper).
 * Also asserts the project's host root testid is visible (`phaser-host` / `dom-host`, §8.2 step 1).
 */
export async function gotoExpedition(page: Page, testInfo: TestInfo, path: string): Promise<void> {
  await page.goto(expeditionUrl(testInfo, path));
  await expect(page.getByTestId(hostTestId(testInfo))).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    () => (window as unknown as DebugWindow).__GAME_DEBUG__?.expedition?.host()?.ready === true,
    null,
    { timeout: 30_000 },
  );
}

/** True once `window.__GAME_DEBUG__.expedition` exists (H1 host + H2 client wired the debug hook). */
export function expeditionDebugInstalled(page: Page): Promise<boolean> {
  return page.evaluate(() => typeof (window as unknown as DebugWindow).__GAME_DEBUG__?.expedition !== "undefined");
}

// ---------------------------------------------------------------------------------------------------------------
// Typed calls onto __GAME_DEBUG__.expedition.*, one generic so every method stays in sync with the doc's API.
// ---------------------------------------------------------------------------------------------------------------

function callExpedition<K extends keyof ExpeditionDebugApi>(
  page: Page,
  method: K,
  ...args: Parameters<ExpeditionDebugApi[K]>
): Promise<Awaited<ReturnType<ExpeditionDebugApi[K]>>> {
  return page.evaluate(
    ({ method, args }) => {
      const api = (window as unknown as DebugWindow).__GAME_DEBUG__?.expedition as
        | Record<string, (...a: unknown[]) => unknown>
        | undefined;
      if (!api) {
        throw new Error(
          "__GAME_DEBUG__.expedition is not installed. The Expedition host (H1) and client (H2) have not " +
            "landed yet, or the page was loaded without ?debug=1.",
        );
      }
      return api[method](...(args as unknown[]));
    },
    { method, args },
  ) as Promise<Awaited<ReturnType<ExpeditionDebugApi[K]>>>;
}

export const hostDebug = (page: Page) => callExpedition(page, "host");
export const phase = (page: Page) => callExpedition(page, "phase");

/**
 * `host().contraption(id)` — NOT `(await hostDebug(page)).contraption(id)`. `page.evaluate`'s return value crosses
 * the CDP boundary as plain (structured-clone/JSON-like) data, so a snapshot returned by `hostDebug` never carries
 * live methods: `contraption` is a function only INSIDE the page. This calls `host()` and `.contraption(id)` in one
 * `page.evaluate`, returning only its plain `Record<string, number | string | boolean> | null` result.
 */
export function contraptionDebug(page: Page, encounterId?: string): Promise<Record<string, number | string | boolean> | null> {
  return page.evaluate((encounterId) => {
    const api = (window as unknown as DebugWindow).__GAME_DEBUG__?.expedition;
    if (!api) throw new Error("__GAME_DEBUG__.expedition is not installed.");
    return api.host()?.contraption(encounterId) ?? null;
  }, encounterId);
}
export const dialogueSnapshot = (page: Page) => callExpedition(page, "dialogue");
export const worldStateSnapshot = (page: Page) => callExpedition(page, "worldState");
export const interact = (page: Page) => callExpedition(page, "interact");
export const walkTo = (page: Page, x: number, surface?: string) => callExpedition(page, "walkTo", x, surface);
export const useLink = (page: Page, id: string) => callExpedition(page, "useLink", id);
export const openPanel = (page: Page) => callExpedition(page, "openPanel");
export const applySolutionDraft = (page: Page) => callExpedition(page, "applySolutionDraft");
export const setProbe = (page: Page, value: number) => callExpedition(page, "setProbe", value);
export const hint = (page: Page) => callExpedition(page, "hint");
export const openSandbox = (page: Page, id: string) => callExpedition(page, "openSandbox", id);
export const setExpress = (page: Page, on: boolean) => callExpedition(page, "express", on);
export const skipCutscene = (page: Page) => callExpedition(page, "skipCutscene");
export const freeze = (page: Page, on: boolean) => callExpedition(page, "freeze", on);

/**
 * `walkTo(x)` only walks the CURRENT walkable component up to its nearest barrier or link boundary; it does not
 * chain through links itself (measured empirically: it never auto-fires a `hop`/`climb`/`drop`, even one already
 * `inRange`). Zones with a gap in the ground (§8.2 step 3's own canal crossing) need an explicit `useLink` at each
 * such boundary. This drives `walkTo` repeatedly, firing any link the host reports `inRange` whenever a call makes
 * no further progress, until `target` is reached or nothing moves for `stallLimit` link-less attempts in a row
 * (a real blocker — e.g. an unsolved station's payoff gate, §0 decision 9). Used for any trek longer than one
 * walkable stretch; callers that want to assert a SPECIFIC link's effect still call `useLink` directly themselves.
 */
export async function walkUntilOrBlocked(page: Page, target: number, opts: { maxTries?: number; stallLimit?: number } = {}): Promise<void> {
  const maxTries = opts.maxTries ?? 60;
  const stallLimit = opts.stallLimit ?? 6;
  // a local alias, not a call to `useLink` itself: eslint's react-hooks plugin treats any `use*`-named call inside
  // a loop as a (mis-detected) React Hook violation, since this file is under `src`'s config scope too.
  const fireLink = useLink;
  let stalls = 0;
  for (let i = 0; i < maxTries; i++) {
    const before = await hostDebug(page);
    if (!before) return;
    await walkTo(page, target);
    // a busy dev server (concurrent lanes' Turbopack rebuilds) can starve the host's rAF loop for a tick or two;
    // give it a beat before treating a small step as a real stall rather than momentary lag.
    await page.waitForTimeout(120);
    const after = await hostDebug(page);
    if (!after) return;
    if (Math.abs(after.playerX - target) < 5) return;
    if (Math.abs(after.playerX - before.playerX) < 1) {
      const link = after.links.find((l) => l.inRange);
      if (link) {
        await fireLink(page, link.id);
        stalls = 0;
        continue;
      }
      stalls++;
      if (stalls >= stallLimit) return; // genuinely blocked
    } else {
      stalls = 0;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The base `GameDebugHandle` (src/game/debug.ts): the runner's own progress, shared with the legacy hosts.
// Used to jump the runner forward (e.g. to reach a later station without walking/solving every prior one).
// ---------------------------------------------------------------------------------------------------------------

/*
 * `state()` and `autoSolve()` also exist on the AMBIENT `Window.__GAME_DEBUG__` other specs' own global
 * augmentation declares (with a narrower `state()` shape than this file's local `ExpeditionDebugHandle`); typing
 * the lookup as that local interface would merge the two declarations' call signatures. So, exactly like
 * `callExpedition` above does for `.expedition.*`, the call itself goes through an untyped intermediate and the
 * wrapper's own return type is asserted at the boundary instead of inferred from a shared global interface.
 */
function callDebug<R>(page: Page, method: "state" | "autoSolve"): Promise<R> {
  return page.evaluate(
    (method) => {
      const dbg = (window as unknown as { __GAME_DEBUG__?: Record<string, (...a: unknown[]) => unknown> }).__GAME_DEBUG__;
      if (!dbg) throw new Error("__GAME_DEBUG__ is not installed.");
      return dbg[method]() as R;
    },
    method,
  );
}

export function runnerState(page: Page): Promise<{ finished: boolean; index: number; encounterId: string | null }> {
  return callDebug(page, "state");
}

export function autoSolve(page: Page): Promise<void> {
  return callDebug(page, "autoSolve");
}

/** Calls `autoSolve()` until the runner reaches `encounterId` (or is finished), up to `maxSteps` times. */
export async function autoSolveTo(page: Page, encounterId: string, maxSteps = 20): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const s = await runnerState(page);
    if (s.finished || s.encounterId === encounterId) return;
    await autoSolve(page);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Panel / control-kind testids (§3, §4.1) the keyboard and station specs assert against.
// ---------------------------------------------------------------------------------------------------------------

/** doc §1.3 `ControlKind`: the panel control kinds a keyboard-usable station falls into. */
export const CONTROL_KINDS = ["scrub", "aim", "slots", "bins", "waves", "cables", "tubes", "matrix", "widget"] as const;
export type ControlKind = (typeof CONTROL_KINDS)[number];

export const TESTIDS = {
  instrumentPanel: "instrument-panel",
  panelBack: "panel-back",
  hintButton: "hint-button",
  widgetSubmit: "widget-submit",
  successBadge: "success-badge",
  cutsceneSkip: "cutscene-skip",
  titleCard: "title-card",
  endScreen: "end-screen",
} as const;
