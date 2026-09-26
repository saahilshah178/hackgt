/**
 * src/game/art/palettes/shared.ts — W0 seed (docs/design/20 §5.7; bible §2.3), extended by A1 (L5) with the rig recolour
 * defaults and the painterly finish tokens. Owned by the art lane with palette.ts.
 * Token path → colour. The UI tokens are identical in every game (the panel is the brand; the world is the subject);
 * rgba tokens become `fill` + `fill-opacity` at build time (02 §3a), never `rgba()` inside SVG paint.
 */
export const SHARED_PALETTE = {
  namespace: "shared",
  tokens: {
    // ---- UI (bible §2.3)
    "ui.panel": "rgba(38, 92, 106, 0.86)",
    "ui.panel.solid": "#265C6A",
    "ui.panel.hi": "#3B7682",
    "ui.card": "#0F2A33",
    "ui.card.deep": "#0B1F27",
    "ui.hex": "rgba(120, 190, 205, 0.14)",
    "ui.grid.major": "rgba(111, 184, 200, 0.55)",
    "ui.grid.minor": "rgba(111, 184, 200, 0.22)",
    "ui.line": "#E8F6F8",
    "ui.line.glow": "rgba(159, 230, 242, 0.45)",
    "ui.text": "#FFFFFF",
    "ui.text.dim": "#9DB8BE",
    "ui.accent": "#E2892C",
    "ui.accent.hi": "#F4A95A",
    "ui.accent.deep": "#B8661C",
    "ui.info.warm": "#E7A08C",
    "fn.f": "#F5F8F8",
    "fn.g": "#6FD98E",
    "fn.h": "#4F92E6",
    "orb.fill": "#3F97B8",
    "orb.ring": "#FFFFFF",
    "pencil.btn": "#3A8FC4",
    // ---- shared world tokens used by shared fx and the lectern slate
    "shadow": "#6E7F9A",
    "haze": "#FFFFFF",
    "glow.cyan": "#9FE6F2",
    "glow.gold": "#F6D27A",
    "stone.lit": "#FBF1DE",
    "stone.base": "#F2E3C6",
    "stone.shade": "#D9C3A0",
    "stone.deep": "#B89C78",
    "gold.hi": "#F6D27A",
    "gold.base": "#D9A441",
    "gold.deep": "#A8782E",
    "inlay.navy": "#27466A",
    "inlay.navy.dark": "#1B3150",
    "bronze.ring": "#6E4A2E",
    "wisp.indigo": "#6A6CF0",
    // ---- the rig's painterly finish (A1; baked into the atlases: key-light rim, cool shade, soft outline glow)
    "char.key_light": "#FFF1D6",
    "char.shade": "#5C6A86",
    "char.outline_glow": "#FFF6E8",
    // ---- rig recolour defaults, char.<id>.<role> with 02 §3b.4's camelCase roles. The game palettes
    //      (palettes/<ns>.ts) define each character's main roles and win over these (BIOME_PALETTES layers the biome
    //      over shared); these fill the roles a body uses that 02 §3b.4 does not list, and Otis until C3 adds him.
    "char.eyeWhite": "#FFFFFF",
    // ida (female_person): the nose shade, earrings, collar and belt
    "char.ida.skinDeep": "#46291B",
    "char.ida.accent": "#D9A441",
    "char.ida.collar": "#F2E3C6",
    "char.ida.belt": "#3F3A44",
    // otis (male_person): night watchman — grizzled hair, khaki shirt, navy work coat
    "char.otis.skin": "#8A5A3E",
    "char.otis.skinShade": "#6E4630",
    "char.otis.skinDeep": "#5A3826",
    "char.otis.ink": "#2B2A33",
    "char.otis.brow": "#4A4540",
    "char.otis.hair": "#4A4540",
    "char.otis.hairHi": "#6B645C",
    "char.otis.top": "#C9C2B0",
    "char.otis.topShade": "#A8A18F",
    "char.otis.coat": "#3E4A6B",
    "char.otis.coatShade": "#2E3852",
    "char.otis.sleeve": "#C9C2B0",
    "char.otis.sleeveShade": "#A8A18F",
    "char.otis.bottom": "#4A4F66",
    "char.otis.sock": "#4A4F66",
    "char.otis.boots": "#3F3A44",
  } as Readonly<Record<string, string>>,
} as const;
