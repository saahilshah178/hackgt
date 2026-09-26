// scripts/art/opentype.d.ts — the slice of opentype.js 2.0.0 the engraving pass uses (it ships no types;
// @types/opentype.js targets 1.x). docs/design/02 §3e.
declare module "opentype.js" {
  export interface PathDataOptions {
    decimalPlaces?: number;
    optimize?: boolean;
    flipY?: boolean;
  }
  export interface Path {
    commands: unknown[];
    toPathData(options?: number | PathDataOptions): string;
  }
  export interface Glyph {
    index: number;
    advanceWidth: number;
    getPath(x: number, y: number, fontSize: number): Path;
  }
  export interface Font {
    unitsPerEm: number;
    charToGlyphIndex(ch: string): number;
    charToGlyph(ch: string): Glyph;
    getKerningValue(left: Glyph, right: Glyph): number;
  }
  export function parse(buffer: ArrayBuffer): Font;
  const opentype: { parse: typeof parse };
  export default opentype;
}
