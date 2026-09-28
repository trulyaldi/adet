import { clampMinMin, DAILY, defaultMinMin, parseFrequency } from './frequency';
import { seed } from './seed';
import { DEFAULT_BUDGET_MIN, DEFAULT_PLAN_CAP, habitDaySec, PlanSettings } from './plan';
import { dailyStreak, dayRecords, planStreak } from './streaks';
import { addDays, dkey } from './time';
import { DEFAULT_PREFS, parsePrefs } from './capacity';
import { Badge, CURRENT_SCHEMA_VERSION, DailyLog, DayOverride, Mark, PersistedState, StreakCarry } from './types';

/**
 * The streak under the pre-v4 rule (any tracked time, monthly freezes), kept
 * as a carry. Its day is the last day that streak counted: today if already
 * tracked, else yesterday (so finishing today still adds one).
 */
function legacyCarry(sessions: any[], now: number): StreakCarry | null {
  const dayMap: Record<string, number> = {};
  for (const s of sessions) {
    if (typeof s?.start !== 'number' || typeof s?.duration !== 'number') continue;
    const k = dkey(new Date(s.start));
    dayMap[k] = (dayMap[k] || 0) + s.duration;
  }
  const old = dailyStreak(dayMap, now);
  if (!old.current && !old.longest) return null;
  const today = dkey(new Date(now));
  const day = (dayMap[today] || 0) > 0 ? today : dkey(addDays(new Date(now), -1));
  return { current: old.current, longest: old.longest, day };
}

/** Device settings the old rules depended on (the v4 daily budget and cap). */
export interface MigrationContext {
  planSettings: PlanSettings;
}

const DEFAULT_CONTEXT: MigrationContext = { planSettings: { budgetMin: DEFAULT_BUDGET_MIN, planCap: DEFAULT_PLAN_CAP } };

/**
 * The streak a v4 build showed (plan-based, rest days, its own carry), kept
 * as the v5 carry so the new rules never show less. Its day is today when
 * today already counted, else yesterday.
 */
function v4Carry(s: any, now: number, ctx: MigrationContext): StreakCarry | null {
  const state = {
    ...s,
    habits: s.habits || [],
    sessions: s.sessions || [],
    projects: s.projects || [],
    plans: s.plans || {},
    planSince: typeof s.planSince === 'string' ? s.planSince : dkey(new Date(now)),
  } as PersistedState;
  const today = dkey(new Date(now));
  const carry = s.streakCarry && typeof s.streakCarry.current === 'number' ? (s.streakCarry as StreakCarry) : null;
  const old = planStreak(dayRecords(state, habitDaySec(state, now), today, ctx.planSettings), today, carry);
  if (!old.current && !old.longest) return null;
  const day = old.marks.get(today) === 'complete' ? today : dkey(addDays(new Date(now), -1));
  return { current: old.current, longest: old.longest, day };
}

export const MIGRATIONS: Array<(s: any, now: number, ctx: MigrationContext) => any> = [
  (s: any) => {
    const { goals: _goals, ...rest } = s;
    return {
      ...rest,
      schemaVersion: 2,
      projects: (s.projects || s.goals).map((p: any) => ({
        id: p.id,
        name: p.name,
        weeklyTarget: p.weeklyTarget || 8,
        started: p.started || null,
      })),
      habits: (s.habits || []).map((h: any) => ({
        ...h,
        projectId: h.projectId || h.goalId,
      })),
    };
  },
  (s: any) => ({
    ...s,
    schemaVersion: 3,
    habits: (s.habits || []).map((h: any) => ({
      ...h,
      dailyTargetMin: h.dailyTargetMin ?? 30,
      weeklyTargetMin: h.weeklyTargetMin ?? ((h.dailyTargetMin ?? 30) * 5),
    })),
  }),
  // v4: every habit keeps its daily behavior (nothing changes silently; the
  // rebalance screen offers the one-time change), gets a minimum of 5 minutes
  // or its full length if shorter, and the old streak is kept as a floor.
  (s: any, now: number) => ({
    ...s,
    schemaVersion: 4,
    habits: (s.habits || []).map((h: any) => ({
      ...h,
      frequency: h.frequency ? parseFrequency(h.frequency) : DAILY,
      minTargetMin: h.minTargetMin != null ? clampMinMin(h.minTargetMin, h.dailyTargetMin) : defaultMinMin(h.dailyTargetMin),
    })),
    plans: {},
    planSince: dkey(new Date(now)),
    streakCarry: legacyCarry(s.sessions || [], now),
    rebalancePending: (s.habits || []).length > 0,
  }),
  // v5: the redesign. Every existing habit is timed (its length becomes a
  // target marker, not a deadline); done marks start empty; days from the
  // update on are planned by capacity; the streak the old rules showed
  // becomes the floor for the new ones.
  (s: any, now: number, ctx: MigrationContext) => ({
    ...s,
    schemaVersion: 5,
    streakCarry: v4Carry(s, now, ctx),
    planSince: dkey(new Date(now)),
    habits: (s.habits || []).map((h: any) => ({ ...h, kind: h.kind === 'check' ? 'check' : 'timed' })),
    marks: Array.isArray(s.marks) ? s.marks : [],
    prefs: s.prefs ?? DEFAULT_PREFS,
    dailyLogs: Array.isArray(s.dailyLogs) ? s.dailyLogs : [],
    badges: Array.isArray(s.badges) ? s.badges : [],
    days: s.days && typeof s.days === 'object' ? s.days : {},
    // Milestones already reached are recorded quietly on first load.
    badgesPrimed: false,
    // The welcome flow's rebalance step replaces the v4 rebalance screen.
    rebalancePending: false,
  }),
];

export function migrate(state: any, fromVersion: number, now: number, ctx: MigrationContext = DEFAULT_CONTEXT): any {
  let migrated = state;
  for (let version = Math.max(1, Math.floor(fromVersion)); version < CURRENT_SCHEMA_VERSION; version++) {
    migrated = MIGRATIONS[version - 1](migrated, now, ctx);
  }
  return migrated;
}

/** Local-only plan state as saved, with anything malformed dropped. */
function plansOf(v: unknown): Record<string, string[]> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, string[]> = {};
  for (const [k, ids] of Object.entries(v as Record<string, unknown>)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(ids)) out[k] = ids.filter((x): x is string => typeof x === 'string');
  }
  return out;
}

/** Saved marks, with anything malformed dropped. */
function marksOf(v: unknown): Mark[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (m): m is Mark => !!m && typeof m.id === 'string' && typeof m.habitId === 'string' && typeof m.day === 'string'
  );
}

/** Saved daily logs, with anything malformed dropped. */
function logsOf(v: unknown): DailyLog[] {
  if (!Array.isArray(v)) return [];
  return v.filter((l): l is DailyLog => !!l && typeof l.id === 'string' && Array.isArray(l.items));
}

/** Saved badges, with anything malformed dropped. */
function badgesOf(v: unknown): Badge[] {
  if (!Array.isArray(v)) return [];
  return v.filter((b): b is Badge => !!b && typeof b.id === 'string' && typeof b.earnedAt === 'number');
}

/** Local per-day overrides, keeping only well-formed recent ones. */
function daysOf(v: unknown): Record<string, DayOverride> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, DayOverride> = {};
  for (const [k, o] of Object.entries(v as Record<string, any>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !o || typeof o !== 'object') continue;
    const ids = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : undefined);
    out[k] = {
      ...(ids(o.order) ? { order: ids(o.order) } : {}),
      ...(ids(o.aside) ? { aside: ids(o.aside) } : {}),
      ...(o.level === 'light' || o.level === 'normal' || o.level === 'heavy' ? { level: o.level } : {}),
      ...(o.prompted === true ? { prompted: true } : {}),
    };
  }
  return out;
}

export function hydrate(
  raw: { v3: string | null; v2: string | null },
  now: number,
  ctx: MigrationContext = DEFAULT_CONTEXT
): PersistedState {
  const cameFromV3 = raw.v3 !== null;
  const value = cameFromV3 ? raw.v3 : raw.v2;
  let saved: any = null;

  try {
    saved = value ? JSON.parse(value) : null;
  } catch {
    saved = null;
  }

  const list = saved && (saved.projects || saved.goals);
  // A stamped state with no projects is a deliberately empty account (e.g. the
  // seed was discarded on first sign-in); only unstamped/legacy empties re-seed.
  const emptyLegacy = Array.isArray(list) && !list.length && typeof saved.schemaVersion !== 'number';
  if (!saved || !Array.isArray(list) || emptyLegacy) return seed(now);

  const sourceVersion =
    typeof saved.schemaVersion === 'number'
      ? saved.schemaVersion
      : cameFromV3
        ? 2
        : 1;
  const migrated = migrate(saved, sourceVersion, now, ctx);
  const projects = migrated.projects.map((p: any) => ({ ...p }));
  const habits = migrated.habits || [];
  const sessions = migrated.sessions || [];

  for (const p of projects) {
    if (p.started) continue;
    const hids = habits
      .filter((h: any) => h.projectId === p.id)
      .map((h: any) => h.id);
    let min: number | null = null;
    for (const s of sessions) {
      if (hids.includes(s.habitId) && (min === null || s.start < min)) min = s.start;
    }
    p.started = min || now;
  }

  const carry = migrated.streakCarry;
  return {
    ...migrated,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects,
    habits,
    sessions,
    marks: marksOf(migrated.marks),
    prefs: parsePrefs(migrated.prefs),
    dailyLogs: logsOf(migrated.dailyLogs),
    badges: badgesOf(migrated.badges),
    active: migrated.active || null,
    historyClearedAt: migrated.historyClearedAt || 0,
    plans: plansOf(migrated.plans),
    planSince: typeof migrated.planSince === 'string' ? migrated.planSince : dkey(new Date(now)),
    streakCarry:
      carry && typeof carry.current === 'number' && typeof carry.longest === 'number' && typeof carry.day === 'string'
        ? { current: carry.current, longest: carry.longest, day: carry.day }
        : null,
    rebalancePending: migrated.rebalancePending === true,
    days: daysOf(migrated.days),
    badgesPrimed: migrated.badgesPrimed !== false,
  };
}

/**
 * The fields saved to device storage (everything else in memory is derived).
 * Local-only fields (plans, planSince, the streak carry, the rebalance flag)
 * are saved here too; they're never synced.
 */
export function persistedSlice(data: PersistedState): PersistedState {
  const { schemaVersion, projects, habits, sessions, marks, prefs, dailyLogs, badges, active, historyClearedAt } = data;
  const { plans, planSince, streakCarry, rebalancePending, days, badgesPrimed } = data;
  return {
    schemaVersion,
    projects,
    habits,
    sessions,
    marks,
    prefs,
    dailyLogs,
    badges,
    active,
    historyClearedAt,
    plans,
    planSince,
    streakCarry,
    rebalancePending,
    days,
    badgesPrimed,
  };
}
