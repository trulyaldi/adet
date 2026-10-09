import assert from 'node:assert/strict';
import { test } from 'node:test';

import { projectRealmsFrom, questEnabledFrom } from './enabled';

test('Quest Mode is on unless explicitly switched off', () => {
  for (const on of [undefined, '', 'true', '1', 'yes', ' TRUE ']) assert.equal(questEnabledFrom(on), true, String(on));
  for (const off of ['false', 'FALSE', '0', 'off', 'no', ' false ']) assert.equal(questEnabledFrom(off), false, off);
});

test('Projects as Realms is off unless explicitly switched on', () => {
  for (const on of ['true', '1', 'on', 'yes', ' TRUE ']) assert.equal(projectRealmsFrom(on), true, on);
  for (const off of [undefined, '', 'false', '0', 'off', 'no', 'maybe']) assert.equal(projectRealmsFrom(off), false, String(off));
});
