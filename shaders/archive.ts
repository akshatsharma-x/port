import { MAX_SHAPE_VERTICES, SHAPE_ORDER } from "@/lib/archive-shapes";

/**
 * A3 · ARCHIVE — the citation constellation's GLSL (DESIGN.md §4.3 A3, §2.4). Two draws: the
 * glyphs (one InstancedMesh, one material, no texture) and the edges (one LineSegments).
 *
 * Monochrome by law: identity is SHAPE — seven SDF glyphs from lib/archive-shapes.ts's vertices,
 * passed as a uniform so the HTML legend and the WebGL glyph are one geometry — and color carries
 * state only: the ink at rest, --accent for focus, --hot for the open record. Each fragment is its
 * final color over the ground, blended with MAX on the dark tubes (the brightest light wins) and
 * MIN on Paper (the darkest ink wins): overlapping stars and converging edges never add up to a
 * white-out, and nothing needs a depth buffer. Fog by view depth past uFogShape.y, density²,
 * fades both to the ground.
 */
const SHAPES = SHAPE_ORDER.length;

const FOG_GLSL = /* glsl */ `
uniform vec2 uFogShape; // x: density · y: depth where the fog starts
float fogAmount(float depth) {
  float d = uFogShape.x * max(0.0, depth - uFogShape.y);
  return 1.0 - exp(-d * d);
}
`;

export const NODE_VERT = /* glsl */ `
${FOG_GLSL}
uniform float uTime;
uniform vec2 uPulse;   // period (s) · depth (share of the radius)
uniform vec2 uScale;   // hover · focus
uniform float uMargin; // the quad's half-size, in glyph radii (room for the glow)
// per glyph: x shape (SHAPE_ORDER index; 7 a point) · y kind (0 mine, 1 cited) · z dashed · w radius
attribute vec4 aGlyph;
attribute vec3 aCenter;
// per glyph, eased on the CPU: x hovered · y lit (a neighbor of the hovered) · z focused · w hot
attribute vec4 aState;
// per glyph: x pulse phase · y receded (0 – 1)
attribute vec2 aMisc;
varying vec2 vP;
varying vec4 vGlyph;
varying vec4 vState;
varying float vRecede;
varying float vFog;
void main() {
  // my records breathe; the works they cite hold still
  float pulse = 1.0 + uPulse.y * sin(6.28318531 * (uTime / uPulse.x + aMisc.x)) * (1.0 - aGlyph.y);
  float s = aGlyph.w * pulse * mix(1.0, uScale.x, aState.x) * mix(1.0, uScale.y, aState.z);
  vec4 view = modelViewMatrix * vec4(aCenter, 1.0);
  vec2 corner = position.xy * uMargin;
  view.xy += corner * s; // a billboard: the quad faces the camera
  vP = corner;
  vGlyph = aGlyph;
  vState = aState;
  vRecede = aMisc.y;
  vFog = fogAmount(-view.z);
  gl_Position = projectionMatrix * view;
}
`;

export const NODE_FRAG = /* glsl */ `
precision highp float;
#define SHAPES ${SHAPES}
#define MAX_V ${MAX_SHAPE_VERTICES}
uniform vec2 uShapes[SHAPES * MAX_V]; // y down, as lib/archive-shapes.ts writes them
uniform int uShapeN[SHAPES];          // 0: the circle
uniform vec2 uRound;                  // the circle's radius · the plain point's
uniform vec3 uGround;
uniform vec3 uInk;
uniform vec3 uFaint;
uniform vec3 uAccent;
uniform vec3 uHot;
uniform float uCitedLight;
uniform float uGlow;
uniform vec3 uDash;                   // dashes around the shape · duty · stroke (radii)
uniform float uRecedeBy;
varying vec2 vP;
varying vec4 vGlyph;
varying vec4 vState;
varying float vRecede;
varying float vFog;
out highp vec4 fragColor;

// iq's exact polygon SDF over shape s's vertices
float sdPolygon(vec2 p, int s) {
  int n = uShapeN[s];
  int o = s * MAX_V;
  vec2 v0 = uShapes[o];
  float d = dot(p - v0, p - v0);
  float sgn = 1.0;
  for (int i = 0; i < MAX_V; i++) {
    if (i >= n) break;
    int j = i == 0 ? n - 1 : i - 1;
    vec2 vi = uShapes[o + i];
    vec2 vj = uShapes[o + j];
    vec2 e = vj - vi;
    vec2 w = p - vi;
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= vi.y, p.y < vj.y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) sgn = -sgn;
  }
  return sgn * sqrt(d);
}

float sdGlyph(vec2 p, int s) {
  if (s >= SHAPES) return length(p) - uRound.y;
  if (uShapeN[s] == 0) return length(p) - uRound.x;
  return sdPolygon(p, s);
}

void main() {
  vec2 p = vec2(vP.x, -vP.y);
  int shape = int(vGlyph.x + 0.5);
  float d = sdGlyph(p, shape);
  float aa = max(fwidth(d), 1e-4);
  float fill = 1.0 - smoothstep(-aa, aa, d);
  // not yet published: the shape's outline, cut into dashes around its center
  float ring = 1.0 - smoothstep(uDash.z - aa, uDash.z + aa, abs(d));
  float around = atan(p.y, p.x) * 0.15915494 + 0.5;
  float dash = step(fract(around * uDash.x), uDash.y);
  float body = mix(fill, ring * dash, vGlyph.z);
  // phosphor: a soft halo outside the edge (the post chain's bloom adds the rest)
  float halo = uGlow * exp(-max(d, 0.0) * 6.0) * (1.0 - 0.5 * vGlyph.z);
  vec3 col = mix(uInk, uFaint, vGlyph.y);
  col = mix(col, uAccent, vState.z);
  col = mix(col, uHot, vState.w);
  float light = mix(1.0, uCitedLight, vGlyph.y) * (1.0 + 0.55 * vState.y + 0.7 * vState.x + 0.4 * vState.z + 0.4 * vState.w);
  float a = clamp(body + halo * (1.0 - body), 0.0, 1.0) * light;
  a *= (1.0 - vFog) * (1.0 - uRecedeBy * vRecede);
  if (a < 0.003) discard;
  fragColor = vec4(mix(uGround, col, min(a, 1.0)), 1.0);
}
`;

export const EDGE_VERT = /* glsl */ `
${FOG_GLSL}
// 0 at the edge's source end, 1 at its target: the pen runs source → target
attribute float aEnd;
// x the draw's delay (s) · y kind (0 between my records, 1 a citation) · z lit · w receded
attribute vec4 aEdge;
varying float vEnd;
varying vec4 vEdge;
varying float vFog;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vEnd = aEnd;
  vEdge = aEdge;
  vFog = fogAmount(-view.z);
  gl_Position = projectionMatrix * view;
}
`;

export const EDGE_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uDraw;   // the plot's start (s, on uTime's clock) · each edge's draw (s)
uniform vec3 uGround;
uniform vec3 uInk;
uniform vec3 uFaint;
uniform vec3 uLight;  // between my records · a citation · lit
uniform float uRecedeBy;
varying float vEnd;
varying vec4 vEdge;
varying float vFog;
out highp vec4 fragColor;
void main() {
  float progress = clamp((uTime - uDraw.x - vEdge.x) / uDraw.y, 0.0, 1.0);
  if (vEnd > progress) discard;
  // the pen's tip, brighter while it travels
  float tip = progress < 1.0 ? smoothstep(progress - 0.08, progress, vEnd) : 0.0;
  vec3 col = mix(uInk, uFaint, vEdge.y);
  float light = mix(mix(uLight.x, uLight.y, vEdge.y), uLight.z, vEdge.z) + tip * 0.6;
  float a = light * (1.0 - vFog) * (1.0 - uRecedeBy * vEdge.w);
  if (a < 0.003) discard;
  fragColor = vec4(mix(uGround, col, min(a, 1.0)), 1.0);
}
`;
