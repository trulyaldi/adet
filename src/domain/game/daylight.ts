// Time of day from the device's local hour, and the colour grades the Quest
// world uses for it. Pure (the matrices are plain 4×5 arrays).

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export function dayPhase(hour: number): DayPhase {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 18) return 'day';
  if (hour >= 18 && hour < 21) return 'dusk';
  return 'night';
}

/** How strong night lights (fireflies, torches, glow) are, 0–1. */
export function nightLight(phase: DayPhase): number {
  return phase === 'night' ? 1 : phase === 'dusk' ? 0.6 : phase === 'dawn' ? 0.35 : 0;
}

export type ColorMatrix = number[];

export const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** r' = r·kr + offset, per channel (a tint that keeps pixel colours distinct). */
function tint(kr: number, kg: number, kb: number, or = 0, og = 0, ob = 0): ColorMatrix {
  return [kr, 0, 0, 0, or, 0, kg, 0, 0, og, 0, 0, kb, 0, ob, 0, 0, 0, 1, 0];
}

export const GRADES: Record<DayPhase, ColorMatrix> = {
  dawn: tint(1.02, 0.94, 0.94, 0.04, 0.02, 0.03),
  day: IDENTITY,
  dusk: tint(1.0, 0.86, 0.82, 0.03, 0, 0.02),
  night: tint(0.62, 0.68, 0.92, 0, 0.01, 0.05),
};

/** Matrix product a·b (apply b, then a). */
export function mulMatrix(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const out: number[] = new Array(20).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? a[r * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) v += a[r * 5 + k] * b[k * 5 + c];
      out[r * 5 + c] = v;
    }
  }
  return out;
}

/** Grey-out for places not reached yet: `amount` 0 (full colour) … 1 (grey), then dimmed. */
export function desaturate(amount: number, dim = 1): ColorMatrix {
  const s = 1 - amount;
  const lr = 0.2126 * (1 - s);
  const lg = 0.7152 * (1 - s);
  const lb = 0.0722 * (1 - s);
  return [
    (lr + s) * dim, lg * dim, lb * dim, 0, 0,
    lr * dim, (lg + s) * dim, lb * dim, 0, 0,
    lr * dim, lg * dim, (lb + s) * dim, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/** Ascension loops use a night palette. */
export const ASCENSION_NIGHT: ColorMatrix = tint(0.7, 0.72, 1.0, 0.02, 0.02, 0.08);
