// The cloud transition between the Overworld and a Realm (world-6), as pure
// worklet math. One value `t` runs 0 (the map) → 1 (the realm), and back for
// the zoom out. It's quantized into a few steps so the motion reads as pixel
// frames; the clouds close over the map as it scales toward the slot, the
// screens swap under full cover, then the clouds part.

/** The whole zoom, in or out. */
export const ZOOM_MS = 720;
/** Reduced motion: a plain crossfade instead. */
export const FADE_MS = 150;
/** Frames the zoom is cut into (about 20 a second). */
export const ZOOM_STEPS = 14;
/** The map's scale at full zoom. */
export const ZOOM_SCALE = 1.6;
/** The claimed slot's clouds lift and drift off. */
export const LIFT_MS = 560;
export const LIFT_STEPS = 8;
/** A newly conquered realm's flag rises once the map is back. */
export const RAISE_MS = 480;
export const RAISE_STEPS = 6;

/** `v` (0..1) held in `n` equal steps; 1 stays 1. */
export function quantize(v: number, n: number): number {
  'worklet';
  if (v >= 1) return 1;
  if (v <= 0) return 0;
  return Math.floor(v * n) / n;
}

const smooth = (v: number) => {
  'worklet';
  return v * v * (3 - 2 * v);
};

/** How closed the clouds are: open at both ends, fully closed through the middle (where the screens swap). */
export function coverOf(t: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (1 - Math.abs(2 * t - 1)) * 1.4));
}

/** The map's scale: 1 → ZOOM_SCALE over the first half, then held. */
export function zoomOf(t: number): number {
  'worklet';
  return 1 + (ZOOM_SCALE - 1) * smooth(Math.min(1, Math.max(0, t * 2)));
}

/** The map's opacity: it fades out under the clouds (and, with reduced motion, across the whole fade). */
export function mapOpacityOf(t: number, reduced: boolean): number {
  'worklet';
  if (reduced) return 1 - t;
  return Math.min(1, Math.max(0, 1 - (t - 0.42) / 0.16));
}

/** The translate that scales a full-screen view by `s` about the screen point (fx, fy) (RN scales about the centre). */
export function focalShift(fx: number, fy: number, w: number, h: number, s: number): { x: number; y: number } {
  'worklet';
  return { x: (fx - w / 2) * (1 - s), y: (fy - h / 2) * (1 - s) };
}

/** One cloud wall half: rows of `row` game pixels whose inner edge juts in and out, so the edge steps like pixel art. */
export function cloudEdge(rows: number, layer: number, side: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < rows; i++) {
    const a = Math.sin(i * 0.9 + layer * 2.1 + side * 4.3);
    const b = Math.sin(i * 0.31 + layer * 1.3 + side);
    out.push(Math.round(5 * a + 4 * b));
  }
  return out;
}
