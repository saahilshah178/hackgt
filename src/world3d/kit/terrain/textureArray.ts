import * as THREE from "three";
import { loadManifest, loadPixels, TEXTURE_BASE } from "../materials/textures";

/*
 * Packs the terrain's ground textures into three DataArrayTextures (albedo in sRGB, normal, AO/rough/metal), one layer
 * per texture, so the splat shader reads any of up to 8 grounds through 3 samplers. Mipmapped and anisotropic like a
 * normal texture. Returns null when the assets are missing (the terrain then keeps its flat biome colours).
 */

export interface TerrainArrays {
  diff: THREE.DataArrayTexture;
  nor: THREE.DataArrayTexture;
  arm: THREE.DataArrayTexture;
  /** per layer: average albedo (sRGB hex) and real-world tile size (m) */
  avg: (string | null)[];
  metres: number[];
  dispose(): void;
}

function arrayTexture(data: Uint8Array, size: number, layers: number, srgb: boolean): THREE.DataArrayTexture {
  const t = new THREE.DataArrayTexture(data, size, size, layers);
  t.format = THREE.RGBAFormat;
  t.type = THREE.UnsignedByteType;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export async function loadTerrainArrays(names: readonly string[], size: number): Promise<TerrainArrays | null> {
  const manifest = await loadManifest();
  if (!manifest) return null;
  const infos = names.map((n) => manifest.textures[n]);
  if (infos.some((i) => !i)) return null;
  const layer = size * size * 4;
  const diff = new Uint8Array(layer * names.length);
  const nor = new Uint8Array(layer * names.length);
  const arm = new Uint8Array(layer * names.length);
  const jobs: Promise<boolean>[] = [];
  infos.forEach((info, i) => {
    const put = (target: Uint8Array, file: string) =>
      loadPixels(TEXTURE_BASE + file, size).then((px) => {
        if (!px) return false;
        target.set(px, i * layer);
        return true;
      });
    jobs.push(put(diff, info.maps.diff), put(nor, info.maps.nor), put(arm, info.maps.arm));
  });
  const ok = await Promise.all(jobs);
  if (ok.some((v) => !v)) return null;
  const tDiff = arrayTexture(diff, size, names.length, true);
  const tNor = arrayTexture(nor, size, names.length, false);
  const tArm = arrayTexture(arm, size, names.length, false);
  return {
    diff: tDiff,
    nor: tNor,
    arm: tArm,
    avg: infos.map((i) => i.avg),
    metres: infos.map((i) => i.metres),
    dispose() {
      tDiff.dispose();
      tNor.dispose();
      tArm.dispose();
    },
  };
}
