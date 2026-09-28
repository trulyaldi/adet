import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_CONFIG } from './config';
import { selectStats } from './engine';
import { habit, sess, state } from './testkit';
import { selectPickerRows, selectPlanToday } from './today';

const S = { budgetMin: 60, planCap: 3 };
// Wednesday Sep 30, 2026, 20:00.
const WED = new Date(2026, 8, 30, 20, 0).getTime();
const at = (day: number, h = 9) => new Date(2026, 8, day, h, 0).getTime();

test('the day completes when every planned habit is done, full or minimum', () => {
  const d = state([habit('a', 30, 5), habit('b', 20, 10)], [], { plans: { '2026-09-30': ['a', 'b'] } });
  const none = selectPlanToday(d, S, WED);
  assert.equal(none.doneCount, 0);
  assert.equal(none.complete, false);

  const one = selectPlanToday({ ...d, sessions: [sess('1', 'a', at(30), 30)] }, S, WED);
  assert.equal(one.doneCount, 1);
  assert.equal(one.plan[0].done, 'full');
  assert.equal(one.complete, false);

  // The minimum is enough.
  const both = selectPlanToday({ ...d, sessions: [sess('1', 'a', at(30), 30), sess('2', 'b', at(30), 10)] }, S, WED);
  assert.equal(both.plan[1].done, 'min');
  assert.equal(both.complete, true);
  assert.equal(both.doneTodayCount, 2);
  assert.equal(both.trackedMin, 40);
});

test('bonus habits: shown with the finished day, counted toward weekly targets, never required', () => {
  const extra = habit('x', 15, 5, { kind: 'weekly', times: 2 });
  const d = state([habit('a', 30, 5), extra], [sess('1', 'a', at(30), 30), sess('2', 'x', at(30, 18), 6)], {
    plans: { '2026-09-30': ['a'] },
  });
  const t = selectPlanToday(d, S, WED);
  assert.equal(t.complete, true);
  assert.deepEqual(t.bonus.map((c) => [c.habitId, c.done, c.weekDone, c.weekTarget]), [['x', 'min', 1, 2]]);
  assert.equal(t.doneTodayCount, 2);

  // Undone habits outside the plan never show up on Today.
  const quiet = selectPlanToday({ ...d, sessions: [sess('1', 'a', at(30), 30)] }, S, WED);
  assert.deepEqual(quiet.bonus, []);

  // The bonus picker offers every other habit, ignoring the budget.
  assert.deepEqual(selectPickerRows(d, S, WED, { ignoreBudget: true }).map((r) => [r.habitId, r.fits]), [['x', true]]);

  // In history, the bonus day gets its badge.
  const rows = selectStats(d, DEFAULT_CONFIG, WED, { heatSel: null }).historyRows;
  assert.deepEqual(rows.map((r) => [r.id, r.mark, r.bonus]), [
    ['2', 'min', true],
    ['1', 'full', false],
  ]);
});

test('a weekly habit done as a bonus on Monday is behind less on Wednesday', () => {
  const w = habit('w', 10, 5, { kind: 'weekly', times: 2 });
  const d = state([habit('a', 10, 5), w], [sess('1', 'w', at(28), 10), sess('2', 'w', at(29), 10)]);
  // Mon and Tue done: the target of 2 is met, so it isn't planned today.
  const t = selectPlanToday(d, S, WED);
  assert.deepEqual(t.plan.map((c) => c.habitId), ['a']);
});

test('the week rolls over on Monday: last week no longer counts', () => {
  const w = habit('w', 10, 5, { kind: 'weekly', times: 2 });
  const d = state([w], [sess('1', 'w', at(26), 10), sess('2', 'w', at(27), 10)]);
  // Sunday Sep 27: one to go at the start of the day, so it's planned, and done.
  const sun = selectPlanToday(d, S, new Date(2026, 8, 27, 20).getTime());
  assert.deepEqual(sun.plan.map((c) => [c.habitId, c.weekDone, c.weekTarget]), [['w', 2, 2]]);
  assert.equal(sun.complete, true);
  // Monday Sep 28: a new week, 0 of 2, planned again.
  const mon = selectPlanToday(d, S, new Date(2026, 8, 28, 8).getTime());
  assert.deepEqual(mon.plan.map((c) => [c.habitId, c.weekDone, c.weekTarget]), [['w', 0, 2]]);
});

test('a running timer shows on its card', () => {
  const d = state([habit('a', 30, 5)], [], {
    plans: { '2026-09-30': ['a'] },
    active: { habitId: 'a', startedAt: WED - 90_000, baseSec: 0 },
  });
  const c = selectPlanToday(d, S, WED).plan[0];
  assert.equal(c.running, true);
  assert.equal(c.paused, false);
  assert.equal(Math.round(c.elapsedSec), 90);
});
