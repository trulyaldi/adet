// Who lives where: every mob, boss, critter, NPC and companion by id, and
// their display names. Art and maps refer to these ids. Pure data.

import type { BiomeId } from '../../domain/game/biomes';

export interface MobDef {
  key: string;
  name: string;
}

export interface BossDef {
  key: string;
  name: string;
  /** What it stands for (shown small, once). */
  represents: string;
}

export interface BiomeRoster {
  name: string;
  mobs: [MobDef, MobDef, MobDef];
  boss: BossDef;
  critters: string[];
}

export const ROSTER: Record<BiomeId, BiomeRoster> = {
  forest: {
    name: 'Whispering Forest',
    mobs: [
      { key: 'slime', name: 'Moss Slime' },
      { key: 'sprite', name: 'Thorn Sprite' },
      { key: 'imp', name: 'Mushroom Imp' },
    ],
    boss: { key: 'wisp', name: 'The Fog Wisp', represents: 'mental fog' },
    critters: ['rabbit', 'bird'],
  },
  swamp: {
    name: 'Mirewood Swamp',
    mobs: [
      { key: 'toad', name: 'Bog Toad' },
      { key: 'wraith', name: 'Leech Wraith' },
      { key: 'eel', name: 'Lantern Eel' },
    ],
    boss: { key: 'hydra', name: 'The Doomscroll Hydra', represents: 'distraction' },
    critters: ['frog', 'firefly'],
  },
  desert: {
    name: 'Sunscorch Desert',
    mobs: [
      { key: 'scarab', name: 'Sand Scarab' },
      { key: 'devil', name: 'Dust Devil' },
      { key: 'golem', name: 'Cactus Golem' },
    ],
    boss: { key: 'djinn', name: 'The Mirage Djinn', represents: 'busywork' },
    critters: ['lizard'],
  },
  frost: {
    name: 'Frostpeak',
    mobs: [
      { key: 'bat', name: 'Frost Bat' },
      { key: 'golem', name: 'Ice Golemling' },
      { key: 'wolf', name: 'Snow Wolf' },
    ],
    boss: { key: 'titan', name: 'The Frozen Titan', represents: 'inertia' },
    critters: ['fox'],
  },
  iron: {
    name: 'Iron Kingdom',
    mobs: [
      { key: 'knight', name: 'Rogue Knight' },
      { key: 'golem', name: 'Paper Golem' },
      { key: 'crow', name: 'Crow Herald' },
    ],
    boss: { key: 'king', name: 'King Tomorrow', represents: 'procrastination' },
    critters: ['pigeon'],
  },
  volcano: {
    name: 'Emberdeep Volcano',
    mobs: [
      { key: 'slug', name: 'Magma Slug' },
      { key: 'imp', name: 'Ash Imp' },
      { key: 'hound', name: 'Cinder Hound' },
    ],
    boss: { key: 'drake', name: 'The Burnout Drake', represents: 'overwork' },
    critters: ['beetle'],
  },
  astral: {
    name: 'Astral Citadel',
    mobs: [
      { key: 'moth', name: 'Star Moth' },
      { key: 'shade', name: 'Void Shade' },
      { key: 'sentinel', name: 'Clockwork Sentinel' },
    ],
    boss: { key: 'echo', name: 'The Hollow Echo', represents: 'self-doubt' },
    critters: ['wisp'],
  },
};

/** NPC ids → default names (Kazakh roots; renamed in one place, or in Quest settings). */
export const NPCS = {
  sage: { name: 'Aqyl', title: 'the Owl', meaning: 'ақыл, "wisdom"' },
  merchant: { name: 'Saudager', title: 'the Fox', meaning: 'саудагер, "merchant"' },
  scribe: { name: 'Hatshy', title: 'the Tortoise', meaning: 'хатшы, "scribe"' },
} as const;
export type NpcId = keyof typeof NPCS;
export const NPC_IDS = Object.keys(NPCS) as NpcId[];

export const mobId = (biome: BiomeId, key: string) => `mob.${biome}.${key}`;
export const bossId = (biome: BiomeId) => `boss.${biome}.${ROSTER[biome].boss.key}`;
