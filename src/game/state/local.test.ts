import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planForSession } from './local';

test('a plan attaches only to its own session', () => {
  const plan = { habitId: 'h1', createdAt: 1_000_000, taskIds: ['a', 'b'] };
  assert.deepEqual(planForSession(plan, { habitId: 'h1', start: 990_000, end: 2_000_000 }), ['a', 'b']);
  assert.deepEqual(planForSession(plan, { habitId: 'h2', start: 990_000, end: 2_000_000 }), [], 'other habit');
  assert.deepEqual(planForSession(plan, { habitId: 'h1', start: 1_200_000, end: 2_000_000 }), [], 'made before this session');
  assert.deepEqual(planForSession(plan, { habitId: 'h1', start: 100, end: 500_000 }), [], 'made after it ended');
  assert.deepEqual(planForSession(null, { habitId: 'h1', start: 0, end: 1 }), []);
});
