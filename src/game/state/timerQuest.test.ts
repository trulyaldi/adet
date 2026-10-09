// The quest bound to a running timer, and the copy kept on the device (Projects as Realms).
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { SESSION_MAX_SEC } from '../../domain/sessions';
import { adoptTimerQuest, bindTimerQuest, boundQuest, dropTimerQuest, onTimerQuestChange, parseBinding, pendingTimerQuest, releaseTimerQuest, resetTimerQuest, setTimerQuest, TimerBinding } from './timerQuest';

const NOW = Date.UTC(2026, 9, 9, 12);
const stored: TimerBinding = { questId: 'q1', habitId: 'h1', at: NOW - 60_000 };

beforeEach(resetTimerQuest);

test('the pending quest is readable, and binds to the habit that starts', () => {
  setTimerQuest('q1');
  assert.equal(pendingTimerQuest(), 'q1');
  bindTimerQuest('h1', NOW);
  assert.equal(pendingTimerQuest(), null);
  assert.equal(boundQuest('h1'), 'q1');
  assert.equal(boundQuest('h2'), null);
  assert.equal(boundQuest(null), null);
});

test('starting with nothing pending binds nothing and drops an older binding', () => {
  setTimerQuest('q1');
  bindTimerQuest('h1', NOW);
  bindTimerQuest('h1', NOW + 1);
  assert.equal(boundQuest('h1'), null);
});

test('drop clears only the pending quest; release clears the binding', () => {
  setTimerQuest('q1');
  bindTimerQuest('h1', NOW);
  setTimerQuest('q2');
  dropTimerQuest();
  assert.equal(pendingTimerQuest(), null);
  assert.equal(boundQuest('h1'), 'q1');
  releaseTimerQuest();
  assert.equal(boundQuest('h1'), null);
});

test('listeners hear each change, with the binding, and only real changes', () => {
  const seen: (TimerBinding | null)[] = [];
  const off = onTimerQuestChange((b) => seen.push(b));
  releaseTimerQuest(); // nothing to release
  bindTimerQuest('h1', NOW); // nothing pending
  assert.deepEqual(seen, []);
  setTimerQuest('q1');
  bindTimerQuest('h1', NOW);
  releaseTimerQuest();
  assert.deepEqual(seen, [{ questId: 'q1', habitId: 'h1', at: NOW }, null]);
  off();
  setTimerQuest('q2');
  bindTimerQuest('h1', NOW);
  assert.equal(seen.length, 2);
});

test('parseBinding: kept only for the running timer’s habit, within a session’s length', () => {
  assert.deepEqual(parseBinding(stored, 'h1', NOW), stored);
  assert.equal(parseBinding(stored, 'h2', NOW), null, 'another habit is running');
  assert.equal(parseBinding(stored, null, NOW), null, 'no timer is running');
  assert.equal(parseBinding({ ...stored, at: NOW - SESSION_MAX_SEC * 1000 - 1 }, 'h1', NOW), null, 'older than a session can last');
  assert.deepEqual(parseBinding({ ...stored, at: NOW - SESSION_MAX_SEC * 1000 }, 'h1', NOW)?.questId, 'q1');
  assert.equal(parseBinding({ ...stored, at: NOW + 1 }, 'h1', NOW), null, 'from the future');
});

test('parseBinding: rubbish is no binding', () => {
  for (const bad of [null, undefined, 'x', 3, {}, { questId: 'q1' }, { questId: '', habitId: 'h1', at: NOW }, { questId: 'q1', habitId: 'h1', at: 'now' }, { questId: 'q1', habitId: 'h1', at: NaN }]) {
    assert.equal(parseBinding(bad, 'h1', NOW), null);
  }
});

test('adopt: a launch copy is taken back, so the session still ends in its result', () => {
  adoptTimerQuest(stored);
  assert.equal(boundQuest('h1'), 'q1');
});

test('adopt: a release that ran before the copy loaded does not wipe it (the focus view’s effect)', () => {
  const seen: unknown[] = [];
  onTimerQuestChange((b) => seen.push(b));
  releaseTimerQuest(); // nothing bound yet: not a change, nothing written
  adoptTimerQuest(stored);
  assert.equal(boundQuest('h1'), 'q1');
  assert.deepEqual(seen, []);
});

test('adopt: a binding made here since launch is newer than the copy', () => {
  setTimerQuest('q2');
  bindTimerQuest('h1', NOW);
  adoptTimerQuest(stored);
  assert.equal(boundQuest('h1'), 'q2');
});

test('adopt: nothing stored adopts nothing', () => {
  adoptTimerQuest(null);
  assert.equal(boundQuest('h1'), null);
});
