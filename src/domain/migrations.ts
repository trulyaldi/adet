import { seed } from './seed';
import { CURRENT_SCHEMA_VERSION, PersistedState } from './types';

export const MIGRATIONS: Array<(s: any) => any> = [
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
];

export function migrate(state: any, fromVersion: number): any {
  let migrated = state;
  for (let version = Math.max(1, Math.floor(fromVersion)); version < CURRENT_SCHEMA_VERSION; version++) {
    migrated = MIGRATIONS[version - 1](migrated);
  }
  return migrated;
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
  if (!saved || !Array.isArray(list) || !list.length) return seed(now);

  const sourceVersion =
    typeof saved.schemaVersion === 'number'
      ? saved.schemaVersion
      : cameFromV3
        ? 2
        : 1;
  const migrated = migrate(saved, sourceVersion);
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

  return {
    ...migrated,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects,
    habits,
    sessions,
    active: migrated.active || null,
    historyClearedAt: migrated.historyClearedAt || 0,
  };
}
