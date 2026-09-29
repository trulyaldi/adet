// The journey's biomes, bottom to top, as the rules see them (ids and twists).
// Art, maps, names of mobs and lore live in src/game/content.

export const BIOME_IDS = ['forest', 'swamp', 'desert', 'frost', 'iron', 'volcano', 'astral'] as const;
export type BiomeId = (typeof BIOME_IDS)[number];
export const BIOME_COUNT = BIOME_IDS.length;

/** What each biome's twist does (see twists.ts). */
export const TWISTS: Record<BiomeId, string> = {
  forest: 'Tutorial: a gentle boss; the fog clears as it weakens.',
  swamp: 'Sessions of 25+ unbroken minutes deal ×1.2.',
  desert: 'A completed weak point makes a session deal ×1.5; none, ×0.75.',
  frost: "The first 10 minutes of each day's first session deal ×2.",
  iron: 'Sessions started before noon deal ×1.25.',
  volcano: 'Days of 1–4 hours deal ×1.3; a session after a rest day is Rested (×1.2). The Drake can’t be ground down in a day.',
  astral: 'Sessions with a chronicle entry deal ×1.25.',
};

export function biomeAt(index: number): BiomeId {
  return BIOME_IDS[((index % BIOME_COUNT) + BIOME_COUNT) % BIOME_COUNT];
}

export function isBiomeId(v: unknown): v is BiomeId {
  return typeof v === 'string' && (BIOME_IDS as readonly string[]).includes(v);
}

/** Achievement ref for a biome run: "<biome>:<loop>". */
export const biomeRef = (biome: BiomeId, loop: number) => `${biome}:${loop}`;

export function parseBiomeRef(ref: string): { biome: BiomeId; loop: number } | null {
  const [b, l] = ref.split(':');
  const loop = Number(l);
  if (!isBiomeId(b) || !Number.isInteger(loop) || loop < 0) return null;
  return { biome: b, loop };
}
