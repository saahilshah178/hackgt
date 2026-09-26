import fontkit from "@pdf-lib/fontkit";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";

/*
 * Renders each samples/<name>.md into samples/<name>.pdf with pdf-lib: one PDF page per "---"
 * section, word-wrapped body text, larger headings, and (when available) a Unicode TTF so math
 * symbols like π render correctly. Run with `pnpm samples:build`.
 */

const SAMPLES = ["trig-notes", "cell-transport", "civil-rights-history"];
const PAGE_SIZE: [number, number] = [612, 792]; // US Letter
const MARGIN = 56;
const BODY_SIZE = 11;
const H1_SIZE = 20;
const H2_SIZE = 15;
const LINE_GAP = 5;

interface Line {
  text: string;
  size: number;
  bold: boolean;
  gapBefore: number;
}

function wrapParagraph(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Splits one markdown page's source into heading/body lines, wrapping body paragraphs to maxWidth. */
function layoutPage(markdown: string, font: PDFFont, boldFont: PDFFont, maxWidth: number): Line[] {
  const lines: Line[] = [];
  const blocks = markdown.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("## ")) {
      lines.push({ text: trimmed.slice(3).trim(), size: H2_SIZE, bold: true, gapBefore: lines.length ? 16 : 0 });
    } else if (trimmed.startsWith("# ")) {
      lines.push({ text: trimmed.slice(2).trim(), size: H1_SIZE, bold: true, gapBefore: lines.length ? 20 : 0 });
    } else {
      const paragraph = trimmed.replace(/\s+/g, " ");
      const wrapped = wrapParagraph(paragraph, font, BODY_SIZE, maxWidth);
      wrapped.forEach((text, i) => lines.push({ text, size: BODY_SIZE, bold: false, gapBefore: i === 0 ? 12 : 0 }));
    }
  }
  return lines;
}

async function buildPdf(markdown: string, useUnicodeFont: boolean, fontBytes: Uint8Array | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let font: PDFFont;
  let bold: PDFFont;
  if (useUnicodeFont && fontBytes) {
    doc.registerFontkit(fontkit);
    font = await doc.embedFont(fontBytes, { subset: true });
    bold = font; // DejaVuSans.ttf is a single regular weight; headings are set larger instead of bolded.
  } else {
    font = await doc.embedFont(StandardFonts.Helvetica);
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  }

  const sections = markdown.split(/\n-{3,}\n/);
  const maxWidth = PAGE_SIZE[0] - 2 * MARGIN;

  for (const section of sections) {
    const page = doc.addPage(PAGE_SIZE);
    const lines = layoutPage(section, font, bold, maxWidth);
    let y = PAGE_SIZE[1] - MARGIN;
    for (const line of lines) {
      y -= line.gapBefore;
      const lineHeight = line.size + LINE_GAP;
      if (y - lineHeight < MARGIN) {
        // Simple overflow guard: samples are sized to fit one page per section, but never crash if not.
        break;
      }
      page.drawText(line.text, {
        x: MARGIN,
        y,
        size: line.size,
        font: line.bold ? bold : font,
        color: rgb(0.1, 0.1, 0.12),
      });
      y -= lineHeight;
    }
  }

  return doc.save();
}

async function main() {
  const fontPath = join("samples", "fonts", "DejaVuSans.ttf");
  let fontBytes: Uint8Array | null = null;
  let useUnicodeFont = false;
  if (existsSync(fontPath)) {
    try {
      fontBytes = new Uint8Array(await readFile(fontPath));
      useUnicodeFont = true;
    } catch {
      useUnicodeFont = false;
    }
  }

  if (!useUnicodeFont) {
    console.warn(
      `[build-samples] ${fontPath} not found or unreadable: falling back to Helvetica (no π glyph).\n` +
        `  REPORT: samples/trig-notes.md must then use "pi" instead of "π" so the rendered PDF matches the fixture quotes.`,
    );
  }

  for (const name of SAMPLES) {
    const mdPath = join("samples", `${name}.md`);
    const md = await readFile(mdPath, "utf8");
    const bytes = await buildPdf(md, useUnicodeFont, fontBytes);
    const pdfPath = join("samples", `${name}.pdf`);
    await writeFile(pdfPath, bytes);
    console.log(`[build-samples] wrote ${pdfPath} (${bytes.byteLength} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
