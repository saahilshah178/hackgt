import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/*
 * pnpm world3d:assets [--force]
 *
 * Downloads the CC0 PBR textures the 3D kit uses (src/world3d/kit/materials, terrain, vegetation) from Poly Haven, plus
 * three.js's MIT water normal map, into public/world3d/textures/<name>/{diff,nor,arm}.jpg, and writes
 * public/world3d/textures/manifest.json (source, real-world tile size, average albedo) and public/world3d/LICENSES.md.
 *
 * Poly Haven's API (https://api.polyhaven.com) lists every asset and its files; we take the 1k JPG Diffuse, the OpenGL
 * normal map (nor_gl) and the packed AO/Roughness/Metalness map (arm; built from AO + Rough when an asset has none).
 * When `sharp` is resolvable (Next ships it) every map is re-encoded at the tier's size and quality ~82 (mozjpeg) and the
 * average albedo is measured; otherwise the 1k originals are kept as they are. Idempotent: existing files are skipped
 * unless --force. Assets are CC0 (Poly Haven) or MIT (three.js); the licence file lists every source URL.
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public/world3d");
const TEX = path.join(OUT, "textures");
const UA = { "User-Agent": "EduXPert-world3d-assets/1.0 (+https://polyhaven.com/license)" };

type Group = "ground" | "structure" | "vegetation";

interface Pick {
  /** our texture name (a GroundTexture, a structure Material, or a kit extra) */
  name: string;
  /** Poly Haven asset id */
  id: string;
  group: Group;
  /** output edge length in pixels */
  size: number;
}

/*
 * One Poly Haven asset per ground texture (core/biomes.ts GROUND_TEXTURES), per textured structure material
 * (contracts MATERIALS minus glass/ice/crystal/gold, which are shading-only) and per vegetation extra. Chosen by browsing
 * the API list and the thumbnails: photographic, tileable, and neutral enough that the biome tint can steer the colour.
 */
const PICKS: Pick[] = [
  // ground: 1024 px (the terrain fills most of the screen)
  { name: "sand", id: "dense_sand", group: "ground", size: 1024 },
  { name: "dune_sand", id: "aerial_beach_01", group: "ground", size: 1024 },
  { name: "grass", id: "leafy_grass", group: "ground", size: 1024 },
  { name: "dry_grass", id: "park_dirt", group: "ground", size: 1024 },
  { name: "forest_floor", id: "forest_leaves_02", group: "ground", size: 1024 },
  { name: "mud", id: "brown_mud_02", group: "ground", size: 1024 },
  { name: "gravel", id: "gravel_floor", group: "ground", size: 1024 },
  { name: "dirt", id: "dirt", group: "ground", size: 1024 },
  { name: "rock", id: "rock_face_03", group: "ground", size: 1024 },
  { name: "cliff", id: "marble_cliff_02", group: "ground", size: 1024 },
  { name: "dark_rock", id: "dark_rock", group: "ground", size: 1024 },
  { name: "snow", id: "snow_02", group: "ground", size: 1024 },
  { name: "ice", id: "snow_01", group: "ground", size: 1024 },
  { name: "regolith", id: "moon_01", group: "ground", size: 1024 },
  { name: "cobble", id: "cobblestone_floor_01", group: "ground", size: 1024 },
  // tilled soil under farm fields (the terrain's fieldMask layer)
  { name: "field", id: "farm_furrows", group: "ground", size: 1024 },
  // structure materials: 512 px (seen at building scale; keeps the total small)
  { name: "sandstone", id: "sandstone_blocks_08", group: "structure", size: 512 },
  { name: "limestone", id: "large_sandstone_blocks_01", group: "structure", size: 512 },
  { name: "marble", id: "marble_01", group: "structure", size: 512 },
  { name: "granite", id: "granite_tile_03", group: "structure", size: 512 },
  { name: "basalt", id: "volcanic_rock_tiles", group: "structure", size: 512 },
  { name: "brick", id: "red_brick", group: "structure", size: 512 },
  { name: "adobe", id: "clay_plaster", group: "structure", size: 512 },
  { name: "plaster", id: "white_plaster_rough_01", group: "structure", size: 512 },
  { name: "wood", id: "weathered_planks", group: "structure", size: 512 },
  { name: "thatch", id: "thatch_roof_angled", group: "structure", size: 512 },
  { name: "metal", id: "metal_plate_02", group: "structure", size: 512 },
  // vegetation: tree bark
  { name: "bark", id: "pine_bark", group: "vegetation", size: 512 },
  { name: "bark_palm", id: "palm_tree_bark", group: "vegetation", size: 512 },
];

const WATER_NORMALS = "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/waternormals.jpg";

interface ManifestEntry {
  source: string;
  url: string;
  license: "CC0";
  authors: string[];
  group: Group;
  size: number;
  /** real-world edge length of one tile in metres (Poly Haven's `dimensions`, mm) */
  metres: number;
  /** average albedo of the diffuse map, sRGB hex (null when sharp was unavailable) */
  avg: string | null;
  maps: { diff: string; nor: string; arm: string };
}

// ---------------------------------------------------------------- sharp (optional)

type SharpFn = (input?: Buffer | string, opts?: Record<string, unknown>) => SharpImage;
interface SharpImage {
  resize(w: number, h: number, o?: Record<string, unknown>): SharpImage;
  jpeg(o: Record<string, unknown>): SharpImage;
  toBuffer(): Promise<Buffer>;
  toFile(p: string): Promise<unknown>;
  stats(): Promise<{ channels: { mean: number }[] }>;
  extractChannel(c: number): SharpImage;
  joinChannel(b: Buffer[], o?: Record<string, unknown>): SharpImage;
  removeAlpha(): SharpImage;
  toColourspace(c: string): SharpImage;
  raw(): SharpImage;
  greyscale(): SharpImage;
}

function loadSharp(): SharpFn | null {
  for (const from of ["sharp", "next"]) {
    try {
      const base = from === "sharp" ? path.join(ROOT, "package.json") : realpathSync(path.join(ROOT, "node_modules/next/package.json"));
      return createRequire(base)("sharp") as SharpFn;
    } catch {
      /* try the next resolver */
    }
  }
  return null;
}

// ---------------------------------------------------------------- download helpers

async function get(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt >= 3) throw new Error(`GET ${url}: ${String(err)}`);
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}

async function getJson<T>(url: string): Promise<T> {
  return JSON.parse((await get(url)).toString("utf8")) as T;
}

interface PhFile {
  url: string;
  size: number;
}
type PhFiles = Record<string, Record<string, Record<string, PhFile>>>;
interface PhInfo {
  name: string;
  authors: Record<string, string>;
  dimensions?: [number, number];
}

const jpg1k = (files: PhFiles, key: string): string | null => files[key]?.["1k"]?.jpg?.url ?? null;

// ---------------------------------------------------------------- main

async function main() {
  const force = process.argv.includes("--force");
  const sharp = loadSharp();
  console.log(sharp ? "sharp: re-encoding at quality 82" : "sharp not found: keeping the 1k originals");
  mkdirSync(TEX, { recursive: true });

  const manifestPath = path.join(TEX, "manifest.json");
  const previous: { textures?: Record<string, ManifestEntry> } = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const textures: Record<string, ManifestEntry> = {};

  const encode = async (buf: Buffer, size: number, out: string, quality = 82) => {
    if (!sharp) return writeFileSync(out, buf);
    await sharp(buf).resize(size, size, { fit: "fill" }).jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(out);
  };

  const queue = [...PICKS];
  const worker = async () => {
    for (let pick = queue.shift(); pick; pick = queue.shift()) {
      const dir = path.join(TEX, pick.name);
      mkdirSync(dir, { recursive: true });
      const out = { diff: path.join(dir, "diff.jpg"), nor: path.join(dir, "nor.jpg"), arm: path.join(dir, "arm.jpg") };
      const have = Object.values(out).every((p) => existsSync(p));
      const prev = previous.textures?.[pick.name];
      if (have && !force && prev && prev.source === pick.id) {
        textures[pick.name] = prev;
        console.log(`  = ${pick.name.padEnd(12)} ${pick.id} (cached)`);
        continue;
      }
      const [files, info] = await Promise.all([
        getJson<PhFiles>(`https://api.polyhaven.com/files/${pick.id}`),
        getJson<PhInfo>(`https://api.polyhaven.com/info/${pick.id}`),
      ]);
      const diffUrl = jpg1k(files, "Diffuse");
      const norUrl = jpg1k(files, "nor_gl");
      if (!diffUrl || !norUrl) throw new Error(`${pick.id}: no 1k Diffuse / nor_gl JPG`);
      const [diff, nor] = await Promise.all([get(diffUrl), get(norUrl)]);
      await encode(diff, pick.size, out.diff);
      await encode(nor, pick.size, out.nor, 86);
      const armUrl = jpg1k(files, "arm");
      if (armUrl) {
        await encode(await get(armUrl), pick.size, out.arm);
      } else if (sharp) {
        // pack AO (R), roughness (G), metalness 0 (B) ourselves
        const roughUrl = jpg1k(files, "Rough");
        const aoUrl = jpg1k(files, "AO");
        if (!roughUrl) throw new Error(`${pick.id}: neither arm nor Rough`);
        const rough = await sharp(await get(roughUrl)).resize(pick.size, pick.size, { fit: "fill" }).greyscale().raw().toBuffer();
        const ao = aoUrl ? await sharp(await get(aoUrl)).resize(pick.size, pick.size, { fit: "fill" }).greyscale().raw().toBuffer() : Buffer.alloc(pick.size * pick.size, 255);
        const packed = Buffer.alloc(pick.size * pick.size * 3);
        for (let i = 0; i < pick.size * pick.size; i++) {
          packed[i * 3] = ao[i];
          packed[i * 3 + 1] = rough[i];
          packed[i * 3 + 2] = 0;
        }
        await sharp(packed, { raw: { width: pick.size, height: pick.size, channels: 3 } }).jpeg({ quality: 82, mozjpeg: true }).toFile(out.arm);
      } else {
        const roughUrl = jpg1k(files, "Rough");
        if (!roughUrl) throw new Error(`${pick.id}: neither arm nor Rough`);
        writeFileSync(out.arm, await get(roughUrl));
      }
      let avg: string | null = null;
      if (sharp) {
        const { channels } = await sharp(out.diff).stats();
        const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
        avg = `#${hex(channels[0].mean)}${hex(channels[1].mean)}${hex(channels[2].mean)}`;
      }
      const mm = info.dimensions?.[0] ?? 2000;
      textures[pick.name] = {
        source: pick.id,
        url: `https://polyhaven.com/a/${pick.id}`,
        license: "CC0",
        authors: Object.keys(info.authors ?? {}),
        group: pick.group,
        size: sharp ? pick.size : 1024,
        metres: Math.round((mm / 1000) * 100) / 100,
        avg,
        maps: { diff: `${pick.name}/diff.jpg`, nor: `${pick.name}/nor.jpg`, arm: `${pick.name}/arm.jpg` },
      };
      console.log(`  + ${pick.name.padEnd(12)} ${pick.id}  ${textures[pick.name].metres} m  avg ${avg ?? "?"}`);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  // water normals (MIT, three.js examples)
  const waterDir = path.join(TEX, "water");
  mkdirSync(waterDir, { recursive: true });
  const waterOut = path.join(waterDir, "normal.jpg");
  if (force || !existsSync(waterOut)) {
    const buf = await get(WATER_NORMALS);
    if (sharp) await sharp(buf).resize(512, 512).jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(waterOut);
    else writeFileSync(waterOut, buf);
    console.log("  + water normals (three.js, MIT)");
  }

  const ordered = Object.fromEntries(PICKS.map((p) => [p.name, textures[p.name]]));
  const manifest = {
    version: 1,
    generated: "pnpm world3d:assets",
    textures: ordered,
    water: { normal: "water/normal.jpg", source: WATER_NORMALS, license: "MIT" },
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const rows = PICKS.map((p) => {
    const t = textures[p.name];
    return `| \`${p.name}\` | ${p.group} | [${t.source}](${t.url}) | ${t.authors.join(", ")} | CC0 1.0 |`;
  });
  const licenses = `# 3D world assets: sources and licences

Downloaded by \`pnpm world3d:assets\` (scripts/fetch-world3d-assets.ts). Textures are re-encoded (resized, JPEG quality
~82) but otherwise unmodified.

## Textures (Poly Haven, CC0 1.0)

All Poly Haven assets are released under [CC0 1.0](https://polyhaven.com/license) (public domain; no attribution
required, credited here anyway).

| Name | Group | Source | Authors | Licence |
|---|---|---|---|---|
${rows.join("\n")}

Each folder holds \`diff.jpg\` (albedo, sRGB), \`nor.jpg\` (OpenGL normal map) and \`arm.jpg\` (R = ambient occlusion,
G = roughness, B = metalness).

## Water normals (three.js, MIT)

\`textures/water/normal.jpg\` is \`examples/textures/waternormals.jpg\` from [three.js](https://github.com/mrdoob/three.js)
(${WATER_NORMALS}), MIT licence, Copyright © 2010-2026 three.js authors.

## Procedural

Sky, clouds, stars, the moon and Earth discs, foliage cards, grass and rock geometry are generated in code
(src/world3d/kit); no image assets.
`;
  writeFileSync(path.join(OUT, "LICENSES.md"), licenses);

  let total = 0;
  const walk = (d: string) => {
    for (const name of Object.keys(ordered)) {
      for (const f of ["diff.jpg", "nor.jpg", "arm.jpg"]) {
        const p = path.join(d, name, f);
        if (existsSync(p)) total += statSync(p).size;
      }
    }
  };
  walk(TEX);
  if (existsSync(waterOut)) total += statSync(waterOut).size;
  console.log(`done: ${PICKS.length} textures + water normals, ${(total / 1024 / 1024).toFixed(1)} MB in public/world3d/textures`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
