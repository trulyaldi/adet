import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as ops from '../items/ops';
import { fallbackInsight, fallbackRecap, fallbackSuggestions, habitsByUse } from './sageFallback';
import { fixedTz } from './tz';

const NOW = Date.UTC(2026, 8, 29, 12);
const s = (id: string, h: string, start: number, min: number) => ({ id, habitId: h, start, end: start + min * 60_000, duration: min * 60 });

test('suggestions: continue the last entry, then the oldest open task of the most-used habits', () => {
  let q = ops.addTask({ items: [], links: [] }, 'h2', 'Old h2 task', NOW - 5000, 'a');
  q = ops.addTask(q, 'h2', 'New h2 task', NOW - 10, 'b');
  q = ops.addTask(q, 'h1', 'h1 task', NOW - 100, 'c');
  q = ops.claimChest(q, { sessionId: 's9', habitId: 'h1', doneTaskIds: [], text: 'shipped the OTP flow', now: NOW - 1 });
  const sessions = [s('s1', 'h2', NOW - 3600_000, 120), s('s2', 'h1', NOW - 7200_000, 30)];
  assert.deepEqual(habitsByUse(sessions, NOW), ['h2', 'h1']);
  const out = fallbackSuggestions(sessions, q.items, ['h1', 'h2'], NOW);
  assert.deepEqual(out.map((x) => [x.habitId, x.title, x.taskId]), [
    ['h1', 'Continue: shipped the OTP flow', undefined],
    ['h2', 'Old h2 task', 'a'],
    ['h1', 'h1 task', 'c'],
  ]);
  assert.deepEqual(fallbackSuggestions([], [], ['h1'], NOW), []);
});

test('insight: best part of the day, else weekday; gentle with little data', () => {
  const tz = fixedTz(0);
  assert.equal(fallbackInsight([], tz), 'Every session sharpens the blade.');
  const mornings = Array.from({ length: 6 }, (_, i) => s(`m${i}`, 'h', Date.UTC(2026, 8, 1 + i, 8), 60));
  assert.equal(fallbackInsight(mornings, tz), 'You fight best before noon.');
  const spread = [8, 13, 18, 23].flatMap((h, j) => [s(`x${j}`, 'h', Date.UTC(2026, 8, 1, h), 30), s(`y${j}`, 'h', Date.UTC(2026, 8, 8, h), 30)]);
  assert.equal(fallbackInsight(spread, tz), 'Tuesdays are your strongest days.');
  for (const line of [fallbackInsight(mornings, tz), fallbackInsight(spread, tz)]) assert.ok(line.split(/\s+/).length <= 12);
});

test('recap template', () => {
  assert.equal(fallbackRecap('The Doomscroll Hydra', 6, 9, 0), 'You faced the Doomscroll Hydra across 6 sessions and 9 tasks. Well fought.');
  assert.equal(fallbackRecap('King Tomorrow', 1, 0, 1), 'You faced King Tomorrow across 1 session. You wrote 1 line along the way. Well fought.');
});
