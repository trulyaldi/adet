// Every tunable number in Quest Mode. Bump BALANCE_VERSION when a change
// alters derived results; stored achievements keep progress from going back.

export const BALANCE_VERSION = 2;

// ---- Sessions ---------------------------------------------------------------
/** Shorter sessions deal no damage, grant nothing and spawn no chest. */
export const MIN_SESSION_MIN = 10;

// ---- Burnout guard (per local day, qualifying sessions in start order) ------
/** Minutes that count at 100%. */
export const DAY_FULL_MIN = 240;
/** Minutes up to this count at HALF_RATE; beyond it, at 0%. */
export const DAY_HALF_MIN = 360;
export const HALF_RATE = 0.5;

// ---- Damage -----------------------------------------------------------------
export const CRIT_DAMAGE = 10;
/** Most weak points that crit per session. */
export const MAX_CRITS = 3;

// ---- Journey ----------------------------------------------------------------
/** Mob HP (effective minutes) = round(MOB_HP_BASE × MOB_HP_GROWTH^biomeIndex). */
export const MOB_HP_BASE = 90;
export const MOB_HP_GROWTH = 1.15;
/** Node kinds of every biome, in order: 3 mobs, the camp, 3 mobs, the boss. */
export const NODE_KINDS = ['mob', 'mob', 'mob', 'camp', 'mob', 'mob', 'mob', 'boss'] as const;
export const NODES_PER_BIOME = NODE_KINDS.length;
/** Which of the biome's 3 mobs stands on each node (camp and boss: -1). */
export const NODE_MOBS = [0, 1, 2, -1, 1, 0, 2, -1] as const;
/**
 * Boss HP = clamp(round(BOSS_HP_FACTOR × Σ weekly target minutes × BOSS_HP_GROWTH^biomeIndex), MIN, MAX),
 * except the tutorial boss. Tuned with `npm run game:balance` (the spec's starting 1.5 × weekly, flat
 * across biomes, made the last biomes too quick; see PLAN.md).
 */
export const BOSS_HP_FACTOR = 1.1;
export const BOSS_HP_GROWTH = 1.15;
export const BOSS_HP_MIN = 480;
export const BOSS_HP_MAX = 2400;
/** The tutorial boss (biome 1, first loop). */
export const FIRST_BOSS_HP = 420;

// ---- Seals: what a boss needs besides HP (0 disables one) --------------------
/** Distinct local days with a qualifying session against the boss, by biome index. */
export const SEAL_DAYS = [3, 4, 5, 5, 6, 6, 7] as const;
/** Sessions of at least DEPTH_MIN focused minutes against the boss. */
export const SEAL_DEPTH = [1, 2, 2, 3, 3, 4, 4] as const;
export const DEPTH_MIN = 45;
/** Completed weak points plus chronicle entries with text, against the boss. */
export const SEAL_INSIGHT = [2, 3, 4, 5, 6, 7, 8] as const;
/** Boss HP multiplier per ascension loop. */
export const ASCENSION_HP_MULT = 1.2;

// ---- Biome twists (only while that biome is active) --------------------------
/** Swamp: sessions of this many unbroken minutes… */
export const SWAMP_UNBROKEN_MIN = 25;
export const SWAMP_MULT = 1.2;
/** Desert: with ≥1 completed weak point / without. */
export const DESERT_WITH_TASK = 1.5;
export const DESERT_WITHOUT_TASK = 0.75;
/** Frost: the first minutes of each day's first qualifying session deal double. */
export const FROST_FIRST_MIN = 10;
export const FROST_MULT = 2;
/** Iron: sessions started before this local hour… */
export const IRON_BEFORE_HOUR = 12;
export const IRON_MULT = 1.25;
/** Volcano: days with effective minutes in [MIN, MAX] deal ×DAY_MULT. */
export const VOLCANO_DAY_MIN = 60;
export const VOLCANO_DAY_MAX = 240;
export const VOLCANO_DAY_MULT = 1.3;
/** Volcano: the day after a zero-minute day is "Rested". */
export const VOLCANO_RESTED_MULT = 1.2;
/** Volcano: the Burnout Drake takes at most this share of its HP per day (no grinding it down). */
export const VOLCANO_BOSS_DAILY_SHARE = 1 / 3;
/** Astral: sessions whose chest was claimed with a chronicle entry. */
export const ASTRAL_MULT = 1.25;

// ---- XP, levels, skills ------------------------------------------------------
export const XP_PER_MIN = 1;
/** Of the session's XP, when its chest is claimed with a chronicle entry. */
export const REFLECTION_XP_SHARE = 0.2;
export const TASK_XP = 15;
/** A quick log with a line (no session): small XP, and Insight against a boss. */
export const QUICK_LOG_XP = 3;
/** Quick logs rewarded per local day; more are still saved, without reward. */
export const QUICK_LOG_DAILY_CAP = 3;
export const BOSS_XP = 100;
/** Cumulative XP for level L is LEVEL_XP_BASE × (L−1)². */
export const LEVEL_XP_BASE = 100;
/** Skill (per habit) level L needs SKILL_XP_BASE × (L−1)² effective minutes. */
export const SKILL_XP_BASE = 25;

// ---- Credits -----------------------------------------------------------------
/** One credit per this many effective minutes (floored, per session). */
export const CREDIT_MINUTES = 10;
export const CHRONICLE_CREDITS = 2;
export const BOSS_CREDITS = 25;
/** Granted once when the journey starts, so anyone can buy something on day one. */
export const WELCOME_CREDITS = 50;

// ---- Chests ------------------------------------------------------------------
/** An unopened chest younger than this badges the Quest tab. */
export const FRESH_CHEST_MS = 24 * 3600_000;

// ---- Ranks -------------------------------------------------------------------
/** Rank titles by the first level they start at; index = avatar gear tier. */
export const RANKS = [
  { title: 'Wanderer', fromLevel: 1 },
  { title: 'Squire', fromLevel: 3 },
  { title: 'Knight', fromLevel: 6 },
  { title: 'Captain', fromLevel: 10 },
  { title: 'Warden', fromLevel: 15 },
  { title: 'Lord', fromLevel: 20 },
  { title: 'Legend', fromLevel: 27 },
] as const;
export type RankTitle = (typeof RANKS)[number]['title'];
