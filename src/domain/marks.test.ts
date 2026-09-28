import assert from 'node:assert/strict';
import test from 'node:test';

import { addMark, isDone, markIndex, moveMarks, removeMark } from './marks';
import { quickSession, sessionFromTimer } from './sessions';
import { habit, state } from './testkit';

const DAY = '2026-07-10';

test('a mark makes a habit done; removing it undoes that', () => {
  const h = habit('a', 30, 5);
  const d = addMark(state([h]), 'a', DAY);
  assert.equal(addMark(d, 'a', DAY), d, 'one mark per habit per day');
  assert.ok(isDone(h, markIndex(d.marks), DAY, 0, 1800));
  const off = removeMark(d, 'a', DAY);
  assert.equal(isDone(h, markIndex(off.marks), DAY, 0, 1800), false);
});

test('a timed habit is done once the day reaches its share; a check-off only by its mark', () => {
  const t = habit('t', 30, 5);
  const c = habit('c', 30, 5, { kind: 'daily' }, { kind: 'check' });
  const idx = markIndex([]);
  assert.equal(isDone(t, idx, DAY, 1799, 1800), false);
  assert.equal(isDone(t, idx, DAY, 1800, 1800), true);
  assert.equal(isDone(t, idx, DAY, 5000, 0), false, 'no share: time alone never "completes" it');
  assert.equal(isDone(c, idx, DAY, 99999, 1800), false);
});

test('merging moves marks and keeps one per day', () => {
  const d = addMark(addMark(addMark(state([]), 'a', DAY), 'a', '2026-07-09'), 'b', DAY);
  const moved = moveMarks(d.marks, 'a', 'b');
  assert.deepEqual(moved.map((m) => m.id).sort(), ['b:2026-07-09', 'b:2026-07-10']);
});

test('quick logs end now and never fail', () => {
  const now = Date.UTC(2026, 6, 10, 12);
  const s = quickSession('s1', 'a', 30, now);
  assert.equal(s.end, now);
  assert.equal(s.duration, 1800);
  assert.equal(s.manual, true);
  assert.equal(quickSession('s2', 'a', 0, now).duration, 60, 'clamped to at least a minute');
});

test('paused and resumed segments add up from timestamps, not ticks', () => {
  const t0 = Date.UTC(2026, 6, 10, 9);
  // Ran 20 minutes, paused for 3 hours, then ran 10 more (e.g. phone locked throughout).
  const active = { habitId: 'a', startedAt: t0 + 3 * 3600_000 + 20 * 60_000, baseSec: 20 * 60 };
  const s = sessionFromTimer(active, t0 + 3 * 3600_000 + 30 * 60_000)!;
  assert.equal(s.duration, 30 * 60);
  assert.equal(sessionFromTimer({ habitId: 'a', startedAt: t0, baseSec: 0 }, t0 + 59_000), null, 'under a minute is discarded');
});
