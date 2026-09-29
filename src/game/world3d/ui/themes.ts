import { Cinzel, EB_Garamond } from "next/font/google";
import type { CSSProperties } from "react";
import type { ClothColor, HudTheme } from "../../../contracts/world3d";
import type { Palette } from "../../engine/palettes";
import { CLOTH_HEX } from "../../../world3d/kit/materials";

/*
 * The diegetic skins of a world3d game's interface (World3D.ui.hudTheme): dialogue boxes, the challenge sheet, the
 * journal and the quest tracker share one set of CSS variables per theme, so an Egyptian world talks on papyrus, a
 * medieval one on parchment and a moon base on glass. Every theme keeps body text at WCAG AA contrast on its panel;
 * the challenge sheet is always dark so the shared widgets read the same in every world.
 */

const cinzel = Cinzel({ subsets: ["latin"], weight: ["500", "700"], display: "swap" });
const garamond = EB_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

const SANS = "var(--font-jakarta), ui-sans-serif, system-ui, sans-serif";

interface ThemeSpec {
  /** dialogue / journal panel background (may be a gradient) */
  panel: string;
  ink: string;
  muted: string;
  border: string;
  heading: string;
  body: string;
  /** small HUD chips over the 3D view */
  chip: string;
  chipInk: string;
  /** the challenge sheet (always dark) */
  sheet: string;
  blur: boolean;
}

const THEMES: Record<HudTheme, ThemeSpec> = {
  papyrus: {
    panel:
      "linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0) 30%), repeating-linear-gradient(90deg, rgba(120,86,40,0.07) 0 2px, rgba(0,0,0,0) 2px 7px), repeating-linear-gradient(0deg, rgba(120,86,40,0.05) 0 1px, rgba(0,0,0,0) 1px 5px), linear-gradient(180deg, #efdfb6, #e3cd98)",
    ink: "#2e1f0e",
    muted: "#5e4526",
    border: "#8a6a3a",
    heading: cinzel.style.fontFamily,
    body: garamond.style.fontFamily,
    chip: "rgba(24, 17, 9, 0.72)",
    chipInk: "#f6ead0",
    sheet: "linear-gradient(180deg, rgba(34, 24, 13, 0.94), rgba(22, 15, 8, 0.96))",
    blur: true,
  },
  parchment: {
    panel: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.35), rgba(0,0,0,0) 60%), linear-gradient(180deg, #f1e4c6, #e2cfa4)",
    ink: "#2f2418",
    muted: "#5d4a33",
    border: "#7b5d3a",
    heading: cinzel.style.fontFamily,
    body: garamond.style.fontFamily,
    chip: "rgba(28, 22, 15, 0.72)",
    chipInk: "#f5ecd8",
    sheet: "linear-gradient(180deg, rgba(36, 28, 20, 0.95), rgba(24, 18, 12, 0.96))",
    blur: true,
  },
  stone: {
    panel: "linear-gradient(180deg, rgba(58, 54, 50, 0.94), rgba(36, 33, 30, 0.96))",
    ink: "#f1ebe1",
    muted: "#c9c0b2",
    border: "#8f8577",
    heading: cinzel.style.fontFamily,
    body: garamond.style.fontFamily,
    chip: "rgba(22, 20, 18, 0.7)",
    chipInk: "#f1ebe1",
    sheet: "linear-gradient(180deg, rgba(40, 37, 34, 0.95), rgba(26, 24, 22, 0.97))",
    blur: true,
  },
  wood: {
    panel: "repeating-linear-gradient(92deg, rgba(0,0,0,0.05) 0 3px, rgba(0,0,0,0) 3px 11px), linear-gradient(180deg, #4a3322, #342316)",
    ink: "#f6ead6",
    muted: "#d9c4a4",
    border: "#a07b4f",
    heading: cinzel.style.fontFamily,
    body: garamond.style.fontFamily,
    chip: "rgba(30, 20, 12, 0.72)",
    chipInk: "#f6ead6",
    sheet: "linear-gradient(180deg, rgba(44, 30, 19, 0.95), rgba(30, 20, 12, 0.97))",
    blur: true,
  },
  glass: {
    panel: "linear-gradient(180deg, rgba(20, 28, 38, 0.66), rgba(12, 18, 26, 0.74))",
    ink: "#f3f7fb",
    muted: "#c3cfdc",
    border: "rgba(255, 255, 255, 0.22)",
    heading: SANS,
    body: SANS,
    chip: "rgba(14, 20, 28, 0.58)",
    chipInk: "#f3f7fb",
    sheet: "linear-gradient(180deg, rgba(16, 22, 30, 0.9), rgba(10, 14, 20, 0.94))",
    blur: true,
  },
  tech: {
    panel: "linear-gradient(180deg, rgba(8, 16, 30, 0.84), rgba(4, 10, 20, 0.9))",
    ink: "#e2f4ff",
    muted: "#9fc2d8",
    border: "rgba(120, 200, 255, 0.45)",
    heading: SANS,
    body: SANS,
    chip: "rgba(4, 12, 24, 0.7)",
    chipInk: "#e2f4ff",
    sheet: "linear-gradient(180deg, rgba(8, 16, 30, 0.93), rgba(4, 10, 20, 0.96))",
    blur: true,
  },
  ice: {
    panel: "linear-gradient(180deg, rgba(232, 244, 250, 0.9), rgba(210, 230, 242, 0.92))",
    ink: "#10283a",
    muted: "#35546a",
    border: "#7ea6c0",
    heading: SANS,
    body: SANS,
    chip: "rgba(10, 26, 38, 0.62)",
    chipInk: "#eef7fc",
    sheet: "linear-gradient(180deg, rgba(14, 30, 44, 0.93), rgba(8, 20, 30, 0.96))",
    blur: true,
  },
};

export interface W3Theme {
  id: HudTheme;
  accent: string;
  vars: CSSProperties;
  /** the palette handed to ChallengePanel and the shared widgets (dark sheet, the world's accent) */
  palette: Palette;
  headingFont: string;
}

/** A readable accent: very dark cloth colours are lifted so they show on the dark HUD chips. */
function accentHex(c: ClothColor): string {
  const lift: Partial<Record<ClothColor, string>> = { charcoal: "#9aa3ad", brown: "#c8955a", indigo: "#7f8fe0", crimson: "#e0626a", olive: "#b5b56a", violet: "#b192e0", linen: "#f1e4c4" };
  return lift[c] ?? CLOTH_HEX[c];
}

export function themeFor(id: HudTheme, accent: ClothColor): W3Theme {
  const t = THEMES[id];
  const a = accentHex(accent);
  const vars = {
    "--w3-panel": t.panel,
    "--w3-ink": t.ink,
    "--w3-muted": t.muted,
    "--w3-border": t.border,
    "--w3-heading": t.heading,
    "--w3-body": t.body,
    "--w3-chip": t.chip,
    "--w3-chip-ink": t.chipInk,
    "--w3-sheet": t.sheet,
    "--w3-accent": a,
    "--w3-blur": t.blur ? "blur(10px) saturate(1.1)" : "none",
  } as CSSProperties;
  const hex = (s: string) => parseInt(s.slice(1), 16);
  const palette: Palette = {
    id: "dusk",
    name: `world3d:${id}`,
    floor: 0x1c1712,
    wall: 0x0e0b08,
    accent: hex(a),
    player: hex(a),
    background: 0x0e0b08,
    css: { floor: "#1c1712", wall: "#0e0b08", accent: a, player: a, background: "#0e0b08", text: "#f7f1e6" },
  };
  return { id, accent: a, vars, palette, headingFont: t.heading };
}
