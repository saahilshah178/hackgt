/**
 * scripts/build-art.ts — PLACEHOLDER (W0). `pnpm art:build [--ns <ns>] [--check] [--kit-only]`, `pnpm art:check`.
 * A1 (docs/design/20 §5.2, §7.2) replaces this with the real pipeline: collect art/<ns>/biome.json + the *.kit.json /
 * *.hero.json fragments, run the src/game/art/kit generators, resolve {{tokens}} from src/game/art/palettes/<ns>.ts,
 * engrave <text data-engrave> with opentype.js 2.0.0 + Cinzel / EB Garamond, lint, pack puppets, build the rig atlases
 * (--ns shared), write public/assets/expedition/<ns>/** + manifest.json (AssetManifest) and
 * src/world/asset-index/<ns>.generated.ts, under .data/art-build.lock. Exits 0 so CI stays green.
 */
const args = process.argv.slice(2);
const check = args.includes("--check");
const nsAt = args.indexOf("--ns");
const ns = nsAt >= 0 ? args[nsAt + 1] : "all namespaces";
console.log(`art:${check ? "check" : "build"} (${ns}): placeholder — the art pipeline lands in W1 (A1). Nothing to do yet.`);
process.exit(0);
