import assert from 'node:assert/strict';
import { test } from 'node:test';

import { habit, sess, state } from './testkit';
import { selectWeek } from './week';

const S = { budgetMin: 60, planCap: 3 };
const at = (day: number, h = 9) => new Date(2026, 8, day, h, 0).getTime();
// Thursday Oct 1, 2026, 12:00. The week is Mon Sep 28 – Sun Oct 4.
const THU = new Date(2026, 9, 1, 12, 0).getTime();

test('week grid: check for complete, moon for the first unfinished day, a ring for today, quiet circles otherwise', () => {
  const a = habit('a', 20, 5);
  const b = habit('b', 20, 5, { kind: 'weekly', times: 2 });
  const d = state(
    [a, b],
    [
      // Mon: a + b done → complete (plan was a, b).
      sess('1', 'a', at(28), 20),
      sess('2', 'b', at(28), 20),
      // Tue: only b… but b isn't planned (weekly, and ahead). a missing → unfinished: rest day.
      // Wed: nothing → unfinished, second one this week: neutral.
      // Thu (today): a done, b planned too.
      sess('3', 'a', new Date(2026, 9, 1, 8).getTime(), 20),
    ],
    { planSince: '2026-09-01', plans: { '2026-10-01': ['a', 'b'] } }
  );
  const w = selectWeek(d, S, THU);
  assert.equal(w.rangeLabel, 'Sep 28 – Oct 4');
  assert.deepEqual(
    w.cells.map((c) => [c.letter, c.date, c.kind]),
    [
      ['M', 28, 'complete'],
      ['T', 29, 'rest'],
      ['W', 30, 'empty'],
      ['T', 1, 'progress'],
      ['F', 2, 'future'],
      ['S', 3, 'future'],
      ['S', 4, 'future'],
    ]
  );
  const today = w.cells[3];
  assert.deepEqual([today.today, today.done, today.total], [true, 1, 2]);
  assert.equal(w.cells[1].label, 'Tuesday, rest day');
  // Each habit: name and its dots (days done of the target).
  assert.deepEqual(w.habits.map((h) => [h.name, h.done, h.target]), [
    ['A', 2, 7],
    ['B', 1, 2],
  ]);
  assert.equal(w.isCurrent, true);
  assert.equal(w.hasEarlier, false, 'tracking started this week');
});

test('earlier weeks page back through history', () => {
  const a = habit('a', 20, 5);
  const d = state([a], [sess('1', 'a', at(21), 20), sess('2', 'a', at(22), 20)], { planSince: '2026-09-01' });
  const last = selectWeek(d, S, THU, 1);
  assert.equal(last.rangeLabel, 'Sep 21 – 27');
  assert.deepEqual(last.cells.map((c) => c.kind), ['complete', 'complete', 'rest', 'empty', 'empty', 'empty', 'empty']);
  assert.equal(last.isCurrent, false);
  assert.deepEqual(last.habits.map((h) => [h.done, h.target]), [[2, 7]]);
  assert.equal(selectWeek(d, S, THU).hasEarlier, true);
});

test('days before tracking started, and free days, are quiet circles', () => {
  const w = habit('w', 20, 5, { kind: 'weekly', times: 1 });
  // Done Monday: the weekly target is met, so Tue and Wed are free days.
  const d = state([w], [sess('1', 'w', at(28), 20)], { planSince: '2026-09-01' });
  const week = selectWeek(d, S, THU);
  assert.deepEqual(week.cells.slice(0, 4).map((c) => c.kind), ['complete', 'empty', 'empty', 'empty']);
});
