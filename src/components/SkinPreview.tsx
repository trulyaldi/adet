// A timer skin's tiny pixel preview for Settings, as SVG rects (no Skia: the
// Settings sheet is on the start-up path). The grids live in skinPreviews.ts.

import React from 'react';
import { PixelRatio } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { TimerSkin } from '../domain/game/timerSkin';
import { SKIN_PREVIEW_COLORS as COLORS, SKIN_PREVIEW_COLS as COLS, SKIN_PREVIEW_ROWS as ROWS, SKIN_PREVIEWS } from './skinPreviews';

/** `width` snaps to whole device pixels per preview pixel. */
export function SkinPreview({ skin, width }: { skin: TimerSkin; width: number }) {
  const ratio = PixelRatio.get();
  const cell = Math.max(1, Math.round((width * ratio) / COLS)) / ratio;
  const grid = SKIN_PREVIEWS[skin];
  const rects: React.ReactNode[] = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      let w = 1;
      while (row[x + w] === row[x]) w++;
      const color = COLORS[row[x]];
      if (color) rects.push(<Rect key={`${x}.${y}`} x={x * cell} y={y * cell} width={w * cell} height={cell} fill={color} />);
      x += w;
    }
  });
  return (
    <Svg width={COLS * cell} height={ROWS * cell}>
      {rects}
    </Svg>
  );
}
