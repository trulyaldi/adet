// A pixel check mark drawn from squares (the pixel font has no ✓ glyph).

import React from 'react';
import { View } from 'react-native';

import { QUI } from './theme';

// 7×5 grid, rows top to bottom.
const GRID = ['......#', '.....#.', '#...#..', '.#.#...', '..#....'];

export function PixelCheck({ px = 2, color = QUI.ink }: { px?: number; color?: string }) {
  return (
    <View accessible={false} style={{ width: 7 * px, height: 5 * px }}>
      {GRID.flatMap((row, y) =>
        [...row].map((c, x) => (c === '#' ? <View key={`${x}:${y}`} style={{ position: 'absolute', left: x * px, top: y * px, width: px, height: px, backgroundColor: color }} /> : null))
      )}
    </View>
  );
}
