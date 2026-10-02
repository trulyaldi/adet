// A jagged pixel starburst behind a big word (World Mode's boss card and KO
// banner, world-6): stacked rows of flat colour, gold → red → white inward.
// Plain views, so it draws before Skia has loaded. Placeholder art for P9.

import React, { memo } from 'react';
import { View } from 'react-native';

import { QUI } from './theme';

/** Row widths (points) of one splash ring: widest in the middle, the ends jut like a burst. */
export function splashRows(rows: number, width: number, seed: number): number[] {
  const mid = (rows - 1) / 2;
  const out: number[] = [];
  for (let i = 0; i < rows; i++) {
    const k = 1 - Math.abs(i - mid) / (mid + 1);
    const jut = i % 2 === 0 ? 0.14 * Math.abs(Math.sin(i * 1.7 + seed)) : 0;
    out.push(Math.round((width * (Math.pow(k, 0.55) + jut)) / 4) * 4);
  }
  return out;
}

const RINGS = [
  { color: QUI.goldDark, scale: 1 },
  { color: QUI.gold, scale: 0.86 },
  { color: QUI.red, scale: 0.68 },
  { color: QUI.white, scale: 0.46 },
];
const ROW = 6;

export const PixelSplash = memo(function PixelSplash({ width, rows = 17 }: { width: number; rows?: number }) {
  return (
    <View style={{ width, height: rows * ROW, alignItems: 'center', justifyContent: 'center' }}>
      {RINGS.map((r, j) => {
        const n = Math.max(3, Math.round(rows * r.scale) | 1);
        return (
          <View key={j} style={{ position: 'absolute', alignItems: 'center' }}>
            {splashRows(n, width * r.scale, j * 2.3).map((w, i) => (
              <View key={i} style={{ width: w, height: ROW, backgroundColor: r.color }} />
            ))}
          </View>
        );
      })}
    </View>
  );
});
