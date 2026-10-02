import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fallbackInsight, fallbackRecap, trailInsight } from './sageFallback';
import { fixedTz } from './tz';

const s = (id: string, h: string, start: number, min: number) => ({ id, habitId: h, start, end: start + min * 60_000, duration: min * 60 });

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
  assert.equal(fallbackRecap('The Doomscroll Hydra', 6, 0), 'You faced the Doomscroll Hydra across 6 sessions. Well fought.');
  assert.equal(fallbackRecap('King Tomorrow', 1, 1), 'You faced King Tomorrow across 1 session. You wrote 1 line along the way. Well fought.');
});

test('recap with no sessions on record still reads well', () => {
  assert.equal(fallbackRecap('The Fog Wisp', 0, 0), 'The Fog Wisp is beaten. Well fought.');
});

test('the Sage mentions a rising skill from the trail, in 12 words or fewer', () => {
  const h = (habitId: string, verdict: 'rising' | 'steady' | 'resting', empty = false) => ({ habitId, verdict, empty }) as never;
  const names = new Map([['a', 'Reading'], ['b', 'A very long habit name that goes on and on and on']]);
  assert.equal(trailInsight({ habits: [h('a', 'steady'), h('a', 'rising')] }, (id) => names.get(id)), 'Reading is rising this week.');
  assert.equal(trailInsight({ habits: [h('a', 'resting')] }, (id) => names.get(id)), null);
  assert.equal(trailInsight({ habits: [h('a', 'rising', true)] }, (id) => names.get(id)), null, 'an empty row is not rising');
  const long = trailInsight({ habits: [h('b', 'rising')] }, (id) => names.get(id))!;
  assert.ok(long.split(' ').length <= 12, long);
});
