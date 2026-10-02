// What every timer skin shares: its props, pixel-grid drawing (one Path per
// colour, so a grid of any size is a few draws) and the stepped sky.

import { Group, Path, Rect, Skia, SkPath } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { BiomeId } from '../../../../domain/game/biomes';
import type { TimerSkin } from '../../../../domain/game/timerSkin';
import { mix } from '../../../../theme/palette';

export interface SkinProps {
  biome: BiomeId;
  worldW: number;
  worldH: number;
  /** The hill line: the sky ends here and the ground starts below. */
  horizon: number;
  /** Today's time toward the target, 0…1. */
  progress: number;
  /** Today's time is at or past the target. */
  past: boolean;
  /** The stepped world clock (stopped with reduced motion, a pause or the app in the background). */
  clock: SharedValue<number>;
  reduced: boolean;
}

/** One skin: drawn behind the hills (`Back`), between them and the ground (`Mid`) and in front of the ground (`Front`). */
export interface SkinRenderer {
  Back: React.ComponentType<SkinProps>;
  Mid?: React.ComponentType<SkinProps>;
  Front?: React.ComponentType<SkinProps>;
  /** How far the far hills have scrolled (world px); the Trail moves them with the time. */
  farShift?(progress: number): number;
  /** Which of the biome's ambient particles to use. */
  ambient: 'day' | 'night';
  /** Spoken name, for the Stage's label. */
  say(progress: number, past: boolean): string;
}

export type SkinRegistry = Record<TimerSkin, SkinRenderer>;

export interface Cell {
  x: number;
  y: number;
  w?: number;
  h?: number;
  color: string;
}

/** Cells from a grid of characters; each character maps to a colour (unmapped ones are empty). */
export function gridCells(grid: readonly string[], colors: Record<string, string>, ox: number, oy: number, cell = 1): Cell[] {
  const out: Cell[] = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const color = colors[row[x]];
      if (!color) {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === row[x]) w++;
      out.push({ x: ox + x * cell, y: oy + y * cell, w: w * cell, h: cell, color });
      x += w;
    }
  });
  return out;
}

/** Cells merged into one Path per colour. */
export function Pixels({ cells, opacity }: { cells: Cell[]; opacity?: number | SharedValue<number> }) {
  const paths = useMemo(() => {
    const by = new Map<string, SkPath>();
    for (const c of cells) {
      let p = by.get(c.color);
      if (!p) {
        p = Skia.Path.Make();
        by.set(c.color, p);
      }
      p.addRect(Skia.XYWHRect(c.x, c.y, c.w ?? 1, c.h ?? 1));
    }
    return [...by];
  }, [cells]);
  return (
    <Group opacity={opacity}>
      {paths.map(([color, p]) => (
        <Path key={color} path={p} color={color} />
      ))}
    </Group>
  );
}

const SKY_BANDS = 6;

/** The sky in flat, stepped bands from `top` to `bottom` (the pixel look has no gradients). */
export function Sky({ top, bottom, worldW, horizon }: { top: string; bottom: string; worldW: number; horizon: number }) {
  const bandH = Math.ceil(horizon / SKY_BANDS);
  return (
    <Group>
      {Array.from({ length: SKY_BANDS }, (_, i) => (
        <Rect key={i} x={0} y={i * bandH} width={worldW} height={i === SKY_BANDS - 1 ? horizon * 2 : bandH + 1} color={mix(top, bottom, i / (SKY_BANDS - 1))} />
      ))}
    </Group>
  );
}

/** A fixed scatter in [0, 1) from an index (the same stars every session). */
export function scatter(i: number, salt: number): number {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
