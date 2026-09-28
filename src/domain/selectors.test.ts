import assert from 'node:assert/strict';
import test from 'node:test';

import { memoLast } from './selectors';

test('memoLast returns the last result while the keys are the same objects', () => {
  let calls = 0;
  const f = memoLast((o: { n: number }, k: number) => {
    calls++;
    return { v: o.n + k };
  });
  const a = { n: 1 };
  const r1 = f(a, 2);
  assert.equal(f(a, 2), r1);
  assert.equal(calls, 1);
  // A new object with equal contents is a change (identity, like React).
  assert.deepEqual(f({ n: 1 }, 2), r1);
  assert.equal(calls, 2);
  f({ n: 1 }, 3);
  assert.equal(calls, 3);
});

test('memoLast can key on a derived value', () => {
  let calls = 0;
  const hour = memoLast(
    (_d: object, now: number) => {
      calls++;
      return now;
    },
    (d, now) => [d, Math.floor(now / 3_600_000)]
  );
  const d = {};
  assert.equal(hour(d, 1000), 1000);
  assert.equal(hour(d, 5000), 1000, 'same hour: cached');
  assert.equal(hour(d, 3_600_000), 3_600_000);
  assert.equal(calls, 2);
});
