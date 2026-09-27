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
