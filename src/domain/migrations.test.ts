import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hydrate, migrate, MIGRATIONS } from './migrations';
import { seed } from './seed';
import { isUntouchedSeed } from './sync';
import { CURRENT_SCHEMA_VERSION } from './types';

const NOW = new Date(2026, 6, 10, 12, 0, 0).getTime();

test('has one migration for every schema version transition', () => {
  assert.equal(MIGRATIONS.length, CURRENT_SCHEMA_VERSION - 1);
});

test('hydrates v2-key legacy data through all migrations', () => {
  const early = NOW - 20_000;
  const late = NOW - 10_000;
  const result = hydrate(
    {
      v3: null,
      v2: JSON.stringify({
        goals: [{ id: 'g1', name: 'Learn', weeklyTarget: 10 }],
        habits: [
          { id: 'h1', goalId: 'g1', name: 'Read', icon: 'book', tile: '#fff' },
        ],
        sessions: [
          { id: 's2', habitId: 'h1', start: late, end: late + 1000, duration: 1 },
          { id: 's1', habitId: 'h1', start: early, end: early + 1000, duration: 1 },
        ],
      }),
    },
    NOW
  );

  assert.equal(result.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(result.projects, [
    { id: 'g1', name: 'Learn', weeklyTarget: 10, started: early },
  ]);
  assert.equal(result.habits[0].projectId, 'g1');
  assert.equal(result.habits[0].dailyTargetMin, 30);
  assert.equal(result.habits[0].weeklyTargetMin, 150);
  assert.equal('goals' in result, false);
});

test('hydrates unstamped v3-key data as v2 and preserves explicit targets', () => {
  const result = hydrate(
    {
      v3: JSON.stringify({
        projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: NOW }],
        habits: [
          { id: 'h1', projectId: 'p1', name: 'Read', icon: 'book', tile: '#fff' },
          {
            id: 'h2',
            projectId: 'p1',
            name: 'Write',
            icon: 'code',
            tile: '#eee',
            dailyTargetMin: 45,
            weeklyTargetMin: 180,
          },
        ],
      }),
      v2: null,
    },
    NOW
  );

  assert.equal(result.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(result.habits[0].dailyTargetMin, 30);
  assert.equal(result.habits[0].weeklyTargetMin, 150);
  assert.equal(result.habits[1].dailyTargetMin, 45);
  assert.equal(result.habits[1].weeklyTargetMin, 180);
});

test('already-current data passes through unchanged', () => {
  const saved = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: NOW - 1000 }],
    habits: [
      {
        id: 'h1',
        projectId: 'p1',
        name: 'Read',
        icon: 'book',
        tile: '#fff',
        dailyTargetMin: 25,
        weeklyTargetMin: 75,
        frequency: { kind: 'weekly', times: 3 },
        minTargetMin: 10,
        kind: 'check',
      },
    ],
    sessions: [],
    marks: [{ id: 'h1:2026-07-10', habitId: 'h1', day: '2026-07-10' }],
    prefs: { capacityMin: [120, 120, 120, 120, 120, 60, 0], weekStart: 0 },
    dailyLogs: [{ id: '2026-07-09', capacityMin: 120, plannedMin: 30, actualMin: 45, items: [{ habitId: 'h1', projectId: 'p1', shareMin: 30 }], doneCount: 1 }],
    badges: [{ id: 'streak-3', earnedAt: 5 }],
    active: null,
    historyClearedAt: 123,
    plans: { '2026-07-10': ['h1'] },
    planSince: '2026-07-01',
    streakCarry: { current: 12, longest: 30, day: '2026-07-01' },
    rebalancePending: false,
    days: { '2026-07-10': { order: ['h1'], aside: [], level: 'light', prompted: true } },
    badgesPrimed: true,
  };

  const result = hydrate({ v3: JSON.stringify(saved), v2: null }, NOW);

  assert.deepEqual(result, saved);
});

test('v3 storage wins when both keys are present', () => {
  const v3 = {
    schemaVersion: 3,
    projects: [{ id: 'new', name: 'New', weeklyTarget: 8, started: NOW }],
    habits: [],
    sessions: [],
    active: null,
    historyClearedAt: 0,
  };
  const v2 = {
    goals: [{ id: 'old', name: 'Old', weeklyTarget: 8, started: NOW }],
    habits: [],
    sessions: [],
  };

  const result = hydrate(
    { v3: JSON.stringify(v3), v2: JSON.stringify(v2) },
    NOW
  );

  assert.equal(result.projects[0].id, 'new');
});

test('empty and invalid storage fall back to the seed', () => {
  const expected = seed(NOW);
  assert.deepEqual(hydrate({ v3: null, v2: null }, NOW), expected);
  assert.deepEqual(hydrate({ v3: '{invalid', v2: null }, NOW), expected);
  assert.equal(expected.schemaVersion, CURRENT_SCHEMA_VERSION);
});

test('migrate treats versions below 1 as legacy v1', () => {
  const result = migrate({ goals: [{ id: 'g1', name: 'Learn' }], habits: [] }, 0, NOW);
  assert.equal(result.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(result.projects[0].id, 'g1');
});

test('a stamped empty state stays empty instead of re-seeding', () => {
  const empty = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects: [],
    habits: [],
    sessions: [],
    marks: [],
    prefs: { capacityMin: [180, 180, 180, 180, 180, 120, 120], weekStart: 1 },
    dailyLogs: [],
    active: null,
    historyClearedAt: 0,
    plans: {},
    planSince: '2026-07-10',
    streakCarry: null,
    rebalancePending: false,
    days: {},
    badges: [],
    badgesPrimed: true,
  };
  assert.deepEqual(hydrate({ v3: JSON.stringify(empty), v2: null }, NOW), empty);
});

// ---------- v4: frequency, minimum, plans ----------

/** A v3 state as the previous app version saved it. */
function v3State(habits: any[], sessions: any[] = []) {
  return {
    schemaVersion: 3,
    projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: NOW - 1000 }],
    habits,
    sessions,
    active: null,
    historyClearedAt: 0,
  };
}
const v3Habit = (id: string, dailyTargetMin: number) => ({
  id,
  projectId: 'p1',
  name: id,
  icon: 'book',
  tile: '#fff',
  dailyTargetMin,
  weeklyTargetMin: dailyTargetMin * 5,
});

test('v3 habits become every-day habits with a 5-minute (or shorter) minimum', () => {
  const r = hydrate({ v3: JSON.stringify(v3State([v3Habit('a', 45), v3Habit('b', 5), v3Habit('c', 3)])), v2: null }, NOW);
  assert.equal(r.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(
    r.habits.map((h) => [h.id, h.frequency, h.dailyTargetMin, h.minTargetMin, h.weeklyTargetMin]),
    [
      ['a', { kind: 'daily' }, 45, 5, 225],
      ['b', { kind: 'daily' }, 5, 5, 25],
      ['c', { kind: 'daily' }, 3, 3, 15],
    ]
  );
  assert.equal(r.rebalancePending, true, 'the one-time rebalance screen is due');
  assert.equal(r.planSince, '2026-07-10', 'days from the update on are judged by their plan');
  assert.deepEqual(r.plans, {});
});

test('the v4 migration keeps the old streak as a carry', () => {
  // Tracked every day Jun 21 – Jul 9 (19 days), today (Jul 10) not yet: counted through Jul 9.
  const sessions = Array.from({ length: 19 }, (_, i) => {
    const start = new Date(2026, 5, 21 + i, 9, 0).getTime();
    return { id: 's' + i, habitId: 'a', start, end: start + 600_000, duration: 600 };
  });
  const r = hydrate({ v3: JSON.stringify(v3State([v3Habit('a', 20)], sessions)), v2: null }, NOW);
  assert.deepEqual(r.streakCarry, { current: 19, longest: 19, day: '2026-07-09' });
  // Nothing lost.
  assert.equal(r.sessions.length, 19);
  assert.equal(r.habits.length, 1);
});

test('no habits: no rebalance screen and no carry', () => {
  const r = hydrate({ v3: JSON.stringify(v3State([])), v2: null }, NOW);
  assert.equal(r.rebalancePending, false);
  assert.equal(r.streakCarry, null);
});

test('an untouched seed saved by the previous version still reads as untouched', () => {
  // What v3 saved for a fresh install: the seed without the v4 fields.
  const s = seed(NOW);
  const old = {
    schemaVersion: 3,
    projects: s.projects,
    habits: s.habits.map(({ frequency: _f, minTargetMin: _m, kind: _k, ...h }) => h),
    sessions: s.sessions,
    active: null,
    historyClearedAt: 0,
  };
  const r = hydrate({ v3: JSON.stringify(old), v2: null }, NOW + 86_400_000);
  assert.equal(isUntouchedSeed(r, seed(NOW + 86_400_000)), true);
});

test('malformed local plan state is dropped, not fatal', () => {
  const saved = { ...seed(NOW), plans: { '2026-07-10': ['h1', 3, null], nope: ['h2'], '2026-07-09': 'x' }, streakCarry: { current: 'x' } };
  const r = hydrate({ v3: JSON.stringify(saved), v2: null }, NOW);
  assert.deepEqual(r.plans, { '2026-07-10': ['h1'] });
  assert.equal(r.streakCarry, null);
});
