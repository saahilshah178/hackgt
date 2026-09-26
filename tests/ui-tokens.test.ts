/**
 * tests/ui-tokens.test.ts (P1) — panel/theme.css equals the shared UI palette (docs/design/20 §3.1, §8.1).
 *
 * Every `--ui-*`, `--fn-*`, `--orb-*`, `--pencil-*` and `--glow-*` custom property in theme.css equals the palette
 * token of the same dotted name (`--ui-card-deep` ↔ `ui.card.deep`), and every such palette token is in theme.css.
 * Checked against UI_TOKENS (src/game/art/palette.ts, bible §2.3) and SHARED_PALETTE (palettes/shared.ts, which
 * also carries the glow tokens the panel uses for gold/cyan accents).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { UI_TOKENS } from "../src/game/art/palette";
import { SHARED_PALETTE } from "../src/game/art/palettes/shared";

const ROOT = path.resolve(import.meta.dirname, "..");
const THEME = readFileSync(path.join(ROOT, "src/game/expedition/panel/theme.css"), "utf8");
const PINNED = /^(ui|fn|orb|pencil|glow)\./;

/** "#E8F6F8" / "rgba(38, 92, 106, 0.86)" → a canonical lower-case string without spaces. */
function norm(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, "");
}

function rootTokens(css: string): Map<string, string> {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  expect(root, "theme.css has a :root block").not.toBeNull();
  const out = new Map<string, string>();
  for (const m of (root?.[1] ?? "").matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1], norm(m[2]));
  return out;
}

function cssNameOf(token: string): string {
  return token.replace(/\./g, "-");
}

function pinnedOf(tokens: Readonly<Record<string, unknown>>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tokens)) if (PINNED.test(k) && typeof v === "string") out.set(k, norm(v));
  return out;
}

function expectThemeEquals(palette: Map<string, string>, label: string, families = /^(ui|fn|orb|pencil|glow)-/): void {
  const css = rootTokens(THEME);
  for (const [token, value] of palette) {
    expect(css.get(cssNameOf(token)), `${label}: theme.css --${cssNameOf(token)} must equal ${token}`).toBe(value);
  }
  const pinnedCss = [...css.keys()].filter((k) => families.test(k));
  const known = new Set([...palette.keys()].map(cssNameOf));
  const extra = pinnedCss.filter((k) => !known.has(k));
  expect(extra, `${label}: theme.css defines token-named properties the palette does not have (use the --xp- prefix)`).toEqual([]);
}

describe("panel theme.css ↔ the shared UI palette", () => {
  it("covers every bible §2.3 UI token", () => {
    const pinned = pinnedOf(SHARED_PALETTE.tokens);
    for (const t of ["ui.panel", "ui.card", "ui.card.deep", "ui.hex", "ui.grid.major", "ui.grid.minor", "ui.line", "ui.line.glow", "ui.text", "ui.text.dim", "ui.accent", "ui.accent.hi", "ui.accent.deep", "ui.info.warm", "fn.f", "fn.g", "fn.h", "orb.fill", "orb.ring", "pencil.btn"]) {
      expect(pinned.has(t), t).toBe(true);
    }
  });

  it("equals SHARED_PALETTE for every pinned token", () => {
    expectThemeEquals(pinnedOf(SHARED_PALETTE.tokens), "SHARED_PALETTE");
  });

  it("equals UI_TOKENS in src/game/art/palette.ts (A1's one colour table)", () => {
    const pinned = pinnedOf(UI_TOKENS);
    expect(pinned.size).toBeGreaterThanOrEqual(20);
    // UI_TOKENS is the bible §2.3 set (ui/fn/orb/pencil); the glow tokens are pinned against SHARED_PALETTE above
    expectThemeEquals(pinned, "UI_TOKENS", /^(ui|fn|orb|pencil)-/);
  });

  it("keeps the §3.1 opaque fallback and the 280 ms slide", () => {
    expect(THEME).toMatch(/--xp-panel-opaque:\s*#1f4b57/i);
    expect(THEME).toMatch(/--xp-slide-ms:\s*280ms/);
    expect(THEME).toMatch(/backdrop-filter:\s*blur\(6px\)/);
  });
});
