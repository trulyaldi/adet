// A pixel icon as SVG rects (no Skia, so it is safe on the start-up path, the
// tab bar included). Rows merge into runs; the size snaps to whole device
// pixels so every icon pixel is the same width on screen.

import React, { useMemo } from 'react';
import { PixelRatio, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

type Run = { x: number; y: number; w: number; knock: boolean };

const cache = new Map<readonly string[], Run[]>();
export function pixelRuns(grid: readonly string[]): Run[] {
  let runs = cache.get(grid);
  if (runs) return runs;
  runs = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x];
      if (c !== '#' && c !== 'o') {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === c) w++;
      runs!.push({ x, y, w, knock: c === 'o' });
      x += w;
    }
  });
  cache.set(grid, runs);
  return runs;
}

/** The drawn size for a requested one: a whole number of device pixels per icon pixel. */
export function snapPixelSize(size: number, cells = 16, ratio = PixelRatio.get()): number {
  const dev = Math.max(1, Math.round((size * ratio) / cells));
  return (dev * cells) / ratio;
}

export function PixelGlyph({ grid, size, color, bg }: { grid: readonly string[]; size: number; color: string; bg: string }) {
  const runs = pixelRuns(grid);
  const cells = grid.length;
  const drawn = useMemo(() => snapPixelSize(size, cells), [size, cells]);
  // The icon sits centred in the requested box on whole device pixels, so every rect edge is crisp.
  const inset = PixelRatio.roundToNearestPixel((size - drawn) / 2);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={drawn} height={drawn} viewBox={`0 0 ${cells} ${cells}`} style={{ position: 'absolute', left: inset, top: inset }}>
        {runs.map((r, i) => (
          <Rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.knock ? bg : color} />
        ))}
      </Svg>
    </View>
  );
}
