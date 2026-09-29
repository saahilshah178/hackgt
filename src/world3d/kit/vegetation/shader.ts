import * as THREE from "three";
import { ATLAS_SIZE } from "./atlas";

/*
 * Vegetation shader patches for MeshStandardMaterial / MeshDepthMaterial (onBeforeCompile):
 *   - world-space wind after instancing: a slow bend with gusts plus sway (aWind.x, metres at the top), and a fast leaf
 *     flutter (aWind.y); phase from each instance's position so a field ripples rather than pulses; calmer with
 *     reduced motion;
 *   - distance fade: small kinds shrink into the ground between uFadeStart and uFadeEnd (no popping);
 *   - alpha-tested cards keep their coverage in the distance (alpha scaled by the mip level, after Ben Golus);
 *   - no back-face normal flip (the crown normals already point out of the canopy);
 *   - translucency: sunlight through leaves when looking toward the sun, only where the sun actually reaches.
 */

export const VEG_VERTEX_PARS = /* glsl */ `
attribute vec2 aWind;
uniform float uFadeStart;
uniform float uFadeEnd;
`;

export const VEG_PROJECT_VERTEX = /* glsl */ `
vec4 vegP = vec4( transformed, 1.0 );
vec3 vegOrigin = vec3( 0.0 );
float vegScale = 1.0;
#ifdef USE_INSTANCING
vegP = instanceMatrix * vegP;
vegOrigin = instanceMatrix[ 3 ].xyz;
vegScale = length( instanceMatrix[ 0 ].xyz );
#endif
vec4 vegW = modelMatrix * vegP;
vec3 vegO = ( modelMatrix * vec4( vegOrigin, 1.0 ) ).xyz;
float vegFade = 1.0 - smoothstep( uFadeStart, uFadeEnd, distance( vegO, cameraPosition ) );
vegW.xyz = vegO + ( vegW.xyz - vegO ) * vegFade;
{
  float calm = 1.0 - 0.6 * uCalm;
  float phase = dot( vegO.xz, vec2( 0.071, 0.113 ) );
  float gust = 0.55 + 0.45 * sin( uTime * 0.31 + vegO.x * 0.021 ) * sin( uTime * 0.19 + vegO.z * 0.017 );
  float windAmt = ( 0.2 + uWind ) * calm;
  float sway = sin( uTime * 1.3 + phase ) * 0.65 + sin( uTime * 2.9 + phase * 1.7 ) * 0.35;
  float bend = aWind.x * vegScale * windAmt;
  vegW.xz += uWindDir * ( 0.55 * gust + 0.45 * sway * gust ) * bend;
  vegW.y -= abs( bend ) * 0.1 * gust;
  float fl = aWind.y * windAmt * vegScale;
  vegW.xyz += vec3( sin( uTime * 6.3 + vegW.x * 2.1 + vegW.y * 1.3 ), sin( uTime * 5.1 + vegW.z * 1.7 ) * 0.6, cos( uTime * 5.7 + vegW.y * 2.3 + vegW.z * 1.1 ) ) * fl;
}
vec4 mvPosition = viewMatrix * vegW;
gl_Position = projectionMatrix * mvPosition;
`;

export const VEG_ALPHA_MIP = /* glsl */ `
#include <map_fragment>
#ifdef USE_MAP
{
  vec2 mdx = dFdx( vMapUv * ${ATLAS_SIZE.toFixed(1)} );
  vec2 mdy = dFdy( vMapUv * ${ATLAS_SIZE.toFixed(1)} );
  float mip = max( 0.0, 0.5 * log2( max( dot( mdx, mdx ), dot( mdy, mdy ) ) ) );
  diffuseColor.a *= 1.0 + mip * 0.3;
}
#endif
`;

export const VEG_TRANSLUCENCY = /* glsl */ `
#include <lights_fragment_end>
{
  vec3 sunV = normalize( ( viewMatrix * vec4( uSunDir, 0.0 ) ).xyz );
  float back = pow( saturate( dot( -geometryViewDir, sunV ) ), 3.0 );
  float wrap = saturate( dot( -normal, sunV ) * 0.5 + 0.35 );
  reflectedLight.directDiffuse += diffuseColor.rgb * uSunColor * ( back * 0.55 + wrap * 0.1 ) * uTranslucency * envDirShadow;
}
`;

const noFlip = (chunk: string) => chunk.replace(/normal \*= faceDirection;/g, "").replace(/bitangent \*= faceDirection;/g, "").replace(/tangent \*= faceDirection;/g, "");

type Shader = THREE.WebGLProgramParametersWithUniforms;

/** Vertex part (wind + fade): used by the colour materials and the shadow depth materials. */
export function patchVegetationVertex(shader: Shader) {
  shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${VEG_VERTEX_PARS}`).replace("#include <project_vertex>", VEG_PROJECT_VERTEX);
}

/** Fragment part for foliage-like materials (after patchSunShadow, which declares envDirShadow and the env uniforms). */
export function patchVegetationFragment(shader: Shader, opts: { alphaMip: boolean; translucency: boolean; noFlip: boolean }) {
  let f = shader.fragmentShader;
  if (opts.translucency) f = f.replace("void main() {", "uniform float uTranslucency;\nvoid main() {").replace("#include <lights_fragment_end>", VEG_TRANSLUCENCY);
  if (opts.alphaMip) f = f.replace("#include <map_fragment>", VEG_ALPHA_MIP);
  if (opts.noFlip) f = f.replace("#include <normal_fragment_begin>", noFlip(THREE.ShaderChunk.normal_fragment_begin));
  shader.fragmentShader = f;
}
