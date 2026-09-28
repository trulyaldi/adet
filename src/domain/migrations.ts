import { clampMinMin, DAILY, defaultMinMin, parseFrequency } from './frequency';
import { seed } from './seed';
import { dailyStreak } from './streaks';
import { dkey } from './time';
import { CURRENT_SCHEMA_VERSION, PersistedState, StreakCarry } from './types';

/** The streak under the pre-v4 rule (any tracked time, monthly freezes), kept as a carry. */
function legacyCarry(sessions: any[], now: number): StreakCarry | null {
  const dayMap: Record<string, number> = {};
  for (const s of sessions) {
    if (typeof s?.start !== 'number' || typeof s?.duration !== 'number') continue;
    const k = dkey(new Date(s.start));
    dayMap[k] = (dayMap[k] || 0) + s.duration;
  }
  const old = dailyStreak(dayMap, now);
  if (!old.current && !old.longest) return null;
  return { current: old.current, longest: old.longest, day: dkey(new Date(now)) };
}

export const MIGRATIONS: Array<(s: any, now: number) => any> = [
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
];

export function migrate(state: any, fromVersion: number, now: number): any {
  let migrated = state;
  for (let version = Math.max(1, Math.floor(fromVersion)); version < CURRENT_SCHEMA_VERSION; version++) {
    migrated = MIGRATIONS[version - 1](migrated, now);
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

export function hydrate(
  raw: { v3: string | null; v2: string | null },
  now: number
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
  const migrated = migrate(saved, sourceVersion, now);
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
    active: migrated.active || null,
    historyClearedAt: migrated.historyClearedAt || 0,
    plans: plansOf(migrated.plans),
    planSince: typeof migrated.planSince === 'string' ? migrated.planSince : dkey(new Date(now)),
    streakCarry:
      carry && typeof carry.current === 'number' && typeof carry.longest === 'number' && typeof carry.day === 'string'
        ? { current: carry.current, longest: carry.longest, day: carry.day }
        : null,
    rebalancePending: migrated.rebalancePending === true,
  };
}
