import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_CONFIG } from './config';
import { selectStats, selectTimer } from './engine';
import { Frequency } from './frequency';
import {
  addToPlan,
  clampBudgetMin,
  clampPlanCap,
  completionOf,
  completionOn,
  doneBefore,
  doneThrough,
  fitPlan,
  habitDaySec,
  planFor,
  planMinutes,
  suggestPlan,
  swapInPlan,
} from './plan';
import { selectPlanToday } from './today';
import { habit, sess, state } from './testkit';
import { PersistedState } from './types';

// Monday Sep 28, 2026, noon.
const MON = new Date(2026, 8, 28, 12, 0).getTime();
const at = (month: number, day: number, h = 9) => new Date(2026, month, day, h, 0).getTime();

test('completion: the minimum counts as done, the full length as full', () => {
  const h = habit('a', 30, 5);
  assert.equal(completionOf(h, 0), null);
  assert.equal(completionOf(h, 4 * 60 + 59), null);
  assert.equal(completionOf(h, 5 * 60), 'min');
  assert.equal(completionOf(h, 29 * 60), 'min');
  assert.equal(completionOf(h, 30 * 60), 'full');
});

test('completion adds up the day: two short sessions reach the minimum', () => {
  const h = habit('a', 30, 5);
  const d = state([h], [sess('1', 'a', at(8, 28, 8), 3), sess('2', 'a', at(8, 28, 18), 3)]);
  const days = habitDaySec(d);
  assert.equal(completionOn(h, days, '2026-09-28'), 'min');
});

test('a running timer counts toward today', () => {
  const h = habit('a', 20, 5);
  const d = state([h], [], { active: { habitId: 'a', startedAt: MON - 6 * 60_000, baseSec: 0 } });
  assert.equal(completionOn(h, habitDaySec(d), '2026-09-28'), null, 'saved sessions only');
  assert.equal(completionOn(h, habitDaySec(d, MON), '2026-09-28'), 'min');
});

test('weekly counts: days done this week, before and through a day', () => {
  const h = habit('a', 30, 5, { kind: 'weekly', times: 3 });
  // Sun Sep 27 is last week; Mon, Tue (min), Wed done; Tue also has a second session.
  const d = state([h], [
    sess('0', 'a', at(8, 27), 30),
    sess('1', 'a', at(8, 28), 30),
    sess('2', 'a', at(8, 29), 5),
    sess('3', 'a', at(8, 29, 15), 2),
    sess('4', 'a', at(8, 30), 3),
  ]);
  const days = habitDaySec(d);
  assert.equal(doneBefore(h, days, '2026-09-28'), 0, 'last week does not count');
  assert.equal(doneBefore(h, days, '2026-09-30'), 2);
  assert.equal(doneThrough(h, days, '2026-09-30'), 2, 'Wed has only 3 minutes: not done');
  assert.equal(doneThrough(h, days, '2026-10-04'), 2);
});

test('timer: the ring fills toward the chosen length, counting earlier time today', () => {
  const h = habit('a', 30, 5);
  const d = state([h], [sess('1', 'a', at(8, 28, 8), 2)], { active: { habitId: 'a', startedAt: MON - 60_000, baseSec: 0 } });
  const toMin = selectTimer(d, DEFAULT_CONFIG, MON, 5)!;
  assert.equal(toMin.goalMin, 5);
  assert.equal(toMin.goalIsMin, true);
  assert.ok(Math.abs(toMin.ringProgress - 3 / 5) < 1e-9);
  assert.equal(toMin.reached, false);
  // No goal given (resumed timer): aims for the full length.
  const toFull = selectTimer(d, DEFAULT_CONFIG, MON)!;
  assert.equal(toFull.goalMin, 30);
  assert.equal(toFull.goalIsMin, false);
  const later = selectTimer(d, DEFAULT_CONFIG, MON + 2 * 60_000, 5)!;
  assert.equal(later.reached, true);
  assert.equal(later.ringProgress, 1);
});

test('history marks each habit-day once: solid for full, hollow for minimum', () => {
  const a = habit('a', 30, 5);
  const b = habit('b', 20, 10);
  const d = state([a, b], [
    sess('1', 'a', at(8, 27, 8), 20),
    sess('2', 'a', at(8, 27, 18), 15), // 35m that day: full
    sess('3', 'b', at(8, 27, 10), 12), // min
    sess('4', 'b', at(8, 26, 10), 4), // under the minimum: no mark, never a failure
  ]);
  const m = selectStats(d, DEFAULT_CONFIG, MON, { heatSel: null });
  const marks = m.historyRows.map((r) => [r.id, r.mark]);
  assert.deepEqual(marks, [
    ['2', 'full'],
    ['3', 'min'],
    ['1', null],
    ['4', null],
  ]);
  const day = selectStats(d, DEFAULT_CONFIG, MON, { heatSel: '2026-09-27' });
  assert.deepEqual(day.heatSelSessions.map((s) => [s.id, s.mark]), [
    ['1', null],
    ['3', 'min'],
    ['2', 'full'],
  ]);
});

test('budget: 15..180 minutes in 15-minute steps, 60 by default; cap: 1..5, 3 by default', () => {
  assert.equal(clampBudgetMin(undefined), 60);
  assert.equal(clampBudgetMin(0), 15);
  assert.equal(clampBudgetMin(52), 45);
  assert.equal(clampBudgetMin(53), 60);
  assert.equal(clampBudgetMin(500), 180);
  assert.equal(clampPlanCap(null), 3);
  assert.equal(clampPlanCap(0), 1);
  assert.equal(clampPlanCap(9), 5);
});

// ---------- the plan ----------
const S = { budgetMin: 60, planCap: 3 };
const suggest = (d: PersistedState, day: string, settings = S) => suggestPlan(d, habitDaySec(d), day, settings);

test('priority: fixed weekday, then every day, then weekly habits furthest behind', () => {
  const d = state([
    habit('weekly', 10, 5, { kind: 'weekly', times: 3 }),
    habit('daily', 10, 5),
    habit('monday', 10, 5, { kind: 'days', days: [0] }),
    habit('tuesday', 10, 5, { kind: 'days', days: [1] }),
  ]);
  // Monday: the Monday habit, the daily one, then the weekly one; Tuesday's isn't due.
  assert.deepEqual(suggest(d, '2026-09-28'), ['monday', 'daily', 'weekly']);
  assert.deepEqual(suggest(d, '2026-09-29'), ['tuesday', 'daily', 'weekly']);
});

test('weekly habits: the one furthest behind with the fewest days left goes first', () => {
  const a = habit('a', 10, 5, { kind: 'weekly', times: 3 });
  const b = habit('b', 10, 5, { kind: 'weekly', times: 2 });
  // Friday Oct 2 (3 days left): a has 3 to go (1.0/day), b has 1 to go (0.33/day).
  const d = state([b, a], [sess('1', 'b', at(8, 28), 10)]);
  assert.deepEqual(suggest(d, '2026-10-02', { budgetMin: 60, planCap: 1 }), ['a']);
});

test('a met weekly target is not due; nothing is marked as missed', () => {
  const w = habit('w', 10, 5, { kind: 'weekly', times: 2 });
  const d = state([w], [sess('1', 'w', at(8, 28), 10), sess('2', 'w', at(8, 29), 10)]);
  assert.deepEqual(suggest(d, '2026-09-30'), []);
  const t = selectPlanToday(d, S, new Date(2026, 8, 30, 12).getTime());
  assert.equal(t.free, true, 'a day with nothing due is free, not incomplete');
  assert.equal(t.complete, false);
});

test('cap and budget: never more habits than the cap, never more full minutes than the budget', () => {
  const d = state([habit('a', 30, 5), habit('b', 25, 5), habit('c', 20, 5), habit('d', 10, 5), habit('e', 5, 5)]);
  // 30 + 25 fit; 20 would make 75 > 60, so it's skipped for the 5-minute one.
  assert.deepEqual(suggest(d, '2026-09-28'), ['a', 'b', 'e']);
  assert.deepEqual(suggest(d, '2026-09-28', { budgetMin: 60, planCap: 1 }), ['a']);
  // A habit longer than the whole budget is never planned (it can still be done as a bonus).
  const long = state([habit('x', 90, 10)]);
  assert.deepEqual(suggest(long, '2026-09-28'), []);
});

test('never exceeds the cap or the budget, for any mix of habits', () => {
  let seedN = 7;
  const rnd = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);
  for (let run = 0; run < 200; run++) {
    const n = 1 + Math.floor(rnd() * 10);
    const habits = Array.from({ length: n }, (_, i) => {
      const full = 5 + Math.floor(rnd() * 24) * 5;
      const kind = rnd();
      const f: Frequency =
        kind < 0.4 ? { kind: 'daily' } : kind < 0.7 ? { kind: 'weekly', times: 1 + Math.floor(rnd() * 6) } : { kind: 'days', days: [Math.floor(rnd() * 7)] };
      return habit('h' + i, full, Math.min(5, full), f);
    });
    const budgetMin = 15 * (1 + Math.floor(rnd() * 12));
    const planCap = 1 + Math.floor(rnd() * 5);
    const d = state(habits);
    for (let day = 28; day <= 30; day++) {
      const plan = suggest(d, `2026-09-${day}`, { budgetMin, planCap });
      assert.ok(plan.length <= planCap);
      assert.ok(planMinutes(plan, d) <= budgetMin, `${planMinutes(plan, d)} > ${budgetMin}`);
    }
  }
});

test('eight daily habits rotate: the least recently done come first', () => {
  const habits = Array.from({ length: 8 }, (_, i) => habit('h' + i, 15, 5));
  // h0-h2 were done yesterday (Sunday), the rest earlier or never.
  const d = state(habits, [
    sess('1', 'h0', at(8, 27), 15),
    sess('2', 'h1', at(8, 27), 15),
    sess('3', 'h2', at(8, 27), 15),
    sess('4', 'h3', at(8, 20), 15),
  ]);
  assert.deepEqual(suggest(d, '2026-09-28'), ['h4', 'h5', 'h6'], 'never-done first');
});

test('a stored plan wins and is trimmed to fit if the budget shrank or a habit is gone', () => {
  const d = state([habit('a', 30, 5), habit('b', 20, 5), habit('c', 20, 5)], [], { plans: { '2026-09-28': ['c', 'gone', 'a', 'b'] } });
  assert.deepEqual(planFor(d, habitDaySec(d), '2026-09-28', S), ['c', 'a']);
  assert.deepEqual(fitPlan(['a', 'b'], d, { budgetMin: 45, planCap: 3 }), ['a']);
  assert.deepEqual(planFor(d, habitDaySec(d), '2026-09-28', { budgetMin: 180, planCap: 5 }), ['c', 'a', 'b']);
});

test('swap and add never go over the budget or the cap', () => {
  const d = state([habit('a', 30, 5), habit('b', 20, 5), habit('c', 40, 5), habit('e', 5, 5)]);
  assert.deepEqual(swapInPlan(['a', 'b'], 'b', 'e', d, S), ['a', 'e']);
  assert.equal(swapInPlan(['a', 'b'], 'b', 'c', d, S), null, '30 + 40 > 60');
  assert.equal(swapInPlan(['a', 'b'], 'b', 'a', d, S), null, 'already planned');
  assert.deepEqual(addToPlan(['a', 'b'], 'e', d, S), ['a', 'b', 'e']);
  assert.equal(addToPlan(['a', 'b'], 'c', d, S), null);
  assert.equal(addToPlan(['a', 'b', 'e'], 'e', d, { budgetMin: 180, planCap: 3 }), null);
});
