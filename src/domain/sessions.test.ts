import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applySessionEdit,
  checkSessionTimes,
  manualSession,
  restoreSession,
  SESSION_CONFIRM_SEC,
  SESSION_MAX_SEC,
} from './sessions';
import { CURRENT_SCHEMA_VERSION, PersistedState, Session } from './types';

const NOW = new Date(2026, 6, 10, 12, 0, 0).getTime(); // 2026-07-10 12:00
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

test('a normal session is valid and reports its duration in seconds', () => {
  assert.deepEqual(checkSessionTimes(NOW - 90 * MIN, NOW - 30 * MIN, NOW), {
    ok: true,
    duration: 3600,
    needsConfirm: false,
  });
});

test('end must be after start', () => {
  const same = checkSessionTimes(NOW - HOUR, NOW - HOUR, NOW);
  const reversed = checkSessionTimes(NOW - HOUR, NOW - 2 * HOUR, NOW);
  assert.equal(same.ok, false);
  assert.equal(reversed.ok, false);
  if (!reversed.ok) assert.match(reversed.error, /after the start/);
});

test('sessions shorter than a minute are rejected', () => {
  const r = checkSessionTimes(NOW - 59 * 1000, NOW, NOW);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, 'A session must be at least 1 minute long.');
  assert.equal(checkSessionTimes(NOW - MIN, NOW, NOW).ok, true);
});

test('editing an existing session under a minute suggests deleting it', () => {
  const r = checkSessionTimes(NOW - 30 * 1000, NOW, NOW, { existing: true });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, 'Sessions must be at least 1 minute. Delete this one instead?');
  const other = checkSessionTimes(NOW - HOUR, NOW - 2 * HOUR, NOW, { existing: true });
  if (!other.ok) assert.match(other.error, /after the start/, 'other errors are unchanged');
});

test('sessions ending in the future are rejected, with a minute of slack', () => {
  assert.equal(checkSessionTimes(NOW - HOUR, NOW + 30 * 1000, NOW).ok, true);
  const r = checkSessionTimes(NOW - HOUR, NOW + 5 * MIN, NOW);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /future/);
});

test('over 8h needs confirmation; exactly 8h does not', () => {
  const at = checkSessionTimes(NOW - SESSION_CONFIRM_SEC * 1000, NOW, NOW);
  const over = checkSessionTimes(NOW - SESSION_CONFIRM_SEC * 1000 - MIN, NOW, NOW);
  assert.deepEqual(at, { ok: true, duration: SESSION_CONFIRM_SEC, needsConfirm: false });
  assert.equal(over.ok && over.needsConfirm, true);
});

test('exactly 16h is allowed; anything longer is blocked with the duration in the message', () => {
  assert.equal(checkSessionTimes(NOW - SESSION_MAX_SEC * 1000, NOW, NOW).ok, true);
  const r = checkSessionTimes(NOW - 16 * HOUR - 30 * MIN, NOW, NOW);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.error, /16h 30m/);
    assert.match(r.error, /at most 16h 00m/);
  }
});

test('missing or invalid times are rejected', () => {
  assert.equal(checkSessionTimes(NaN, NOW, NOW).ok, false);
  assert.equal(checkSessionTimes(NOW - HOUR, Infinity, NOW).ok, false);
});

test('a session spanning midnight is valid', () => {
  const start = new Date(2026, 6, 9, 23, 30).getTime();
  const end = new Date(2026, 6, 10, 0, 45).getTime();
  assert.deepEqual(checkSessionTimes(start, end, NOW), { ok: true, duration: 75 * 60, needsConfirm: false });
});

const base: Session = {
  id: 's1',
  habitId: 'h1',
  start: NOW - 2 * HOUR,
  end: NOW - HOUR,
  duration: 3600,
  notes: 'old note',
  manual: true,
  updatedAt: 123,
};

test('applySessionEdit moves habit and times, derives duration, keeps other fields', () => {
  const next = applySessionEdit(base, {
    habitId: 'h2',
    start: NOW - 3 * HOUR,
    end: NOW - HOUR - 15 * MIN,
    note: '  new note  ',
  });
  assert.notEqual(next, base);
  assert.deepEqual(next, {
    id: 's1',
    habitId: 'h2',
    start: NOW - 3 * HOUR,
    end: NOW - HOUR - 15 * MIN,
    duration: 105 * 60,
    notes: 'new note',
    manual: true,
    updatedAt: 123,
  });
  assert.equal(base.habitId, 'h1', 'input is not mutated');
});

test('applySessionEdit drops a blank note', () => {
  const next = applySessionEdit(base, { habitId: 'h1', start: base.start, end: base.end, note: '   ' });
  assert.equal('notes' in next, false);
  assert.equal(base.notes, 'old note');
});

test('manualSession builds a manual session with derived duration', () => {
  assert.deepEqual(manualSession('s9', { habitId: 'h1', start: NOW - 45 * MIN, end: NOW, note: 'reading' }), {
    id: 's9',
    habitId: 'h1',
    start: NOW - 45 * MIN,
    end: NOW,
    duration: 45 * 60,
    manual: true,
    notes: 'reading',
  });
  assert.equal('notes' in manualSession('s9', { habitId: 'h1', start: NOW - MIN, end: NOW, note: '' }), false);
});

const withSessions = (sessions: Session[], habitIds = ['h1']): PersistedState => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8 }],
  habits: habitIds.map((id) => ({
    id,
    projectId: 'p1',
    name: id,
    icon: 'code' as const,
    tile: '#fff',
    dailyTargetMin: 30,
    weeklyTargetMin: 150,
  })),
  sessions,
  active: null,
  historyClearedAt: 0,
});

test('restoreSession puts a deleted session back as a new object', () => {
  const data = withSessions([]);
  const next = restoreSession(data, base);
  assert.equal(next.sessions.length, 1);
  assert.deepEqual(next.sessions[0], base);
  assert.notEqual(next.sessions[0], base, 'fresh identity so sync stamps it');
});

test('restoreSession is a no-op if the session exists or its habit is gone', () => {
  const present = withSessions([base]);
  assert.equal(restoreSession(present, base), present);
  const noHabit = withSessions([], ['h2']);
  assert.equal(restoreSession(noHabit, base), noHabit);
});
