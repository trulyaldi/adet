import assert from 'node:assert/strict';
import { test } from 'node:test';

import { newlyConquered, resetFlagMemory } from './flagMemory';

test('a flag rises once per conquest, never for flags already standing', () => {
  resetFlagMemory();
  assert.deepEqual(newlyConquered(['a']), []);
  assert.deepEqual(newlyConquered(['a', 'b']), ['b']);
  assert.deepEqual(newlyConquered(['a', 'b']), []);
  // Undone, then conquered again: it rises again.
  assert.deepEqual(newlyConquered(['a']), []);
  assert.deepEqual(newlyConquered(['a', 'b']), ['b']);
});
