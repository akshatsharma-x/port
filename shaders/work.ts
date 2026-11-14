/**
 * A4 · WORK — the slide carousel's GLSL (DESIGN.md §4.3 A4). One draw: an InstancedMesh of slide
 * mounts sampling a sampler2DArray of covers, the mount and its print drawn in-shader.
 *
 * A slide at rest is a dither duotone: its cover's luminance through an 8 × 8 Bayer, in ink on the
 * film's ground. The one in the gate PROJECTS: it DITHER-RESOLVEs to full color (the scene tier,
 * §3.6: steps(32) over 900 ms on a 0.7 · bayer + 0.3 · radial field), under the lamp's falloff,
 * with dust specks in the light and a hint of lens barrel. A fast fling smears the picture behind
 * its motion like phosphor persistence. The PROJECTION flies a slide in screen space until its
 * window covers the viewport the way the case study's DOM hero does (object-fit: cover). Paper is a
 * lightbox: dark ink on backlit white, and the gate is a loupe — full color under a round lens.
 *
 * Mount space is uv − 0.5 (the 50 mm mount, −0.5…0.5); window space is that over the window's half
 * size (−1…1 inside the 36 × 24 mm frame).
 */

const BAYER_GLSL = /* glsl */ `
float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
`;

export const SLIDE_VERT = /* glsl */ `
uniform vec2 uWindow;   // the window's half size, mount units
uniform vec2 uCoverNdc; // the window's half size in NDC once it covers the viewport
// per slide: x layer (its cover) · y gate (1 in the gate … 0 a slide away) · z fly (0 – 1, eased) · w fade (1 shown … 0 gone)
attribute vec4 aSlide;
// per slide: x resolve (stepped, 0 – 1) · y pointed (an INDEX row's, 0 – 1) · z distance from the gate (slides)
attribute vec3 aState;
varying vec2 vM;
varying vec4 vSlide;
varying vec3 vState;
void main() {
  vM = uv - 0.5;
  vSlide = aSlide;
  vState = aState;
  vec4 clip = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  if (aSlide.z > 0.0) {
    // the PROJECTION: from where it stands to the cover rect, in screen space (its window's corners
    // land on the viewport's cover rect; the mount around them runs off screen)
    vec2 target = position.xy / uWindow * uCoverNdc;
    vec3 ndc = clip.xyz / clip.w;
    gl_Position = vec4(mix(ndc.xy, target, aSlide.z), mix(ndc.z, -0.999, aSlide.z), 1.0);
  } else {
    gl_Position = clip;
  }
}
`;

export const SLIDE_FRAG = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
${BAYER_GLSL}
uniform sampler2DArray uCovers;
uniform sampler2D uPrint;  // the mounts' print (R8 coverage): two rows per slide (top band, bottom band)
uniform float uSlides;
uniform vec2 uWindow;      // the window's half size, mount units
uniform vec4 uPrintBand;   // x: band centre (|y|, mount units) · y: band half-height · z: half-width
uniform float uRadius;     // the mount's corner radius
uniform float uCell;       // the dither's cell, device px
uniform float uSmear;      // the rail's motion: the smear's signed length, window uv
uniform float uTaps;
uniform vec3 uLook;        // x: lamp falloff · y: barrel · z: rest dim
uniform float uPaper;      // 1: a lightbox, and the gate is a loupe
uniform vec2 uLoupe;       // Paper: the loupe's radius (window heights) · magnification
uniform vec3 uGround;      // the film's ground (the duotone's dark; Paper: the backlit white)
uniform vec3 uInk;         // the duotone's ink
uniform vec3 uLit;         // a pointed slide's ink (--accent)
uniform vec3 uMount;       // the mount's stock
uniform vec3 uPrintInk;    // its print
uniform vec3 uRim;         // the window's inner edge and the loupe's rim
varying vec2 vM;
varying vec4 vSlide;
varying vec3 vState;

vec3 cover(vec2 uv, float layer) {
  // ImageData rows run top to bottom; texture rows bottom to top
  // a little sharper than trilinear: the window minifies its cover (LOW's 640 into ~490 device px)
  return texture(uCovers, vec3(uv.x, 1.0 - uv.y, layer), -0.5).rgb;
}

// sRGB-ish luminance for an even dither (the covers are decoded to linear)
float tone(vec3 c) { return pow(clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0), 1.0 / 2.2); }

void main() {
  float layer = vSlide.x;
  float gate = vSlide.y;
  float fly = vSlide.z;
  // the rounded-square mount (its edge antialiased; nothing past it)
  vec2 q = abs(vM) - (0.5 - uRadius);
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float aa = fwidth(sd);
  float alpha = (1.0 - smoothstep(-aa, aa, sd)) * vSlide.w;
  if (alpha <= 0.001) discard;

  vec2 w = vM / uWindow; // −1…1 across the window
  // the distance past the window's edge, mount units (negative inside)
  float dWin = max(abs(vM.x) - uWindow.x, abs(vM.y) - uWindow.y);
  float fw = fwidth(dWin);
  float inWin = 1.0 - smoothstep(-fw, fw, dWin);
  vec3 color = uMount;

  if (inWin > 0.0) {
    vec2 uv = w * 0.5 + 0.5;
    float clean = 1.0 - fly; // a projected picture has no lens, lamp or dust of its own
    // a hint of lens barrel, in the gate
    vec2 c = uv - 0.5;
    uv = 0.5 + c * (1.0 + uLook.y * gate * clean * dot(c * vec2(1.5, 1.0), c * vec2(1.5, 1.0)) * 2.0);
    // Paper's loupe magnifies its own circle
    float loupeR = uLoupe.x * gate * clean;
    vec2 lc = (uv - 0.5) * vec2(1.5, 1.0);
    float inLoupe = uPaper > 0.5 ? 1.0 - smoothstep(loupeR - 0.004, loupeR + 0.004, length(lc)) : 1.0;
    vec2 luv = uPaper > 0.5 ? mix(uv, 0.5 + (uv - 0.5) / uLoupe.y, inLoupe) : uv;

    // the smear: taps trail behind the motion, each fainter, like phosphor letting go
    vec3 pic = cover(luv, layer);
    if (abs(uSmear) > 1e-4 && fly <= 0.0) {
      vec3 acc = pic;
      float wsum = 1.0;
      for (float k = 1.0; k < 16.0; k += 1.0) {
        if (k >= uTaps) break;
        float f = k / uTaps;
        float wk = exp(-3.0 * f);
        acc += cover(luv - vec2(uSmear * f, 0.0), layer) * wk;
        wsum += wk;
      }
      pic = acc / wsum;
    }

    // at rest: 1-bit, the cover's tone through the Bayer, ink on the ground (a pointed slide in --accent)
    vec2 cell = floor(gl_FragCoord.xy / uCell);
    float t = bayer8(cell);
    vec3 ink = mix(uInk, uLit, vState.y);
    // a phosphor lights the film's bright parts; a lightbox shows through the film, so its dark
    // parts are the ink
    float lit = uPaper > 0.5 ? 1.0 - tone(pic) : tone(pic);
    vec3 duo = mix(uGround, ink, step(t, lit));
    // in the gate: the resolve opens cells whose field 0.7 · bayer + 0.3 · radial is below the progress
    float field = 0.7 * t + 0.3 * clamp(length((uv - 0.5) * vec2(1.5, 1.0)) / 0.9, 0.0, 1.0);
    float open = step(field, vState.x) * inLoupe;
    // the lamp: a hotspot that falls off to the corners; dust specks in its light
    float lamp = 1.0 - uLook.x * clean * smoothstep(0.0, 1.0, length((uv - 0.5) * vec2(1.5, 1.0)) / 0.9);
    float dust = 0.0;
    for (float k = 0.0; k < 9.0; k += 1.0) {
      vec2 p = hash22(vec2(layer * 13.0 + 1.0, k + 1.0)) * 0.9 + 0.05;
      float r = mix(0.002, 0.0065, hash12(vec2(layer + 3.0, k + 7.0)));
      float d = length((uv - p) * vec2(1.5, 1.0));
      dust = max(dust, 1.0 - smoothstep(r * 0.55, r, d));
    }
    vec3 full = pic * lamp * (1.0 - 0.7 * dust * clean);
    vec3 picture = mix(duo, full, open);
    // slides away from the gate dim; a flying slide is all picture
    picture *= mix(1.0, 1.0 - uLook.z, clamp(vState.z, 0.0, 1.0) * clean);
    // Paper: the loupe's rim
    if (uPaper > 0.5 && loupeR > 0.0) {
      float rim = abs(length(lc) - loupeR);
      picture = mix(picture, uRim, (1.0 - smoothstep(0.003, 0.009, rim)) * 0.85);
    }
    color = mix(color, picture, inWin);
  }

  if (inWin < 1.0) {
    // the mount: its edge catches the light; a soft shadow falls into the window; its print in
    // the bands above and below it
    color = mix(color, color + 0.06, (1.0 - smoothstep(0.0, 0.012, -sd)) * (1.0 - inWin));
    color = mix(color, uRim, (1.0 - smoothstep(0.0, 0.012, dWin)) * 0.5 * (1.0 - inWin));
    float top = step(0.0, vM.y);
    float by = (abs(vM.y) - uPrintBand.x) / uPrintBand.y; // −1…1 across the band, outward from the window
    float bx = vM.x / uPrintBand.z;
    if (abs(by) < 1.0 && abs(bx) < 1.0) {
      // row 0 of a slide is its top band, row 1 its bottom; the atlas's data runs top to bottom from v 0
      float row = vSlide.x * 2.0 + (1.0 - top);
      float up = top > 0.5 ? by : -by; // +1 at the band's upper edge
      vec2 puv = vec2(bx * 0.5 + 0.5, (row + 0.5 - up * 0.5) / (2.0 * uSlides));
      float ink = texture(uPrint, puv).r;
      color = mix(color, mix(uPrintInk, uLit, vState.y), ink * (1.0 - inWin));
    }
  }
  gl_FragColor = vec4(color, alpha);
}
`;
