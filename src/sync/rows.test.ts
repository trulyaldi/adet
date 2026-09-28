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
    record: { id: 'h1', projectId: 'p1', name: 'H', icon: 'book', tile: '#fff', dailyTargetMin: 30, weeklyTargetMin: 150, updatedAt: T },
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
    record: { id: 'p2', name: 'Old', weeklyTarget: 4, started: 5, archivedAt: T - 1000, updatedAt: T },
  },
];

for (const c of cases) {
  test(`${c.table}/${c.id} round-trips through a server row`, () => {
    const row = changeToRow(c, 'user-1');
    assert.equal(row.user_id, 'user-1');
    assert.deepEqual(rowToChange(c.table, serverTs(row)), c);
  });
}

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
