import { chromium } from "@playwright/test";

/*
 * Screenshots of WebGL pages (the /dev/kit3d gallery, a world3d game) for visual QA and the vision critic.
 *
 *   pnpm world3d:shot <url> <out.png> [--size 1280x720] [--wait 4000] [--ready <css selector>] [--eval <js>]...
 *   pnpm world3d:shot http://localhost:3450/dev/kit3d?world=nile&cam=spawn&shot=1 shots/nile-spawn.png
 *
 * Several url/out pairs may follow each other. Waits for the page's canvas, then `--wait` ms for textures, shaders and
 * scatter to settle. Each --eval runs in the page (in order, ~1 s apart) after the ready selector appears, for driving a
 * game into a state (e.g. `window.__GAME_DEBUG__.world3d.begin()`). Prints console errors from the page so a broken shader never hides behind a pretty screenshot.
 */

async function main() {
  const args = process.argv.slice(2);
  let size = { width: 1280, height: 720 };
  let wait = 4000;
  let ready = "canvas";
  const evals: string[] = [];
  const pairs: [string, string][] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--size") {
      const [w, h] = args[++i].split("x").map(Number);
      size = { width: w, height: h };
    } else if (a === "--wait") wait = Number(args[++i]);
    else if (a === "--ready") ready = args[++i];
    else if (a === "--eval") evals.push(args[++i]);
    else {
      pairs.push([a, args[++i]]);
    }
  }
  if (pairs.length === 0 || pairs.some(([, out]) => !out)) {
    console.error("usage: pnpm world3d:shot <url> <out.png> [<url> <out.png> ...] [--size 1280x720] [--wait 4000] [--ready selector]");
    process.exit(2);
  }
  const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl"] });
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const [url, out] of pairs) {
    const t0 = Date.now();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForSelector(ready, { timeout: 120_000 });
    for (const js of evals) {
      await page.waitForTimeout(900);
      await page.evaluate(js);
    }
    await page.waitForTimeout(wait);
    await page.screenshot({ path: out });
    console.log(`${out}  (${Date.now() - t0} ms)`);
  }
  if (errors.length) console.log(`console errors (${errors.length}):\n  ${[...new Set(errors)].slice(0, 12).join("\n  ")}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
