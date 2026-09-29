// Shading helpers: ramps lit from the top-left with ordered dithering, so
// procedural shapes get the same volume treatment as hand-drawn ones.

import { bayer, Color, hex, Px } from './px';

export type RampHex = string[];
export const ramp = (r: RampHex): Color[] => r.map((h) => hex(h));

// Light from the top-left, slightly in front.
const L = (() => {
  const v = [-0.5, -0.72, 0.48];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / n);
})();

/** A ramp colour for a sphere-ish surface point (nx, ny in −1…1), dithered at band edges. */
export function lit(r: Color[], nx: number, ny: number, x: number, y: number, bias = 0): Color {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const i = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]) + bias;
  const t = Math.max(0, Math.min(0.999, i)) * r.length + (bayer(x, y) - 0.5) * 0.8;
  return r[Math.max(0, Math.min(r.length - 1, Math.floor(t)))];
}

/** A shaded ellipse (a lit sphere squashed to rx × ry). */
export function ball(px: Px, cx: number, cy: number, rx: number, ry: number, r: Color[], bias = 0): Px {
  return px.ellipse(cx, cy, rx, ry, (x, y, nx, ny) => lit(r, nx, ny, x, y, bias));
}

/** Discs along a quadratic curve, radius easing from r0 to r1 (necks, tails, smoke). */
export function tube(
  px: Px,
  p0: [number, number],
  c: [number, number],
  p1: [number, number],
  r0: number,
  r1: number,
  col: Color[] | Color
): Px {
  const len = Math.hypot(c[0] - p0[0], c[1] - p0[1]) + Math.hypot(p1[0] - c[0], p1[1] - c[1]);
  const steps = Math.max(4, Math.ceil(len * 1.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0];
    const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
    const r = r0 + (r1 - r0) * t;
    if (Array.isArray(col)) ball(px, x, y, r, r, col);
    else px.ellipse(x, y, r, r, col);
  }
  return px;
}

/** Top-left light and bottom-right shadow on the edges of one flat colour. */
export function edgeLight(px: Px, base: Color, light: Color, dark: Color): Px {
  return px.rim(base, light, dark);
}
