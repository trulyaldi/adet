// Fixtures shared by the domain tests (not a test file itself).

import { DEFAULT_PREFS } from './capacity';
import { Frequency } from './frequency';
import { Habit, PersistedState, Session } from './types';

export function habit(id: string, full: number, min: number, frequency: Frequency = { kind: 'daily' }, extra: Partial<Habit> = {}): Habit {
  return {
    id,
    projectId: 'p1',
    name: id.toUpperCase(),
    icon: 'book',
    tile: '#fff',
    dailyTargetMin: full,
    weeklyTargetMin: full * 7,
    frequency,
    minTargetMin: min,
    ...extra,
  };
}

export function sess(id: string, habitId: string, start: number, min: number): Session {
  return { id, habitId, start, end: start + min * 60_000, duration: min * 60 };
}

export function state(habits: Habit[], sessions: Session[] = [], extra: Partial<PersistedState> = {}): PersistedState {
  return {
    schemaVersion: 5,
    projects: [{ id: 'p1', name: 'P', weeklyTarget: 8, started: 0 }],
    habits,
    sessions,
    marks: [],
    prefs: DEFAULT_PREFS,
    dailyLogs: [],
    badges: [],
    items: [],
    links: [],
    active: null,
    historyClearedAt: 0,
    plans: {},
    planSince: '2026-01-01',
    streakCarry: null,
    rebalancePending: false,
    days: {},
    badgesPrimed: true,
    ...extra,
  };
}
