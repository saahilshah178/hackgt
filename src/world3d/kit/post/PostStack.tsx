"use client";

import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette, wrapEffect } from "@react-three/postprocessing";
import { Effect, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { LightRig } from "../../core/moods";
import type { QualitySettings } from "../quality";

/*
 * The post chain, by quality tier:
 *   full  (High):   N8AO ambient occlusion → mip-chain bloom → AgX tone mapping → colour grade → vignette → SMAA
 *   basic (Medium): bloom (half resolution) → AgX → grade → vignette, MSAA on the composer target
 *   none  (Low):    no composer; <WorldScene> sets AgX on the renderer instead.
 * The grade reads the mood's rig.post (saturation, contrast, warmth, vignette, bloom): white balance, a gentle
 * perceptual contrast curve, split toning (warm highlights, cool shadows) and saturation, after tone mapping.
 */

const GRADE_FRAGMENT = /* glsl */ `
uniform float saturation;
uniform float contrast;
uniform float warmth;
void mainImage( const in vec4 inputColor, const in vec2 uv, out vec4 outputColor ) {
  vec3 c = max( inputColor.rgb, 0.0 );
  c *= vec3( 1.0 + warmth * 0.07, 1.0 + warmth * 0.012, 1.0 - warmth * 0.1 );
  vec3 g = pow( c, vec3( 1.0 / 2.2 ) );
  g = ( g - 0.5 ) * contrast + 0.5;
  float l = dot( g, vec3( 0.2126, 0.7152, 0.0722 ) );
  vec3 highs = vec3( 0.035, 0.008, -0.03 ) * smoothstep( 0.45, 1.0, l );
  vec3 lows = vec3( -0.018, 0.0, 0.028 ) * ( 1.0 - smoothstep( 0.02, 0.4, l ) );
  g += ( highs + lows ) * clamp( abs( warmth ) * 1.6 + 0.2, 0.0, 1.0 ) * sign( warmth + 0.001 );
  l = dot( g, vec3( 0.2126, 0.7152, 0.0722 ) );
  g = mix( vec3( l ), g, saturation );
  outputColor = vec4( pow( max( g, 0.0 ), vec3( 2.2 ) ), inputColor.a );
}
`;

export class GradeEffect extends Effect {
  constructor({ saturation = 1, contrast = 1, warmth = 0 }: { saturation?: number; contrast?: number; warmth?: number } = {}) {
    super("GradeEffect", GRADE_FRAGMENT, {
      uniforms: new Map<string, THREE.Uniform>([
        ["saturation", new THREE.Uniform(saturation)],
        ["contrast", new THREE.Uniform(contrast)],
        ["warmth", new THREE.Uniform(warmth)],
      ]),
    });
  }
  get saturation(): number {
    return this.uniforms.get("saturation")!.value as number;
  }
  set saturation(v: number) {
    this.uniforms.get("saturation")!.value = v;
  }
  get contrast(): number {
    return this.uniforms.get("contrast")!.value as number;
  }
  set contrast(v: number) {
    this.uniforms.get("contrast")!.value = v;
  }
  get warmth(): number {
    return this.uniforms.get("warmth")!.value as number;
  }
  set warmth(v: number) {
    this.uniforms.get("warmth")!.value = v;
  }
}

const Grade = wrapEffect(GradeEffect);

export interface PostProps {
  rig: LightRig;
  settings: QualitySettings;
  /** night/lunar: stronger bloom on small lights */
  night: boolean;
}

export function PostStack({ rig, settings, night }: PostProps) {
  if (settings.post === "none") return null;
  const full = settings.post === "full";
  const p = rig.post;
  return (
    <EffectComposer multisampling={settings.multisampling} frameBufferType={THREE.HalfFloatType} enableNormalPass={false}>
      {full ? <N8AO halfRes quality="performance" aoRadius={2.4} distanceFalloff={1.2} intensity={2.2} color="#1a1612" /> : <></>}
      <Bloom
        mipmapBlur
        intensity={p.bloom * (night ? 1.1 : 0.75)}
        luminanceThreshold={night ? 0.6 : 0.95}
        luminanceSmoothing={0.3}
        radius={0.72}
        levels={full ? 7 : 5}
        resolutionScale={full ? 1 : 0.5}
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Grade saturation={p.saturation * 1.14} contrast={p.contrast * 1.04} warmth={p.warmth * 1.8} />
      <Vignette offset={0.32} darkness={p.vignette * 0.9} />
      {full ? <SMAA /> : <></>}
    </EffectComposer>
  );
}
