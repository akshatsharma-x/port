/**
 * Where the sun is, for the hero globe's live terminator (DESIGN.md §4.3 A1). Earth-fixed unit
 * vectors: y toward the north pole, z toward (0° N, 0° E), x toward (0° N, 90° E).
 *
 * The subsolar point from NOAA's general solar position equations (fractional year → declination
 * and equation of time; good to about ±0.5°, a fraction of a pixel on the globe). Driven by the
 * same clock as the HUD's local time, so the two can't disagree.
 */
const DEG = Math.PI / 180;

export function earthVector(latDeg: number, lonDeg: number): [number, number, number] {
  const la = latDeg * DEG;
  const lo = lonDeg * DEG;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

/** The subsolar point: { lat, lon } in degrees (lon east-positive, −180…180). */
export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const year = date.getUTCFullYear();
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const dayOfYear = Math.floor((date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3_600_000;
  const g = ((2 * Math.PI) / (leap ? 366 : 365)) * (dayOfYear - 1 + (hours - 12) / 24);
  const eqTimeMin = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  let lon = -15 * (hours - 12 + eqTimeMin / 60);
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat: decl / DEG, lon };
}

export const sunDirection = (date: Date): [number, number, number] => {
  const s = subsolarPoint(date);
  return earthVector(s.lat, s.lon);
};

/**
 * A rotation (row-major 3×3) that turns the Earth so `lat, lon` faces the viewer (+z), `tiltDeg`
 * above center, with east to the right and north up.
 */
export function facing(latDeg: number, lonDeg: number, tiltDeg: number): number[] {
  const la = latDeg * DEG;
  const lo = lonDeg * DEG;
  const t = tiltDeg * DEG;
  const c = earthVector(latDeg, lonDeg);
  const e = [Math.cos(lo), 0, -Math.sin(lo)];
  const n = [-Math.sin(la) * Math.sin(lo), Math.cos(la), -Math.sin(la) * Math.cos(lo)];
  const X = [1, 0, 0];
  const N = [0, Math.cos(t), -Math.sin(t)];
  const F = [0, Math.sin(t), Math.cos(t)];
  // R = X·eᵀ + N·nᵀ + F·cᵀ
  const R: number[] = [];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) R.push((X[r] ?? 0) * (e[k] ?? 0) + (N[r] ?? 0) * (n[k] ?? 0) + (F[r] ?? 0) * (c[k] ?? 0));
  return R;
}
