import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hydrate } from './migrations';
import { applyFrequencies, averageDailyMin, finishRebalance, suggestedFrequency } from './rebalance';
import { habit, state } from './testkit';

test('habits over 30 minutes are suggested 3 times a week; the rest stay as they are', () => {
  assert.deepEqual(suggestedFrequency(habit('a', 45, 5)), { kind: 'weekly', times: 3 });
  assert.deepEqual(suggestedFrequency(habit('b', 30, 5)), { kind: 'daily' });
  // Already twice a week: not raised to three.
  assert.deepEqual(suggestedFrequency(habit('c', 60, 5, { kind: 'weekly', times: 2 })), { kind: 'weekly', times: 2 });
});

test('the average day: full minutes times how often, over a week', () => {
  const hs = [habit('a', 60, 5), habit('b', 20, 5), habit('c', 45, 5)];
  assert.equal(averageDailyMin(hs), 125);
  assert.equal(averageDailyMin(hs, suggestedFrequency), Math.round((60 * 3 + 20 * 7 + 45 * 3) / 7));
});

test('applying only touches habits whose frequency changes (so only they sync)', () => {
  const hs = [habit('a', 45, 5), habit('b', 20, 5)];
  const out = applyFrequencies(hs, { a: { kind: 'weekly', times: 3 }, b: { kind: 'daily' } });
  assert.notEqual(out[0], hs[0]);
  assert.deepEqual(out[0].frequency, { kind: 'weekly', times: 3 });
  assert.equal(out[0].weeklyTargetMin, 135);
  assert.equal(out[1], hs[1], 'unchanged habit keeps its identity');
});

test('the rebalance shows once: either button clears it for good, and nothing is lost', () => {
  const d = state([habit('a', 45, 5), habit('b', 20, 5)], [], { rebalancePending: true, plans: { '2026-09-28': ['a', 'b'], '2026-09-27': ['a'] } });
  const kept = finishRebalance(d, null, '2026-09-28');
  assert.equal(kept.rebalancePending, false);
  assert.equal(kept.habits, d.habits);
  assert.deepEqual(kept.plans, d.plans);

  const applied = finishRebalance(d, { a: { kind: 'weekly', times: 3 }, b: { kind: 'daily' } }, '2026-09-28');
  assert.equal(applied.rebalancePending, false);
  assert.deepEqual(applied.habits.map((h) => h.frequency), [{ kind: 'weekly', times: 3 }, { kind: 'daily' }]);
  assert.deepEqual(applied.plans, { '2026-09-27': ['a'] }, "today's plan is suggested again; history stays");
  assert.equal(applied.sessions, d.sessions);

  // Saved and loaded again, it stays dismissed.
  const reloaded = hydrate({ v3: JSON.stringify(applied), v2: null }, Date.now());
  assert.equal(reloaded.rebalancePending, false);
});
