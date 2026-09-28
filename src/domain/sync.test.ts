import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_PREFS } from './capacity';

import { seed } from './seed';
import { restoreSession } from './sessions';
import {
  ACTIVE_ID,
  Change,
  confirmPushed,
  enqueue,
  isUntouchedSeed,
  mergeRemote,
  Outbox,
  parseTimestamp,
  stampLocalChanges,
} from './sync';
import { CURRENT_SCHEMA_VERSION, Habit, PersistedState, Session } from './types';

const NOW = new Date(2026, 6, 10, 12, 0, 0).getTime();

const habit = (id: string, updatedAt: number, name = id): Habit => ({
  id,
  projectId: 'p1',
  name,
  icon: 'code',
  tile: '#fff',
  dailyTargetMin: 30,
  weeklyTargetMin: 150,
  updatedAt,
});

const session = (id: string, habitId: string, updatedAt: number, notes?: string): Session => ({
  id,
  habitId,
  start: 1000,
  end: 61000,
  duration: 60,
  updatedAt,
  ...(notes ? { notes } : {}),
});

function state(partial: Partial<PersistedState>): PersistedState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: 0, updatedAt: 100 }],
    habits: [],
    sessions: [],
    marks: [],
    prefs: DEFAULT_PREFS,
    dailyLogs: [],
    badges: [],
    active: null,
    historyClearedAt: 0,
    plans: {},
    planSince: '2026-01-01',
    streakCarry: null,
    rebalancePending: false,
    days: {},
    badgesPrimed: true,
    ...partial,
  };
}

const upsertHabit = (h: Habit): Change => ({ table: 'habits', id: h.id, record: h, deletedAt: null });
const deleteHabit = (h: Habit, at: number, mergedInto: string | null = null): Change => ({
  table: 'habits',
  id: h.id,
  record: { ...h, updatedAt: at },
  deletedAt: at,
  mergedInto,
});

// --- merge -----------------------------------------------------------------

test('newer remote edit wins over an older local record', () => {
  const data = state({ habits: [habit('h1', 100, 'Old')] });
  const res = mergeRemote(data, {}, [upsertHabit(habit('h1', 200, 'New'))], NOW);
  assert.equal(res.data.habits[0].name, 'New');
  assert.deepEqual(res.outbox, {});
});

test('newer local edit wins over an older remote edit', () => {
  const local = habit('h1', 300, 'Local');
  const data = state({ habits: [local] });
  const outbox = enqueue({}, [upsertHabit(local)]);
  const res = mergeRemote(data, outbox, [upsertHabit(habit('h1', 200, 'Remote'))], NOW);
  assert.equal(res.data.habits[0].name, 'Local');
  assert.ok(res.outbox['habits:h1'], 'local edit stays queued for push');
});

test('a newer remote delete removes the record; an older one does not', () => {
  const h = habit('h1', 100);
  const deleted = mergeRemote(state({ habits: [h] }), {}, [deleteHabit(h, 200)], NOW);
  assert.equal(deleted.data.habits.length, 0);

  const edited = habit('h1', 300, 'Edited after delete');
  const kept = mergeRemote(state({ habits: [edited] }), {}, [deleteHabit(h, 200)], NOW);
  assert.equal(kept.data.habits[0].name, 'Edited after delete');
});

test('a delete beats an edit made at the same instant', () => {
  const h = habit('h1', 200);
  const res = mergeRemote(state({ habits: [h] }), {}, [deleteHabit(h, 200)], NOW);
  assert.equal(res.data.habits.length, 0);
});

test('a remote delete of a habit also deletes its local sessions', () => {
  const h = habit('h1', 100);
  const data = state({ habits: [h], sessions: [session('s1', 'h1', 100)] });
  const res = mergeRemote(data, {}, [deleteHabit(h, 200)], NOW);
  assert.equal(res.data.sessions.length, 0);
  assert.equal(res.outbox['sessions:s1'].deletedAt, NOW);
});

test('remote deletes of unknown records are ignored', () => {
  const data = state({});
  const res = mergeRemote(data, {}, [deleteHabit(habit('ghost', 1), 5)], NOW);
  assert.equal(res.data, data);
});

test('same record edited on both sides: the later edit wins either way', () => {
  const localEdit = session('s1', 'h1', 200, 'local');
  const data = state({ habits: [habit('h1', 1)], sessions: [localEdit] });
  const outbox = enqueue({}, [{ table: 'sessions', id: 's1', record: localEdit, deletedAt: null }]);

  const remoteOlder: Change = { table: 'sessions', id: 's1', record: session('s1', 'h1', 150, 'remote'), deletedAt: null };
  const a = mergeRemote(data, outbox, [remoteOlder], NOW);
  assert.equal(a.data.sessions[0].notes, 'local');
  assert.ok(a.outbox['sessions:s1']);

  const remoteNewer: Change = { table: 'sessions', id: 's1', record: session('s1', 'h1', 250, 'remote'), deletedAt: null };
  const b = mergeRemote(data, outbox, [remoteNewer], NOW);
  assert.equal(b.data.sessions[0].notes, 'remote');
  assert.equal(b.outbox['sessions:s1'], undefined, 'stale local edit is dropped, not pushed');
});

test('a session on a habit that was merged away is moved to the merge target', () => {
  const h1 = habit('h1', 100);
  const h2 = habit('h2', 100);
  // Logged offline on h1 while another device merged h1 into h2.
  const offline = session('s9', 'h1', 300);
  const data = state({
    habits: [h1, h2],
    sessions: [offline],
    active: { habitId: 'h1', startedAt: 5, baseSec: 0, updatedAt: 300 },
  });
  const outbox = enqueue({}, [{ table: 'sessions', id: 's9', record: offline, deletedAt: null }]);

  const res = mergeRemote(data, outbox, [deleteHabit(h1, 200, 'h2')], NOW);

  assert.deepEqual(res.data.habits.map((h) => h.id), ['h2']);
  assert.equal(res.data.sessions[0].habitId, 'h2');
  assert.equal(res.outbox['sessions:s9'].record.habitId, 'h2');
  assert.equal(res.data.active?.habitId, 'h2');
  assert.equal(res.outbox[`active_timers:${ACTIVE_ID}`].deletedAt, null);
});

test('a newer remote timer replaces the local one; a remote stop clears it', () => {
  const data = state({ active: { habitId: 'h1', startedAt: 10, baseSec: 0, updatedAt: 100 } });
  const newer: Change = {
    table: 'active_timers',
    id: ACTIVE_ID,
    record: { habitId: 'h2', startedAt: null, baseSec: 42, updatedAt: 200 },
    deletedAt: null,
  };
  assert.equal(mergeRemote(data, {}, [newer], NOW).data.active?.habitId, 'h2');

  const stop: Change = { ...newer, deletedAt: 200 };
  assert.equal(mergeRemote(data, {}, [stop], NOW).data.active, null);
});

// --- local change detection -------------------------------------------------

test('stampLocalChanges stamps only records whose identity changed', () => {
  const keep = habit('h1', 1);
  const prev = state({ habits: [keep, habit('h2', 1)] });
  const next = { ...prev, habits: [keep, { ...prev.habits[1], name: 'Renamed' }] };
  const { data, changes } = stampLocalChanges(prev, next, NOW);
  assert.equal(data.habits[0], keep);
  assert.equal(data.habits[1].updatedAt, NOW);
  assert.deepEqual(changes.map((c) => c.id), ['h2']);
});

test('stampLocalChanges records deletes and infers merges', () => {
  const prev = state({
    habits: [habit('h1', 1), habit('h2', 1)],
    sessions: [session('s1', 'h1', 1)],
  });
  const next = { ...prev, habits: [prev.habits[1]], sessions: [{ ...prev.sessions[0], habitId: 'h2' }] };
  const { changes } = stampLocalChanges(prev, next, NOW);
  const del = changes.find((c) => c.table === 'habits' && c.id === 'h1');
  assert.ok(del && del.table === 'habits');
  assert.equal(del.deletedAt, NOW);
  assert.equal(del.mergedInto, 'h2');
});

test('stopping the timer queues an active_timers delete', () => {
  const prev = state({ active: { habitId: 'h1', startedAt: 10, baseSec: 0 } });
  const { changes } = stampLocalChanges(prev, { ...prev, active: null }, NOW);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].table, 'active_timers');
  assert.equal(changes[0].deletedAt, NOW);
});

test('no-op updates produce no changes and keep identity', () => {
  const prev = state({ habits: [habit('h1', 1)] });
  const res = stampLocalChanges(prev, prev, NOW);
  assert.equal(res.data, prev);
  assert.equal(res.changes.length, 0);
});

// --- outbox ----------------------------------------------------------------

test('confirmPushed keeps entries replaced while the push was in flight', () => {
  const first = upsertHabit(habit('h1', 1));
  const second = upsertHabit(habit('h2', 1));
  let outbox: Outbox = enqueue({}, [first, second]);
  const pushed = [first, second];
  outbox = enqueue(outbox, [upsertHabit(habit('h2', 5, 'edited mid-push'))]);
  const after = confirmPushed(outbox, pushed);
  assert.deepEqual(Object.keys(after), ['habits:h2']);
  assert.equal(after['habits:h2'].record.updatedAt, 5);
});

// --- first sign-in -----------------------------------------------------------

test('delete then undo before a push leaves a single upsert in the outbox', () => {
  const s1 = session('s1', 'h1', 100);
  const before = state({ habits: [habit('h1', 100)], sessions: [s1] });

  const del = stampLocalChanges(before, { ...before, sessions: [] }, NOW);
  let outbox = enqueue({}, del.changes);
  assert.equal(outbox['sessions:s1'].deletedAt, NOW);

  const undone = stampLocalChanges(del.data, restoreSession(del.data, s1), NOW + 3000);
  outbox = enqueue(outbox, undone.changes);
  assert.deepEqual(Object.keys(outbox), ['sessions:s1']);
  assert.equal(outbox['sessions:s1'].deletedAt, null);
  assert.equal(outbox['sessions:s1'].record.updatedAt, NOW + 3000);
  assert.equal(undone.data.sessions[0].updatedAt, NOW + 3000);
});

test('delete, push, then undo: a second device ends up with the session restored', () => {
  const s1 = session('s1', 'h1', 100, 'kept note');
  const deviceB = state({ habits: [habit('h1', 100)], sessions: [s1] });
  const a0 = state({ habits: [habit('h1', 100)], sessions: [s1] });

  // Device A deletes; the delete is pushed and device B pulls it.
  const del = stampLocalChanges(a0, { ...a0, sessions: [] }, NOW);
  const b1 = mergeRemote(deviceB, {}, del.changes, NOW + 1000);
  assert.deepEqual(b1.data.sessions, []);

  // Device A undoes; the restore is pushed and device B pulls it.
  const undo = stampLocalChanges(del.data, restoreSession(del.data, s1), NOW + 3000);
  const b2 = mergeRemote(b1.data, b1.outbox, undo.changes, NOW + 4000);
  assert.equal(b2.data.sessions.length, 1);
  assert.equal(b2.data.sessions[0].notes, 'kept note');
  assert.equal(b2.data.sessions[0].updatedAt, NOW + 3000);

  // A device that only pulls after the undo sees the restore win over the delete.
  const late = mergeRemote(deviceB, {}, [...del.changes, ...undo.changes], NOW + 5000);
  assert.equal(late.data.sessions.length, 1);
});

test('isUntouchedSeed matches the seed from another day but not edited data', () => {
  const installed = seed(NOW - 5 * 86_400_000);
  assert.equal(isUntouchedSeed(installed, seed(NOW)), true);

  const renamed = { ...installed, habits: [{ ...installed.habits[0], name: 'Mine' }, ...installed.habits.slice(1)] };
  assert.equal(isUntouchedSeed(renamed, seed(NOW)), false);

  const stamped = { ...installed, sessions: [{ ...installed.sessions[0], updatedAt: 1 }, ...installed.sessions.slice(1)] };
  assert.equal(isUntouchedSeed(stamped, seed(NOW)), false);

  const deletedOne = { ...installed, sessions: installed.sessions.slice(1) };
  assert.equal(isUntouchedSeed(deletedOne, seed(NOW)), false);
});

// --- timestamps --------------------------------------------------------------

test('parseTimestamp handles Postgres microsecond timestamps', () => {
  const ms = Date.UTC(2026, 8, 27, 10, 0, 0, 123);
  assert.equal(parseTimestamp('2026-09-27T10:00:00.123456+00:00'), ms);
  assert.equal(parseTimestamp('2026-09-27T10:00:00.1234+00:00'), ms);
  assert.equal(parseTimestamp('2026-09-27T10:00:00.12+00:00'), ms - 3);
  assert.equal(parseTimestamp('2026-09-27T10:00:00+00:00'), ms - 123);
  assert.equal(parseTimestamp('2026-09-27T15:00:00.123+05'), ms);
  assert.equal(parseTimestamp('2026-09-27T10:00:00.123Z'), ms);
  assert.ok(Number.isNaN(parseTimestamp('nope')));
});

// ---------- the redesign's records (005) ----------

test('marks, logs, badges and prefs are stamped and queued like any edit', () => {
  const prev = state({});
  const next = {
    ...prev,
    marks: [{ id: 'h1:2026-09-28', habitId: 'h1', day: '2026-09-28' }],
    badges: [{ id: 'streak-3', earnedAt: 5 }],
    prefs: { ...prev.prefs, weekStart: 0 as const },
  };
  const { data, changes } = stampLocalChanges(prev, next, 777);
  assert.deepEqual(changes.map((c) => c.table).sort(), ['badges', 'habit_marks', 'user_prefs']);
  assert.equal(data.prefs.updatedAt, 777);
  assert.equal(data.marks[0].updatedAt, 777);
  // Undoing a check-off is a soft delete.
  const off = stampLocalChanges(data, { ...data, marks: [] }, 900).changes;
  assert.deepEqual(off.map((c) => [c.table, c.deletedAt]), [['habit_marks', 900]]);
});

test('prefs: the later edit wins; a merged-away habit takes its marks along', () => {
  const h1 = { ...habit('h1', 100), updatedAt: 100 };
  const h2 = { ...habit('h2', 100), updatedAt: 100 };
  const local = state({
    habits: [h1, h2],
    marks: [
      { id: 'h1:2026-09-27', habitId: 'h1', day: '2026-09-27', updatedAt: 100 },
      { id: 'h1:2026-09-28', habitId: 'h1', day: '2026-09-28', updatedAt: 100 },
      { id: 'h2:2026-09-28', habitId: 'h2', day: '2026-09-28', updatedAt: 100 },
    ],
    prefs: { capacityMin: [60, 60, 60, 60, 60, 60, 60], weekStart: 1, updatedAt: 200 },
  });
  const remote: Change[] = [
    deleteHabit(h1, 500, 'h2'),
    { table: 'user_prefs', id: 'prefs', deletedAt: null, record: { capacityMin: [90, 90, 90, 90, 90, 90, 90], weekStart: 0, updatedAt: 150 } },
  ];
  const { data } = mergeRemote(local, {}, remote, 1000);
  assert.equal(data.prefs.capacityMin[0], 60, 'older remote prefs lose');
  assert.deepEqual(data.marks.map((m) => m.id).sort(), ['h2:2026-09-27', 'h2:2026-09-28']);
  const newer = mergeRemote(local, {}, [{ ...remote[1], record: { ...(remote[1].record as any), updatedAt: 300 } } as Change], 1000);
  assert.equal(newer.data.prefs.weekStart, 0);
});
