// deriveGameState: the whole game from sessions and stored user actions.
// Pure and deterministic; nothing here is stored except what the watcher
// writes back from `newAchievements` (append-only).

import { achievementId, AchievementProps, isQuickLog, Item, itemsOfType, Link } from '../items/types';
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
  /** Local days ('YYYY-MM-DD') whose plan was completed (the Today ring full). */
  goalDays?: readonly string[];
  /** Weeks (their first day, 'YYYY-MM-DD') in which every weekly target was met. */
  bountyWeeks?: readonly string[];
}

/** The most XP a day of sessions can earn (the burnout guard's bands). */
export const DAY_SESSION_XP_MAX = (DAY_FULL_MIN + (DAY_HALF_MIN - DAY_FULL_MIN) * HALF_RATE) * XP_PER_MIN;
/** Non-session XP allowed per local day. */
export const DAY_ACTIVITY_XP_MAX = Math.round(DAY_SESSION_XP_MAX * B.ACTIVITY_XP_SHARE);

export interface ActivityRewards {
  /** Quick logs with a line that earned XP (after both caps). */
  quickLogXp: number;
  /** Weak points done outside a session. */
  outsideTaskXp: number;
  goalDays: number;
  bounties: number;
  xp: number;
  credits: number;
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
  /** A boss brought to 0 HP whose seals aren't all filled yet. */
  staggered?: boolean;
}

export type SealKind = 'days' | 'depth' | 'insight';
export interface SealState {
  kind: SealKind;
  have: number;
  need: number;
}

export interface BossDefeat {
  biome: BiomeId;
  loop: number;
  /** Epoch ms. */
  at: number;
  /**
   * The session that landed the blow (or the quick log that filled a staggered
   * boss's last seal), or null when only an achievement records it.
   */
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
  /** The front enemy is a boss at 0 HP waiting for its seals (it never heals). */
  staggered: boolean;
  /** Seals of the current biome's boss (enabled ones only), filled by sessions fought against it. */
  seals: SealState[];
  /** Enemies ahead in this biome that surplus damage has already softened. */
  softened: { global: number; hp: number; maxHp: number }[];
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
  /** Boss-defeat achievements already recorded in items, for ceremonies. */
  bossAchievements: string[];
  /** What activity outside sessions earned (v2 N7.4). */
  activity: ActivityRewards;
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

const MOB_HP_BY_BIOME = Array.from({ length: BIOME_COUNT }, (_, i) => Math.round(B.MOB_HP_BASE * B.MOB_HP_GROWTH ** i));

/** Mob HP for a biome (effective minutes). */
export function mobHp(biomeIndex: number): number {
  return MOB_HP_BY_BIOME[biomeIndex] ?? Math.round(B.MOB_HP_BASE * B.MOB_HP_GROWTH ** biomeIndex);
}

// Hot-loop copies (a module namespace read is a getter call in some bundlers).
const NODES = B.NODES_PER_BIOME;
const KINDS = B.NODE_KINDS;
const DEPTH_MIN = B.DEPTH_MIN;

const SEAL_TARGETS: Record<SealKind, number>[] = B.SEAL_DAYS.map((days, i) => ({ days, depth: B.SEAL_DEPTH[i], insight: B.SEAL_INSIGHT[i] }));

/** The seals a biome's boss needs (0 disables one). */
export function sealTargets(biomeIndex: number): Record<SealKind, number> {
  return { ...SEAL_TARGETS[Math.max(0, Math.min(SEAL_TARGETS.length - 1, biomeIndex))] };
}

/** Boss HP for a biome run, from the weekly target minutes. */
export function bossHp(biomeIndex: number, loop: number, weeklyTargetMin: number): number {
  const base =
    biomeIndex === 0 && loop === 0
      ? B.FIRST_BOSS_HP
      : Math.min(B.BOSS_HP_MAX, Math.max(B.BOSS_HP_MIN, Math.round(B.BOSS_HP_FACTOR * Math.max(0, weeklyTargetMin) * B.BOSS_HP_GROWTH ** biomeIndex)));
  return Math.round(base * B.ASCENSION_HP_MULT ** loop);
}

export function nodeMaxHp(n: NodeRef, weeklyTargetMin: number): number {
  if (n.kind === 'camp') return 0;
  if (n.kind === 'boss') return bossHp(n.biomeIndex, n.loop, weeklyTargetMin);
  return mobHp(n.biomeIndex);
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
  // Quick logs (no session), oldest first; the first few with a line each day are rewarded.
  const quick: { id: string; at: number; rewarded: boolean }[] = [];
  const quickPerDay = new Map<string, number>();
  for (const l of itemsOfType(input.items, 'log')) {
    if (!isQuickLog(l)) logs.set(l.props.sessionId, l.body);
    else quick.push({ id: l.id, at: l.createdAt, rewarded: !!l.body.trim() });
  }
  quick.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  for (const q of quick) {
    if (!q.rewarded) continue;
    const d = tz.dayKey(q.at);
    const n = quickPerDay.get(d) ?? 0;
    q.rewarded = n < B.QUICK_LOG_DAILY_CAP;
    quickPerDay.set(d, n + 1);
  }
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
  // One enemy falls per session at most (R1). Surplus damage carries down the
  // path, never taking an enemy below 1 HP, until it is absorbed: nothing is
  // discarded. A boss also needs its seals (R3); at 0 HP without them it is
  // staggered (R4): it doesn't heal, and later sessions fill the seals.
  let pos = nodeAt(0);
  const soft = new Map<number, number>(); // damage already dealt to enemies ahead of the front
  /** Max HP of node `g`, without building its NodeRef (the walk calls this a lot). */
  const maxAt = (g: number) => {
    const inLoop = g % PER_LOOP;
    const node = inLoop % NODES;
    const kind = KINDS[node];
    if (kind === 'mob') return MOB_HP_BY_BIOME[Math.floor(inLoop / NODES)];
    if (kind === 'camp') return 0;
    return bossHp(Math.floor(inLoop / NODES), Math.floor(g / PER_LOOP), target);
  };
  const hpAt = (g: number) => maxAt(g) - (soft.get(g) ?? 0);
  let hp = hpAt(0);
  // Every enemy after the front and before `frontier` is down to 1 HP (or is a
  // camp): surplus skips straight past them. Enemies only lose HP, so it only
  // moves forward (the burnout guard keeps the walk short, but a long run of
  // softened enemies would otherwise be re-walked by every session).
  let frontier = 1;
  const settleFrontier = () => {
    if (frontier <= pos.global) frontier = pos.global + 1;
    for (;;) {
      const max = maxAt(frontier);
      if (max > 0 && max - (soft.get(frontier) ?? 0) > 1) break;
      frontier++;
    }
  };
  const advance = (to: number) => {
    // Walk past nodes with no HP (the camp); a softened node keeps its damage.
    pos = nodeAt(to);
    while (nodeMaxHp(pos, target) <= 0) pos = nodeAt(pos.global + 1);
    hp = hpAt(pos.global);
    soft.delete(pos.global);
    settleFrontier();
  };
  advance(0);
  // Seals per boss encounter (its biome run), from sessions fought against it.
  const seals = new Map<string, { days: Set<string>; depth: number; insight: number }>();
  const sealOf = (n: NodeRef) => {
    const k = biomeRef(n.biome, n.loop);
    let v = seals.get(k);
    if (!v) seals.set(k, (v = { days: new Set(), depth: 0, insight: 0 }));
    return v;
  };
  const sealsMet = (n: NodeRef) => {
    const t = SEAL_TARGETS[Math.max(0, Math.min(SEAL_TARGETS.length - 1, n.biomeIndex))];
    const v = sealOf(n);
    return v.days.size >= t.days && v.depth >= t.depth && v.insight >= t.insight;
  };
  const defeats = new Map<string, BossDefeat>();
  const defeatBoss = (n: NodeRef, at: number, sessionId: string | null) => {
    const ref = biomeRef(n.biome, n.loop);
    if (!defeats.has(ref)) defeats.set(ref, { biome: n.biome, loop: n.loop, at, sessionId });
  };
  let snapIdx = 0;
  const snapTo = (until: number) => {
    // Recorded bosses keep progress from ever going back (a balance change can't un-defeat one).
    while (snapIdx < storedBosses.length && storedBosses[snapIdx].at < until) {
      const sb = storedBosses[snapIdx++];
      const ref = biomeRef(sb.biome, sb.loop);
      if (!defeats.has(ref)) defeats.set(ref, { biome: sb.biome, loop: sb.loop, at: sb.at, sessionId: null });
      if (pos.global <= sb.global) {
        for (const g of [...soft.keys()]) if (g <= sb.global) soft.delete(g);
        advance(sb.global + 1);
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
  let qi = 0;
  /** Rewarded quick logs up to `until`: XP always; Insight against a boss on the journey. */
  const flushQuick = (until: number) => {
    for (; qi < quick.length && quick[qi].at < until; qi++) {
      const l = quick[qi];
      if (!l.rewarded || startedAt === null || l.at < startedAt) continue;
      snapTo(l.at);
      if (pos.kind !== 'boss') continue;
      sealOf(pos).insight++;
      if (hp <= 0 && sealsMet(pos)) {
        defeatBoss(pos, l.at, l.id);
        advance(pos.global + 1);
      }
    }
  };

  for (const s of byEnd) {
    flushQuick(s.end);
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
      let felled = false;
      // Seals: a session fought against the boss (the front enemy before its damage).
      if (pos.kind === 'boss') {
        const v = sealOf(pos);
        v.days.add(day);
        if (s.duration / 60 >= DEPTH_MIN) v.depth++;
        v.insight += c.completed + (hasChronicle ? 1 : 0);
        // A staggered boss whose seals are now filled falls to this session.
        if (hp <= 0 && sealsMet(pos)) {
          hits.push({ node: pos, damage: 0, defeated: true });
          defeatBoss(pos, s.end, s.id);
          felled = true;
          advance(pos.global + 1);
        }
      }
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
      let g = pos.global;
      while (left > 0) {
        const front = g === pos.global;
        if (!front && g < frontier) {
          g = frontier;
          continue;
        }
        const max = maxAt(g);
        if (max <= 0) {
          g++;
          continue;
        }
        const n = front ? pos : nodeAt(g);
        const cur = front ? hp : hpAt(g);
        // Only the front enemy can fall, and only once per session; the rest stop at 1 HP.
        const floor = front && !felled ? 0 : 1;
        let take = Math.min(left, Math.max(0, cur - floor));
        if (n.kind === 'boss' && n.biome === 'volcano') {
          const cap = Math.ceil(max * VOLCANO_BOSS_DAILY_SHARE);
          const key = `${n.global}:${day}`;
          const used = drakeDay.get(key) ?? 0;
          take = Math.min(take, Math.max(0, cap - used));
          drakeDay.set(key, used + take);
        }
        if (take > 0) {
          left -= take;
          damage += take;
          if (front) hp -= take;
          else {
            soft.set(g, (soft.get(g) ?? 0) + take);
            if (g === frontier && cur - take <= 1) settleFrontier();
          }
        }
        if (front && hp <= 0 && !felled) {
          if (n.kind === 'boss' && !sealsMet(n)) {
            // Staggered: it stays the front enemy; the surplus walks on past it.
            if (take > 0) hits.push({ node: n, damage: take, defeated: false, staggered: true });
            g++;
            continue;
          }
          hits.push({ node: n, damage: take, defeated: true });
          if (n.kind === 'boss') defeatBoss(n, s.end, s.id);
          felled = true;
          advance(g + 1);
          g = pos.global;
          continue;
        }
        if (take > 0) hits.push({ node: n, damage: take, defeated: false });
        g++;
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
  flushQuick(Infinity);
  snapTo(Infinity);

  // ---- activity outside sessions ----
  const activity = activityRewards(input, tz, startedAt, quick, completed);
  xpTotal += activity.xp;
  earned += activity.credits;

  // Bosses: XP and credits, whichever way they were beaten.
  const defeated = [...defeats.values()].sort((a, b) => a.at - b.at || a.loop - b.loop);
  xpTotal += BOSS_XP * defeated.length;
  if (startedAt !== null) earned += BOSS_CREDITS * defeated.length;

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
  const targets = sealTargets(pos.biomeIndex);
  const have = sealOf(bossPos);
  const sealList: SealState[] = (['days', 'depth', 'insight'] as const)
    .filter((k) => targets[k] > 0)
    .map((k) => ({ kind: k, need: targets[k], have: k === 'days' ? have.days.size : have[k] }));
  const softened = [...soft.entries()]
    .filter(([gl]) => gl > pos.global && gl <= bossPos.global)
    .sort((a, b) => a[0] - b[0])
    .map(([gl]) => ({ global: gl, hp: hpAt(gl), maxHp: nodeMaxHp(nodeAt(gl), target) }));
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
      staggered: pos.kind === 'boss' && hp <= 0,
      seals: sealList,
      softened,
    },
    chests: { unopened, hasFreshChest: unopened.some((c) => c.fresh) },
    sessions: results,
    newAchievements,
    bossAchievements: [...new Set(storedBosses.map((d) => biomeRef(d.biome, d.loop)))],
    activity,
  };
}

/**
 * Rewards for what happens outside sessions (v2 N7.4), derived from current
 * data: quick logs with a line, weak points completed outside any session,
 * completed day plans and weeks with every target met. On the journey only
 * (from startedAt). Per-kind caps first, then the day's non-session XP is held
 * to DAY_ACTIVITY_XP_MAX. Deleting a completed weak point removes its XP, the
 * way deleting a session does.
 */
function activityRewards(
  input: DeriveInput,
  tz: GameTz,
  startedAt: number | null,
  quick: readonly { id: string; at: number; rewarded: boolean }[],
  completedIn: ReadonlyMap<string, number>
): ActivityRewards {
  const none: ActivityRewards = { quickLogXp: 0, outsideTaskXp: 0, goalDays: 0, bounties: 0, xp: 0, credits: 0 };
  if (startedAt === null) return none;
  const startDay = tz.dayKey(startedAt);
  // Events in time order, per local day.
  const inSession = new Set<string>();
  for (const l of input.links) if (l.kind === 'completed_in' && l.toType === 'session' && completedIn.has(l.toId)) inSession.add(l.fromId);
  const events: { at: number; kind: 'quick' | 'task' }[] = [];
  for (const q of quick) if (q.rewarded && q.at >= startedAt) events.push({ at: q.at, kind: 'quick' });
  for (const t of itemsOfType(input.items, 'task')) {
    if (t.props.status !== 'done' || !t.props.doneAt || inSession.has(t.id)) continue;
    const at = parseIso(t.props.doneAt);
    if (at !== null && at >= startedAt) events.push({ at, kind: 'task' });
  }
  events.sort((a, b) => a.at - b.at);
  const tasksPerDay = new Map<string, number>();
  const xpPerDay = new Map<string, number>();
  let quickLogXp = 0;
  let outsideTaskXp = 0;
  for (const e of events) {
    const day = tz.dayKey(e.at);
    let gain = B.QUICK_LOG_XP;
    if (e.kind === 'task') {
      const n = tasksPerDay.get(day) ?? 0;
      tasksPerDay.set(day, n + 1);
      if (n >= B.OUTSIDE_TASK_DAILY_CAP) continue;
      gain = B.OUTSIDE_TASK_XP;
    }
    const used = xpPerDay.get(day) ?? 0;
    const take = Math.max(0, Math.min(gain, DAY_ACTIVITY_XP_MAX - used));
    if (!take) continue;
    xpPerDay.set(day, used + take);
    if (e.kind === 'quick') quickLogXp += take;
    else outsideTaskXp += take;
  }
  const goalDays = new Set((input.goalDays ?? []).filter((d) => d >= startDay)).size;
  // A week counts once its first day is on or after the journey's start week.
  const bounties = new Set((input.bountyWeeks ?? []).filter((w) => addDaysKey(w, 6) >= startDay)).size;
  const xp = quickLogXp + outsideTaskXp + bounties * B.BOUNTY_XP;
  return { quickLogXp, outsideTaskXp, goalDays, bounties, xp, credits: goalDays * B.GOAL_DAY_CREDITS + bounties * B.BOUNTY_CREDITS };
}

/** 'YYYY-MM-DD' plus n days (calendar arithmetic, no time zone). */
function addDaysKey(k: string, n: number): string {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
