import { FX_HEAD } from "./fx";

/**
 * The signature transitions' fx-gl programs (DESIGN.md §3.6): TRACKING TEAR (+ MISFEED), POWER
 * CYCLE and the Paper SCAN. They travel with lib/transitions.ts in its lazy chunk and compile when
 * it lands (on idle after load), so first-load JS carries only the layer and the test wipe.
 */
/**
 * ② TRACKING TEAR (uMode 0) and the Paper MISFEED (uMode 1): seeded tear bands with chroma
 * fringes, head-switching noise in the bottom 4%, a 4×4 Bayer flood that rolls off upward.
 */
export const FX_TEAR = `${FX_HEAD}
uniform vec4 uBand[5];
uniform float uBands;
uniform float uHead;
uniform float uFlood;
uniform float uRoll;
uniform float uSeed;
uniform float uMode;
uniform vec3 uInk;
uniform vec3 uGround;
uniform vec3 uHot;
uniform vec3 uCold;
void main() {
  vec2 px = gl_FragCoord.xy;
  float y = 1.0 - uv.y;
  float frame = floor(uT / 33.3333);
  vec3 col = vec3(0.0);
  float a = 0.0;
  for (int i = 0; i < 5; i++) {
    vec4 b = uBand[i];
    float yy = y + (uv.x - 0.5) * 0.12 * uMode;
    if (b.y <= 0.0 || yy < b.x || yy > b.x + b.y) continue;
    float x = px.x + b.z * uBands;
    float row = floor(px.y / 2.0);
    float streak = hash(vec2(floor(x / mix(24.0, 7.0, uMode)), row + frame * 7.0 + uSeed));
    vec3 c = mix(uGround, uInk, step(0.62, streak));
    float m = mod(x, 97.0);
    c = mix(c, uHot, step(m, b.w) * 0.9 * (1.0 - uMode));
    c = mix(c, uCold, step(97.0 - b.w, m) * 0.9 * (1.0 - uMode));
    col = c;
    a = 0.88 * uBands;
  }
  if (y > 0.96 && uHead > 0.0) {
    float n = hash(floor(px / vec2(5.0, 2.0)) + frame);
    col = mix(col, mix(uGround, uInk, step(0.5, n)), uHead);
    a = max(a, 0.9 * uHead);
  }
  if (uMode > 0.5) {
    float s = step(0.985, hash(vec2(floor(px.x / 3.0), uSeed))) * uBands;
    col = mix(col, uInk, s);
    a = max(a, s * 0.7);
  }
  if (step(bayer4(floor(px / 3.0)), uFlood - 0.0001) * step(y, uRoll) > 0.5) {
    float n = hash(floor(px / 2.0) + frame * 13.0);
    col = mix(uGround, uInk, step(0.7, n) * mix(0.55, 0.35, uMode));
    a = 1.0;
  }
  if (uRoll > 0.0 && uRoll < 1.0) {
    float bar = exp(-abs(y - uRoll) * 90.0);
    col = mix(col, uInk, bar * 0.7);
    a = max(a, bar * 0.8);
  }
  o = vec4(col * a, a);
}`;

/**
 * ① POWER CYCLE: the beam. Glow hugs the raster's edge (strongest as a line or dot), the barrel
 * darkens curved edges, one scanline roll passes. uMask 1 (no View Transition): the tube is dark
 * outside the raster, covering the instant token swap.
 */
export const FX_POWER = `${FX_HEAD}
uniform float uScaleX;
uniform float uScaleY;
uniform float uBright;
uniform float uBarrel;
uniform float uRoll;
uniform float uOpacity;
uniform float uMask;
uniform vec3 uBeam;
void main() {
  vec2 p = uv - 0.5;
  vec2 halfSize = max(vec2(uScaleX, uScaleY) * uRes * 0.5, vec2(1.0));
  vec2 q = abs(p * uRes) - halfSize;
  float outside = max(q.x, q.y);
  float d = length(max(q, 0.0));
  float thin = 1.0 - smoothstep(4.0, uRes.y * 0.25, halfSize.y * 2.0);
  float glow = exp(-d / mix(3.0, 10.0, thin)) * (uBright - 1.0 + 0.35 * thin) * uOpacity;
  vec3 light = uBeam * glow;
  float dark = 0.0;
  if (uMask > 0.5 && outside > 0.0) dark = 1.0;
  vec2 bp = abs(p * 2.0);
  float edge = pow(pow(bp.x, 4.0) + pow(bp.y, 4.0), 0.25);
  dark = max(dark, smoothstep(1.0 - uBarrel * 3.0, 1.02, edge) * (uBarrel / 0.15) * 0.85);
  if (uRoll >= 0.0) light += uBeam * exp(-abs((1.0 - uv.y) - uRoll) * 30.0) * 0.12;
  o = vec4(light, dark);
}`;

/** The Paper SCAN: a photocopier's light bar sweeping top → bottom (uMask 1 covers below it). */
export const FX_SCAN = `${FX_HEAD}
uniform float uY;
uniform float uMask;
uniform vec3 uBar;
uniform vec3 uCover;
void main() {
  float y = 1.0 - uv.y;
  float d = y - uY;
  float bar = clamp(exp(-abs(d) * 160.0) + exp(-abs(d) * 22.0) * 0.35, 0.0, 1.0);
  vec3 col = uBar * bar;
  float a = bar;
  if (uMask > 0.5 && d > 0.0) {
    col = mix(uCover, uBar, bar);
    a = 1.0;
  }
  o = vec4(col * a, a);
}`;
