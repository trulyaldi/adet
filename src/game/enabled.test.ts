import assert from 'node:assert/strict';
import { test } from 'node:test';

import { questEnabledFrom } from './enabled';

test('Quest Mode is on unless explicitly switched off', () => {
  for (const on of [undefined, '', 'true', '1', 'yes', ' TRUE ']) assert.equal(questEnabledFrom(on), true, String(on));
  for (const off of ['false', 'FALSE', '0', 'off', 'no', ' false ']) assert.equal(questEnabledFrom(off), false, off);
});
