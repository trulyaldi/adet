// Logical sprite ids → frames and animations. Game code only ever names
// sprites by id (e.g. `boss.swamp.hydra.idle`, `npc.sage.talk`,
// `tile.forest.ground.a`), never by file. Node-safe: no images here (see
// atlasSources.ts for those).

import { BIOME_IDS, BiomeId } from '../../domain/game/biomes';
import { GEAR_SKUS, PET_SKUS, SHOP, FIRE_STYLES } from '../content/shop';
import { bossId, mobId, NPC_IDS, ROSTER } from '../content/roster';
import { AtlasName, ATLAS_SIZES, RAW_SPRITES } from './frames.generated';

export type { AtlasName };
export { ATLAS_SIZES };

export interface SpriteMeta {
  id: string;
  atlas: AtlasName;
  /** Frames as [x, y, w, h] in the atlas. */
  frames: [number, number, number, number][];
  w: number;
  h: number;
  fps: number;
  loop: boolean;
  /** Anchor from the frame's top-left (usually bottom centre: the feet). */
  ax: number;
  ay: number;
  additive: boolean;
}

const cache = new Map<string, SpriteMeta>();

export function hasSprite(id: string): boolean {
  return id in RAW_SPRITES;
}

/** A sprite's metadata; unknown ids fall back to a 1-pixel sprite (never crash a screen). */
export function sprite(id: string): SpriteMeta {
  let m = cache.get(id);
  if (m) return m;
  const raw = RAW_SPRITES[id] ?? RAW_SPRITES['fx.pixel'];
  const [atlas, frames, fps, loop, ax, ay, additive] = raw;
  m = { id, atlas, frames, w: frames[0][2], h: frames[0][3], fps, loop: loop === 1, ax, ay, additive: additive === 1 };
  cache.set(id, m);
  return m;
}

/** The frame index of an animation at `ms` (non-looping ones hold their last frame). */
export function frameAt(m: SpriteMeta, ms: number): number {
  const n = m.frames.length;
  if (n <= 1 || m.fps <= 0) return 0;
  const i = Math.floor((ms / 1000) * m.fps);
  return m.loop ? i % n : Math.min(n - 1, i);
}

// ---------------------------------------------------------------------------
// Every id the game refers to. A test checks each one resolves.

export const DECOR = ['tree.a', 'tree.b', 'bush', 'rock', 'flowers', 'tuft', 'mushrooms', 'landmark', 'light'] as const;
export type DecorName = (typeof DECOR)[number];

export function biomeIds(b: BiomeId): string[] {
  const r = ROSTER[b];
  return [
    ...r.mobs.flatMap((m) => [`${mobId(b, m.key)}.idle`, `${mobId(b, m.key)}.idle@flash`, `${mobId(b, m.key)}.idle@flip`, `${mobId(b, m.key)}.hurt`]),
    `${bossId(b)}.idle`,
    `${bossId(b)}.idle@flash`,
    `${bossId(b)}.hurt`,
    `${bossId(b)}.low`,
    `trophy.${b}`,
    ...r.critters.flatMap((c) => [`critter.${b}.${c}.idle`, `critter.${b}.${c}.idle@flip`, `critter.${b}.${c}.hop`, `critter.${b}.${c}.hop@flip`]),
    `villager.${b}.idle`,
    ...['a', 'b', 'c'].map((v) => `tile.${b}.ground.${v}`),
    `tile.${b}.path.edge`,
    `tile.${b}.path.fill`,
    `tile.${b}.edge.l.a`,
    `tile.${b}.edge.l.b`,
    `tile.${b}.edge.r.a`,
    `tile.${b}.edge.r.b`,
    `tile.${b}.liquid`,
    ...DECOR.map((d) => `decor.${b}.${d}`),
    `prop.${b}.gate.closed`,
    `prop.${b}.gate.open`,
    `prop.${b}.grave`,
    `prop.${b}.flag`,
    `parallax.${b}.cloud`,
    `parallax.${b}.far.a`,
    `parallax.${b}.far.b`,
  ];
}

export const TIERS = 7;

export const REQUIRED_IDS: string[] = [
  ...BIOME_IDS.flatMap(biomeIds),
  'avatar.body',
  'avatar.pip',
  'avatar.weapon.staff',
  'avatar.weapon.basic',
  ...Array.from({ length: TIERS }, (_, t) => `avatar.outfit.${t}`),
  ...GEAR_SKUS.map((s) => `avatar.${s}`),
  ...PET_SKUS.flatMap((s) => [`${s}.idle`, `${s}.idle@flip`]),
  ...NPC_IDS.flatMap((n) => [`npc.${n}.idle`, `npc.${n}.talk`]),
  ...FIRE_STYLES.flatMap((f) => [`prop.campfire.${f}.lit`, `prop.campfire.${f}.embers`]),
  'prop.chest.closed',
  'prop.chest.bounce',
  'prop.chest.open',
  'prop.board',
  'prop.shadow',
  'fx.sparkle',
  'fx.dust',
  'fx.hit',
  'fx.glow.warm',
  'fx.glow.cool',
  'fx.glow.small',
  'fx.fog',
  'fx.pixel',
  ...['sword', 'quill', 'coin', 'xp', 'chest', 'lock', 'freeze', 'check', 'heart', 'rested', 'star'].map((i) => `icon.${i}`),
  ...SHOP.map((s) => s.icon),
];

/** Avatar back layers exist only for tiers that have one. */
export const backLayer = (tier: number): string | null => (hasSprite(`avatar.back.${tier}`) ? `avatar.back.${tier}` : null);
