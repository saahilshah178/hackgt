"use client";

import { Environment } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES } from "../../core/biomes";
import type { Weather } from "../../../contracts/world3d";
import type { LightRig } from "../../core/moods";
import { sunDirection } from "../../core/moods";
import { useWorldKit } from "../context";
import { qualitySettings } from "../quality";
import { useEnv } from "./env";
import { calibrateSky, calibratedHorizon, skyIrradiance, type SkyCalibration } from "./preetham";
import { createSkyMaterial } from "./shader";

/*
 * Sky and light: the sky dome (./shader.ts), image-based lighting (a PMREM of that same sky over a ground disc of the
 * biome's colour, so PBR materials pick up the right ambient and reflections), exponential fog whose colour IS the sky's
 * horizon colour (computed with the CPU Preetham port), and the sun (or moon) as one DirectionalLight whose tight,
 * high-resolution shadow box follows the focus point (the player), snapped to whole shadow texels so it never shimmers.
 *
 * The lunar biome is special-cased here rather than in the rig: a black sky, the Earth overhead and a hard white sun.
 */

export interface SkyLook {
  mode: 0 | 1 | 2;
  sun: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  fog: THREE.Color;
  fogDensity: number;
  envIntensity: number;
  hemisphere: { sky: THREE.Color; ground: THREE.Color; intensity: number };
  groundRadiance: THREE.Color;
  exposure: number;
  cal: SkyCalibration;
  /** linear radiance of a sunlit cloud top */
  cloudLight: THREE.Color;
}

/** The rig's fog densities are tuned for a flat stub; the lit, textured world reads better with ~half of it. */
export const FOG_SCALE = 0.5;

const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/** Everything the sky, fog, IBL and sun need, derived once per rig. */
export function skyLook(rig: LightRig, biome: keyof typeof BIOMES, weather: Weather = "clear"): SkyLook {
  const d = sunDirection(rig);
  const sun = new THREE.Vector3(d.x, d.y, d.z).normalize();
  const lunar = biome === "lunar";
  const mode: 0 | 1 | 2 = lunar ? 2 : rig.night ? 1 : 0;
  const rigFog = new THREE.Color(rig.fog.color);
  const sunV: [number, number, number] = [sun.x, sun.y, sun.z];
  const sunIntensity = lunar ? 3.4 : rig.sun.intensity;
  // rain: a darker, flatter day (the rig's overcast ambient is tuned for dry cloud)
  const gloom = weather === "light_rain" ? 0.62 : weather === "ash" ? 0.75 : 1;
  const cal = calibrateSky(sunV, rig.sky, sunIntensity);
  // a clouded sky is lit by more than the (dimmed) sun: an overcast deck glows, it is the brightest thing in view
  if (mode === 0) cal.target *= (1 + Math.max(0, rig.clouds - 0.4) * 4) * gloom;
  let fog: THREE.Color;
  if (mode === 0) {
    const h = calibratedHorizon(sunV, rig.sky, cal);
    const sky = new THREE.Color(h[0], h[1], h[2]);
    // keep the sky's brightness, lean the hue toward the mood's designed fog colour
    const scaled = rigFog.clone().multiplyScalar(lum(sky) / Math.max(1e-4, lum(rigFog)));
    fog = sky.lerp(scaled, 0.5);
    // weather that thickens the air (mist, rain, dust) also flattens the horizon toward the fog tint
    fog.lerp(scaled, Math.min(0.4, Math.max(0, (rig.fog.density - 0.002) * 120)));
  } else if (mode === 1) {
    fog = rigFog.clone().multiplyScalar(0.55);
  } else {
    fog = new THREE.Color(0, 0, 0);
  }
  const sunColor = lunar ? new THREE.Color("#fffaf2") : new THREE.Color(rig.sun.color);
  const g = new THREE.Color(BIOMES[biome].ground.low.color);
  // image-based light: match the ambient the mood designed (its hemisphere light) on an up-facing surface
  const hemiSky = new THREE.Color(rig.hemisphere.sky);
  const targetAmbient = rig.hemisphere.intensity * lum(hemiSky) * 1.15;
  const envRaw = mode === 0 ? skyIrradiance(sunV, rig.sky, cal) : 0;
  const envIntensity = mode === 2 ? 0.18 : mode === 1 ? 0.9 : Math.min(3, Math.max(0.2, (targetAmbient * gloom) / Math.max(1e-3, envRaw)));
  const irradiance = sunIntensity * Math.max(0, sun.y) + rig.hemisphere.intensity * 0.6;
  const groundRadiance = g.multiplyScalar((irradiance / Math.PI) * 0.9).multiply(sunColor.clone().lerp(new THREE.Color(1, 1, 1), 0.5));
  return {
    mode,
    sun,
    sunColor,
    sunIntensity,
    fog,
    fogDensity: rig.fog.density * FOG_SCALE,
    envIntensity,
    hemisphere: { sky: new THREE.Color(rig.hemisphere.sky), ground: new THREE.Color(rig.hemisphere.ground), intensity: rig.hemisphere.intensity },
    groundRadiance,
    exposure: rig.exposure * (lunar ? 0.9 : 1) * (gloom < 1 ? 0.88 : 1),
    cal,
    cloudLight: sunColor
      .clone()
      .multiplyScalar(sunIntensity * 0.24)
      .add(hemiSky.clone().multiplyScalar(rig.hemisphere.intensity * 0.3 * Math.max(0, rig.clouds - 0.3) * gloom)),
  };
}

function applySkyUniforms(m: ReturnType<typeof createSkyMaterial>, look: SkyLook, rig: LightRig, forEnv: boolean) {
  const u = m.uniforms;
  u.sunDirection.value.copy(look.sun);
  u.rayleigh.value = rig.sky.rayleigh;
  u.turbidity.value = rig.sky.turbidity;
  u.mieCoefficient.value = rig.sky.mieCoefficient;
  u.mieDirectionalG.value = rig.sky.mieDirectionalG;
  u.uMode.value = look.mode;
  u.uClouds.value = rig.clouds;
  u.uFogColor.value.copy(look.fog);
  // denser air lifts the fog band higher up the sky
  u.uFogBand.value = Math.min(0.22, 0.035 + look.fogDensity * 22);
  u.uSunDisc.value = forEnv ? 0 : 1;
  u.uNightHorizon.value.copy(look.fog);
  u.uNightZenith.value.set(0.0015, 0.0025, 0.008);
  u.uStarBoost.value = look.mode === 2 ? 1.6 : 1;
  u.uSkyRef.value = look.cal.ref;
  u.uSkyTarget.value = look.cal.target;
  u.uSkyGamma.value = look.cal.gamma;
  u.uCloudLight.value.copy(look.cloudLight);
  // the Earth: high over the map's north-west, where most spawn shots look
  u.uEarthDir.value.set(-0.55, 0.36, -0.75).normalize();
}

export function SkySystem({ focus }: { focus?: () => { x: number; y: number; z: number } | null }) {
  const kit = useWorldKit();
  const env = useEnv();
  const { rig, composed, quality } = kit;
  const q = qualitySettings(quality);
  const biome = composed.world.biome;
  const weather = composed.world.atmosphere.weather;
  const look = useMemo(() => skyLook(rig, biome, weather), [rig, biome, weather]);
  const gl = useThree((s) => s.gl);

  // ---- the dome
  const sky = useMemo(() => {
    const m = createSkyMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1000; // after the opaque world: only uncovered pixels run the sky shader
    mesh.name = "sky";
    return { m, mesh };
  }, []);
  useEffect(() => applySkyUniforms(sky.m, look, rig, false), [sky, look, rig]);
  useEffect(
    () => () => {
      sky.m.dispose();
      sky.mesh.geometry.dispose();
    },
    [sky],
  );

  // ---- image-based lighting: PMREM of the sky + a ground disc (rendered once per look; temporaries freed at once)
  const envTarget = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const scene = new THREE.Scene();
    const m = createSkyMaterial();
    applySkyUniforms(m, look, rig, true);
    const dome = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m);
    dome.frustumCulled = false;
    scene.add(dome);
    const groundGeo = new THREE.CircleGeometry(600, 48).rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({ color: look.groundRadiance, fog: false });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -6;
    scene.add(ground);
    const rt = pmrem.fromScene(scene, 0.03, 0.1, 1000, { size: q.envSize });
    pmrem.dispose();
    m.dispose();
    dome.geometry.dispose();
    groundGeo.dispose();
    groundMat.dispose();
    return rt;
  }, [gl, look, rig, q.envSize]);
  useEffect(() => () => envTarget.dispose(), [envTarget]);
  const envMap = envTarget.texture;

  // ---- sun
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const basis = useMemo(() => {
    const fwd = look.sun.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    return { right, up };
  }, [look]);
  const spawn = composed.spawn;
  const tmp = useMemo(() => ({ f: new THREE.Vector3() }), []);
  const extent = q.shadowExtent;
  const mapSize = q.shadowMapSize;

  useFrame((state, dt) => {
    env.uTime.value += reducedDt(dt, kit.reducedMotion);
    sky.m.uniforms.uTime.value = env.uTime.value;
    // haze lives near the ground: looking down from high up, the air between camera and land is thinner
    const fog = state.scene.fog;
    if (fog && fog instanceof THREE.FogExp2) {
      const cam = state.camera.position;
      const above = cam.y - composed.hf.height(cam.x, cam.z);
      fog.density = look.fogDensity * (1 - 0.5 * THREE.MathUtils.smoothstep(above, 30, 350));
    }
    const L = light.current;
    if (!L) return;
    const p = focus?.() ?? null;
    const f = tmp.f.set(p?.x ?? spawn.x, p?.y ?? spawn.y, p?.z ?? spawn.z);
    // snap the box centre to whole shadow texels in light space (no shimmering while the player walks)
    const texel = (2 * extent) / Math.max(1, mapSize);
    const a = f.dot(basis.right);
    const b = f.dot(basis.up);
    f.addScaledVector(basis.right, Math.round(a / texel) * texel - a).addScaledVector(basis.up, Math.round(b / texel) * texel - b);
    target.position.copy(f);
    target.updateMatrixWorld();
    L.position.copy(f).addScaledVector(look.sun, 500);
    env.uShadowFocus.value.copy(f);
  });

  useEffect(() => {
    const L = light.current;
    if (!L) return;
    L.shadow.camera.updateProjectionMatrix();
    L.shadow.needsUpdate = true;
  }, [extent, mapSize]);

  useEffect(() => {
    env.uSunDir.value.copy(look.sun);
    env.uSunColor.value.copy(look.sunColor).multiplyScalar(look.sunIntensity);
    env.uNight.value = look.mode === 1 ? 1 : 0;
    env.uShadowExtent.value = extent;
    env.uShadowOn.value = mapSize > 0 ? 1 : 0;
  }, [env, look, extent, mapSize]);

  const fogKey = `${look.fog.getHexString()}:${look.fogDensity.toFixed(5)}`;
  return (
    <>
      <primitive object={sky.mesh} />
      <color attach="background" args={[look.fog]} />
      {look.fogDensity > 0 && <fogExp2 key={fogKey} attach="fog" args={[look.fog, look.fogDensity]} />}
      {envMap && <Environment map={envMap} environmentIntensity={look.envIntensity} />}
      <hemisphereLight args={[look.hemisphere.sky, look.hemisphere.ground, look.hemisphere.intensity * (envMap ? 0.25 : 1)]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        color={look.sunColor}
        intensity={look.sunIntensity}
        castShadow={mapSize > 0}
        shadow-mapSize={[mapSize || 512, mapSize || 512]}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={1100}
        shadow-bias={-0.0003}
        shadow-normalBias={0.035}
        shadow-radius={2}
      />
    </>
  );
}

function reducedDt(dt: number, reduced: boolean) {
  return Math.min(0.1, dt) * (reduced ? 0.5 : 1);
}
