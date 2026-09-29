/*
 * The Preetham daylight model as plain TypeScript: the same maths as the sky dome's fragment shader (./shader.ts, after
 * three.js's examples/jsm/objects/Sky.js, MIT), so the renderer can ask what colour the sky is at the horizon and match
 * the fog to it exactly. Geometry that fades into fog then meets a sky of the same colour: no seam at the horizon.
 * Outputs linear radiance before exposure (the same scale the dome writes).
 */

export interface SkyParams {
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
}

type V3 = [number, number, number];

const E = Math.E;
const PI = Math.PI;
const TOTAL_RAYLEIGH: V3 = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const MIE_CONST: V3 = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];
const CUTOFF = 1.6110731556870734;
const STEEPNESS = 1.5;
const EE = 1000;
const RAYLEIGH_ZENITH = 8.4e3;
const MIE_ZENITH = 1.25e3;
const THREE_OVER_16PI = 0.05968310365946075;
const ONE_OVER_4PI = 0.07957747154594767;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function sunIntensity(zenithCos: number) {
  const z = clamp(zenithCos, -1, 1);
  return EE * Math.max(0, 1 - Math.pow(E, -((CUTOFF - Math.acos(z)) / STEEPNESS)));
}

/** Sky radiance (linear RGB, the dome's scale) looking along unit `dir`, sun along unit `sun`. No clouds, no disc. */
export function skyRadiance(dir: V3, sun: V3, p: SkyParams): V3 {
  const sunE = sunIntensity(sun[1]);
  // Sky.js's sun fade with a unit sun vector (as the dome passes it): ≈ 1, so the rayleigh coefficient is used as given
  const sunfade = 1 - clamp(1 - Math.exp(sun[1] / 450000), 0, 1);
  const rayleighCoef = p.rayleigh - 1 * (1 - sunfade);
  const betaR = TOTAL_RAYLEIGH.map((v) => v * rayleighCoef) as V3;
  const c = 0.2 * p.turbidity * 10e-18;
  const betaM = MIE_CONST.map((v) => 0.434 * c * v * p.mieCoefficient) as V3;

  const zenith = Math.acos(Math.max(0, dir[1]));
  const inverse = 1 / (Math.cos(zenith) + 0.15 * Math.pow(93.885 - (zenith * 180) / PI, -1.253));
  const sR = RAYLEIGH_ZENITH * inverse;
  const sM = MIE_ZENITH * inverse;
  const fex = [0, 1, 2].map((i) => Math.exp(-(betaR[i] * sR + betaM[i] * sM))) as V3;
  const cosTheta = dir[0] * sun[0] + dir[1] * sun[1] + dir[2] * sun[2];
  const rPhase = THREE_OVER_16PI * (1 + Math.pow(cosTheta * 0.5 + 0.5, 2));
  const g = p.mieDirectionalG;
  const mPhase = ONE_OVER_4PI * ((1 - g * g) / Math.pow(1 - 2 * g * cosTheta + g * g, 1.5));
  const out: V3 = [0, 0, 0];
  const horizonMix = clamp(Math.pow(1 - sun[1], 5), 0, 1);
  for (let i = 0; i < 3; i++) {
    const ratio = (betaR[i] * rPhase + betaM[i] * mPhase) / (betaR[i] + betaM[i]);
    let lin = Math.pow(sunE * ratio * (1 - fex[i]), 1.5);
    lin *= 1 + (Math.pow(sunE * ratio * fex[i], 0.5) - 1) * horizonMix;
    const l0 = 0.1 * fex[i];
    out[i] = (lin + l0) * 0.04 + [0, 0.0003, 0.00075][i];
  }
  return out;
}

/**
 * The average sky colour just above the horizon (elevation `elevDeg`), sampled around the compass and weighted a
 * little toward the sun (fog in the sun's direction is brighter). Linear RGB, dome scale.
 */
export function horizonRadiance(sun: V3, p: SkyParams, elevDeg = 1.5, samples = 24): V3 {
  const el = (elevDeg * PI) / 180;
  const acc: V3 = [0, 0, 0];
  let wsum = 0;
  for (let k = 0; k < samples; k++) {
    const az = (k / samples) * PI * 2;
    const dir: V3 = [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
    const toward = Math.max(0, dir[0] * sun[0] + dir[2] * sun[2]);
    const w = 1 + 0.6 * toward;
    const r = skyRadiance(dir, sun, p);
    for (let i = 0; i < 3; i++) acc[i] += r[i] * w;
    wsum += w;
  }
  return acc.map((v) => v / wsum) as V3;
}

// ---------------------------------------------------------------- calibration

/**
 * The raw model is far too bright at the horizon and around a low sun for a game camera (horizon/zenith up to 30:1).
 * The dome therefore maps luminance through a gentle power curve anchored at the zenith:
 *   L' = target · (L / zenith)^gamma   (hue preserved)
 * with `target` tied to the sun's intensity, so the sky, the fog and the image-based light all sit at a plausible
 * brightness next to sunlit ground. The shader applies the same curve (uSkyRef/uSkyTarget/uSkyGamma).
 */
export interface SkyCalibration {
  /** zenith luminance of the raw model */
  ref: number;
  /** zenith luminance after calibration */
  target: number;
  gamma: number;
}

export const luminance = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

export function calibrateSky(sun: V3, p: SkyParams, sunIntensity: number): SkyCalibration {
  const ref = Math.max(1e-4, luminance(skyRadiance([0, 1, 0], sun, p)));
  // a low sun leaves a deeper blue zenith; a high sun a paler one
  const elev = Math.asin(clamp(sun[1], -1, 1));
  const target = sunIntensity * (0.045 + 0.05 * clamp(elev / 1.1, 0, 1));
  return { ref, target, gamma: 0.5 };
}

export function applyCalibration(c: V3, cal: SkyCalibration): V3 {
  const l = Math.max(1e-6, luminance(c));
  const k = (cal.target * Math.pow(l / cal.ref, cal.gamma)) / l;
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** Calibrated horizon colour away from the sun's glow (the fog colour's base). */
export function calibratedHorizon(sun: V3, p: SkyParams, cal: SkyCalibration, elevDeg = 2, samples = 32): V3 {
  const el = (elevDeg * PI) / 180;
  const acc: V3 = [0, 0, 0];
  let wsum = 0;
  for (let k = 0; k < samples; k++) {
    const az = (k / samples) * PI * 2;
    const dir: V3 = [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
    const cosSun = dir[0] * sun[0] + dir[1] * sun[1] + dir[2] * sun[2];
    // skip the tight forward-scattering lobe; keep a little of the broad glow
    const w = cosSun > 0.9 ? 0.15 : 1;
    const r = applyCalibration(skyRadiance(dir, sun, p), cal);
    for (let i = 0; i < 3; i++) acc[i] += r[i] * w;
    wsum += w;
  }
  return acc.map((v) => v / wsum) as V3;
}

/** Irradiance on an up-facing surface from the calibrated sky's upper hemisphere (deterministic quadrature). */
export function skyIrradiance(sun: V3, p: SkyParams, cal: SkyCalibration, rings = 8, perRing = 16): number {
  let e = 0;
  for (let r = 0; r < rings; r++) {
    const theta0 = (r / rings) * (PI / 2);
    const theta1 = ((r + 1) / rings) * (PI / 2);
    const theta = (theta0 + theta1) / 2;
    const solid = (Math.cos(theta0) - Math.cos(theta1)) * ((2 * PI) / perRing);
    for (let k = 0; k < perRing; k++) {
      const az = ((k + 0.5) / perRing) * PI * 2;
      const dir: V3 = [Math.sin(theta) * Math.sin(az), Math.cos(theta), -Math.sin(theta) * Math.cos(az)];
      const cosSun = dir[0] * sun[0] + dir[1] * sun[1] + dir[2] * sun[2];
      // the sun's own lobe is the DirectionalLight's job; leave it out of the ambient estimate
      const l = cosSun > 0.995 ? 0 : luminance(applyCalibration(skyRadiance(dir, sun, p), cal));
      e += l * Math.cos(theta) * solid;
    }
  }
  return e;
}
