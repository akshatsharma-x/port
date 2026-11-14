/**
 * A2 · LOG — the punch-card deck's GLSL (DESIGN.md §4.3 A2, §5.2–5.4). Three draws: the cards (one
 * InstancedMesh, one material), the light shafts (one InstancedMesh), the light panel behind.
 *
 * The atlas (scripts/bake/atlases.ts): A = card stock (0 at the holes and the cut corner),
 * R = printed ink. Colors are theme uniforms. World units are inches. Fog is exponential-squared
 * by view depth past uFog.w, toward the ground color, so the deck's far end is swallowed.
 */

import { MAX_SLOTS } from "@/lib/log";

const FOG_GLSL = /* glsl */ `
uniform vec4 uFog; // rgb: the ground · w: unused
uniform vec2 uFogShape; // x: density · y: depth where the fog starts
float fogAmount(float depth) {
  float d = uFogShape.x * max(0.0, depth - uFogShape.y);
  return 1.0 - exp(-d * d);
}
`;

const ATLAS_GLSL = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec2 uAtlasGrid; // cells across, down
uniform vec4 uCardInCell; // the card's rectangle in its cell, as a share of the cell: x, y, w, h
// uv: three's plane (0,0 bottom-left); the atlas runs top-down (an ImageBitmap, unflipped)
vec2 atlasUv(float cell, vec2 uv) {
  vec2 cr = vec2(mod(cell, uAtlasGrid.x), floor(cell / uAtlasGrid.x));
  vec2 inCell = uCardInCell.xy + vec2(uv.x, 1.0 - uv.y) * uCardInCell.zw;
  return (cr + inCell) / uAtlasGrid;
}
`;

export const CARD_VERT = /* glsl */ `
uniform vec2 uCardSize; // in
// per card: x atlas cell · y bow under the cursor (in) · z light gain · w standing (1) → fallen (0)
attribute vec4 aCard;
// the card behind it in the deck: x its cell (-1: none) · y how much light it lets through to this one
attribute vec2 aBehind;
varying vec2 vUv;
varying vec4 vCard;
varying vec2 vBehind;
varying float vDepth;
void main() {
  vec3 p = position;
  // the bow: a half sine across the card's width, toward the viewer
  p.z += aCard.y * sin(3.14159265 * (p.x / uCardSize.x + 0.5));
  vec4 view = viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
  vDepth = -view.z;
  vUv = uv;
  vCard = aCard;
  vBehind = aBehind;
  gl_Position = projectionMatrix * view;
}
`;

export const CARD_FRAG = /* glsl */ `
precision highp float;
${ATLAS_GLSL}
${FOG_GLSL}
uniform vec2 uCardSize;
uniform vec2 uCornerCut; // run along the top, drop down the side (in)
uniform vec3 uStock;
uniform vec3 uInk;
uniform vec3 uInkBright; // the top-edge text: the card's own words
uniform vec3 uLight;
uniform float uHole; // HDR: the backlight seen through a hole
uniform float uGlow; // the stock's translucency to the card behind's holes
uniform float uFallenFade;
varying vec2 vUv;
varying vec4 vCard;
varying vec2 vBehind;
varying float vDepth;
out highp vec4 fragColor;
void main() {
  vec2 uv = vUv;
  // the back is blank stock; its holes are the front's, mirrored
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  // the cut corner (upper left, seen from the front) is no card at all
  vec2 fromCorner = vec2(uv.x * uCardSize.x, (1.0 - uv.y) * uCardSize.y);
  if (fromCorner.x / uCornerCut.x + fromCorner.y / uCornerCut.y < 1.0) discard;
  vec4 t = texture(uAtlas, atlasUv(vCard.x, uv));
  float standing = vCard.w;
  vec3 c;
  if (t.a < 0.5) {
    // a hole: on a standing card the backlight comes through it; on a fallen one it's just open
    if (standing < 0.5) discard;
    c = uLight * uHole * vCard.z * standing;
  } else if (!gl_FrontFacing) {
    c = uStock * 0.7;
  } else {
    c = mix(mix(uStock, uInk, t.r), uInkBright, t.g);
    // the light through the card behind's holes, soft through the stock (a blurred mip of its alpha)
    if (vBehind.x >= 0.0 && vBehind.y > 0.005) {
      float through = 1.0 - textureLod(uAtlas, atlasUv(vBehind.x, vUv), 3.0).a;
      c += uLight * uGlow * through * vBehind.y * standing;
    }
  }
  // a card the camera has passed drops out of the light as it falls: into the ground, like the far end
  float fade = max(fogAmount(vDepth), (1.0 - standing) * uFallenFade);
  fragColor = vec4(mix(c, uFog.rgb, fade), 1.0);
}
`;

export const SHAFT_VERT = /* glsl */ `
#define MAX_CARDS ${MAX_SLOTS}
uniform mat4 uCards[MAX_CARDS];
uniform float uCardLight[MAX_CARDS];
uniform vec2 uCardSize;
uniform vec2 uShaft; // x length · y width (in)
// per shaft: x the card's slot · y, z the hole's center, inches from the card's top-left
attribute vec3 aShaft;
varying float vAlong;
varying float vAcross;
varying float vLight;
varying float vDepth;
void main() {
  int k = int(aShaft.x + 0.5);
  mat4 M = uCards[k];
  vec3 base = (M * vec4(aShaft.y - 0.5 * uCardSize.x, uCardSize.y - aShaft.z, 0.0, 1.0)).xyz;
  vec3 dir = normalize((M * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  // a ribbon from the hole toward the viewer, turned to face the camera about its own axis
  vec3 toCamera = normalize(cameraPosition - base);
  vec3 side = normalize(cross(dir, toCamera) + vec3(1e-5, 0.0, 0.0));
  vec3 world = base + dir * (position.y * uShaft.x) + side * (position.x * uShaft.y);
  vec4 view = viewMatrix * vec4(world, 1.0);
  vAlong = position.y;
  vAcross = position.x * 2.0;
  vLight = uCardLight[k];
  vDepth = -view.z;
  // a dark shaft draws nothing: collapse it, so it costs no fill
  gl_Position = vLight < 1e-3 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * view;
}
`;

export const SHAFT_FRAG = /* glsl */ `
precision highp float;
${FOG_GLSL}
uniform vec3 uLight;
uniform float uShaftIntensity;
varying float vAlong;
varying float vAcross;
varying float vLight;
varying float vDepth;
out highp vec4 fragColor;
void main() {
  float a = (1.0 - vAlong) * (1.0 - vAlong) * (1.0 - vAcross * vAcross);
  // additive light in the haze: it thins with the fog, as the haze it lights does
  float k = uShaftIntensity * a * vLight * (1.0 - fogAmount(vDepth));
  fragColor = vec4(uLight * k, 0.0);
}
`;

export const PANEL_VERT = /* glsl */ `
varying vec2 vUv;
varying float vDepth;
void main() {
  vec4 view = viewMatrix * modelMatrix * vec4(position, 1.0);
  vUv = uv;
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}
`;

export const PANEL_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uLight;
uniform float uPanel;
varying vec2 vUv;
varying float vDepth;
out highp vec4 fragColor;
void main() {
  // the light behind the deck: a glow, brightest at its heart and gone before the quad's edge
  vec2 q = (vUv - 0.5) * 2.0;
  float r = 1.0 - smoothstep(0.0, 1.0, length(q));
  float k = uPanel * r * r * r;
  fragColor = vec4(uLight * k, 0.0);
}
`;
