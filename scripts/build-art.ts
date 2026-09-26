/**
 * scripts/build-art.ts — `pnpm art:build [--ns <ns>] [--check] [--kit-only]` (docs/design/20 §5.2, 02 §3).
 *
 * For each namespace (shared first, so the biomes can count its always-resident textures): collect fragments, run the
 * kit, resolve tokens, engrave, lint, pack puppets, build the rig atlases (shared), and write
 * public/assets/expedition/<ns>/** + manifest.json + License.txt and src/world/asset-index/<ns>.generated.ts, under
 * .data/art-build.lock. `--check` rebuilds in memory and byte-compares against the committed output (stale files
 * count as differences); `--kit-only` builds every hero key from its kit entry (fallback ladder step 1).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildNamespace, NAMESPACES, PUBLIC_DIR, type NsResult } from "./art/build";
import { acquireLock } from "./art/lock";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const check = args.includes("--check");
const kitOnly = args.includes("--kit-only");
const nsAt = args.indexOf("--ns");
const only = nsAt >= 0 ? args[nsAt + 1] : null;
if (only && !(NAMESPACES as readonly string[]).includes(only)) {
  console.error(`art:build: unknown namespace "${only}" (${NAMESPACES.join(", ")})`);
  process.exit(2);
}
const targets = only ? [only] : [...NAMESPACES];

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const visit = (d: string) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) visit(p);
      else out.push(path.relative(ROOT, p));
    }
  };
  visit(dir);
  return out;
}

/** Files under public/assets/expedition/<ns>/ that the build did not produce (excluding kept rig files). */
function staleFiles(res: NsResult): string[] {
  const produced = new Set(res.files.map((f) => f.rel));
  return listFiles(path.join(ROOT, PUBLIC_DIR, res.ns)).filter((f) => !produced.has(f) && !(res.rigKept && f.startsWith(`${PUBLIC_DIR}/shared/char/`)) && !f.endsWith(".DS_Store"));
}

async function main(): Promise<number> {
  const release = check ? () => undefined : acquireLock(ROOT);
  const log = (s: string) => console.log(s);
  let failed = false;
  let sharedManifest = null;
  try {
    for (const ns of targets) {
      const t0 = Date.now();
      let res: NsResult;
      try {
        res = await buildNamespace(ns, { root: ROOT, kitOnly, log, sharedManifest });
      } catch (e) {
        console.error(`art:${check ? "check" : "build"} ✗ ${(e as Error).message}`);
        failed = true;
        continue;
      }
      if (ns === "shared") sharedManifest = res.manifest;
      for (const w of res.warnings) console.warn(`  warn ${w}`);
      if (check) {
        const diffs: string[] = [];
        for (const f of res.files) {
          const abs = path.join(ROOT, f.rel);
          if (!fs.existsSync(abs)) diffs.push(`missing ${f.rel}`);
          else if (!fs.readFileSync(abs).equals(f.data)) diffs.push(`differs ${f.rel}`);
        }
        for (const s of staleFiles(res)) diffs.push(`stale ${s}`);
        if (diffs.length) {
          failed = true;
          console.error(`art:check ✗ ${ns}: ${diffs.length} difference(s) — run pnpm art:build\n  ${diffs.slice(0, 20).join("\n  ")}`);
        } else console.log(`art:check ✓ ${ns} (${res.files.length} files)`);
      } else {
        for (const f of res.files) {
          const abs = path.join(ROOT, f.rel);
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          if (!fs.existsSync(abs) || !fs.readFileSync(abs).equals(f.data)) fs.writeFileSync(abs, f.data);
        }
        for (const s of staleFiles(res)) fs.rmSync(path.join(ROOT, s));
        for (const line of res.report) console.log(line);
        console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      }
    }
  } finally {
    release();
  }
  return failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e);
    process.exit(1);
  },
);
