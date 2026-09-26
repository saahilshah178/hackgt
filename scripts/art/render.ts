/**
 * scripts/art/render.ts — the one Chromium path (Playwright's, already a devDependency) used by the rig build
 * (20 §5.5 step 4), the puppet bbox fallback and the contact sheets (20 §5.3 "Review"). Build-time only.
 */
import { chromium, type Browser, type Page } from "@playwright/test";

let shared: Browser | null = null;
let users = 0;

/** Runs `fn` with a Chromium instance shared across nested callers; closes it when the last caller returns. */
export async function withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
  users++;
  try {
    if (!shared) shared = await chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text"] });
    return await fn(shared);
  } finally {
    users--;
    if (users === 0 && shared) {
      const b = shared;
      shared = null;
      await b.close();
    }
  }
}

/** A page sized to `w × h` CSS px at `scale` device pixels per CSS px, transparent background. */
export async function openPage(browser: Browser, w: number, h: number, scale: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: Math.max(1, Math.ceil(w)), height: Math.max(1, Math.ceil(h)) }, deviceScaleFactor: scale });
  return ctx.newPage();
}

/** Renders an SVG document (already token-resolved) to PNG bytes: w×h design units at `scale` texels per unit. */
export async function renderSvg(svg: string, w: number, h: number, scale: number): Promise<Buffer> {
  return withBrowser(async (browser) => {
    const page = await openPage(browser, w, h, scale);
    try {
      const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`;
      await page.setContent(html, { waitUntil: "load" });
      return await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
    } finally {
      await page.context().close();
    }
  });
}

/** Renders an HTML file (by absolute path) full-page to PNG. */
export async function renderHtmlFile(absPath: string, width: number, scale = 1): Promise<Buffer> {
  return withBrowser(async (browser) => {
    const page = await openPage(browser, width, 400, scale);
    try {
      await page.goto(`file://${absPath}`, { waitUntil: "load" });
      await page.waitForTimeout(50);
      return await page.screenshot({ fullPage: true });
    } finally {
      await page.context().close();
    }
  });
}

/** Bounding boxes (via getBBox) of `<g id>` elements in an SVG document, in the SVG's user units. */
export async function measureGroups(svg: string, groupIds: string[]): Promise<Record<string, [number, number, number, number]>> {
  return withBrowser(async (browser) => {
    const page = await openPage(browser, 64, 64, 1);
    try {
      await page.setContent(`<!doctype html><html><body>${svg}</body></html>`);
      return await page.evaluate((idsIn: string[]) => {
        const out: Record<string, [number, number, number, number]> = {};
        for (const id of idsIn) {
          const g = document.getElementById(id) as unknown as SVGGraphicsElement | null;
          if (!g) continue;
          const b = g.getBBox();
          out[id] = [b.x, b.y, b.width, b.height];
        }
        return out;
      }, groupIds);
    } finally {
      await page.context().close();
    }
  });
}
