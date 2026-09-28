// The Adet palette: brand blue plus eight warm, bright project colors. Pure
// data and color math, so it can be tested under node and reused off-device.

import { PROJECT_COLORS, ProjectColor } from '../domain/look';

export { PROJECT_COLORS };
export type { ProjectColor };

export interface SwatchDef {
  /** The color itself: tiles, rings, bars, buttons. */
  base: string;
  /** Soft background (light theme). */
  light: string;
  /** Button edge, pressed state, and colored text on `light` or white. */
  dark: string;
  /** Text and icons drawn on `base`. */
  on: string;
}

export const INK = '#15171C';
export const WHITE = '#FFFFFF';

export const BRAND: SwatchDef = { base: '#0A7AFF', light: '#E3F0FF', dark: '#0060CC', on: WHITE };

export const SWATCHES: Record<ProjectColor, SwatchDef> = {
  purple: { base: '#7A48F0', light: '#F1EBFF', dark: '#5B2FC9', on: WHITE },
  orange: { base: '#FF8A1F', light: '#FFF0E0', dark: '#A95000', on: INK },
  green: { base: '#22B45E', light: '#E3F7EA', dark: '#0F7A3A', on: INK },
  pink: { base: '#F2489A', light: '#FFE6F2', dark: '#B81D68', on: INK },
  teal: { base: '#13B5A8', light: '#DDF6F3', dark: '#0A766D', on: INK },
  yellow: { base: '#FFC01E', light: '#FFF6D6', dark: '#8F6700', on: INK },
  coral: { base: '#FF6A55', light: '#FFE9E5', dark: '#B8321F', on: INK },
  indigo: { base: '#4F5DF0', light: '#E8EAFF', dark: '#3542C7', on: WHITE },
};

// ---------- color math ----------
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: number[]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** `a` mixed toward `b` by t (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

/** `hex` with an alpha channel (0..1), as #RRGGBBAA. */
export function alpha(hex: string, a: number): string {
  return hex.slice(0, 7) + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0').toUpperCase();
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two opaque colors (1..21). */
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** A swatch resolved for a theme: dark mode swaps the pastel for a deep tint of the color. */
export interface Swatch extends SwatchDef {
  /** A lighter shade for "bonus" time past a target. */
  bonus: string;
}

export function resolveSwatch(def: SwatchDef, dark: boolean, card: string): Swatch {
  if (!dark) return { ...def, bonus: mix(def.base, WHITE, 0.45) };
  return {
    base: def.base,
    light: mix(card, def.base, 0.2),
    dark: mix(def.base, '#000000', 0.38),
    on: def.on,
    bonus: mix(def.base, WHITE, 0.35),
  };
}
