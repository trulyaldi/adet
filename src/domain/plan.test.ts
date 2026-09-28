import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_CONFIG } from './config';
import { selectStats, selectTimer } from './engine';
import { Frequency } from './frequency';
import { clampBudgetMin, clampPlanCap, completionOf, completionOn, doneBefore, doneThrough, habitDaySec } from './plan';
import { Habit, PersistedState, Session } from './types';

// Monday Sep 28, 2026, noon.
const MON = new Date(2026, 8, 28, 12, 0).getTime();
const at = (month: number, day: number, h = 9) => new Date(2026, month, day, h, 0).getTime();

export function habit(id: string, full: number, min: number, frequency: Frequency = { kind: 'daily' }): Habit {
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
  };
}

export function sess(id: string, habitId: string, start: number, min: number): Session {
  return { id, habitId, start, end: start + min * 60_000, duration: min * 60 };
}

export function state(habits: Habit[], sessions: Session[] = [], extra: Partial<PersistedState> = {}): PersistedState {
  return {
    schemaVersion: 4,
    projects: [{ id: 'p1', name: 'P', weeklyTarget: 8, started: 0 }],
    habits,
    sessions,
    active: null,
    historyClearedAt: 0,
    plans: {},
    planSince: '2026-01-01',
    streakCarry: null,
    rebalancePending: false,
    ...extra,
  };
}

test('completion: the minimum counts as done, the full length as full', () => {
  const h = habit('a', 30, 5);
  assert.equal(completionOf(h, 0), null);
  assert.equal(completionOf(h, 4 * 60 + 59), null);
  assert.equal(completionOf(h, 5 * 60), 'min');
  assert.equal(completionOf(h, 29 * 60), 'min');
  assert.equal(completionOf(h, 30 * 60), 'full');
});

test('completion adds up the day: two short sessions reach the minimum', () => {
  const h = habit('a', 30, 5);
  const d = state([h], [sess('1', 'a', at(8, 28, 8), 3), sess('2', 'a', at(8, 28, 18), 3)]);
  const days = habitDaySec(d);
  assert.equal(completionOn(h, days, '2026-09-28'), 'min');
});

test('a running timer counts toward today', () => {
  const h = habit('a', 20, 5);
  const d = state([h], [], { active: { habitId: 'a', startedAt: MON - 6 * 60_000, baseSec: 0 } });
  assert.equal(completionOn(h, habitDaySec(d), '2026-09-28'), null, 'saved sessions only');
  assert.equal(completionOn(h, habitDaySec(d, MON), '2026-09-28'), 'min');
});

test('weekly counts: days done this week, before and through a day', () => {
  const h = habit('a', 30, 5, { kind: 'weekly', times: 3 });
  // Sun Sep 27 is last week; Mon, Tue (min), Wed done; Tue also has a second session.
  const d = state([h], [
    sess('0', 'a', at(8, 27), 30),
    sess('1', 'a', at(8, 28), 30),
    sess('2', 'a', at(8, 29), 5),
    sess('3', 'a', at(8, 29, 15), 2),
    sess('4', 'a', at(8, 30), 3),
  ]);
  const days = habitDaySec(d);
  assert.equal(doneBefore(h, days, '2026-09-28'), 0, 'last week does not count');
  assert.equal(doneBefore(h, days, '2026-09-30'), 2);
  assert.equal(doneThrough(h, days, '2026-09-30'), 2, 'Wed has only 3 minutes: not done');
  assert.equal(doneThrough(h, days, '2026-10-04'), 2);
});

test('timer: the ring fills toward the chosen length, counting earlier time today', () => {
  const h = habit('a', 30, 5);
  const d = state([h], [sess('1', 'a', at(8, 28, 8), 2)], { active: { habitId: 'a', startedAt: MON - 60_000, baseSec: 0 } });
  const toMin = selectTimer(d, DEFAULT_CONFIG, MON, 5)!;
  assert.equal(toMin.goalMin, 5);
  assert.equal(toMin.goalIsMin, true);
  assert.ok(Math.abs(toMin.ringProgress - 3 / 5) < 1e-9);
  assert.equal(toMin.reached, false);
  // No goal given (resumed timer): aims for the full length.
  const toFull = selectTimer(d, DEFAULT_CONFIG, MON)!;
  assert.equal(toFull.goalMin, 30);
  assert.equal(toFull.goalIsMin, false);
  const later = selectTimer(d, DEFAULT_CONFIG, MON + 2 * 60_000, 5)!;
  assert.equal(later.reached, true);
  assert.equal(later.ringProgress, 1);
});

test('history marks each habit-day once: solid for full, hollow for minimum', () => {
  const a = habit('a', 30, 5);
  const b = habit('b', 20, 10);
  const d = state([a, b], [
    sess('1', 'a', at(8, 27, 8), 20),
    sess('2', 'a', at(8, 27, 18), 15), // 35m that day: full
    sess('3', 'b', at(8, 27, 10), 12), // min
    sess('4', 'b', at(8, 26, 10), 4), // under the minimum: no mark, never a failure
  ]);
  const m = selectStats(d, DEFAULT_CONFIG, MON, { heatSel: null });
  const marks = m.historyRows.map((r) => [r.id, r.mark]);
  assert.deepEqual(marks, [
    ['2', 'full'],
    ['3', 'min'],
    ['1', null],
    ['4', null],
  ]);
  const day = selectStats(d, DEFAULT_CONFIG, MON, { heatSel: '2026-09-27' });
  assert.deepEqual(day.heatSelSessions.map((s) => [s.id, s.mark]), [
    ['1', null],
    ['3', 'min'],
    ['2', 'full'],
  ]);
});

test('budget: 15..180 minutes in 15-minute steps, 60 by default; cap: 1..5, 3 by default', () => {
  assert.equal(clampBudgetMin(undefined), 60);
  assert.equal(clampBudgetMin(0), 15);
  assert.equal(clampBudgetMin(52), 45);
  assert.equal(clampBudgetMin(53), 60);
  assert.equal(clampBudgetMin(500), 180);
  assert.equal(clampPlanCap(null), 3);
  assert.equal(clampPlanCap(0), 1);
  assert.equal(clampPlanCap(9), 5);
});
