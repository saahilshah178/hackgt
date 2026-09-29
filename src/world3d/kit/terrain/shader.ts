/*
 * GLSL for the terrain splat (MeshStandardMaterial + onBeforeCompile, WebGL2). Per fragment:
 *   1. weights for 8 slots (shore, low, high, cliff, peak, path, field, stone) from the height above the water, the
 *      slope, the path/field/stone masks and two octaves of tileable noise (the same rules as splat.ts);
 *   2. only slots with weight > 1% are sampled, from three texture arrays (albedo sRGB, OpenGL normal, AO/rough/metal);
 *      the cliff slot is triplanar (no stretching on steep faces); beyond ~40 m each layer cross-fades to a rotated,
 *      4x larger sample so the tiling never shows toward the horizon;
 *   3. macro variation (brightness and hue at 180 m and 37 m), the heightfield cavity, and a wet band at the waterline
 *      (darker, glossier) finish the albedo; normals use the whiteout blend onto the geometric normal.
 * Untextured (Low tier): the slot colours with the same weights and macro variation.
 */

export const TERRAIN_VERTEX_PARS = /* glsl */ `
varying vec3 vTWPos;
varying vec3 vTWNormal;
`;

export const TERRAIN_VERTEX_MAIN = /* glsl */ `
vTWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vTWNormal = normalize( mat3( modelMatrix ) * objectNormal );
`;

export const TERRAIN_FRAGMENT_PARS = /* glsl */ `
precision highp sampler2DArray;
uniform sampler2DArray tDiff;
uniform sampler2DArray tNor;
uniform sampler2DArray tArm;
uniform sampler2D tMask;
uniform sampler2D tNoise;
uniform float uTextured;
uniform float uTriplanar;
uniform float uLevel;
uniform float uHasWater;
uniform float uHighLine;
uniform float uPeakLine;
uniform float uLayer[8];
uniform vec3 uTint[8];
uniform vec3 uFlat[8];
uniform float uScale[8];
uniform float uRough[8];
uniform float uNormalStrength;
uniform float uWetness;
varying vec3 vTWPos;
varying vec3 vTWNormal;

vec3 splatAlbedo;
vec3 splatN;
float splatRough;
float splatAO;

vec3 tpNormalY( vec3 tn, vec3 N ) {
  vec3 t = vec3( tn.xy + N.xz, abs( tn.z ) * N.y );
  return t.xzy;
}

void sampleSlot( int i, float w, vec2 xz, vec3 N, float farT, float farSel, mat2 rot, vec3 dpx, vec3 dpy, inout vec3 alb, inout vec3 nrm, inout float rough, inout float ao ) {
  float L = uLayer[ i ];
  float s = uScale[ i ];
  vec3 d = vec3( 0.0 );
  vec3 tn = vec3( 0.0, 0.0, 1.0 );
  vec3 wn;
  vec3 arm = vec3( 1.0 );
  if ( i == 3 && uTriplanar > 0.5 ) {
    // cliffs: fewer, larger repeats with distance so rock detail never aliases into bands
    s *= mix( 1.0, 0.3, farT );
    vec3 bw = pow( abs( N ), vec3( 4.0 ) );
    bw /= ( bw.x + bw.y + bw.z );
    vec3 sgn = vec3( N.x < 0.0 ? -1.0 : 1.0, N.y < 0.0 ? -1.0 : 1.0, N.z < 0.0 ? -1.0 : 1.0 );
    vec2 uvX = vTWPos.zy * s;
    vec2 uvY = vTWPos.xz * s;
    vec2 uvZ = vTWPos.xy * s;
    uvX.x *= sgn.x;
    uvZ.x *= -sgn.z;
    vec2 gxX = dpx.zy * s * vec2( sgn.x, 1.0 );
    vec2 gyX = dpy.zy * s * vec2( sgn.x, 1.0 );
    vec2 gxY = dpx.xz * s;
    vec2 gyY = dpy.xz * s;
    vec2 gxZ = dpx.xy * s * vec2( -sgn.z, 1.0 );
    vec2 gyZ = dpy.xy * s * vec2( -sgn.z, 1.0 );
    vec3 dX = textureGrad( tDiff, vec3( uvX, L ), gxX, gyX ).rgb;
    vec3 dY = textureGrad( tDiff, vec3( uvY, L ), gxY, gyY ).rgb;
    vec3 dZ = textureGrad( tDiff, vec3( uvZ, L ), gxZ, gyZ ).rgb;
    d = dX * bw.x + dY * bw.y + dZ * bw.z;
    vec3 nX = textureGrad( tNor, vec3( uvX, L ), gxX, gyX ).xyz * 2.0 - 1.0;
    vec3 nY = textureGrad( tNor, vec3( uvY, L ), gxY, gyY ).xyz * 2.0 - 1.0;
    vec3 nZ = textureGrad( tNor, vec3( uvZ, L ), gxZ, gyZ ).xyz * 2.0 - 1.0;
    nX.xy *= uNormalStrength; nY.xy *= uNormalStrength; nZ.xy *= uNormalStrength;
    nX.x *= sgn.x;
    nZ.x *= -sgn.z;
    vec3 tX = vec3( nX.xy + N.zy, abs( nX.z ) * N.x );
    vec3 tY = vec3( nY.xy + N.xz, abs( nY.z ) * N.y );
    vec3 tZ = vec3( nZ.xy + N.xy, abs( nZ.z ) * N.z );
    wn = normalize( tX.zyx * bw.x + tY.xzy * bw.y + tZ.xyz * bw.z );
    arm = textureGrad( tArm, vec3( uvX, L ), gxX, gyX ).rgb * bw.x + textureGrad( tArm, vec3( uvY, L ), gxY, gyY ).rgb * bw.y + textureGrad( tArm, vec3( uvZ, L ), gxZ, gyZ ).rgb * bw.z;
  } else {
    vec2 uv = xz * s;
    vec2 gx = dpx.xz * s;
    vec2 gy = dpy.xz * s;
    if ( farT < 0.999 ) {
      d = textureGrad( tDiff, vec3( uv, L ), gx, gy ).rgb;
      tn = textureGrad( tNor, vec3( uv, L ), gx, gy ).xyz * 2.0 - 1.0;
      arm = textureGrad( tArm, vec3( uv, L ), gx, gy ).rgb;
    }
    if ( farT > 0.001 ) {
      // far: two differently rotated and scaled samples, chosen region by region by a large-scale noise, so the
      // ground never shows a repeating grid toward the horizon
      vec3 d2 = vec3( 0.0 );
      vec3 tn2 = vec3( 0.0 );
      vec3 arm2 = vec3( 0.0 );
      if ( farSel < 0.99 ) {
        vec2 uv2 = rot * uv * 0.25 + 0.37;
        vec2 gx2 = rot * gx * 0.25;
        vec2 gy2 = rot * gy * 0.25;
        vec3 n2 = textureGrad( tNor, vec3( uv2, L ), gx2, gy2 ).xyz * 2.0 - 1.0;
        n2.xy = rot * n2.xy;
        d2 += textureGrad( tDiff, vec3( uv2, L ), gx2, gy2 ).rgb * ( 1.0 - farSel );
        tn2 += n2 * ( 1.0 - farSel );
        arm2 += textureGrad( tArm, vec3( uv2, L ), gx2, gy2 ).rgb * ( 1.0 - farSel );
      }
      if ( farSel > 0.01 ) {
        mat2 rot2 = mat2( -0.34, 0.94, -0.94, -0.34 );
        vec2 uv3 = rot2 * uv * 0.16 + 0.71;
        vec2 gx3 = rot2 * gx * 0.16;
        vec2 gy3 = rot2 * gy * 0.16;
        vec3 n3 = textureGrad( tNor, vec3( uv3, L ), gx3, gy3 ).xyz * 2.0 - 1.0;
        n3.xy = rot2 * n3.xy;
        d2 += textureGrad( tDiff, vec3( uv3, L ), gx3, gy3 ).rgb * farSel;
        tn2 += n3 * farSel;
        arm2 += textureGrad( tArm, vec3( uv3, L ), gx3, gy3 ).rgb * farSel;
      }
      d = mix( d, d2, farT );
      tn = mix( tn, tn2, farT );
      arm = mix( arm, arm2, farT );
    }
    if ( i == 7 ) {
      // paving: pull the grout contrast toward the stone's average so a causeway reads as weathered slabs
      vec3 avgC = textureLod( tDiff, vec3( 0.5, 0.5, L ), 12.0 ).rgb;
      d = mix( avgC, d, 0.6 );
      tn.xy *= 0.6;
    }
    tn.xy *= uNormalStrength;
    wn = normalize( tpNormalY( tn, N ) );
  }
  alb += d * uTint[ i ] * w;
  nrm += wn * w;
  rough += arm.g * uRough[ i ] * w;
  ao += arm.r * w;
}

void computeSplat() {
  vec3 N = normalize( vTWNormal );
  vec2 xz = vTWPos.xz;
  vec4 nA = texture2D( tNoise, xz * ( 1.0 / 181.0 ) );
  vec4 nB = texture2D( tNoise, xz * ( 1.0 / 37.0 ) + 0.37 );
  float n1 = nA.r * 2.0 - 1.0;
  float n2 = nB.g * 2.0 - 1.0;
  vec4 mask = texture2D( tMask, envGridUv( xz ) );
  float rel = vTWPos.y - uLevel;
  float slope = 1.0 - clamp( N.y, 0.0, 1.0 );

  float w[ 8 ];
  w[ 0 ] = 0.0; w[ 1 ] = 1.0; w[ 2 ] = 0.0; w[ 3 ] = 0.0; w[ 4 ] = 0.0; w[ 5 ] = 0.0; w[ 6 ] = 0.0; w[ 7 ] = 0.0;
  float t;
  #define SPLAT_BLEND( slot, amount ) t = ( amount ); if ( t > 0.0 ) { for ( int j = 0; j < 8; j ++ ) w[ j ] *= 1.0 - t; w[ slot ] += t; }
  SPLAT_BLEND( 2, smoothstep( uHighLine * 0.75, uHighLine * 1.25, rel + n1 * uHighLine * 0.35 + n2 * 1.5 ) )
  SPLAT_BLEND( 4, smoothstep( uPeakLine - 8.0, uPeakLine + 8.0, rel + n1 * 10.0 + n2 * 4.0 - slope * 20.0 ) )
  SPLAT_BLEND( 0, uHasWater * ( 1.0 - smoothstep( 0.35, 1.7, rel + n2 * 0.6 + n1 * 0.4 ) ) )
  SPLAT_BLEND( 3, smoothstep( 0.17, 0.30, slope + n2 * 0.05 ) )
  SPLAT_BLEND( 6, smoothstep( 0.2, 0.7, mask.g + n2 * 0.15 ) )
  float drift = smoothstep( 0.5, 0.85, nB.b * 0.7 + nA.a * 0.5 );
  float stoneW = smoothstep( 0.25, 0.7, mask.b + n2 * 0.2 ) * ( 1.0 - 0.6 * drift );
  SPLAT_BLEND( 5, smoothstep( 0.25, 0.7, mask.r + n2 * 0.25 ) * ( 1.0 - stoneW ) * ( 1.0 - 0.35 * drift ) )
  SPLAT_BLEND( 7, stoneW )

  vec3 alb = vec3( 0.0 );
  vec3 nrm = vec3( 0.0 );
  float rough = 0.0;
  float ao = 0.0;
  if ( uTextured > 0.5 ) {
    float dist = length( vTWPos - cameraPosition );
    float farT = smoothstep( 35.0, 110.0, dist );
    float farSel = smoothstep( 0.3, 0.7, nA.a );
    float ca = 0.8253;
    float sa = 0.5646;
    mat2 rot = mat2( ca, sa, -sa, ca );
    vec3 dpx = dFdx( vTWPos );
    vec3 dpy = dFdy( vTWPos );
    for ( int i = 0; i < 8; i ++ ) {
      if ( w[ i ] > 0.01 ) sampleSlot( i, w[ i ], xz, N, farT, farSel, rot, dpx, dpy, alb, nrm, rough, ao );
    }
    float wsum = 0.0;
    for ( int i = 0; i < 8; i ++ ) wsum += w[ i ] > 0.01 ? w[ i ] : 0.0;
    alb /= max( wsum, 1e-3 );
    rough /= max( wsum, 1e-3 );
    ao /= max( wsum, 1e-3 );
    nrm = normalize( nrm );
  } else {
    for ( int i = 0; i < 8; i ++ ) alb += uFlat[ i ] * w[ i ];
    nrm = N;
    rough = 0.95;
    ao = 1.0;
  }

  // macro variation: large soft patches of lighter/darker, warmer/cooler ground
  float macro = mix( 0.8, 1.14, nA.b ) * mix( 0.93, 1.06, nB.a );
  alb *= macro;
  alb *= mix( vec3( 1.0 ), vec3( 1.07, 0.98, 0.9 ), clamp( nA.g * 1.3 - 0.35, 0.0, 1.0 ) * 0.7 );

  // waterline: wet, darker, glossier ground; underwater ground a little greener
  float wet = uHasWater * ( 1.0 - smoothstep( 0.0, 0.9, rel + n2 * 0.3 ) );
  alb *= mix( 1.0, 0.52, wet );
  rough = mix( rough, 0.14, wet * 0.85 );
  alb *= mix( vec3( 1.0 ), vec3( 0.62, 0.72, 0.66 ), uHasWater * ( 1.0 - smoothstep( -1.2, 0.0, rel ) ) );
  // rain: the whole ground darkens and turns glossy, most in hollows, least on steep rock
  float soak = uWetness * ( 1.0 - slope * 0.6 ) * mix( 0.75, 1.0, 1.0 - mask.a );
  alb *= mix( 1.0, 0.58, soak );
  rough = mix( rough, 0.22, soak * 0.8 );

  splatAlbedo = alb;
  splatN = nrm;
  splatRough = clamp( rough, 0.04, 1.0 );
  splatAO = ao * mix( 0.45, 1.0, mask.a );
}
`;

/** Replaces the standard chunks: albedo, roughness, normal and ambient occlusion come from the splat. */
export const TERRAIN_MAP_FRAGMENT = /* glsl */ `
computeSplat();
diffuseColor.rgb *= splatAlbedo;
`;

export const TERRAIN_ROUGHNESS_FRAGMENT = /* glsl */ `
float roughnessFactor = splatRough;
`;

export const TERRAIN_NORMAL_FRAGMENT = /* glsl */ `
normal = normalize( ( viewMatrix * vec4( splatN, 0.0 ) ).xyz );
`;

export const TERRAIN_AO_FRAGMENT = /* glsl */ `
{
  float ambientOcclusion = splatAO;
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
  #endif
}
`;
