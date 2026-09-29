import * as THREE from "three";

/*
 * The sky dome: a unit box drawn around the camera at the far plane (rotation-only view matrix, so it never needs to
 * follow the camera), shading three modes in one program:
 *   day   - the Preetham scattering model and cloud layer from three.js's examples/jsm/objects/Sky.js (MIT, © three.js
 *           authors), plus a horizon band that blends into the exact fog colour so fogged land meets the sky seamlessly;
 *   night - a moonlit gradient, a star field (hashed cells, gentle twinkle) and a shaded moon disc with maria;
 *   lunar - a black sky with hard stars, a small white sun with glare, and the Earth hanging in the sky (procedural
 *           continents, clouds, terminator and an atmospheric rim).
 * The same material renders once into the PMREM environment (sun disc off) for image-based lighting.
 */

export const SKY_VERTEX = /* glsl */ `
uniform vec3 sunDirection;
uniform float rayleigh;
uniform float turbidity;
uniform float mieCoefficient;

varying vec3 vDir;
varying vec3 vBetaR;
varying vec3 vBetaM;
varying float vSunE;

const float e = 2.71828182845904523536028747135266249775724709369995957;
const float pi = 3.141592653589793238462643383279502884197169;
const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );
const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );
const float cutoffAngle = 1.6110731556870734;
const float steepness = 1.5;
const float EE = 1000.0;

float sunIntensity( float zenithAngleCos ) {
  zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
  return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
}

vec3 totalMie( float T ) {
  float c = ( 0.2 * T ) * 10E-18;
  return 0.434 * c * MieConst;
}

void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4( mat3( viewMatrix ) * position, 1.0 );
  gl_Position = p.xyww;
  vSunE = sunIntensity( sunDirection.y );
  vBetaR = totalRayleigh * rayleigh;
  vBetaM = totalMie( turbidity ) * mieCoefficient;
}
`;

export const SKY_FRAGMENT = /* glsl */ `
varying vec3 vDir;
varying vec3 vBetaR;
varying vec3 vBetaM;
varying float vSunE;

uniform vec3 sunDirection;
uniform float mieDirectionalG;
uniform float uMode;          // 0 day, 1 night, 2 lunar
uniform float uClouds;        // coverage 0..1
uniform float uTime;
uniform vec3 uFogColor;       // linear, the scene fog colour
uniform float uFogBand;       // how far above the horizon the fog colour reaches
uniform float uSunDisc;       // 0 in the environment render
uniform float uSkyScale;
uniform vec3 uEarthDir;
uniform vec3 uNightHorizon;
uniform vec3 uNightZenith;
uniform float uStarBoost;
uniform float uSkyRef;
uniform float uSkyTarget;
uniform float uSkyGamma;
uniform vec3 uCloudLight;

const float pi = 3.141592653589793238462643383279502884197169;
const float rayleighZenithLength = 8.4E3;
const float mieZenithLength = 1.25E3;
const float sunAngularDiameterCos = 0.99994;
const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
const float ONE_OVER_FOURPI = 0.07957747154594767;

float rayleighPhase( float cosTheta ) { return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) ); }
float hgPhase( float cosTheta, float g ) {
  float g2 = pow( g, 2.0 );
  float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
  return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
}

vec2 grad2( vec2 i ) {
  vec3 p = fract( i.xyx * vec3( 0.1031, 0.1030, 0.0973 ) );
  p += dot( p, p.yzx + 33.33 );
  return fract( ( p.xx + p.yz ) * p.zy ) * 2.0 - 1.0;
}
float noise2( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 );
  float a = dot( grad2( i ), f );
  float b = dot( grad2( i + vec2( 1.0, 0.0 ) ), f - vec2( 1.0, 0.0 ) );
  float c = dot( grad2( i + vec2( 0.0, 1.0 ) ), f - vec2( 0.0, 1.0 ) );
  float d = dot( grad2( i + vec2( 1.0, 1.0 ) ), f - vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y ) * 1.6;
}
float fbm2( vec2 p, float drift ) {
  float r = 0.0;
  float a = 1.0;
  for ( int i = 0; i < 5; i ++ ) { r += a * noise2( p ); a *= 0.5; p = p * 2.03 + drift; }
  return r;
}
float hash13( vec3 p ) {
  p = fract( p * 0.1031 );
  p += dot( p, p.zyx + 31.32 );
  return fract( ( p.x + p.y ) * p.z );
}
float vnoise3( vec3 p ) {
  vec3 i = floor( p );
  vec3 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  float n000 = hash13( i );
  float n100 = hash13( i + vec3( 1, 0, 0 ) );
  float n010 = hash13( i + vec3( 0, 1, 0 ) );
  float n110 = hash13( i + vec3( 1, 1, 0 ) );
  float n001 = hash13( i + vec3( 0, 0, 1 ) );
  float n101 = hash13( i + vec3( 1, 0, 1 ) );
  float n011 = hash13( i + vec3( 0, 1, 1 ) );
  float n111 = hash13( i + vec3( 1, 1, 1 ) );
  return mix( mix( mix( n000, n100, f.x ), mix( n010, n110, f.x ), f.y ), mix( mix( n001, n101, f.x ), mix( n011, n111, f.x ), f.y ), f.z );
}
float fbm3( vec3 p ) {
  float r = 0.0;
  float a = 0.5;
  for ( int i = 0; i < 5; i ++ ) { r += a * vnoise3( p ); a *= 0.5; p = p * 2.02 + 1.7; }
  return r;
}

vec3 starField( vec3 dir, float boost ) {
  vec3 col = vec3( 0.0 );
  for ( int layer = 0; layer < 2; layer ++ ) {
    float scale = layer == 0 ? 170.0 : 320.0;
    vec3 p = dir * scale;
    vec3 c = floor( p );
    float h = hash13( c + float( layer ) * 17.0 );
    float thresh = layer == 0 ? 0.93 : 0.955;
    if ( h > thresh ) {
      vec3 jitter = vec3( hash13( c + 1.7 ), hash13( c + 3.1 ), hash13( c + 5.3 ) ) - 0.5;
      vec3 center = c + 0.5 + jitter * 0.7;
      float d = length( p - center );
      float mag = pow( ( h - thresh ) / ( 1.0 - thresh ), 3.0 );
      float size = 0.22 + 0.25 * mag;
      float b = smoothstep( size, 0.0, d );
      float twinkle = 0.75 + 0.25 * sin( uTime * ( 2.0 + 3.0 * h ) + h * 90.0 );
      float t = hash13( c + 9.2 );
      vec3 tint = t < 0.2 ? vec3( 1.0, 0.82, 0.65 ) : t > 0.8 ? vec3( 0.75, 0.85, 1.0 ) : vec3( 1.0 );
      col += tint * b * ( 0.25 + 3.5 * mag ) * mix( twinkle, 1.0, step( 1.5, uMode ) ) * boost;
    }
  }
  return col;
}

// a lit sphere drawn as a disc around direction \`axis\` with angular radius \`radius\`; returns (normal.xyz, coverage)
vec4 discSphere( vec3 dir, vec3 axis, float radius, out vec3 right, out vec3 upv ) {
  right = normalize( cross( axis, abs( axis.y ) > 0.99 ? vec3( 1.0, 0.0, 0.0 ) : vec3( 0.0, 1.0, 0.0 ) ) );
  upv = cross( right, axis );
  float cd = dot( dir, axis );
  if ( cd < cos( radius * 1.6 ) ) return vec4( 0.0 );
  vec2 q = vec2( dot( dir, right ), dot( dir, upv ) ) / sin( radius );
  float r2 = dot( q, q );
  float cover = smoothstep( 1.0, 0.94, r2 ) * step( 0.0, cd );
  vec3 n = vec3( q, sqrt( max( 0.0, 1.0 - r2 ) ) );
  return vec4( n, cover );
}

vec3 clouds( vec3 direction, vec3 background, vec3 sunColor, vec3 skyAmbient, float cosTheta, float coverage, float night ) {
  if ( direction.y <= 0.0 || coverage <= 0.0 ) return background;
  vec2 uv = direction.xz / ( direction.y + 0.08 ) * 0.9;
  uv += uTime * vec2( 0.004, 0.0015 );
  float evolve = uTime * 0.006;
  float n = clamp( fbm2( uv * 2.2, evolve ) * 0.65 + 0.5, 0.0, 1.0 );
  float region = noise2( uv * 0.45 ) * 0.37 + 0.5;
  // broken cloud has clear gaps between banks; an overcast deck closes them
  float cov = clamp( coverage + ( region - 0.5 ) * 0.6 * ( 1.0 - smoothstep( 0.7, 0.95, coverage ) ) + smoothstep( 0.75, 1.0, coverage ) * 0.25, 0.0, 1.0 );
  float threshold = 1.0 - cov;
  float mask = smoothstep( threshold, threshold + 0.28, n );
  float horizonFade = smoothstep( 0.0, 0.09, direction.y );
  mask *= horizonFade;
  float depth = max( 0.0, n - threshold );
  // light through the cloud: density a little way toward the sun darkens the far side and bottoms (volume on a plane)
  vec2 toSun = normalize( sunDirection.xz + 1e-4 ) * 0.09;
  float nSun = clamp( fbm2( ( uv + toSun ) * 2.2, evolve ) * 0.65 + 0.5, 0.0, 1.0 );
  float occl = max( 0.0, nSun - threshold );
  depth = max( depth, 0.0 );
  float lightThrough = exp( -occl * 3.2 );
  float beer = exp( depth * -4.0 );
  float powder = 1.0 - beer * beer;
  float shade = mix( 0.42, 1.0, clamp( beer * powder * 2.6, 0.0, 1.0 ) );
  float silver = clamp( 0.51 / pow( 1.49 - cosTheta * 1.4, 1.5 ), 0.0, 3.0 );
  float edge = mask * ( 1.0 - mask ) * 4.0;
  vec3 col = skyAmbient * ( 0.85 + 0.3 * ( 1.0 - mask ) ) + sunColor * shade * mix( 0.35, 1.15, lightThrough );
  col += sunColor * silver * edge * 0.6;
  float alpha = ( 1.0 - exp( depth * -9.0 ) ) * horizonFade * mix( 0.85, 1.0, coverage );
  // an overcast deck has no holes: thin spots are still cloud
  alpha = max( alpha, smoothstep( 0.75, 1.0, coverage ) * 0.92 * horizonFade );
  return mix( background, col, clamp( alpha, 0.0, 1.0 ) );
}

void main() {
  vec3 direction = normalize( vDir );
  vec3 col;
  float cosTheta = dot( direction, sunDirection );

  if ( uMode < 0.5 ) {
    // ---------------------------------------------------------- day: Preetham
    float zenithAngle = acos( max( 0.0, direction.y ) );
    float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
    float sR = rayleighZenithLength * inverse;
    float sM = mieZenithLength * inverse;
    vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );
    float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
    vec3 betaRTheta = vBetaR * rPhase;
    float mPhase = hgPhase( cosTheta, mieDirectionalG );
    vec3 betaMTheta = vBetaM * mPhase;
    vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
    Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 0.5 ) ), clamp( pow( 1.0 - sunDirection.y, 5.0 ), 0.0, 1.0 ) );
    vec3 L0 = vec3( 0.1 ) * Fex;
    float sundisc = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta ) * uSunDisc;
    vec3 base = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );
    // calibration (preetham.ts calibrateSky): compress the model's huge horizon/sun-glow range around the zenith
    float bl = max( dot( base, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-6 );
    base *= uSkyTarget * pow( bl / uSkyRef, uSkyGamma ) / bl;
    float lin = uSkyTarget / uSkyRef;
    col = base + ( 30.0 * sundisc ) * min( vSunE * Fex * 0.04, vec3( 8.0 ) ) * max( lin, 0.35 );
    vec3 sunColor = uCloudLight * mix( vec3( 1.0 ), Fex / max( Fex.r, 1e-3 ), 0.25 );
    col = clouds( direction, col, sunColor, base * 0.9, cosTheta, uClouds, 0.0 );
    float band = 1.0 - smoothstep( -0.02, uFogBand, direction.y );
    col = mix( col, uFogColor, band );
  } else if ( uMode < 1.5 ) {
    // ---------------------------------------------------------- night: moon, stars
    float up = max( direction.y, 0.0 );
    col = mix( uNightHorizon, uNightZenith, pow( up, 0.45 ) );
    float moonGlow = pow( max( cosTheta, 0.0 ), 24.0 );
    col += vec3( 0.12, 0.15, 0.22 ) * ( 0.18 * moonGlow + 0.05 * pow( max( cosTheta, 0.0 ), 4.0 ) );
    float starsVis = smoothstep( 0.02, 0.25, direction.y ) * ( 1.0 - moonGlow );
    col += starField( direction, uStarBoost ) * 0.35 * starsVis;
    vec3 right; vec3 upv;
    vec4 moon = discSphere( direction, sunDirection, 0.012, right, upv );
    if ( moon.w > 0.0 ) {
      vec3 n = moon.xyz;
      float maria = smoothstep( 0.45, 0.62, fbm3( n * 3.1 + 4.0 ) );
      float craters = smoothstep( 0.55, 0.7, fbm3( n * 11.0 ) ) * 0.25;
      vec3 L = normalize( vec3( 0.55, 0.25, 0.8 ) );
      float lit = smoothstep( -0.08, 0.12, dot( n, L ) );
      vec3 mc = vec3( 1.0, 0.97, 0.9 ) * ( 1.0 - 0.38 * maria - craters ) * ( 0.35 + 0.65 * n.z );
      col = mix( col, mc * 2.4 * lit + col * ( 1.0 - lit ), moon.w );
    }
    vec3 moonLight = vec3( 0.05, 0.06, 0.08 );
    col = clouds( direction, col, moonLight, uNightZenith * 1.5, cosTheta, uClouds * 0.9, 1.0 );
    float band = 1.0 - smoothstep( -0.02, uFogBand, direction.y );
    col = mix( col, uFogColor, band );
  } else {
    // ---------------------------------------------------------- lunar: black sky, sun, Earth
    col = vec3( 0.0 );
    col += starField( direction, uStarBoost ) * 0.55 * smoothstep( -0.02, 0.06, direction.y );
    float sunCore = smoothstep( 0.99997, 0.999985, cosTheta ) * uSunDisc;
    float glare = pow( max( cosTheta, 0.0 ), 900.0 ) * 1.4 + pow( max( cosTheta, 0.0 ), 60.0 ) * 0.06;
    col += vec3( 1.0, 0.98, 0.95 ) * ( sunCore * 60.0 + glare * uSunDisc );
    vec3 right; vec3 upv;
    vec4 earth = discSphere( direction, uEarthDir, 0.03, right, upv );
    if ( earth.w > 0.0 ) {
      vec3 n = earth.xyz;
      // the Earth's own frame: spin slowly about its axis
      float spin = uTime * 0.004;
      vec3 p = vec3( n.x * cos( spin ) - n.z * sin( spin ), n.y, n.x * sin( spin ) + n.z * cos( spin ) );
      float land = smoothstep( 0.53, 0.58, fbm3( p * 2.2 + 11.0 ) );
      float polar = smoothstep( 0.78, 0.9, abs( n.y ) );
      float cloud = smoothstep( 0.5, 0.72, fbm3( p * 4.5 + vec3( 0.0, 0.0, uTime * 0.01 ) ) );
      vec3 ocean = vec3( 0.02, 0.07, 0.22 );
      vec3 ground = mix( vec3( 0.16, 0.2, 0.08 ), vec3( 0.42, 0.33, 0.2 ), smoothstep( 0.4, 0.7, fbm3( p * 6.0 ) ) );
      vec3 albedo = mix( ocean, ground, land );
      albedo = mix( albedo, vec3( 0.9 ), max( polar, cloud * 0.9 ) );
      vec3 Ls = vec3( dot( sunDirection, right ), dot( sunDirection, upv ), dot( sunDirection, -uEarthDir ) );
      float lit = clamp( dot( n, normalize( Ls ) ) * 1.2 + 0.05, 0.0, 1.0 );
      float rim = pow( 1.0 - n.z, 3.0 );
      vec3 ec = albedo * lit * 2.2 + vec3( 0.25, 0.45, 1.0 ) * rim * ( 0.25 + lit ) * 0.9;
      col = mix( col, ec, earth.w );
    }
  }

  gl_FragColor = vec4( col * uSkyScale, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface SkyUniforms {
  [k: string]: THREE.IUniform<unknown>;
  sunDirection: THREE.IUniform<THREE.Vector3>;
  rayleigh: THREE.IUniform<number>;
  turbidity: THREE.IUniform<number>;
  mieCoefficient: THREE.IUniform<number>;
  mieDirectionalG: THREE.IUniform<number>;
  uMode: THREE.IUniform<number>;
  uClouds: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
  uFogColor: THREE.IUniform<THREE.Color>;
  uFogBand: THREE.IUniform<number>;
  uSunDisc: THREE.IUniform<number>;
  uSkyScale: THREE.IUniform<number>;
  uEarthDir: THREE.IUniform<THREE.Vector3>;
  uNightHorizon: THREE.IUniform<THREE.Color>;
  uNightZenith: THREE.IUniform<THREE.Color>;
  uStarBoost: THREE.IUniform<number>;
  uSkyRef: THREE.IUniform<number>;
  uSkyTarget: THREE.IUniform<number>;
  uSkyGamma: THREE.IUniform<number>;
  uCloudLight: THREE.IUniform<THREE.Color>;
}

export function createSkyMaterial(): THREE.ShaderMaterial & { uniforms: SkyUniforms } {
  const uniforms: SkyUniforms = {
    sunDirection: { value: new THREE.Vector3(0, 1, 0) },
    rayleigh: { value: 1 },
    turbidity: { value: 2 },
    mieCoefficient: { value: 0.005 },
    mieDirectionalG: { value: 0.8 },
    uMode: { value: 0 },
    uClouds: { value: 0.3 },
    uTime: { value: 0 },
    uFogColor: { value: new THREE.Color(0.8, 0.8, 0.8) },
    uFogBand: { value: 0.06 },
    uSunDisc: { value: 1 },
    uSkyScale: { value: 1 },
    uEarthDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },
    uNightHorizon: { value: new THREE.Color(0.02, 0.03, 0.06) },
    uNightZenith: { value: new THREE.Color(0.002, 0.004, 0.012) },
    uStarBoost: { value: 1 },
    uSkyRef: { value: 1 },
    uSkyTarget: { value: 1 },
    uSkyGamma: { value: 1 },
    uCloudLight: { value: new THREE.Color(1, 1, 1) },
  };
  const m = new THREE.ShaderMaterial({
    name: "world3d:sky",
    uniforms,
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  return m as THREE.ShaderMaterial & { uniforms: SkyUniforms };
}
