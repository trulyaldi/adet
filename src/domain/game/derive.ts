// deriveGameState: the whole game from sessions and stored user actions.
// Pure and deterministic; nothing here is stored except what the watcher
// writes back from `newAchievements` (append-only).

import { achievementId, AchievementProps, Item, itemsOfType, Link } from '../items/types';
import type { Habit, Session } from '../types';
import * as B from './balance';
import {
  BOSS_CREDITS,
  BOSS_XP,
  CHRONICLE_CREDITS,
  CREDIT_MINUTES,
  CRIT_DAMAGE,
  DAY_FULL_MIN,
  DAY_HALF_MIN,
  FRESH_CHEST_MS,
  HALF_RATE,
  MAX_CRITS,
  MIN_SESSION_MIN,
  REFLECTION_XP_SHARE,
  TASK_XP,
  VOLCANO_BOSS_DAILY_SHARE,
  XP_PER_MIN,
} from './balance';
import { BiomeId, biomeAt, BIOME_COUNT, BIOME_IDS, biomeRef, parseBiomeRef } from './biomes';
import { LevelInfo, levelFromXp, RankInfo, rankForLevel, skillLevel } from './level';
import { twistDamage } from './twists';
import { DEVICE_TZ, GameTz, prevDayKey } from './tz';

export interface DeriveInput {
  sessions: readonly Session[];
  /** Current habits (skills; a habit with history but no longer here is retired). */
  habits: readonly Pick<Habit, 'id' | 'weeklyTargetMin'>[];
  items: readonly Item[];
  links: readonly Link[];
  now: number;
  tz?: GameTz;
  /** Σ weekly target minutes across active habits (boss HP). Default: Σ over `habits`. */
  weeklyTargetMin?: number;
}

export type NodeKind = (typeof B.NODE_KINDS)[number];

/** A node on the journey. `global` counts every node from the very first, across loops. */
export interface NodeRef {
  global: number;
  loop: number;
  biomeIndex: number;
  biome: BiomeId;
  /** 0 … NODES_PER_BIOME − 1 within the biome. */
  node: number;
  kind: NodeKind;
  /** The biome mob roster slot on a mob node, else −1. */
  mob: number;
}

export interface NodeHit {
  node: NodeRef;
  damage: number;
  defeated: boolean;
}

export interface BossDefeat {
  biome: BiomeId;
  loop: number;
  /** Epoch ms. */
  at: number;
  /** The session that landed the blow, or null when only an achievement records it. */
  sessionId: string | null;
}

export interface SessionResult {
  sessionId: string;
  habitId: string;
  start: number;
  end: number;
  /** Local day of the start. */
  day: string;
  /** Focused minutes. */
  minutes: number;
  /** After the burnout guard. */
  effMin: number;
  /** Ended after the quest started: moves the journey, earns credits, has a chest. */
  onJourney: boolean;
  claimed: boolean;
  /** The chronicle entry's text ('' when only boxes were ticked), or null. */
  chronicle: string | null;
  /** Weak points completed in it. */
  completedTasks: number;
  /** Twist-adjusted base damage (applies right away). */
  baseDamage: number;
  /** From completed weak points (once claimed). */
  critDamage: number;
  /** What actually landed (a Drake's daily limit can swallow some). */
  damage: number;
  /** The biome active when its damage landed (journey sessions). */
  biome: BiomeId | null;
  loop: number;
  hits: NodeHit[];
  xp: number;
  credits: number;
}

export interface SkillState extends LevelInfo {
  habitId: string;
  /** Effective minutes on the habit. */
  minutes: number;
  /** The habit was deleted; its history still counts. */
  retired: boolean;
}

export interface ChestState {
  sessionId: string;
  habitId: string;
  end: number;
  fresh: boolean;
  /** What opening could add: crits need weak points, the rest a chronicle line. */
  effMin: number;
}

export interface JourneyState {
  started: boolean;
  /** Epoch ms of quest_meta.startedAt, or null. */
  startedAt: number | null;
  /** The node being fought. */
  position: NodeRef;
  hp: number;
  maxHp: number;
  /** Max HP of the current biome's boss. */
  bossMaxHp: number;
  /** Total damage dealt on the journey. */
  totalDamage: number;
  /** Every boss beaten (derived or recorded), oldest first. */
  defeated: BossDefeat[];
}

export interface GameState {
  balanceVersion: number;
  xp: LevelInfo & { total: number };
  rank: RankInfo;
  skills: SkillState[];
  /** `earned` is from play; `welcome` is the one-time grant once the journey starts. */
  credits: { earned: number; welcome: number; spent: number; balance: number };
  journey: JourneyState;
  chests: { unopened: ChestState[]; hasFreshChest: boolean };
  /** Qualifying sessions, oldest first. */
  sessions: SessionResult[];
  /** Milestones reached but not stored yet (the watcher appends them). */
  newAchievements: AchievementProps[];
}

// ---------------------------------------------------------------------------
// Journey geometry
// ---------------------------------------------------------------------------

const PER_LOOP = BIOME_COUNT * B.NODES_PER_BIOME;

export function nodeAt(global: number): NodeRef {
  const g = Math.max(0, Math.floor(global));
  const loop = Math.floor(g / PER_LOOP);
  const inLoop = g % PER_LOOP;
  const biomeIndex = Math.floor(inLoop / B.NODES_PER_BIOME);
  const node = inLoop % B.NODES_PER_BIOME;
  return { global: g, loop, biomeIndex, biome: biomeAt(biomeIndex), node, kind: B.NODE_KINDS[node], mob: B.NODE_MOBS[node] };
}

export function bossGlobal(biomeIndex: number, loop: number): number {
  return loop * PER_LOOP + biomeIndex * B.NODES_PER_BIOME + (B.NODES_PER_BIOME - 1);
}

/** Boss HP for a biome run, from the weekly target minutes. */
export function bossHp(biomeIndex: number, loop: number, weeklyTargetMin: number): number {
  const base =
    biomeIndex === 0 && loop === 0
      ? B.FIRST_BOSS_HP
      : Math.min(B.BOSS_HP_MAX, Math.max(B.BOSS_HP_MIN, Math.round(B.BOSS_HP_FACTOR * Math.max(0, weeklyTargetMin))));
  return Math.round(base * B.ASCENSION_HP_MULT ** loop);
}

export function nodeMaxHp(n: NodeRef, weeklyTargetMin: number): number {
  if (n.kind === 'camp') return 0;
  if (n.kind === 'boss') return bossHp(n.biomeIndex, n.loop, weeklyTargetMin);
  return B.MOB_HP;
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

const iso = (ms: number) => new Date(ms).toISOString();
const parseIso = (s: string | undefined): number | null => {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};

interface ClaimInfo {
  claimed: boolean;
  chronicle: string | null;
  completed: number;
}

const NO_CLAIM: ClaimInfo = { claimed: false, chronicle: null, completed: 0 };

export function deriveGameState(input: DeriveInput): GameState {
  const tz = input.tz ?? DEVICE_TZ;
  const target = input.weeklyTargetMin ?? input.habits.reduce((a, h) => a + (h.weeklyTargetMin || 0), 0);

  // ---- stored actions ----
  const meta = itemsOfType(input.items, 'quest_meta')[0] ?? null;
  const startedAt = meta ? parseIso(meta.props.startedAt) : null;
  const claims = new Set<string>();
  for (const c of itemsOfType(input.items, 'chest_claim')) claims.add(c.props.sessionId);
  const logs = new Map<string, string>();
  for (const l of itemsOfType(input.items, 'log')) logs.set(l.props.sessionId, l.body);
  const completed = new Map<string, number>();
  for (const l of input.links) if (l.kind === 'completed_in' && l.toType === 'session') completed.set(l.toId, (completed.get(l.toId) ?? 0) + 1);
  const spent = itemsOfType(input.items, 'purchase').reduce((a, p) => a + (p.props.cost || 0), 0);
  const storedIds = new Set(itemsOfType(input.items, 'achievement').map((a) => a.id));
  const storedBosses: { global: number; at: number; biome: BiomeId; loop: number }[] = [];
  for (const a of itemsOfType(input.items, 'achievement')) {
    if (a.props.kind !== 'boss_defeated') continue;
    const r = parseBiomeRef(a.props.ref);
    if (!r) continue;
    const biomeIndex = BIOME_IDS.indexOf(r.biome);
    storedBosses.push({ global: bossGlobal(biomeIndex, r.loop), at: parseIso(a.props.at) ?? 0, biome: r.biome, loop: r.loop });
  }
  storedBosses.sort((a, b) => a.at - b.at || a.global - b.global);

  const claimOf = (id: string): ClaimInfo => {
    const claimed = claims.has(id);
    return { claimed, chronicle: logs.has(id) ? logs.get(id)! : null, completed: claimed ? completed.get(id) ?? 0 : 0 };
  };

  // ---- qualifying sessions and the burnout guard (start order per day) ----
  const qualifying = input.sessions.filter((s) => s.duration / 60 >= MIN_SESSION_MIN);
  const byStart = [...qualifying].sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));
  const dayCum = new Map<string, number>();
  const dayEff = new Map<string, number>();
  const effOf = new Map<string, number>();
  const dayOf = new Map<string, string>();
  const firstOfDay = new Set<string>();
  for (const s of byStart) {
    const day = tz.dayKey(s.start);
    const m = s.duration / 60;
    const cum = dayCum.get(day) ?? 0;
    if (!dayCum.has(day)) firstOfDay.add(s.id);
    const full = Math.max(0, Math.min(cum + m, DAY_FULL_MIN) - Math.min(cum, DAY_FULL_MIN));
    const half = Math.max(0, Math.min(cum + m, DAY_HALF_MIN) - Math.max(cum, DAY_FULL_MIN));
    const eff = full + half * HALF_RATE;
    dayCum.set(day, cum + m);
    dayEff.set(day, (dayEff.get(day) ?? 0) + eff);
    effOf.set(s.id, eff);
    dayOf.set(s.id, day);
  }

  // ---- the journey, in end order ----
  let pos = nodeAt(0);
  let hp = nodeMaxHp(pos, target);
  const settle = () => {
    // Nodes with no HP left (the camp, a beaten node) are walked past.
    while (hp <= 0) {
      pos = nodeAt(pos.global + 1);
      hp = nodeMaxHp(pos, target);
    }
  };
  settle();
  const defeats = new Map<string, BossDefeat>();
  let snapIdx = 0;
  const snapTo = (until: number) => {
    // Recorded bosses keep progress from ever going back (a balance change can't un-defeat one).
    while (snapIdx < storedBosses.length && storedBosses[snapIdx].at < until) {
      const sb = storedBosses[snapIdx++];
      const ref = biomeRef(sb.biome, sb.loop);
      if (!defeats.has(ref)) defeats.set(ref, { biome: sb.biome, loop: sb.loop, at: sb.at, sessionId: null });
      if (pos.global <= sb.global) {
        pos = nodeAt(sb.global + 1);
        hp = nodeMaxHp(pos, target);
        settle();
      }
    }
  };
  const drakeDay = new Map<string, number>();
  const prevEff = new Map<string, number>();
  const prevDayEff = (day: string) => {
    let v = prevEff.get(day);
    if (v === undefined) prevEff.set(day, (v = dayEff.get(prevDayKey(day)) ?? 0));
    return v;
  };
  let totalDamage = 0;

  const byEnd = [...qualifying].sort((a, b) => a.end - b.end || (a.id < b.id ? -1 : 1));
  const results: SessionResult[] = [];
  let xpTotal = 0;
  let earned = 0;

  for (const s of byEnd) {
    const eff = effOf.get(s.id)!;
    const day = dayOf.get(s.id)!;
    const onJourney = startedAt !== null && s.end >= startedAt;
    // Chests (and their bonuses) belong to the journey only; history before it counts for XP alone.
    const c = onJourney ? claimOf(s.id) : NO_CLAIM;
    const hasChronicle = c.claimed && !!c.chronicle && c.chronicle.trim().length > 0;
    let baseDamage = 0;
    let critDamage = 0;
    let damage = 0;
    const hits: NodeHit[] = [];
    let biome: BiomeId | null = null;
    let loop = 0;

    if (onJourney) {
      snapTo(s.end);
      biome = pos.biome;
      loop = pos.loop;
      baseDamage = Math.round(
        twistDamage(pos.biome, {
          effMin: eff,
          minutes: s.duration / 60,
          unbroken: s.end - s.start - s.duration * 1000 <= 60_000,
          completedTasks: c.completed,
          hasChronicle,
          firstOfDay: firstOfDay.has(s.id),
          startHour: tz.hour(s.start),
          dayEffMin: dayEff.get(day) ?? 0,
          prevDayEffMin: prevDayEff(day),
        })
      );
      critDamage = c.claimed ? Math.min(MAX_CRITS, c.completed) * CRIT_DAMAGE : 0;
      let left = baseDamage + critDamage;
      while (left > 0) {
        let take = Math.min(left, hp);
        const isDrake = pos.kind === 'boss' && pos.biome === 'volcano';
        if (isDrake) {
          const cap = Math.ceil(nodeMaxHp(pos, target) * VOLCANO_BOSS_DAILY_SHARE);
          const used = drakeDay.get(day) ?? 0;
          take = Math.min(take, Math.max(0, cap - used));
          drakeDay.set(day, used + take);
        }
        if (take <= 0) break; // the Drake has had enough for today
        hp -= take;
        left -= take;
        damage += take;
        const defeated = hp <= 0;
        hits.push({ node: pos, damage: take, defeated });
        if (defeated) {
          if (pos.kind === 'boss') {
            const ref = biomeRef(pos.biome, pos.loop);
            if (!defeats.has(ref)) defeats.set(ref, { biome: pos.biome, loop: pos.loop, at: s.end, sessionId: s.id });
          }
          settle();
        }
      }
      totalDamage += damage;
    }

    // XP counts all history; credits count the journey.
    const baseXp = Math.round(eff * XP_PER_MIN);
    let xp = baseXp + c.completed * TASK_XP;
    if (hasChronicle) xp += Math.round(baseXp * REFLECTION_XP_SHARE);
    let credits = 0;
    if (onJourney) {
      credits = Math.floor(eff / CREDIT_MINUTES);
      if (hasChronicle) credits += CHRONICLE_CREDITS;
    }
    xpTotal += xp;
    earned += credits;
    results.push({
      sessionId: s.id,
      habitId: s.habitId,
      start: s.start,
      end: s.end,
      day,
      minutes: s.duration / 60,
      effMin: eff,
      onJourney,
      claimed: c.claimed,
      chronicle: c.chronicle,
      completedTasks: c.completed,
      baseDamage,
      critDamage,
      damage,
      biome,
      loop,
      hits,
      xp,
      credits,
    });
  }
  snapTo(Infinity);

  // Bosses: XP and credits, whichever way they were beaten.
  const defeated = [...defeats.values()].sort((a, b) => a.at - b.at || a.loop - b.loop);
  for (const d of defeated) {
    xpTotal += BOSS_XP;
    if (startedAt !== null) earned += BOSS_CREDITS;
  }

  // ---- levels, rank, skills ----
  const lv = levelFromXp(xpTotal);
  const rank = rankForLevel(lv.level);
  const skillMin = new Map<string, number>();
  for (const r of results) skillMin.set(r.habitId, (skillMin.get(r.habitId) ?? 0) + r.effMin);
  const current = new Set(input.habits.map((h) => h.id));
  const skills: SkillState[] = [];
  for (const h of input.habits) {
    const m = Math.round(skillMin.get(h.id) ?? 0);
    skills.push({ habitId: h.id, minutes: m, retired: false, ...skillLevel(m) });
  }
  for (const [id, min] of skillMin) {
    if (current.has(id)) continue;
    const m = Math.round(min);
    skills.push({ habitId: id, minutes: m, retired: true, ...skillLevel(m) });
  }

  // ---- chests ----
  const unopened: ChestState[] = [];
  for (let i = results.length - 1; i >= 0; i--) {
    const r = results[i];
    if (!r.onJourney || r.claimed) continue;
    unopened.push({ sessionId: r.sessionId, habitId: r.habitId, end: r.end, fresh: input.now - r.end < FRESH_CHEST_MS, effMin: r.effMin });
  }

  // ---- new achievements (derived, not stored yet) ----
  const newAchievements: AchievementProps[] = [];
  for (const d of defeated) {
    if (d.sessionId === null) continue;
    const ref = biomeRef(d.biome, d.loop);
    if (!storedIds.has(achievementId('boss_defeated', ref))) newAchievements.push({ kind: 'boss_defeated', ref, at: iso(d.at) });
  }

  const welcome = startedAt !== null ? B.WELCOME_CREDITS : 0;
  const bossPos = nodeAt(bossGlobal(pos.biomeIndex, pos.loop));
  return {
    balanceVersion: B.BALANCE_VERSION,
    xp: { total: xpTotal, ...lv },
    rank,
    skills,
    credits: { earned, welcome, spent, balance: Math.max(0, welcome + earned - spent) },
    journey: {
      started: startedAt !== null,
      startedAt,
      position: pos,
      hp,
      maxHp: nodeMaxHp(pos, target),
      bossMaxHp: nodeMaxHp(bossPos, target),
      totalDamage,
      defeated,
    },
    chests: { unopened, hasFreshChest: unopened.some((c) => c.fresh) },
    sessions: results,
    newAchievements,
  };
}
