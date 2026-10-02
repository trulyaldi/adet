// Every tunable number in Quest Mode. Bump BALANCE_VERSION when a change
// alters derived results; stored achievements keep progress from going back.

export const BALANCE_VERSION = 4;

// ---- Sessions ---------------------------------------------------------------
/** Shorter sessions deal no damage, grant nothing and spawn no chest. */
export const MIN_SESSION_MIN = 10;

// ---- Burnout guard (per local day, qualifying sessions in start order) ------
/** Minutes that count at 100%. */
export const DAY_FULL_MIN = 240;
/** Minutes up to this count at HALF_RATE; beyond it, at 0%. */
export const DAY_HALF_MIN = 360;
export const HALF_RATE = 0.5;

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

/** Boss HP multiplier per ascension loop. */
export const ASCENSION_HP_MULT = 1.2;

// ---- Biome twists (only while that biome is active) --------------------------
/** Swamp: sessions of this many unbroken minutes… */
export const SWAMP_UNBROKEN_MIN = 25;
export const SWAMP_MULT = 1.2;
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
/** A quick log with a line (no session): small XP. */
export const QUICK_LOG_XP = 3;
/** Quick logs rewarded per local day; more are still saved, without reward. */
export const QUICK_LOG_DAILY_CAP = 3;

// ---- Activity outside sessions (v2 N7.4; from the journey's start) ----------
/** The day's plan completed (the Today ring full): once per local day. */
export const GOAL_DAY_CREDITS = 5;
/** Every weekly target met (the Stats hero relaxed): once per week. */
export const BOUNTY_CREDITS = 40;
export const BOUNTY_XP = 60;
/**
 * Non-session XP (quick logs)
 * never exceeds this share of the most XP a day of sessions can earn.
 */
export const ACTIVITY_XP_SHARE = 0.1;
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

// ---- World Mode: realms, quests and results (world-2) -----------------------
/** Biome slots a realm can claim (one realm each). */
export const MAX_REALMS = 7;
/** Every quest's hearts (fixed). Partly takes one, never the last; only Done clears. */
export const QUEST_HEARTS = 3;
/** Phases that make a quest a boss (fewer: it fights as a mob). */
export const BOSS_MIN_PHASES = 2;
/** A result can be taken back for this long. */
export const RESULT_UNDO_MS = 6000;
/** Credits when a mob or a phase is cleared (once per quest, on the journey). */
export const CLEAR_CREDITS = 5;
/** Credits when a boss falls (its last phase cleared), on top of that phase's. */
export const BOSS_DEFEAT_CREDITS = 25;
