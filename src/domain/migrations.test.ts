import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hydrate, migrate, MIGRATIONS } from './migrations';
import { seed } from './seed';
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

  assert.equal(result.schemaVersion, 3);
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

  assert.equal(result.schemaVersion, 3);
  assert.equal(result.habits[0].dailyTargetMin, 30);
  assert.equal(result.habits[0].weeklyTargetMin, 150);
  assert.equal(result.habits[1].dailyTargetMin, 45);
  assert.equal(result.habits[1].weeklyTargetMin, 180);
});

test('already-current data passes through unchanged', () => {
  const saved = {
    schemaVersion: 3,
    projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: NOW - 1000 }],
    habits: [
      {
        id: 'h1',
        projectId: 'p1',
        name: 'Read',
        icon: 'book',
        tile: '#fff',
        dailyTargetMin: 25,
        weeklyTargetMin: 125,
      },
    ],
    sessions: [],
    active: null,
    historyClearedAt: 123,
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
  assert.equal(expected.schemaVersion, 3);
});

test('migrate treats versions below 1 as legacy v1', () => {
  const result = migrate({ goals: [{ id: 'g1', name: 'Learn' }], habits: [] }, 0);
  assert.equal(result.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(result.projects[0].id, 'g1');
});

test('a stamped empty state stays empty instead of re-seeding', () => {
  const empty = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects: [],
    habits: [],
    sessions: [],
    active: null,
    historyClearedAt: 0,
  };
  assert.deepEqual(hydrate({ v3: JSON.stringify(empty), v2: null }, NOW), empty);
});
