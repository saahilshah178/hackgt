/**
 * scripts/art-contact-sheet.ts — `pnpm art:sheet [--ns <ns>]` (docs/design/20 §5.1, §5.3 "Review"; 02 §3a.4 step 10).
 *
 * Renders, per namespace, through the same Chromium path as the rig: every manifest entry; 3 extra seeds per kit entry
 * (seed + 1…3, so the critic can pick a seed instead of asking for a redraw); every atlas frame with its 7 computed
 * anchors (dot + rotation tick); every puppet's rest pose and 4 sampled poses of each animation. Writes
 * .data/art-sheet/<ns>.html and <ns>.png (gitignored). Read the PNGs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ManifestEntry } from "../src/contracts/world";
import { sampleAnim } from "../src/game/expedition/puppets/anim";
import { kitVariants, NAMESPACES, PUBLIC_DIR, readManifest } from "./art/build";
import { renderHtmlFile } from "./art/render";
import { puppetSheetSize } from "./art/vram";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = path.join(ROOT, ".data", "art-sheet");
const args = process.argv.slice(2);
const nsAt = args.indexOf("--ns");
const targets = nsAt >= 0 ? [args[nsAt + 1]] : [...NAMESPACES];
const REL = path.relative(OUT, path.join(ROOT, PUBLIC_DIR));
const url = (file: string) => `${REL}/${file}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const COLORS: Record<string, string> = { head: "#e6194b", face: "#f58231", torso: "#3cb44b", back: "#4363d8", hand_r: "#911eb4", hand_l: "#42d4f4", feet: "#f032e6" };
const CHECKER = "background:repeating-conic-gradient(#d9d4cc 0 25%,#ece7df 0 50%) 0 0/16px 16px";

function fit(w: number, h: number, maxW: number, maxH: number): number {
  return Math.min(1, maxW / w, maxH / h);
}
function svgCell(e: Extract<ManifestEntry, { kind: "svg" }>, ns: string): string {
  const s = fit(e.width, e.height, 420, 260) * (Math.max(e.width, e.height) < 120 ? 2 : 1);
  let cell = `<figure><div class="img" style="${CHECKER};width:${Math.round(e.width * s)}px;height:${Math.round(e.height * s)}px"><img src="${url(e.file)}" style="width:100%;height:100%">`;
  for (const a of e.anchors) cell += `<i style="left:${a.x * s}px;top:${a.y * s}px" title="${a.name}"></i>`;
  cell += `<b style="left:${e.pivot[0] * 100}%;top:${e.pivot[1] * 100}%"></b></div><figcaption>${esc(e.key)}<br>${e.width}×${e.height} · ${esc(e.source)}${e.seed !== null ? ` · seed ${e.seed}` : ""} · rs ${e.rasterScale}${e.tileWidth ? ` · tile ${e.tileWidth}` : ""}</figcaption></figure>`;
  if (e.source.startsWith("kit:") && e.seed !== null && !e.key.endsWith(".b") && !e.key.endsWith(".needle")) {
    for (const v of kitVariants(ROOT, ns, e.key, [e.seed + 1, e.seed + 2, e.seed + 3])) {
      cell += `<figure class="alt"><div class="img" style="${CHECKER};width:${Math.round(e.width * s)}px;height:${Math.round(e.height * s)}px"><img src="data:image/svg+xml;base64,${Buffer.from(v.svg).toString("base64")}" style="width:100%;height:100%"></div><figcaption>seed ${v.seed}</figcaption></figure>`;
    }
  }
  return `<div class="entry">${cell}</div>`;
}
function puppetPose(e: Extract<ManifestEntry, { kind: "puppet" }>, states: ReturnType<typeof sampleAnim>, scale: number, label: string): string {
  const [sw, sh] = puppetSheetSize(e);
  const sorted = e.parts.map((p, i) => ({ p, i })).sort((a, b) => a.p.z - b.p.z || a.i - b.i);
  let h = `<figure><div class="img" style="${CHECKER};width:${e.width * scale}px;height:${e.height * scale}px;overflow:visible">`;
  for (const { p } of sorted) {
    const st = states[p.name];
    const [bx, by, bw, bh] = p.box;
    const left = (p.rest[0] - p.pivot[0] * bw + st.x) * scale;
    const top = (p.rest[1] - p.pivot[1] * bh + st.y) * scale;
    h += `<div style="position:absolute;left:${left}px;top:${top}px;width:${bw * scale}px;height:${bh * scale}px;background:url(${url(e.file)}) ${-(bx + st.frame * bw) * scale}px ${-by * scale}px/${sw * scale}px ${sh * scale}px no-repeat;transform-origin:${p.pivot[0] * 100}% ${p.pivot[1] * 100}%;transform:rotate(${st.rot}deg) scale(${st.scaleX},${st.scaleY});opacity:${st.alpha}"></div>`;
  }
  return `${h}<b style="left:${e.pivot[0] * 100}%;top:${e.pivot[1] * 100}%"></b></div><figcaption>${esc(label)}</figcaption></figure>`;
}
function puppetCell(e: Extract<ManifestEntry, { kind: "puppet" }>): string {
  const scale = Math.max(1, Math.min(4, 220 / Math.max(e.width, e.height)));
  let h = `<div class="entry"><figure><div class="img" style="${CHECKER};width:${e.width * scale}px;height:${e.height * scale}px"><img src="${url(e.restFile)}" style="width:100%;height:100%"></div><figcaption>${esc(e.key)} rest<br>${e.parts.length} parts · ${esc(e.source)}</figcaption></figure>`;
  const parts = e.parts.map((p) => ({ name: p.name, frames: p.frames }));
  for (const a of e.anims) for (const f of [0, 0.25, 0.5, 0.75]) h += puppetPose(e, sampleAnim(a, a.ms * f, parts), scale, `${a.id} @ ${Math.round(a.ms * f)} ms`);
  const [sw, sh] = puppetSheetSize(e);
  h += `<figure><div class="img" style="${CHECKER};width:${sw * scale}px;height:${sh * scale}px"><img src="${url(e.file)}" style="width:100%;height:100%"></div><figcaption>packed sheet ${sw}×${sh}</figcaption></figure>`;
  return `${h}</div>`;
}
function atlasCell(e: Extract<ManifestEntry, { kind: "atlas" }>): string {
  const cols = e.poses.length > 12 ? 7 : 6;
  const rows = Math.ceil(e.poses.length / cols);
  const s = 0.875; // 192 texels → 168 display units
  let h = `<div class="entry"><h3>${esc(e.key)} · ${esc(e.source)} · ${e.poses.length} frames</h3>`;
  e.poses.forEach((pose, i) => {
    const an = e.anchors.find((a) => a.pose === pose);
    h += `<figure><div class="img" style="background:linear-gradient(#D8D4CF,#F4E7DA);width:${e.displayWidth}px;height:${e.displayHeight}px"><div style="position:absolute;inset:0;background:url(${url(e.image)}) ${-(i % cols) * e.frameWidth * s}px ${-Math.floor(i / cols) * e.frameHeight * s}px/${cols * e.frameWidth * s}px ${rows * e.frameHeight * s}px"></div>`;
    for (const p of an?.points ?? []) h += `<i style="left:${p.x}px;top:${p.y}px;background:${COLORS[p.name]}"><u style="transform:rotate(${p.rot}deg);background:${COLORS[p.name]}"></u></i>`;
    h += `</div><figcaption>${pose}${an ? ` · ${an.facing}` : ""}</figcaption></figure>`;
  });
  h += `<p class="legend">${Object.entries(COLORS).map(([k, c]) => `<span style="color:${c}">● ${k}</span>`).join(" ")}</p></div>`;
  return h;
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  for (const ns of targets) {
    const m = readManifest(ROOT, ns);
    if (!m) {
      console.warn(`art:sheet: ${ns} has no manifest (run pnpm art:build)`);
      continue;
    }
    let body = `<h1>${ns} — ${m.entries.length} entries · heroes ${m.heroCount}/${m.heroCap} · VRAM ${m.vram.map((v) => `${v.zone} ${v.mb} MB`).join(", ")}</h1>`;
    for (const e of m.entries) body += e.kind === "svg" ? svgCell(e, ns) : e.kind === "puppet" ? puppetCell(e) : atlasCell(e);
    if (m.entries.length === 0) body += "<p>(no entries yet)</p>";
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:12px;background:#f4f1ec;font:13px/1.3 system-ui,sans-serif;color:#223}
h1{font-size:16px;margin:0 0 10px} h3{width:100%;margin:6px 0;font-size:14px}
.entry{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;padding:8px 0;border-bottom:1px solid #d8d2c8}
figure{margin:0} figure.alt figcaption{color:#667}
.img{position:relative;outline:1px solid #c9c2b6}
.img i{position:absolute;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;background:#e2892c;box-shadow:0 0 0 1px #fff}
.img i u{position:absolute;left:3px;top:3px;width:12px;height:2px;transform-origin:0 50%}
.img b{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border:2px solid #0b1f27;border-radius:50%;box-sizing:border-box}
figcaption{max-width:440px;font-size:12px;margin-top:3px} .legend span{margin-right:10px}
</style></head><body>${body}</body></html>`;
    const htmlFile = path.join(OUT, `${ns}.html`);
    fs.writeFileSync(htmlFile, html);
    const png = await renderHtmlFile(htmlFile, 1600);
    fs.writeFileSync(path.join(OUT, `${ns}.png`), png);
    console.log(`art:sheet ${ns}: ${path.relative(ROOT, path.join(OUT, `${ns}.png`))} (${m.entries.length} entries)`);
  }
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e);
    process.exit(1);
  },
);
