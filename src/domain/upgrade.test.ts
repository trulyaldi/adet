// The update to daily plans, end to end on realistic old data: nine daily
// habits with timer lengths from 3 to 90 minutes, five months of history
// with an unbroken streak, a running timer, notes and manual logs, saved in
// the exact v3 shape the previous version wrote.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dailyStreak } from './streaks';
import { hydrate, persistedSlice } from './migrations';
import { habitDaySec, planMinutes } from './plan';
import { averageDailyMin, finishRebalance, suggestedFrequency } from './rebalance';
import { seed } from './seed';
import { dayRecords, planStreak } from './streaks';
import { isUntouchedSeed } from './sync';
import { addDays, dkey } from './time';
import { selectPlanToday } from './today';
import { PersistedState } from './types';
import { selectWeek } from './week';

// Wednesday Sep 30, 2026, 08:00.
const NOW = new Date(2026, 8, 30, 8, 0).getTime();
const SETTINGS = { budgetMin: 60, planCap: 3 };
const LENGTHS: [string, number][] = [
  ['Coding', 60],
  ['LeetCode', 30],
  ['Reading', 20],
  ['Portfolio', 45],
  ['Gym', 90],
  ['Meditate', 10],
  ['Walk', 25],
  ['Guitar', 15],
  ['Flashcards', 3],
];
const STREAK_DAYS = 150;

/** What the previous version saved: schema 3, no frequency, minimum or plans. */
function oldSave() {
  const habits = LENGTHS.map(([name, min], i) => ({
    id: 'h' + i,
    projectId: i < 5 ? 'p1' : 'p2',
    name,
    icon: 'book',
    tile: '#E4E0F7',
    dailyTargetMin: min,
    weeklyTargetMin: min * 5,
    updatedAt: 1_700_000_000_000 + i,
  }));
  const sessions: any[] = [];
  const today = new Date(NOW);
  for (let back = STREAK_DAYS; back >= 1; back--) {
    const day = addDays(today, -back);
    // Two or three habits a day, rotating; a different length each time.
    for (let j = 0; j < 2 + (back % 2); j++) {
      const h = habits[(back + j * 3) % habits.length];
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 7 + j * 4, 15).getTime();
      const minutes = 5 + ((back * 7 + j * 11) % 50);
      sessions.push({
        id: `s${back}-${j}`,
        habitId: h.id,
        start,
        end: start + minutes * 60_000,
        duration: minutes * 60,
        ...(back % 17 === 0 ? { notes: 'felt good' } : {}),
        ...(back % 23 === 0 ? { manual: true } : {}),
        updatedAt: 1_700_000_000_000,
      });
    }
  }
  return {
    schemaVersion: 3,
    projects: [
      { id: 'p1', name: 'Become ML Engineer', weeklyTarget: 12, started: sessions[0].start, updatedAt: 1_700_000_000_000 },
      { id: 'p2', name: 'Health', weeklyTarget: 5, started: sessions[0].start, updatedAt: 1_700_000_000_000 },
    ],
    habits,
    sessions,
    active: { habitId: 'h2', startedAt: NOW - 4 * 60_000, baseSec: 0, updatedAt: NOW - 4 * 60_000 },
    historyClearedAt: 1_700_000_000_500,
  };
}

function upgraded(): { old: ReturnType<typeof oldSave>; data: PersistedState } {
  const old = oldSave();
  return { old, data: hydrate({ v3: JSON.stringify(old), v2: null }, NOW) };
}

const streakOf = (d: PersistedState, now: number) => {
  const day = dkey(new Date(now));
  return planStreak(dayRecords(d, habitDaySec(d, now), day, SETTINGS), day, d.streakCarry);
};

test('upgrade: loads with nothing lost', () => {
  const { old, data } = upgraded();
  assert.equal(data.schemaVersion, 5);
  assert.deepEqual(data.projects, old.projects);
  assert.deepEqual(data.sessions, old.sessions, 'every session, note and manual flag kept as is');
  assert.deepEqual(data.active, old.active, 'the running timer keeps running');
  assert.equal(data.historyClearedAt, old.historyClearedAt);
  assert.equal(data.habits.length, 9);
  for (const [i, h] of data.habits.entries()) {
    const { frequency, minTargetMin, kind, ...rest } = h;
    assert.equal(kind, 'timed', 'every existing habit is timed');
    assert.deepEqual(rest, old.habits[i], `${h.name}: old fields unchanged`);
    assert.deepEqual(frequency, { kind: 'daily' }, 'daily habits stay every day');
    assert.equal(minTargetMin, Math.min(5, old.habits[i].dailyTargetMin));
  }
  assert.equal(isUntouchedSeed(data, seed(NOW)), false, 'real data is never mistaken for the sample');
});

test('upgrade: the long streak is kept, never lower under the new rules', () => {
  const { old, data } = upgraded();
  const oldMap: Record<string, number> = {};
  for (const s of old.sessions) oldMap[dkey(new Date(s.start))] = (oldMap[dkey(new Date(s.start))] || 0) + s.duration;
  const before = dailyStreak(oldMap, NOW);
  assert.equal(before.current, STREAK_DAYS);
  assert.deepEqual(data.streakCarry, { current: STREAK_DAYS, longest: STREAK_DAYS, day: '2026-09-29' });
  const s = streakOf(data, NOW);
  assert.equal(s.current, STREAK_DAYS);
  assert.ok(s.longest >= STREAK_DAYS);
});

test("upgrade: today's plan fits the cap and the budget, and finishing it by minimums completes the day", () => {
  const { data } = upgraded();
  const t = selectPlanToday(data, SETTINGS, NOW);
  assert.ok(t.plan.length <= 3 && t.plan.length > 0);
  assert.ok(t.plannedMin <= 60);
  assert.ok(!t.plan.some((c) => c.fullMin > 60), 'a 90-minute habit never fits a 60-minute day');
  assert.equal(t.complete, false);

  // Do each planned habit for its minimum only (the running timer is stopped first).
  const done: PersistedState = {
    ...data,
    active: null,
    plans: { ...data.plans, [t.day]: t.plan.map((c) => c.habitId) },
    sessions: [
      ...data.sessions,
      ...t.plan.map((c, i) => {
        const start = NOW + i * 600_000;
        return { id: 'today' + i, habitId: c.habitId, start, end: start + c.minMin * 60_000, duration: c.minMin * 60 };
      }),
    ],
  };
  const later = NOW + 3 * 3600_000;
  const after = selectPlanToday(done, SETTINGS, later);
  assert.equal(after.complete, true, 'minimums count as done');
  assert.ok(after.plan.every((c) => c.done === 'min' || c.done === 'full'));
  assert.equal(streakOf(done, later).current, STREAK_DAYS + 1);
  // The week view marks today complete.
  assert.equal(selectWeek(done, SETTINGS, later).cells[2].kind, 'complete');
});

test('upgrade: the rebalance brings the average day down, once', () => {
  const { data } = upgraded();
  assert.equal(data.rebalancePending, true);
  const before = averageDailyMin(data.habits);
  const after = averageDailyMin(data.habits, suggestedFrequency);
  assert.equal(before, 298);
  assert.ok(after < before);
  const chosen = Object.fromEntries(data.habits.map((h) => [h.id, suggestedFrequency(h)]));
  const applied = finishRebalance(data, chosen, dkey(new Date(NOW)));
  assert.deepEqual(
    applied.habits.filter((h) => h.frequency.kind === 'weekly').map((h) => h.name),
    ['Coding', 'Portfolio', 'Gym'],
    'only habits over 30 minutes'
  );
  assert.deepEqual(applied.sessions, data.sessions);
  assert.equal(applied.rebalancePending, false);

  // Saved and loaded again: stays v4, dismissed, and not migrated twice.
  const again = hydrate({ v3: JSON.stringify(persistedSlice(applied)), v2: null }, NOW + 60_000);
  assert.equal(again.rebalancePending, false);
  assert.deepEqual(again.streakCarry, applied.streakCarry);
  assert.deepEqual(again.habits, applied.habits);
  assert.deepEqual(again, persistedSlice(applied));
});

test('upgrade: plans survive a save and reload', () => {
  const { data } = upgraded();
  const t = selectPlanToday(data, SETTINGS, NOW);
  const pinned = { ...data, plans: { [t.day]: t.plan.map((c) => c.habitId) } };
  const again = hydrate({ v3: JSON.stringify(persistedSlice(pinned)), v2: null }, NOW + 1000);
  assert.deepEqual(again.plans, pinned.plans);
  assert.equal(planMinutes(again.plans[t.day], again), t.plannedMin);
});
