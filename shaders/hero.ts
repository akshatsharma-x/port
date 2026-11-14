/**
 * A1 · HERO — the particle system's GLSL (DESIGN.md §4.3, §5.2–5.4). One Points draw; WebGL2
 * (GLSL 3.00: gl_VertexID seeds every particle, so no per-particle attribute but the targets).
 *
 * Attributes: position = INITIALS, aConstellation, aGlobe (normalized Int16, world states ±1) and
 * aLattice (NDC; z = 1 on the About layout's blocks and lines).
 *
 * The morph (uMorph 0–3, owned by scroll): inside each transition every particle starts at its
 * own random moment, travels on a quintic ease, and is carried by one coherent curl-noise field
 * (divergence-free, so the cloud flows like smoke) with a bell that peaks mid-flight, plus an
 * outward burst — scatter, then reassemble. The field drifts with time, so a cloud caught
 * mid-flight keeps swirling; at rest it breathes; scroll velocity stirs it.
 */

/** Simplex noise with its analytic gradient (Ashima Arts / Stefan Gustavson, MIT), and its curl. */
export const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v, out vec3 gradient) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  vec4 m2 = m * m;
  vec4 m4 = m2 * m2;
  vec4 pdotx = vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3));
  vec4 temp = m2 * m * pdotx;
  gradient = -8.0 * (temp.x * x0 + temp.y * x1 + temp.z * x2 + temp.w * x3);
  gradient += m4.x * p0 + m4.y * p1 + m4.z * p2 + m4.w * p3;
  gradient *= 105.0;
  return 105.0 * dot(m4, pdotx);
}

/**
 * A divergence-free flow (Bridson et al. 2007): the curl of the potential f₁·c₁ + f₂·c₂, which is
 * ∇f₁ × c₁ + ∇f₂ × c₂ — two noise evaluations instead of the full curl's three, still swirling in
 * two planes, still incompressible (the cloud flows like smoke, never clumps or tears).
 */
vec3 curlNoise(vec3 p) {
  vec3 g1;
  vec3 g2;
  snoise(p, g1);
  snoise(p + vec3(31.416, -47.853, 12.793), g2);
  return cross(g1, vec3(0.0, 1.0, 0.0)) + cross(g2, vec3(0.8571, 0.1714, 0.4857));
}
`;

/** PCG4D (Jarzynski & Olano 2020): four independent uniforms per particle, from gl_VertexID. */
export const HASH_GLSL = /* glsl */ `
uvec4 pcg4d(uvec4 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
  v ^= v >> 16u;
  v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
  return v;
}
vec4 hash4(uint i) {
  return vec4(pcg4d(uvec4(i, i ^ 0x9E3779B9u, i * 3u + 1u, 0x632BE5ABu))) * (1.0 / 4294967295.0);
}
`;

export const HERO_VERT = /* glsl */ `
in vec3 aConstellation;
in vec3 aGlobe;
in vec3 aLattice;

uniform float uMorph;
uniform float uTime;
/* x: initials scale · y: constellation scale · z: globe scale · w: the subject's lift (world y) */
uniform vec4 uFit;
uniform mat3 uGlobe;
uniform vec3 uSun;
uniform vec3 uCity;
/* the cursor's field: xy pointer (NDC), z strength 0–1 (both damped on the CPU, λ 10) */
uniform vec3 uField;
/* x: radius (NDC height units), y: push at the center */
uniform vec2 uRepel;
uniform float uAspect;
/* NDC per world unit at the subject's depth (the lattice's share of the flow) */
uniform float uNdcPerWorld;
/* x: spread · y: scatter · z: burst · w: curl frequency */
uniform vec4 uShape;
/* x: field drift (1/s) · y: the breath at rest (world units) · z: turbulence 0–1 · w: its amplitude */
uniform vec4 uFlow;
/* x: base point size (device px) · y: its random spread · z: the camera's distance */
uniform vec3 uSize;
uniform vec3 uColorBase;
uniform vec3 uColorHot;
uniform vec3 uColorSignal;
/* x: per-particle intensity · y: hot share · z: hot gain */
uniform vec3 uLight;
/* 1 = Paper: colors are ink absorbance, so shade is more ink, not less light */
uniform float uInk;

out vec3 vColor;

${HASH_GLSL}
${NOISE_GLSL}

void main() {
  vec4 h = hash4(uint(gl_VertexID));
  float m = clamp(uMorph, 0.0, 3.0);
  float seg = min(floor(m), 2.0);
  float t = m - seg;
  float start = h.x * uShape.x;
  float lt = clamp((t - start) / (1.0 - uShape.x), 0.0, 1.0);
  float e = lt * lt * lt * (lt * (lt * 6.0 - 15.0) + 10.0);
  float bell = sin(3.14159265 * lt);
  bell = bell * bell * (3.0 - 2.0 * bell);

  vec3 lift = vec3(0.0, uFit.w, 0.0);
  vec3 pI = position * uFit.x;
  vec3 pC = aConstellation * uFit.y;
  vec3 pG = (uGlobe * aGlobe) * uFit.z;
  vec3 a = seg < 0.5 ? pI : (seg < 1.5 ? pC : pG);
  vec3 b = seg < 0.5 ? pC : pG;
  bool toLattice = seg > 1.5;
  vec3 base = toLattice ? a : mix(a, b, e);

  // one coherent field for what moves — the scatter in flight, the stir of a scroll — evaluated
  // only where something moves; at rest each particle just breathes (a few px, nearly free)
  float scatter = uShape.y * bell * (0.55 + 0.9 * h.z);
  float stir = uFlow.z * uFlow.w;
  vec3 flow = vec3(0.0);
  if (scatter + stir > 1e-5) flow = curlNoise(base * uShape.w + vec3(0.0, uTime * uFlow.x, 0.0));
  vec3 breath = sin(vec3(1.7, 1.3, 2.1) * uTime + h.yzw * 6.2831853) * uFlow.y;
  vec3 outward = normalize(base + vec3(1e-4, 2e-4, 3e-4));
  vec3 world = base + lift + flow * (scatter + stir) + breath + outward * (uShape.z * uShape.y * bell * (0.4 + 0.6 * h.w));

  vec4 clip = projectionMatrix * viewMatrix * vec4(world, 1.0);
  vec2 ndc = clip.xy / clip.w;
  float depth = clip.z / clip.w;
  float wL = toLattice ? e : 0.0;
  if (toLattice) {
    vec2 grid = aLattice.xy + (flow.xy * stir + breath.xy) * uNdcPerWorld;
    ndc = mix(ndc, grid, wL);
    depth = mix(depth, 0.0, wL);
  }

  // the cursor's field: a circle in screen space; particles are pushed out of it
  vec2 d = (ndc - uField.xy) * vec2(uAspect, 1.0);
  float r = length(d);
  float f = 1.0 - smoothstep(0.0, uRepel.x, r);
  ndc += (d / max(r, 1e-4)) * vec2(1.0 / uAspect, 1.0) * f * f * uRepel.y * uField.z;
  gl_Position = vec4(ndc, depth, 1.0);

  float persp = mix(uSize.z / clip.w, 1.0, wL);
  gl_PointSize = max(1.0, uSize.x * (1.0 - 0.5 * uSize.y + uSize.y * h.y) * persp);

  // light: base, a hot share, then each state's own lighting, weighted by how much of it shows
  float wG = seg < 0.5 ? 0.0 : (seg < 1.5 ? e : 1.0 - e);
  float hot = step(1.0 - uLight.y, h.z);
  vec3 col = mix(uColorBase, uColorHot, hot) * mix(1.0, uLight.z, hot) * (0.55 + 0.9 * h.w);
  // the globe: day side lit, night side dim, the city always lit (the signal)
  float day = smoothstep(-0.12, 0.2, dot(normalize(aGlobe), uSun));
  float city = 1.0 - smoothstep(0.012, 0.045, distance(aGlobe, uCity));
  col *= mix(1.0, uInk > 0.5 ? mix(1.25, 0.45, day) : mix(0.14, 1.0, day), wG);
  col = mix(col, uColorSignal * uLight.z * 1.6, city * wG);
  // the lattice: the About layout carries the light; the bare grid is a faint blueprint under it
  col *= mix(1.0, mix(0.22, 1.0, aLattice.z), wL);
  // in flight, particles run a little hot: the scatter reads as excitation
  col *= 1.0 + 0.4 * bell;
  vColor = col * uLight.x;
}
`;

/**
 * The sprite: a disc with analytic AA (fwidth — no MSAA anywhere, §5.3), a gaussian core and,
 * where there's no bloom (LOW), a halo baked in. Dark themes add light (One, One); Paper
 * multiplies ink into the paper (DESIGN.md §5.4: ink stipple, multiply).
 */
export const HERO_FRAG = /* glsl */ `
in vec3 vColor;
out highp vec4 fragColor;
/* x: core falloff · y: halo gain · z: halo falloff */
uniform vec3 uProfile;
/* 1 = Paper: multiply ink */
uniform float uInk;

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float r = sqrt(r2);
  float aa = max(fwidth(r), 1e-3);
  float disc = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  float profile = exp(-r2 * uProfile.x) + uProfile.y * exp(-r2 * uProfile.z);
  float k = disc * profile;
  if (uInk > 0.5) {
    // vColor carries the ink's absorbance: the paper keeps (1 - absorbed) of its light
    fragColor = vec4(1.0 - min(vec3(1.0), vColor * k), 1.0);
  } else {
    fragColor = vec4(vColor * k, 0.0);
  }
}
`;
