// Levels, ranks and skills from XP.

import { LEVEL_XP_BASE, RANKS, RankTitle, SKILL_XP_BASE } from './balance';

export interface LevelInfo {
  level: number;
  /** XP earned past the current level's threshold. */
  xpIntoLevel: number;
  /** XP from this level to the next. */
  xpForNextLevel: number;
}

/** Cumulative XP needed to reach `level` on a base × (L−1)² curve. */
export function xpForLevel(level: number, base = LEVEL_XP_BASE): number {
  return base * (level - 1) ** 2;
}

export function levelFromXp(xp: number, base = LEVEL_XP_BASE): LevelInfo {
  const x = Math.max(0, Math.floor(xp));
  let level = Math.floor(Math.sqrt(x / base)) + 1;
  // Guard float edges at exact thresholds.
  while (xpForLevel(level + 1, base) <= x) level++;
  while (level > 1 && xpForLevel(level, base) > x) level--;
  const from = xpForLevel(level, base);
  return { level, xpIntoLevel: x - from, xpForNextLevel: xpForLevel(level + 1, base) - from };
}

export function skillLevel(minutes: number): LevelInfo {
  return levelFromXp(minutes, SKILL_XP_BASE);
}

export interface RankInfo {
  title: RankTitle;
  /** 0–6: the avatar's gear tier. */
  tier: number;
  /** First level of the next rank, or null at Legend. */
  nextAt: number | null;
}

export function rankForLevel(level: number): RankInfo {
  let tier = 0;
  for (let i = 0; i < RANKS.length; i++) if (level >= RANKS[i].fromLevel) tier = i;
  return { title: RANKS[tier].title, tier, nextAt: tier + 1 < RANKS.length ? RANKS[tier + 1].fromLevel : null };
}
