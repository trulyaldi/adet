// Migration 006 not run yet: sync carries on for everything else, quest
// changes stay queued without being counted (so sync never loops on them),
// and the Quest tab shows its setup note.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Change } from '../domain/sync';
import { getQuestTables, questTabView, sendableCount, setQuestTables } from './questTables';
import { pullChangesWith, pushChangesWith, SyncDb } from './remoteCore';

const MISSING = { code: '42P01', message: 'relation "public.items" does not exist' };

/** A server with every table except items and links. */
function serverWithout006() {
  const calls: string[] = [];
  const db: SyncDb = {
    from(table: string) {
      const missing = table === 'items' || table === 'links';
      const result = missing ? { data: null, error: MISSING } : { data: [], error: null };
      const q = {
        select: () => q, eq: () => q, gte: () => q, order: () => q, range: () => q,
        upsert: async () => { calls.push(`push:${table}`); return { error: missing ? MISSING : null }; },
        then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => {
          calls.push(`pull:${table}`);
          return Promise.resolve(result).then(ok, fail);
        },
      };
      return q;
    },
  };
  return { db, calls };
}

const session: Change = { table: 'sessions', id: 's1', deletedAt: null, record: { id: 's1', habitId: 'h1', start: 0, end: 600_000, duration: 600, updatedAt: 1 } } as Change;
const task: Change = { table: 'items', id: 't1', deletedAt: null, record: { id: 't1', type: 'task', title: 'A', body: '', props: { status: 'open', order: 0 }, habitId: 'h1', createdAt: 1, updatedAt: 1 } } as Change;

test('pull: other tables sync, the quest tables are marked missing, nothing throws', async () => {
  setQuestTables('available');
  const { db, calls } = serverWithout006();
  const out = await pullChangesWith(db, {}, 'u1');
  assert.deepEqual(out.changes, []);
  assert.equal(getQuestTables(), 'missing');
  assert.ok(calls.includes('pull:sessions') && calls.includes('pull:projects'), 'the rest of sync still ran');
  assert.equal(questTabView(getQuestTables()), 'setup');
});

test('push: quest changes stay queued, others confirm, and the queue does not loop', async () => {
  setQuestTables('available');
  const { db } = serverWithout006();
  const confirmed: string[] = [];
  await pushChangesWith(db, [session, task], 'u1', (cs) => confirmed.push(...cs.map((c) => c.id)));
  assert.deepEqual(confirmed, ['s1']);
  assert.equal(getQuestTables(), 'missing');
  // What's left is the quest change alone: not sendable, so sync goes idle.
  assert.equal(sendableCount({ 'items:t1': task }), 0);
  assert.equal(sendableCount({ 'items:t1': task, 'sessions:s1': session }), 1);
});

test('the Quest tab: setup note without 006, a wait before the first answer, then the map', () => {
  assert.equal(questTabView('missing'), 'setup');
  assert.equal(questTabView('unknown'), 'finding');
  assert.equal(questTabView('available'), 'map');
});
