// Every biome's content, bottom to top, and their built maps (memoised).

import { BIOME_IDS, BiomeId } from '../../../domain/game/biomes';
import { astral } from './astral';
import { desert } from './desert';
import { forest } from './forest';
import { frost } from './frost';
import { iron } from './iron';
import { BiomeDef, BiomeMap, buildBiome } from './layout';
import { swamp } from './swamp';
import { volcano } from './volcano';

export const BIOMES: Record<BiomeId, BiomeDef> = { forest, swamp, desert, frost, iron, volcano, astral };

let maps: BiomeMap[] | null = null;
/** Every biome's map, index 0 (the forest, at the bottom) first. */
export function biomeMaps(): BiomeMap[] {
  if (!maps) maps = BIOME_IDS.map((id) => buildBiome(BIOMES[id]));
  return maps;
}

export * from './layout';
