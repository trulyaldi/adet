// A layered tilemap: ground, decor and overhang layers, each one batched
// draw. Animated tiles (water, lava, torches) animate from the game clock.

import React, { memo, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { AtlasName } from '../assets/manifest';
import { BatchItem, SpriteBatch } from './SpriteBatch';

export const TILE = 16;

export interface TileLayer {
  /** Rows of tile ids (null = empty), top to bottom. */
  grid: (string | null)[][];
  /** World position of the grid's top-left, in game pixels. */
  x: number;
  y: number;
}

/** Tiles as batch items (tiles are anchored top-left). */
export function tileItems(layer: TileLayer): BatchItem[] {
  const out: BatchItem[] = [];
  layer.grid.forEach((row, j) =>
    row.forEach((id, i) => {
      if (id) out.push({ id, x: layer.x + i * TILE, y: layer.y + j * TILE });
    })
  );
  return out;
}

export const Tilemap = memo(function Tilemap({
  atlas,
  ground,
  decor,
  overhang,
  clock,
  children,
}: {
  atlas: AtlasName;
  ground: TileLayer;
  /** Decor sprites (anchored at their feet), drawn above the ground. */
  decor?: BatchItem[];
  /** Drawn last, over characters. */
  overhang?: BatchItem[];
  clock?: SharedValue<number>;
  /** Characters and objects between decor and overhang. */
  children?: React.ReactNode;
}) {
  const g = useMemo(() => tileItems(ground), [ground]);
  return (
    <>
      <SpriteBatch atlas={atlas} items={g} clock={clock} />
      {decor && <SpriteBatch atlas={atlas} items={decor} clock={clock} />}
      {children}
      {overhang && <SpriteBatch atlas={atlas} items={overhang} clock={clock} />}
    </>
  );
});
