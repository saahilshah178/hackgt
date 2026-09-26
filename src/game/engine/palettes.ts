import type { PaletteId } from "../../contracts/common";

/**
 * The 6 palettes (LIBRARY / GameSpec `theme.paletteId`). Colors are plain hex numbers so both the
 * Phaser host (tint) and the DOM host / React widgets (CSS custom properties) can use the same values.
 * Chosen for contrast on a projector: floor/wall are dark, accent reads clearly against them.
 */
export interface Palette {
  id: PaletteId;
  name: string;
  /** Room floor tint. */
  floor: number;
  /** Room wall / border tint. */
  wall: number;
  /** Socket / interactive object tint. */
  accent: number;
  /** Player sprite tint. */
  player: number;
  /** Background behind the play area. */
  background: number;
  /** CSS hex strings for React overlays. */
  css: { floor: string; wall: string; accent: string; player: string; background: string; text: string };
}

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function make(id: PaletteId, name: string, floor: number, wall: number, accent: number, player: number, background: number): Palette {
  return {
    id,
    name,
    floor,
    wall,
    accent,
    player,
    background,
    css: {
      floor: hex(floor),
      wall: hex(wall),
      accent: hex(accent),
      player: hex(player),
      background: hex(background),
      text: "#f5f3ee",
    },
  };
}

export const PALETTES: Record<PaletteId, Palette> = {
  ember: make("ember", "Ember", 0x3a2018, 0x1c0f0a, 0xff8a3d, 0xffce6b, 0x120a07),
  tide: make("tide", "Tide", 0x14313a, 0x0a1a1f, 0x4dd0e1, 0xa5f3fc, 0x081217),
  moss: make("moss", "Moss", 0x223a1c, 0x11200d, 0x8bc34a, 0xd6f5a0, 0x0c1509),
  dusk: make("dusk", "Dusk", 0x2a2140, 0x150f27, 0xb388ff, 0xe8d9ff, 0x0d0a17),
  parchment: make("parchment", "Parchment", 0xd8c9a3, 0x9c8a63, 0x8a5a2b, 0x5b3a1a, 0xefe6cf),
  neon: make("neon", "Neon", 0x1a1a2e, 0x0a0a14, 0xff2fd0, 0x2fffe0, 0x08080f),
};

export function getPalette(id: PaletteId): Palette {
  return PALETTES[id];
}
