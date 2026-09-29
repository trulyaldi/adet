// Small, pooled particle effects. Each particle is a pure function of the
// clock and its index (no per-frame state), drawn as pixel squares in one
// batched draw. Ambient presets loop; bursts play once from `startAt`.

import { Atlas, useColorBuffer, useRSXformBuffer, useRectBuffer } from '@shopify/react-native-skia';
import React, { memo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { sprite } from '../assets/manifest';
import { useAtlas } from './atlas';
import { NEAREST } from './pixel';

export type ParticleKind =
  | 'fireflies'
  | 'leaves'
  | 'spores'
  | 'fog'
  | 'bubbles'
  | 'sand'
  | 'heat'
  | 'snow'
  | 'embers'
  | 'stars'
  | 'dust'
  | 'sparkle'
  | 'dissolve'
  | 'aurora'
  | 'ash';

/** Bursts play once; the rest loop forever. */
export const BURSTS: ParticleKind[] = ['dust', 'sparkle', 'dissolve'];

/** RGB palettes per preset (0–1). */
const COLORS: Record<ParticleKind, [number, number, number][]> = {
  fireflies: [[1, 0.93, 0.55], [0.95, 1, 0.6]],
  leaves: [[0.43, 0.68, 0.33], [0.85, 0.62, 0.25], [0.6, 0.78, 0.35]],
  spores: [[0.62, 0.95, 0.82], [0.85, 1, 0.9]],
  fog: [[0.9, 0.95, 0.93]],
  bubbles: [[0.66, 0.92, 0.86], [0.85, 1, 0.97]],
  sand: [[0.95, 0.8, 0.52], [0.9, 0.7, 0.42]],
  heat: [[1, 0.98, 0.9]],
  snow: [[1, 1, 1], [0.85, 0.92, 1]],
  embers: [[1, 0.55, 0.15], [1, 0.8, 0.3], [1, 0.95, 0.6]],
  stars: [[1, 0.96, 0.78], [0.8, 0.95, 1], [1, 1, 1]],
  dust: [[0.95, 0.92, 0.85], [0.8, 0.74, 0.62]],
  sparkle: [[1, 0.96, 0.7], [1, 0.83, 0.35], [1, 1, 1]],
  dissolve: [[1, 1, 1], [0.9, 0.95, 1]],
  aurora: [[0.5, 0.95, 0.75], [0.72, 0.55, 0.94]],
  ash: [[0.62, 0.58, 0.56], [0.45, 0.42, 0.42]],
};

export interface ParticlesProps {
  kind: ParticleKind;
  /** Region in game pixels (bursts use its centre as the origin). */
  x: number;
  y: number;
  w: number;
  h: number;
  count?: number;
  clock: SharedValue<number>;
  /** Bursts: clock time to start. */
  startAt?: SharedValue<number>;
  /** 0–1 overall strength (night fireflies, fading fog). */
  intensity?: SharedValue<number> | number;
  /** Tint for bursts (e.g. a boss's colour for dissolve). */
  tint?: [number, number, number];
}

export const Particles = memo(function Particles({ kind, x, y, w, h, count = 16, clock, startAt, intensity, tint }: ParticlesProps) {
  const image = useAtlas('shared');
  const px = sprite('fx.pixel').frames[0];
  const palette = tint ? [tint, COLORS[kind][0]] : COLORS[kind];
  const burst = BURSTS.includes(kind);

  // Every particle is the same 1-pixel sprite, scaled.
  const sprites = useRectBuffer(count, (r) => {
    'worklet';
    r.setXYWH(px[0], px[1], 1, 1);
  });

  const transforms = useRSXformBuffer(count, (xf, i) => {
    'worklet';
    const t = clock.value;
    const s0 = ((i * 2654435761) % 1000) / 1000;
    const s1 = ((i * 40503 + 17) % 997) / 997;
    const s2 = ((i * 69069 + 7) % 991) / 991;
    let px1 = 0;
    let py1 = 0;
    let size = 1;
    const local = burst ? t - (startAt ? startAt.value : 0) : t;
    switch (kind) {
      case 'fireflies': {
        px1 = x + s0 * w + Math.sin(local / 1400 + s1 * 6.28) * 6;
        py1 = y + s1 * h + Math.cos(local / 1700 + s2 * 6.28) * 4;
        break;
      }
      case 'leaves':
      case 'snow':
      case 'ash': {
        const speed = kind === 'snow' ? 9 : kind === 'ash' ? 6 : 7;
        const life = (h / speed) * 1000;
        const p = ((local + s0 * life) % life) / life;
        px1 = x + s1 * w + Math.sin(p * 12 + s2 * 6.28) * 4;
        py1 = y + p * h;
        size = kind === 'snow' && s2 > 0.6 ? 2 : 1;
        break;
      }
      case 'spores':
      case 'bubbles':
      case 'embers': {
        const speed = kind === 'embers' ? 14 : kind === 'bubbles' ? 8 : 4;
        const life = (h / speed) * 1000;
        const p = ((local + s0 * life) % life) / life;
        px1 = x + s1 * w + Math.sin(p * 9 + s2 * 6.28) * (kind === 'embers' ? 3 : 2);
        py1 = y + h - p * h;
        size = kind === 'bubbles' && s2 > 0.7 ? 2 : 1;
        break;
      }
      case 'fog': {
        const life = 16000;
        const p = ((local + s0 * life) % life) / life;
        px1 = x - 20 + p * (w + 40);
        py1 = y + s1 * h;
        size = 3 + Math.floor(s2 * 4);
        break;
      }
      case 'sand': {
        const life = 1800;
        const p = ((local + s0 * life * 3) % life) / life;
        px1 = x - 10 + p * (w + 20);
        py1 = y + s1 * h + Math.sin(p * 6) * 2;
        break;
      }
      case 'heat': {
        px1 = x + s0 * w;
        py1 = y + s1 * h - ((local / 90 + s2 * 20) % 12);
        break;
      }
      case 'stars':
      case 'aurora': {
        px1 = x + s0 * w;
        py1 = y + s1 * h + (kind === 'aurora' ? Math.sin(local / 2000 + s0 * 8) * 3 : 0);
        size = kind === 'aurora' ? 2 : s2 > 0.85 ? 2 : 1;
        break;
      }
      case 'dust':
      case 'sparkle':
      case 'dissolve': {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const p = Math.max(0, local) / (kind === 'dust' ? 450 : kind === 'sparkle' ? 900 : 1100);
        if (kind === 'dissolve') {
          // Squares over the sprite drift up and away in a scattered order.
          const gx = x + s0 * w;
          const gy = y + s1 * h;
          const q = Math.max(0, p - s2 * 0.5) * 2;
          px1 = gx + (s2 - 0.5) * 10 * q;
          py1 = gy - q * 14;
          size = 2;
        } else {
          const a = s0 * 6.283;
          const v = kind === 'dust' ? 6 + s1 * 5 : 12 + s1 * 16;
          px1 = cx + Math.cos(a) * v * p;
          py1 = cy + Math.sin(a) * v * p * (kind === 'dust' ? 0.4 : 1) + (kind === 'sparkle' ? p * p * 18 : 0);
          size = kind === 'sparkle' && s2 > 0.6 ? 2 : 1;
        }
        break;
      }
    }
    xf.set(size, 0, Math.round(px1), Math.round(py1));
  });

  const colors = useColorBuffer(count, (c, i) => {
    'worklet';
    const t = clock.value;
    const s1 = ((i * 40503 + 17) % 997) / 997;
    const s2 = ((i * 69069 + 7) % 991) / 991;
    const k = palette[i % palette.length];
    const strength = intensity === undefined ? 1 : typeof intensity === 'number' ? intensity : intensity.value;
    let a = 1;
    const local = burst ? t - (startAt ? startAt.value : 0) : t;
    switch (kind) {
      case 'fireflies':
        a = 0.35 + 0.65 * Math.max(0, Math.sin(local / 500 + s1 * 12));
        break;
      case 'stars':
        a = 0.4 + 0.6 * Math.max(0, Math.sin(local / 900 + s2 * 20));
        break;
      case 'fog':
        a = 0.12;
        break;
      case 'heat':
        a = 0.18;
        break;
      case 'aurora':
        a = 0.25 + 0.2 * Math.sin(local / 1500 + s1 * 6);
        break;
      case 'embers':
        a = 0.6 + 0.4 * Math.sin(local / 120 + s1 * 30);
        break;
      case 'dust':
      case 'sparkle':
      case 'dissolve': {
        const life = kind === 'dust' ? 450 : kind === 'sparkle' ? 900 : 1100;
        const p = local / life;
        a = local < 0 || p > 1 ? 0 : kind === 'dissolve' ? Math.max(0, 1 - Math.max(0, p - s2 * 0.5) * 2) : 1 - p;
        break;
      }
    }
    c[0] = k[0];
    c[1] = k[1];
    c[2] = k[2];
    c[3] = Math.max(0, Math.min(1, a * strength));
  });

  if (!image) return null;
  return <Atlas image={image} sprites={sprites} transforms={transforms} colors={colors} colorBlendMode="modulate" sampling={NEAREST} />;
});
