/**
 * The stage's post chain GLSL (DESIGN.md §5.1–5.4): the persistence pass and RetroEffect — one
 * EffectPass after Bloom: persistence composite, radial chromatic aberration, vignette, tone
 * mapping, ±1 LSB blue-noise output dither.
 *
 * The canvas is opaque in the theme's own --bg (Paper: the paper), and only the scene's light is
 * graded — the background is never darkened or shifted, so the canvas meets the page with no
 * seam at the slot's edge, and the vignette never darkens DOM text (§5.1).
 */

/** AgX, as three.js ships it (MIT; Filament / Blender, Rec.2020 primaries). Linear sRGB in and out. */
export const AGX_GLSL = /* glsl */ `
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
  vec3(1.6605, -0.1246, -0.0182),
  vec3(-0.5876, 1.1329, -0.1006),
  vec3(-0.0728, -0.0083, 1.1187)
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
  vec3(0.6274, 0.0691, 0.0164),
  vec3(0.3293, 0.9195, 0.0880),
  vec3(0.0433, 0.0113, 0.8956)
);
vec3 agxDefaultContrastApprox(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx(vec3 color) {
  const mat3 AgXInsetMatrix = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859)
  );
  const mat3 AgXOutsetMatrix = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405)
  );
  const float AgxMinEv = -12.47393;
  const float AgxMaxEv = 4.026069;
  color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
  color = AgXInsetMatrix * color;
  color = max(color, 1e-10);
  color = log2(color);
  color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);
  color = clamp(color, 0.0, 1.0);
  color = agxDefaultContrastApprox(color);
  color = AgXOutsetMatrix * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
  return clamp(color, 0.0, 1.0);
}
`;

/**
 * Phosphor persistence (HIGH, dark themes): a half-res memory of the scene's light that decays
 * by uDecay (0.84 or 0.88 per 1/60 s, dt-corrected on the CPU). RGB is the memory; A is the share
 * of it that's trail (memory brighter than now), so static particles grow no halo — only motion
 * leaves phosphor behind.
 */
export const PERSIST_FRAG = /* glsl */ `
uniform sampler2D uScene;
uniform sampler2D uPrev;
uniform vec3 uBg;
uniform float uDecay;
varying vec2 vUv;
void main() {
  vec3 cur = max(texture2D(uScene, vUv).rgb - uBg, 0.0);
  vec3 mem = max(cur, texture2D(uPrev, vUv).rgb * uDecay);
  const vec3 Y = vec3(0.2126, 0.7152, 0.0722);
  float lm = dot(mem, Y);
  gl_FragColor = vec4(mem, max(lm - dot(cur, Y), 0.0) / max(lm, 1e-5));
}
`;

export const PERSIST_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/**
 * RetroEffect (postprocessing Effect, CONVOLUTION: it samples inputBuffer around uv).
 * inputColor = the scene + bloom; inputBuffer = the scene before bloom.
 */
export const RETRO_FRAG = /* glsl */ `
uniform vec3 uBg;
uniform sampler2D uPersist;
uniform float uPersistOn;
/* x: aberration at the corners at rest · y: added by a fling (device px) */
uniform vec2 uCA;
/* x: vignette offset · y: darkness (dark themes) · z: Paper's ink falloff */
uniform vec3 uVignette;
/* 1 = Paper: ink on paper, LDR — no tone map */
uniform float uPaper;
uniform sampler2D uNoise;
uniform float uNoiseSize;

${AGX_GLSL}

vec3 srgbFromLinear(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 linearFromSrgb(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 aspect = vec2(resolution.x / resolution.y, 1.0);
  vec2 fromCenter = uv - 0.5;
  // 0 at the center, 1 at the corners
  float radial = length(fromCenter * aspect) / length(0.5 * aspect);
  vec2 dir = fromCenter / max(length(fromCenter), 1e-5);
  vec2 shift = dir * (uCA.x * radial + uCA.y * radial) * texelSize;
  vec3 c;
  if (uPaper < 0.5) {
    vec3 base = texture2D(inputBuffer, uv).rgb;
    vec3 bloom = max(inputColor.rgb - base, 0.0);
    vec3 scene = vec3(texture2D(inputBuffer, uv + shift).r, base.g, texture2D(inputBuffer, uv - shift).b);
    vec3 light = max(scene - uBg, 0.0) + bloom;
    if (uPersistOn > 0.5) {
      vec4 p = texture2D(uPersist, uv);
      light += p.rgb * p.a;
    }
    light *= smoothstep(0.8, uVignette.x * 0.799, distance(uv, vec2(0.5)) * (uVignette.y + uVignette.x));
    c = uBg + agx(light);
  } else {
    // Paper: what the ink absorbed; a fling misregisters the plates (cyan / magenta, ±shift)
    vec3 bg = max(uBg, vec3(1e-4));
    vec3 a = 1.0 - inputColor.rgb / bg;
    float r = 1.0 - texture2D(inputBuffer, uv + shift).r / bg.r;
    float b = 1.0 - texture2D(inputBuffer, uv - shift).b / bg.b;
    a = clamp(vec3(r, a.g, b), 0.0, 1.0);
    // a scan's falloff toward the corners, on the ink only (the paper meets the page's paper)
    a *= 1.0 - uVignette.z * smoothstep(0.35, 1.0, radial);
    c = uBg * (1.0 - a);
  }
  // ±1 LSB of blue noise, in the 8-bit output's own (sRGB) steps
  float n = (texture2D(uNoise, gl_FragCoord.xy / uNoiseSize).r - 0.5) * 2.0;
  vec3 s = srgbFromLinear(clamp(c, 0.0, 1.0)) + n / 255.0;
  outputColor = vec4(linearFromSrgb(clamp(s, 0.0, 1.0)), inputColor.a);
}
`;
