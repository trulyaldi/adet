import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ACTIVE_ID, Change } from '../domain/sync';
import { changeToRow, rowToChange } from './rows';

const T = Date.UTC(2026, 8, 27, 10, 0, 0, 123);

// Postgres returns timestamps with microseconds and a +00:00 offset.
const serverTs = (row: Record<string, unknown>) => ({
  ...row,
  updated_at: typeof row.updated_at === 'string' ? row.updated_at.replace('Z', '000+00:00') : row.updated_at,
  deleted_at: typeof row.deleted_at === 'string' ? row.deleted_at.replace('Z', '000+00:00') : row.deleted_at,
});

const cases: Change[] = [
  { table: 'projects', id: 'p1', deletedAt: null, record: { id: 'p1', name: 'P', weeklyTarget: 8, started: 5, updatedAt: T } },
  {
    table: 'habits',
    id: 'h1',
    deletedAt: T,
    mergedInto: 'h2',
    record: {
      id: 'h1',
      projectId: 'p1',
      name: 'H',
      icon: 'book',
      tile: '#fff',
      dailyTargetMin: 30,
      weeklyTargetMin: 90,
      updatedAt: T,
      frequency: { kind: 'days', days: [0, 2, 4] },
      minTargetMin: 10,
      kind: 'check',
    },
  },
  {
    table: 'sessions',
    id: 's1',
    deletedAt: null,
    record: { id: 's1', habitId: 'h1', start: 1, end: 60001, duration: 60, notes: 'n', manual: true, updatedAt: T },
  },
  { table: 'sessions', id: 's2', deletedAt: null, record: { id: 's2', habitId: 'h1', start: 1, end: 2, duration: 1, updatedAt: T } },
  { table: 'active_timers', id: ACTIVE_ID, deletedAt: null, record: { habitId: 'h1', startedAt: null, baseSec: 12.5, updatedAt: T } },
  {
    table: 'projects',
    id: 'p2',
    deletedAt: null,
    record: { id: 'p2', name: 'Old', weeklyTarget: 4, started: 5, archivedAt: T - 1000, color: 'teal', icon: 'music', scene: 'orbit', updatedAt: T },
  },
  // The redesign's tables (005).
  { table: 'habit_marks', id: 'h1:2026-09-28', deletedAt: null, record: { id: 'h1:2026-09-28', habitId: 'h1', day: '2026-09-28', updatedAt: T } },
  { table: 'habit_marks', id: 'h1:2026-09-27', deletedAt: T, record: { id: 'h1:2026-09-27', habitId: 'h1', day: '2026-09-27', updatedAt: T } },
  {
    table: 'daily_logs',
    id: '2026-09-27',
    deletedAt: null,
    record: { id: '2026-09-27', capacityMin: 180, plannedMin: 150, actualMin: 95, items: [{ habitId: 'h1', projectId: 'p1', shareMin: 150 }], doneCount: 1, updatedAt: T },
  },
  { table: 'badges', id: 'streak-7', deletedAt: null, record: { id: 'streak-7', earnedAt: T - 5, updatedAt: T } },
  { table: 'user_prefs', id: 'prefs', deletedAt: null, record: { capacityMin: [120, 120, 120, 120, 90, 0, 60], weekStart: 0, updatedAt: T } },
];

for (const c of cases) {
  test(`${c.table}/${c.id} round-trips through a server row`, () => {
    const row = changeToRow(c, 'user-1');
    assert.equal(row.user_id, 'user-1');
    assert.deepEqual(rowToChange(c.table, serverTs(row)), c);
  });
}

test('rows from before 005 read with defaults: timed habits, id-derived project looks', () => {
  const habit = rowToChange('habits', { id: 'h', project_id: 'p', name: 'H', icon: 'book', tile: '#fff', daily_target_min: 30, weekly_target_min: 90, updated_at: '2026-09-27T10:00:00+00:00' });
  assert.ok(habit.table === 'habits' && habit.record.kind === 'timed');
  const project = rowToChange('projects', { id: 'p', name: 'P', weekly_target: 5, started: null, color: null, icon: 'nope', updated_at: '2026-09-27T10:00:00+00:00' });
  assert.ok(project.table === 'projects' && !('color' in project.record) && !('icon' in project.record));
});

test('prefs rows are clamped on the way in', () => {
  const c = rowToChange('user_prefs', { id: 'prefs', capacity_min: [999, -5, 30, 30, 30, 30], week_start: 3, updated_at: '2026-09-27T10:00:00+00:00' });
  assert.ok(c.table === 'user_prefs');
  assert.equal(c.record.capacityMin.length, 7, 'malformed (6 values) falls back to the default');
  assert.equal(c.record.weekStart, 1);
});

test('live habits never carry merged_into', () => {
  const c: Change = { ...(cases[1] as Extract<Change, { table: 'habits' }>), deletedAt: null };
  assert.equal(changeToRow(c, 'u').merged_into, null);
});

test('projects always send archived_at, so unarchiving clears it on the server', () => {
  const base = cases[0] as Extract<Change, { table: 'projects' }>;
  assert.equal(changeToRow(base, 'u').archived_at, null, 'never archived');
  const archived: Change = { ...base, record: { ...base.record, archivedAt: T } };
  assert.equal(changeToRow(archived, 'u').archived_at, T);
  const unarchived: Change = { ...base, record: { ...base.record, archivedAt: null } };
  assert.equal(changeToRow(unarchived, 'u').archived_at, null);
});

test('project rows without archived_at (before migration 003, or null) read as active', () => {
  const row = { user_id: 'u', id: 'p1', name: 'P', weekly_target: '8', started: '5', updated_at: '2026-09-27T10:00:00.123+00:00', deleted_at: null };
  const c = rowToChange('projects', row);
  assert.equal(c.table, 'projects');
  assert.ok(c.table === 'projects' && !('archivedAt' in c.record));
  const nulled = rowToChange('projects', { ...row, archived_at: null });
  assert.ok(nulled.table === 'projects' && !('archivedAt' in nulled.record));
  // bigint columns can come back as strings.
  const str = rowToChange('projects', { ...row, archived_at: String(T) });
  assert.ok(str.table === 'projects' && str.record.archivedAt === T);
});

test('habit rows from before migration 004 (or older apps) read as daily with the default minimum', () => {
  const row = {
    user_id: 'u',
    id: 'h9',
    project_id: 'p1',
    name: 'Old',
    icon: 'code',
    tile: '#fff',
    daily_target_min: 40,
    weekly_target_min: 200,
    merged_into: null,
    updated_at: '2026-09-27T10:00:00.123456+00:00',
    deleted_at: null,
  };
  const c = rowToChange('habits', row);
  assert.equal(c.table, 'habits');
  if (c.table !== 'habits') return;
  assert.deepEqual(c.record.frequency, { kind: 'daily' });
  assert.equal(c.record.minTargetMin, 5);
  // A bad value never crashes the pull.
  const odd = rowToChange('habits', { ...row, frequency: { kind: 'weekly', times: 'x' }, min_target_min: 90 });
  if (odd.table !== 'habits') return;
  assert.deepEqual(odd.record.frequency, { kind: 'daily' });
  assert.equal(odd.record.minTargetMin, 40, 'a minimum is never longer than the full session');
});

test('habit rows send frequency and minimum (needs migration 004)', () => {
  const row = changeToRow(cases[1], 'u');
  assert.deepEqual(row.frequency, { kind: 'days', days: [0, 2, 4] });
  assert.equal(row.min_target_min, 10);
});
