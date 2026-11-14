/**
 * A5 · CAPABILITIES — the keycap pile's GLSL (DESIGN.md §4.3 A5). Two draws: the caps (one
 * InstancedMesh, the sculpted cap of components/stage/keycaps/geometry.ts) and their blob shadows
 * (one instanced batch of quads on the wall behind the pile).
 *
 * A cap is lit by its theme's matcap (a layer of one sampler2DArray, so a theme change is a
 * uniform) times its plastic: charcoal on the tubes, beige on Paper, the primary stack in
 * --accent. Its legend is the atlas's coverage in its cell: on the tubes a backlit legend, emissive
 * past 1 so it blooms; on Paper dye-sublimated, ink in the plastic under the same daylight. The
 * pile draws back to front with backface culling — no depth buffer in the post chain — and the caps
 * are convex but for a shallow dish, so the order is the overlap.
 */
export const CAP_VERT = /* glsl */ `
attribute float aTop;
// per key: x atlas cell · y primary · z dimmed (0 – 1) · w lit (0 – 1: pressed, typed)
attribute vec4 aKey;
varying vec2 vUv;
varying vec3 vNormalV;
varying vec4 vKey;
varying float vTop;
void main() {
  vUv = uv;
  vKey = aKey;
  vTop = aTop;
  // the instance is rotation and translation only: its 3 × 3 turns the normal
  vNormalV = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const CAP_FRAG = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uMatcap;
uniform float uTheme;      // the matcap's layer: 0 phosphor · 1 amber · 2 paper
uniform sampler2D uLegends;
uniform float uCols;
uniform vec3 uCap;         // the plastic
uniform vec3 uCapPrimary;  // the primary stack's
uniform vec3 uLegend;      // the legend's light (tubes) or ink (Paper)
uniform vec3 uLegendPrimary;
uniform vec3 uLit;         // a pressed or typed key's glow (--accent)
uniform float uEmissive;   // the backlit legend's level (past 1: it blooms)
uniform float uPaper;
uniform float uDim;        // how far the rest dim while one is hovered
varying vec2 vUv;
varying vec3 vNormalV;
varying vec4 vKey;
varying float vTop;
void main() {
  vec3 n = normalize(vNormalV);
  vec2 m = n.xy * 0.49 + 0.5;
  vec3 light = texture(uMatcap, vec3(m.x, 1.0 - m.y, uTheme)).rgb;
  vec3 cap = mix(uCap, uCapPrimary, vKey.y);
  vec3 col = cap * light;
  float ink = 0.0;
  if (vTop > 0.5) {
    // the atlas's rows run top to bottom from v 0; the cap's v runs up
    vec2 cell = vec2(mod(vKey.x, uCols), floor(vKey.x / uCols));
    vec2 auv = (cell + vec2(clamp(vUv.x, 0.0, 1.0), 1.0 - clamp(vUv.y, 0.0, 1.0))) / uCols;
    ink = texture(uLegends, auv).r;
    vec3 legend = mix(uLegend, uLegendPrimary, vKey.y);
    col = uPaper > 0.5 ? mix(col, legend * light, ink) : mix(col, legend * uEmissive, ink);
  }
  col *= 1.0 - uDim * vKey.z;
  col += uLit * vKey.w * (vTop > 0.5 ? 0.25 + ink * 1.5 : 0.08);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const SHADOW_VERT = /* glsl */ `
// per shadow: x softness (0 sharp … 1 far from the wall) · y strength
attribute vec2 aShade;
varying vec2 vP;
varying vec2 vShade;
void main() {
  vP = uv * 2.0 - 1.0;
  vShade = aShade;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const SHADOW_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uShadow;
uniform float uOpacity;
varying vec2 vP;
varying vec2 vShade;
void main() {
  // a squircle-ish blob that softens with the key's distance from the wall
  float d = length(pow(abs(vP), vec2(1.6)));
  float a = (1.0 - smoothstep(0.35 - 0.3 * vShade.x, 1.0, d)) * vShade.y * uOpacity;
  if (a <= 0.002) discard;
  gl_FragColor = vec4(uShadow, a);
}
`;
