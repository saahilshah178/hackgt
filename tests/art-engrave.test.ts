/**
 * tests/art-engrave.test.ts — build-time engraving (docs/design/02 §3e, 20 §5.2 step 4).
 * `π/2` in EB Garamond becomes paths; a glyph missing from every font of the face fails and names the code point;
 * markup, anchors and the 8 KB budget; and no engraved string in any committed manifest leaks an encounter answer
 * (R8's token-boundary matcher over `answerVarsFor`).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AssetManifest } from "../src/contracts/world";
import { GameSpec } from "../src/contracts/gamespec";
import { getMode } from "../src/mechanics/registry";
import { bannedValuesFor, leaks } from "../src/world/answer-leak";
import { engrave, EngraveError, engraveSvg, injectRequests, MAX_ENGRAVE_BYTES, parseMarkup, requestToText } from "../scripts/art/engrave";
import { lintOutput } from "../scripts/art/lint";

const ROOT = path.resolve(import.meta.dirname, "..");
const opts = { size: 26, x: 100, y: 40, anchor: "middle" as const, letterSpacing: 0, precision: 1 as const };

describe("engrave()", () => {
  it("turns π/2 in EB Garamond (serif) into path data with no missing glyphs", () => {
    const r = engrave("π/2", { ...opts, face: "serif" });
    expect(r.missing).toEqual([]);
    expect(r.d).toMatch(/^M[\d.]+ [\d.]+/);
    expect(r.d).not.toMatch(/NaN/);
    expect(r.width).toBeGreaterThan(20);
    // centred on x = 100: the path spans both sides of it
    const xs = [...r.d.matchAll(/[MLQC]\s*(-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...xs)).toBeLessThan(100);
    expect(Math.max(...xs)).toBeGreaterThan(100);
    // y is baseline-down (glyph tops above the baseline at y = 40)
    const ys = [...r.d.matchAll(/[ML]\s*-?[\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeLessThan(40);
  });
  it("fails on a glyph missing from both fonts and lists the code point", () => {
    expect(engrave("♪", { ...opts, face: "serif" }).missing).toEqual(["U+266A ♪"]);
    expect(engrave("3 sin(π/2 · t)", { ...opts, face: "caps" }).missing).toEqual(["U+03C0 π"]); // Cinzel has no π
    expect(() => engraveSvg('<svg><text data-engrave="serif" x="0" y="20" font-size="20">A ♪ B</text></svg>', "test.key")).toThrow(EngraveError);
    expect(() => engraveSvg('<svg><text data-engrave="serif" x="0" y="20" font-size="20">A ♪ B</text></svg>', "test.key")).toThrow(/U\+266A/);
  });
  it("supports ^{…} superscripts and _{…} subscripts (write sin^{-1}; U+207B is in neither font)", () => {
    expect(parseMarkup("sin^{-1} x_{0}")).toEqual([
      { text: "sin", level: 0 },
      { text: "-1", level: 1 },
      { text: " x", level: 0 },
      { text: "0", level: -1 },
    ]);
    const plain = engrave("x2", { ...opts, face: "serif" });
    const sup = engrave("x^{2}", { ...opts, face: "serif" });
    expect(sup.missing).toEqual([]);
    expect(sup.width).toBeLessThan(plain.width); // the 2 is set at 0.62 size
    expect(engrave("sin⁻¹", { ...opts, face: "serif" }).missing).toContain("U+207B ⁻");
  });
  it("renders Cinzel caps for wordmarks and Roman numerals", () => {
    const r = engrave("THE COURIER-LEDGER", { ...opts, face: "caps", size: 14 });
    expect(r.missing).toEqual([]);
    expect(engrave("XII IX IV", { ...opts, face: "caps" }).missing).toEqual([]);
  });
});

describe("engraveSvg()", () => {
  it("replaces <text data-engrave> with <path>, keeps paint and transform, and the result passes the lint", () => {
    const src = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60"><text data-engrave="serif" x="100" y="40" font-size="26" text-anchor="middle" fill="#B89C78" transform="rotate(5 100 40)">π/2</text></svg>';
    const { svg, engraved, bytes } = engraveSvg(src, "orrery_terraces.part.test");
    expect(svg).not.toMatch(/<text/);
    expect(svg).toMatch(/<path d="M[^"]+" fill="#B89C78" transform="rotate\(5 100 40\)"\/>/);
    expect(engraved).toEqual(["π/2"]);
    expect(bytes).toBeGreaterThan(100);
    expect(lintOutput(svg)).toEqual([]);
  });
  it("leaves plain <text> for the lint to reject", () => {
    const { svg } = engraveSvg('<svg xmlns="http://www.w3.org/2000/svg"><text x="1" y="2">hi</text></svg>');
    expect(lintOutput(svg).map((i) => i.rule)).toContain("text");
  });
  it("enforces the 8 KB engraving budget per asset", () => {
    const long = "THE COURIER-LEDGER ".repeat(4);
    expect(() => engraveSvg(`<svg><text data-engrave="caps" x="0" y="30" font-size="30">${long}</text></svg>`, "k")).toThrow(new RegExp(`> ${MAX_ENGRAVE_BYTES / 1024} KB`));
  });
  it("injects generator engrave requests as <text data-engrave> before </svg>", () => {
    const req = { id: "t", text: "0 I II", face: "caps" as const, size: 12, x: 10, y: 20, anchor: "start" as const, fill: "orrery.engrave", rotate: 0 };
    expect(requestToText(req)).toBe('<text data-engrave="caps" x="10.0" y="20.0" font-size="12.0" text-anchor="start" fill="{{orrery.engrave}}">0 I II</text>');
    expect(injectRequests("<svg><path/></svg>", [req])).toMatch(/<path\/><text data-engrave="caps"[^>]*>0 I II<\/text><\/svg>$/);
  });
});

describe("engraved strings never leak an answer", () => {
  it("no engraved string in any committed manifest contains an encounter answer value (R8 matcher)", () => {
    const engravedStrings: string[] = [];
    for (const ns of ["shared", "orrery_terraces", "living_gate", "archive_of_voices"]) {
      const file = path.join(ROOT, "public/assets/expedition", ns, "manifest.json");
      if (!fs.existsSync(file)) continue;
      const m = AssetManifest.parse(JSON.parse(fs.readFileSync(file, "utf8")));
      for (const e of m.entries) if (e.kind === "svg") engravedStrings.push(...e.engraved);
    }
    const banned = new Set<string>();
    for (const f of fs.readdirSync(path.join(ROOT, "fixtures")).filter((x) => x.endsWith(".json"))) {
      const spec = GameSpec.safeParse(JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures", f), "utf8")));
      if (!spec.success) continue;
      for (const enc of spec.data.encounters) {
        const mode = getMode(enc.familyId, enc.mode);
        if (mode) for (const v of bannedValuesFor(mode, enc.params, enc.solution)) banned.add(v);
      }
    }
    expect(banned.size).toBeGreaterThan(0);
    const leaksFound = engravedStrings.flatMap((s) => [...banned].filter((b) => leaks(s, b)).map((b) => `${s} ⊇ ${b}`));
    expect(leaksFound).toEqual([]);
    // the matcher itself: a period answer "π" would be caught in "T = π", never in "spin"
    expect(leaks("T = π", "π")).toBe(true);
    expect(leaks("spin", "π")).toBe(false);
  });
});
