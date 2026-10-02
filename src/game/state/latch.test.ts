// The double-tap guard on Done and on the result buttons.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createLatch } from './latch';

test('a burst of taps acts once, until released', () => {
  const latch = createLatch();
  let acted = 0;
  const tap = () => latch.take() && acted++;
  tap();
  tap();
  tap();
  assert.equal(acted, 1);
  latch.release();
  tap();
  assert.equal(acted, 2);
});

test('latches are independent', () => {
  const a = createLatch();
  const b = createLatch();
  assert.equal(a.take(), true);
  assert.equal(b.take(), true);
  assert.equal(a.take(), false);
});
