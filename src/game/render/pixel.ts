// The pixel rules every renderer follows: nearest-neighbour sampling,
// integer scales, positions on the game-pixel grid.

import { FilterMode, MipmapMode } from '@shopify/react-native-skia';

export const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;

export { MIN_WORLD_W, pixelScale, snap } from './grid';
