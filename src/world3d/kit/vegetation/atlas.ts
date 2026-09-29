import * as THREE from "three";
import { mulberry32, type Rng } from "../../core/prng";
import { loadManifest, TEXTURE_BASE } from "../materials/textures";

/*
 * The foliage atlas: one 2048² RGBA texture holding every leaf card, frond, flower head and bark strip the vegetation
 * uses, so all trees, bushes, reeds, flowers and crops share ONE alpha-tested material (one GPU program, one draw per
 * chunk and variant). Everything is drawn procedurally with Canvas 2D from a fixed seed (deterministic), then the colour
 * is dilated into the transparent texels (no dark halos when mipmapped) and uploaded as a DataTexture (straight alpha).
 * When the Poly Haven bark photos arrive, their cells are redrawn from the photos (tiled, no seams).
 *
 * Cell rectangles are in UV space (0..1, v up); geometry builders map their cards into them.
 */

export const ATLAS_SIZE = 2048;

export interface Cell {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

const px = (x: number, y: number, w: number, h: number): Cell => ({ u0: x / ATLAS_SIZE, v0: 1 - (y + h) / ATLAS_SIZE, u1: (x + w) / ATLAS_SIZE, v1: 1 - y / ATLAS_SIZE });

/** Pixel layout (y down in the canvas; converted to v-up UV rects). */
export const CELLS = {
  frond: px(0, 0, 1024, 512),
  needles: px(1024, 0, 512, 512),
  leaves: px(1536, 0, 512, 512),
  birchLeaves: px(0, 512, 512, 512),
  bushLeaves: px(512, 512, 512, 512),
  papyrus: px(1024, 512, 512, 512),
  wheat: px(1536, 512, 256, 512),
  flower: px(1792, 512, 256, 256),
  cattail: px(1792, 768, 256, 256),
  barkPalm: px(0, 1024, 512, 1024),
  bark: px(512, 1024, 512, 1024),
  barkBirch: px(1024, 1024, 256, 1024),
  barkDead: px(1280, 1024, 256, 1024),
  deadFrond: px(1536, 1024, 512, 256),
  grassCard: px(1536, 1280, 512, 256),
  plain: px(1536, 1536, 512, 512),
} satisfies Record<string, Cell>;
export type CellName = keyof typeof CELLS;

/** Metres of bark height one bark cell covers (the photo tiles twice down each 512×1024 strip). */
export const BARK_PERIOD = { barkPalm: 2.6, bark: 4, barkBirch: 5, barkDead: 4 } as const;

type Ctx = CanvasRenderingContext2D;

const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h.toFixed(1)}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%, ${a})`;
const jitter = (rng: Rng, v: number, amt: number) => v + (rng() - 0.5) * 2 * amt;

function leafShape(ctx: Ctx, x: number, y: number, len: number, wid: number, angle: number, fill: string, rib: string | null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.25, -wid, len * 0.7, -wid * 0.9, len, 0);
  ctx.bezierCurveTo(len * 0.7, wid * 0.9, len * 0.25, wid, 0, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  if (rib) {
    ctx.strokeStyle = rib;
    ctx.lineWidth = Math.max(1, wid * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.92, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFrond(ctx: Ctx, c: { x: number; y: number; w: number; h: number }, rng: Rng, dead: boolean) {
  const { x, y, w, h } = c;
  const cy = y + h / 2;
  const hue = dead ? 34 : 88;
  // leaflets: both sides, pointing toward the tip, longest in the middle third
  for (let t = 0.04; t < 0.985; t += 0.017) {
    const px0 = x + t * w;
    const env = Math.pow(Math.sin(Math.PI * (t * 0.92 + 0.05)), 0.65);
    const len = h * 0.47 * env * jitter(rng, 1, 0.08);
    for (const side of [-1, 1]) {
      const ang = side * (0.75 + 0.25 * t) + jitter(rng, 0, 0.06);
      const l = len * jitter(rng, 1, 0.06);
      const light = dead ? jitter(rng, 0.42, 0.06) : jitter(rng, 0.3, 0.05) + 0.06 * (1 - t);
      ctx.save();
      ctx.translate(px0, cy);
      ctx.rotate(-ang);
      ctx.beginPath();
      const wid = Math.max(3.4, h * 0.012);
      ctx.moveTo(0, -wid * 0.4);
      ctx.quadraticCurveTo(l * 0.5, -wid * 1.2 + side * l * 0.05, l, side * l * 0.12);
      ctx.quadraticCurveTo(l * 0.5, wid * 1.1 + side * l * 0.05, 0, wid * 0.4);
      ctx.fillStyle = hsl(jitter(rng, hue, 6), dead ? 0.45 : 0.52, light);
      ctx.fill();
      ctx.restore();
    }
  }
  // rachis
  ctx.strokeStyle = hsl(hue - 20, 0.35, dead ? 0.4 : 0.34);
  ctx.lineCap = "round";
  ctx.lineWidth = h * 0.028;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x + w * 0.99, cy);
  ctx.stroke();
}

function drawNeedles(ctx: Ctx, c: { x: number; y: number; w: number; h: number }, rng: Rng) {
  const { x, y, w, h } = c;
  const cy = y + h / 2;
  // a flat spray: main twig along x, side twigs, dense short needles; silhouette a soft pointed oval
  const twig = (x0: number, y0: number, x1: number, y1: number, width: number) => {
    ctx.strokeStyle = hsl(28, 0.3, 0.2);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  twig(x, cy, x + w * 0.97, cy, 6);
  const sides: [number, number, number, number][] = [];
  for (let t = 0.08; t < 0.9; t += 0.075) {
    for (const s of [-1, 1]) {
      const reach = h * 0.42 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.05)) * jitter(rng, 1, 0.12);
      const x0 = x + t * w;
      const x1 = x0 + reach * 0.7;
      const y1 = cy + s * reach;
      sides.push([x0, cy, x1, y1]);
      twig(x0, cy, x1, y1, 3);
    }
  }
  const needle = (x0: number, y0: number, dx: number, dy: number) => {
    const l = h * jitter(rng, 0.045, 0.012);
    const a = Math.atan2(dy, dx) + (rng() < 0.5 ? -1 : 1) * jitter(rng, 0.9, 0.25);
    ctx.strokeStyle = hsl(jitter(rng, 138, 10), jitter(rng, 0.38, 0.08), jitter(rng, 0.22, 0.05));
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l);
    ctx.stroke();
  };
  ctx.lineCap = "round";
  for (const [x0, y0, x1, y1] of [[x, cy, x + w * 0.97, cy] as [number, number, number, number], ...sides]) {
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 5);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      needle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, x1 - x0, y1 - y0);
      needle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, x1 - x0, y1 - y0);
    }
  }
}

function drawLeafCluster(ctx: Ctx, c: { x: number; y: number; w: number; h: number }, rng: Rng, opts: { count: number; size: number; hue: number; sat: number; light: number }) {
  const { x, y, w, h } = c;
  const cx = x + w / 2;
  const cy = y + h / 2;
  // twigs from the lower centre
  ctx.strokeStyle = hsl(28, 0.3, 0.22);
  ctx.lineCap = "round";
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + jitter(rng, 0, 1.2);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, y + h * 0.95);
    ctx.lineTo(cx + Math.cos(a) * w * 0.38, cy + Math.sin(a) * h * 0.3);
    ctx.stroke();
  }
  for (let k = 0; k < opts.count; k++) {
    // denser toward the middle, leaves pointing outward
    const r = Math.sqrt(rng()) * w * 0.4;
    const a = rng() * Math.PI * 2;
    const lx = cx + Math.cos(a) * r;
    const ly = cy + Math.sin(a) * r * 0.9;
    const len = opts.size * jitter(rng, 1, 0.25);
    const shade = (ly - y) / h; // lower leaves a touch darker
    const light = jitter(rng, opts.light, 0.06) - shade * 0.06;
    leafShape(ctx, lx, ly, len, len * 0.3, a + jitter(rng, 0, 0.6), hsl(jitter(rng, opts.hue, 7), jitter(rng, opts.sat, 0.08), light), hsl(opts.hue, opts.sat * 0.6, light + 0.08, 0.6));
  }
}

function drawPapyrus(ctx: Ctx, c: { x: number; y: number; w: number; h: number }, rng: Rng) {
  const { x, y, w, h } = c;
  const bx = x + w / 2;
  const by = y + h * 0.98;
  ctx.lineCap = "round";
  for (let k = 0; k < 130; k++) {
    const a = -Math.PI / 2 + jitter(rng, 0, 1.35);
    const l = h * jitter(rng, 0.62, 0.18);
    const ex = bx + Math.cos(a) * l;
    const ey = by + Math.sin(a) * l;
    ctx.strokeStyle = hsl(jitter(rng, 92, 8), 0.42, jitter(rng, 0.3, 0.05));
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + Math.cos(a) * l * 0.6, by + Math.sin(a) * l * 0.5, ex, ey + l * 0.08);
    ctx.stroke();
    // a tiny bract at the tip
    ctx.fillStyle = hsl(62, 0.4, 0.4);
    ctx.beginPath();
    ctx.arc(ex, ey + l * 0.08, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWheat(ctx: Ctx, c: { x: number; y: number; w: number; h: number }, rng: Rng) {
  const { x, y, w, h } = c;
  const cx = x + w / 2;
  ctx.lineCap = "round";
  // stem
  ctx.strokeStyle = hsl(48, 0.5, 0.55);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx, y + h);
  ctx.lineTo(cx, y + h * 0.45);
  ctx.stroke();
  // ear: stacked spikelets with awns
  for (let t = 0; t < 1; t += 0.055) {
    const yy = y + h * (0.45 - t * 0.4);
    for (const s of [-1, 1]) {
      const sx = cx + s * w * 0.1;
      leafShape(ctx, cx, yy, w * 0.2, w * 0.07, s < 0 ? Math.PI + 0.5 : -0.5, hsl(jitter(rng, 45, 4), 0.62, jitter(rng, 0.6, 0.05)), null);
      ctx.strokeStyle = hsl(45, 0.5, 0.7, 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, yy);
      ctx.lineTo(sx + s * w * 0.18, yy - h * 0.12);
      ctx.stroke();
    }
  }
}

function drawFlower(ctx: Ctx, c: { x: number; y: number; w: number; h: number }) {
  const { x, y, w, h } = c;
  const cx = x + w / 2;
  const cy = y + h / 2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    leafShape(ctx, cx, cy, w * 0.44, w * 0.16, a, hsl(0, 0, 0.93), null);
  }
  ctx.fillStyle = hsl(45, 0.9, 0.5);
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawCattail(ctx: Ctx, c: { x: number; y: number; w: number; h: number }) {
  const { x, y, w, h } = c;
  const cx = x + w / 2;
  ctx.strokeStyle = hsl(80, 0.35, 0.35);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx, y + h);
  ctx.lineTo(cx, y + h * 0.05);
  ctx.stroke();
  ctx.fillStyle = hsl(24, 0.45, 0.24);
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.42, w * 0.1, h * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
}

function noiseFill(ctx: Ctx, c: { x: number; y: number; w: number; h: number }, rng: Rng, base: [number, number, number], streak: number) {
  const { x, y, w, h } = c;
  ctx.fillStyle = hsl(base[0], base[1], base[2]);
  ctx.fillRect(x, y, w, h);
  for (let k = 0; k < 900; k++) {
    const sx = x + rng() * w;
    const sy = y + rng() * h;
    const len = streak * jitter(rng, 1, 0.6);
    ctx.fillStyle = hsl(base[0] + jitter(rng, 0, 6), base[1], base[2] + jitter(rng, 0, 0.1), 0.5);
    ctx.fillRect(sx, sy, jitter(rng, 4, 3), len);
  }
}

function drawPalmBark(ctx: Ctx, c: { x: number; y: number; w: number; h: number }, rng: Rng) {
  noiseFill(ctx, c, rng, [30, 0.18, 0.36], 10);
  // leaf-base scars: offset rows of chevrons
  const rows = 16;
  for (let r = 0; r < rows; r++) {
    const yy = c.y + (r / rows) * c.h;
    const off = r % 2 ? 0.5 : 0;
    for (let k = -1; k < 5; k++) {
      const xx = c.x + ((k + off) / 4) * c.w;
      ctx.strokeStyle = hsl(28, 0.2, 0.22, 0.8);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(xx - c.w * 0.12, yy + 18);
      ctx.lineTo(xx, yy);
      ctx.lineTo(xx + c.w * 0.12, yy + 18);
      ctx.stroke();
    }
  }
}

function drawBirchBark(ctx: Ctx, c: { x: number; y: number; w: number; h: number }, rng: Rng) {
  noiseFill(ctx, c, rng, [40, 0.08, 0.86], 3);
  for (let k = 0; k < 60; k++) {
    const yy = c.y + rng() * c.h;
    const xx = c.x + rng() * c.w;
    ctx.fillStyle = hsl(20, 0.15, jitter(rng, 0.15, 0.05), 0.85);
    ctx.fillRect(xx, yy, c.w * jitter(rng, 0.25, 0.15), jitter(rng, 5, 3));
  }
}

/** Fills the RGB of (near) transparent texels with their neighbourhood's colour so mipmaps don't bleed black edges. */
function dilate(data: Uint8ClampedArray, size: number) {
  // two passes of a 4-neighbour flood, then a global fallback to the mean leaf colour
  let mr = 0;
  let mg = 0;
  let mb = 0;
  let n = 0;
  for (let i = 0; i < size * size; i++) {
    if (data[i * 4 + 3] > 200) {
      mr += data[i * 4];
      mg += data[i * 4 + 1];
      mb += data[i * 4 + 2];
      n++;
    }
  }
  if (n) {
    mr /= n;
    mg /= n;
    mb /= n;
  }
  const src = new Uint8ClampedArray(data);
  const filled = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) if (src[i * 4 + 3] > 40) filled[i] = 1;
  for (let pass = 0; pass < 6; pass++) {
    const next = filled.slice();
    for (let yy = 0; yy < size; yy++) {
      for (let xx = 0; xx < size; xx++) {
        const i = yy * size + xx;
        if (filled[i]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let k = 0;
        const take = (j: number) => {
          if (!filled[j]) return;
          r += data[j * 4];
          g += data[j * 4 + 1];
          b += data[j * 4 + 2];
          k++;
        };
        if (xx > 0) take(i - 1);
        if (xx < size - 1) take(i + 1);
        if (yy > 0) take(i - size);
        if (yy < size - 1) take(i + size);
        if (k) {
          data[i * 4] = r / k;
          data[i * 4 + 1] = g / k;
          data[i * 4 + 2] = b / k;
          next[i] = 1;
        }
      }
    }
    filled.set(next);
  }
  for (let i = 0; i < size * size; i++) {
    if (!filled[i]) {
      data[i * 4] = mr;
      data[i * 4 + 1] = mg;
      data[i * 4 + 2] = mb;
    }
  }
}

const rect = (c: Cell) => ({ x: c.u0 * ATLAS_SIZE, y: (1 - c.v1) * ATLAS_SIZE, w: (c.u1 - c.u0) * ATLAS_SIZE, h: (c.v1 - c.v0) * ATLAS_SIZE });

export interface FoliageAtlas {
  texture: THREE.DataTexture;
  dispose(): void;
}

/** Builds the atlas (browser only). Bark photos are drawn in when they arrive; `onUpdate` fires after each upload. */
export function createFoliageAtlas(): FoliageAtlas | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const rng = mulberry32(0xf011a6e);
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  drawFrond(ctx, rect(CELLS.frond), rng, false);
  drawNeedles(ctx, rect(CELLS.needles), rng);
  drawLeafCluster(ctx, rect(CELLS.leaves), rng, { count: 70, size: 92, hue: 95, sat: 0.45, light: 0.3 });
  drawLeafCluster(ctx, rect(CELLS.birchLeaves), rng, { count: 90, size: 58, hue: 78, sat: 0.55, light: 0.4 });
  drawLeafCluster(ctx, rect(CELLS.bushLeaves), rng, { count: 150, size: 46, hue: 100, sat: 0.4, light: 0.27 });
  drawPapyrus(ctx, rect(CELLS.papyrus), rng);
  drawWheat(ctx, rect(CELLS.wheat), rng);
  drawFlower(ctx, rect(CELLS.flower));
  drawCattail(ctx, rect(CELLS.cattail));
  drawPalmBark(ctx, rect(CELLS.barkPalm), rng);
  noiseFill(ctx, rect(CELLS.bark), rng, [26, 0.25, 0.26], 40);
  drawBirchBark(ctx, rect(CELLS.barkBirch), rng);
  noiseFill(ctx, rect(CELLS.barkDead), rng, [30, 0.08, 0.42], 50);
  drawFrond(ctx, rect(CELLS.deadFrond), rng, true);
  const g = rect(CELLS.grassCard);
  ctx.fillStyle = hsl(90, 0.4, 0.45);
  ctx.fillRect(g.x, g.y, g.w, g.h);
  const p = rect(CELLS.plain);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(p.x, p.y, p.w, p.h);

  const image = ctx.getImageData(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  dilate(image.data, ATLAS_SIZE);
  // canvas rows run top-down; flip so row 0 is v = 0 (the Cell rects are v-up)
  const flipped = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);
  const row = ATLAS_SIZE * 4;
  for (let yy = 0; yy < ATLAS_SIZE; yy++) flipped.set(image.data.subarray(yy * row, (yy + 1) * row), (ATLAS_SIZE - 1 - yy) * row);
  const texture = new THREE.DataTexture(flipped, ATLAS_SIZE, ATLAS_SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  texture.name = "world3d:foliage-atlas";

  // photo bark: tile the Poly Haven maps into the bark strips once they load
  let disposed = false;
  void loadManifest().then(async (m) => {
    if (!m || disposed) return;
    const photo = async (name: string) => {
      const info = m.textures[name];
      if (!info) return null;
      try {
        const res = await fetch(TEXTURE_BASE + info.maps.diff);
        return await createImageBitmap(await res.blob());
      } catch {
        return null;
      }
    };
    const [palm, bark] = await Promise.all([photo("bark_palm"), photo("bark")]);
    if (disposed) return;
    const draw = (bmp: ImageBitmap | null, cell: Cell, tint: string | null) => {
      if (!bmp) return;
      const r = rect(cell);
      // two tiles down the strip; the strip's width is one tile around the trunk
      for (let k = 0; k < 2; k++) ctx.drawImage(bmp, r.x, r.y + (k * r.h) / 2, r.w, r.h / 2);
      if (tint) {
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = tint;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.globalCompositeOperation = "source-over";
      }
      const img = ctx.getImageData(r.x, r.y, r.w, r.h);
      for (let yy = 0; yy < r.h; yy++) {
        const dst = (ATLAS_SIZE - 1 - (r.y + yy)) * row + r.x * 4;
        flipped.set(img.data.subarray(yy * r.w * 4, (yy + 1) * r.w * 4), dst);
      }
    };
    draw(palm, CELLS.barkPalm, null);
    draw(bark, CELLS.bark, null);
    draw(bark, CELLS.barkDead, "#b8b0a6");
    palm?.close();
    bark?.close();
    texture.needsUpdate = true;
  });

  return {
    texture,
    dispose() {
      disposed = true;
      texture.dispose();
    },
  };
}
