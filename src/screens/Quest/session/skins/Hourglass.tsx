// Hourglass: a big pixel hourglass in the sky behind the fight. The top
// chamber drains toward the target, grain by grain, and the bottom fills.

import { Group, Rect } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';

import { sandAt } from '../../../../domain/game/timerSkin';
import { PALETTES } from '../../../../game/content/palettes';
import { mix } from '../../../../theme/palette';
import { Cell, Pixels, SkinProps, SkinRenderer, Sky } from './common';

// Placeholder art (P9 art pass): built from half-widths, one row each.
/** Inner half-widths of the top chamber, top → neck (the bottom chamber mirrors it). */
const CHAMBER = [4, 4, 4, 3, 3, 2, 1, 0];
const ROWS = CHAMBER.length;
/** Grains step at about 8 fps. */
const GRAIN_MS = 125;

function Back({ biome, worldW, horizon, progress, past, clock, reduced }: SkinProps) {
  const pal = PALETTES[biome];
  const cell = horizon >= 70 ? 2 : 1;
  const tall = (ROWS * 2 + 3) * cell;
  const cx = Math.round(worldW / 2);
  const top0 = Math.max(2, Math.round((horizon - tall) / 2) - 4);
  const sand = sandAt(progress);
  const glass = useMemo(() => {
    const out: Cell[] = [];
    const at = (x: number, y: number, color: string) => out.push({ x: cx + x * cell, y: top0 + y * cell, w: cell, h: cell, color });
    const capRow = (y: number) => {
      for (let x = -6; x <= 6; x++) at(x, y, x === -6 || x === 6 ? pal.trunk[0] : pal.trunk[1]);
    };
    capRow(0);
    capRow(ROWS * 2 + 2);
    // Posts down the sides.
    for (let y = 1; y <= ROWS * 2 + 1; y++) {
      at(-6, y, pal.trunk[0]);
      at(6, y, pal.trunk[0]);
    }
    // The glass outline.
    const rowsOf = [...CHAMBER, 0, ...[...CHAMBER].reverse()];
    rowsOf.forEach((hw, i) => {
      at(-(hw + 1), i + 1, pal.rock[2]);
      at(hw + 1, i + 1, pal.rock[2]);
    });
    return out;
  }, [pal, cx, top0, cell]);
  const grains = useMemo(() => {
    const out: Cell[] = [];
    const light = pal.path[2];
    const dark = pal.path[1];
    const fill = (rows: number[], amount: number, fromBottom: boolean, yOf: (i: number) => number) => {
      const total = rows.reduce((n, hw) => n + hw * 2 + 1, 0);
      let left = Math.round(amount * total);
      const order = fromBottom ? rows.map((_, i) => rows.length - 1 - i) : rows.map((_, i) => i);
      for (const i of order) {
        if (left <= 0) break;
        const hw = rows[i];
        const width = Math.min(left, hw * 2 + 1);
        left -= width;
        // Fill a row from its middle outward.
        const start = -Math.floor(width / 2);
        for (let x = start; x < start + width; x++) out.push({ x: cx + x * cell, y: top0 + yOf(i) * cell, w: cell, h: cell, color: (x + i) % 3 ? light : dark });
      }
    };
    // Top: the sand sits on the neck and drains from the top down.
    fill(CHAMBER, sand.top, true, (i) => i + 1);
    // Bottom: a pile from the base up.
    const bottom = [...CHAMBER].reverse();
    fill(bottom, sand.bottom, true, (i) => ROWS + 2 + i);
    return out;
  }, [pal, cx, top0, cell, sand.top, sand.bottom]);
  // A thin falling stream while there is sand left to fall.
  const flowing = !reduced && !past && progress < 1;
  const neckY = top0 + (ROWS + 1) * cell;
  const fall = ROWS * cell;
  const g0 = useDerivedValue(() => neckY + (((Math.floor(clock.value / GRAIN_MS) + 0) * cell) % fall));
  const g1 = useDerivedValue(() => neckY + (((Math.floor(clock.value / GRAIN_MS) + 3) * cell) % fall));
  const g2 = useDerivedValue(() => neckY + (((Math.floor(clock.value / GRAIN_MS) + 6) * cell) % fall));
  return (
    <Group>
      <Sky top={pal.sky[0]} bottom={mix(pal.sky[1], pal.path[2], 0.15)} worldW={worldW} horizon={horizon} />
      <Pixels cells={glass} />
      <Pixels cells={grains} />
      {flowing && (
        <>
          <Rect x={cx} y={g0} width={cell} height={cell} color={pal.path[2]} />
          <Rect x={cx} y={g1} width={cell} height={cell} color={pal.path[2]} />
          <Rect x={cx} y={g2} width={cell} height={cell} color={pal.path[1]} />
        </>
      )}
    </Group>
  );
}

export const hourglass: SkinRenderer = {
  Back,
  ambient: 'day',
  say: (p, past) => (past ? 'The hourglass has run through: past the target' : `The hourglass is ${Math.round(p * 100)}% through`),
};
