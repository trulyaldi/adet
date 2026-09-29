import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayPhase, desaturate, IDENTITY, mulMatrix, nightLight } from './daylight';

test('day phases by local hour', () => {
  assert.equal(dayPhase(5), 'dawn');
  assert.equal(dayPhase(12), 'day');
  assert.equal(dayPhase(19), 'dusk');
  assert.equal(dayPhase(23), 'night');
  assert.equal(dayPhase(2), 'night');
  assert.equal(nightLight('night'), 1);
  assert.equal(nightLight('day'), 0);
});

test('matrices: identity is neutral; no desaturation is identity', () => {
  const m = desaturate(0.5, 0.8);
  assert.deepEqual(mulMatrix(IDENTITY, m), m);
  desaturate(0).forEach((v, i) => assert.ok(Math.abs(v - IDENTITY[i]) < 1e-9));
});
