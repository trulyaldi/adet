// The pixel rules every renderer follows: nearest-neighbour sampling,
// integer scales, positions on the game-pixel grid.

import { FilterMode, MipmapMode } from '@shopify/react-native-skia';

export const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;

/** Narrowest the world is ever shown, in game pixels. */
export const MIN_WORLD_W = 112;

/** The largest integer scale that still shows MIN_WORLD_W game pixels across `width` points. */
export function pixelScale(width: number, minWorld = MIN_WORLD_W): number {
  return Math.max(2, Math.min(8, Math.floor(width / minWorld)));
}

/** Snap to the game-pixel grid. */
export const snap = (v: number) => Math.round(v);
