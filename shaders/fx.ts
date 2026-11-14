/**
 * #fx-gl fragment shaders (DESIGN.md §3.6). One full-screen triangle each; output is
 * premultiplied (blend ONE, ONE_MINUS_SRC_ALPHA): rgb adds light, alpha darkens what's below.
 * Colors arrive as uniforms read from design tokens — no color is written here.
 */
export const FX_VERT = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

/** Shared by every fx-gl fragment shader (shaders/fx-signatures.ts too). */
export const FX_HEAD = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 o;
uniform vec2 uRes;
uniform float uT;
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
`;

/** The Part 3 test wipe: a phosphor beam sweeps top → bottom, trailing decay and scanlines. */
export const FX_WIPE = `${FX_HEAD}
uniform float t;
uniform vec3 c;
void main() {
  float y = 1.0 - uv.y;
  float d = t * 1.2 - y;
  float beam = exp(-abs(d) * 80.0);
  float trail = d > 0.0 ? exp(-d * 8.0) * 0.4 : 0.0;
  float lines = 0.7 + 0.3 * step(0.5, fract(gl_FragCoord.y * 0.5));
  float a = clamp(beam + trail, 0.0, 1.0) * lines * (1.0 - smoothstep(0.8, 1.0, t));
  o = vec4(c * a, a);
}`;
