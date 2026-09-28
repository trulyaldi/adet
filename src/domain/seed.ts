// Seed dataset — ported from the design's seed(). Generates ~90 days of
// deterministic sample sessions so a fresh install has something to show.

import { DEFAULT_PREFS } from './capacity';
import { addDays, dkey, rand } from './time';
import {
  CURRENT_SCHEMA_VERSION,
  Habit,
  PersistedState,
  Project,
  Session,
} from './types';

export function seed(now: number = Date.now()): PersistedState {
  const projects: Project[] = [
    { id: 'g1', name: 'Become ML Engineer', weeklyTarget: 12, started: null },
  ];
  // Key order matches what the migrations produce (new fields last), so a
  // seed saved by an older version still reads as untouched (see isUntouchedSeed).
  const habits: Habit[] = [
    { id: 'h1', projectId: 'g1', name: 'Coding', icon: 'code', tile: '#E4E0F7', dailyTargetMin: 60, weeklyTargetMin: 300, frequency: { kind: 'daily' }, minTargetMin: 5, kind: 'timed' },
    { id: 'h2', projectId: 'g1', name: 'LeetCode', icon: 'target', tile: '#D9F2E3', dailyTargetMin: 30, weeklyTargetMin: 150, frequency: { kind: 'daily' }, minTargetMin: 5, kind: 'timed' },
    { id: 'h3', projectId: 'g1', name: 'Reading', icon: 'book', tile: '#FDE4D5', dailyTargetMin: 30, weeklyTargetMin: 150, frequency: { kind: 'daily' }, minTargetMin: 5, kind: 'timed' },
    { id: 'h4', projectId: 'g1', name: 'Portfolio', icon: 'briefcase', tile: '#FADCE8', dailyTargetMin: 30, weeklyTargetMin: 120, frequency: { kind: 'daily' }, minTargetMin: 5, kind: 'timed' },
  ];
  const sessions: Session[] = [];
  const nowD = new Date(now);
  let sid = 1;
  for (let i = 1; i <= 90; i++) {
    const day = addDays(nowD, -i);
    habits.forEach((h, j) => {
      const r = rand(i * 7 + j * 13);
      if (r < 0.58) {
        const mins = 15 + Math.floor(rand(i * 31 + j * 17 + 5) * 90);
        const startH = 8 + Math.floor(rand(i * 11 + j * 23) * 12);
        const start = new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          startH,
          Math.floor(r * 59)
        ).getTime();
        sessions.push({
          id: 's' + sid++,
          habitId: h.id,
          start,
          end: start + mins * 60000,
          duration: mins * 60,
        });
      }
    });
  }
  const t = new Date(
    nowD.getFullYear(),
    nowD.getMonth(),
    nowD.getDate(),
    9,
    10
  ).getTime();
  sessions.push({
    id: 's' + sid++,
    habitId: 'h2',
    start: t,
    end: t + 32 * 60000,
    duration: 32 * 60,
    notes: 'Two mediums, one hard',
  });

  // Backfill project.started from earliest session (mirrors load()).
  for (const p of projects) {
    const hids = habits.filter((h) => h.projectId === p.id).map((h) => h.id);
    let min: number | null = null;
    for (const s of sessions) {
      if (hids.includes(s.habitId) && (min === null || s.start < min)) min = s.start;
    }
    p.started = min || now;
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects,
    habits,
    sessions,
    marks: [],
    prefs: DEFAULT_PREFS,
    dailyLogs: [],
    active: null,
    historyClearedAt: 0,
    plans: {},
    planSince: dkey(nowD),
    streakCarry: null,
    rebalancePending: false,
    days: {},
  };
}

/** dkey re-export kept close to seed for tests. */
export { dkey };
