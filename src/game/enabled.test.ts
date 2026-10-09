import assert from 'node:assert/strict';
import { test } from 'node:test';

import { projectRealmsFrom, questEnabledFrom } from './enabled';

test('Quest Mode is on unless explicitly switched off', () => {
  for (const on of [undefined, '', 'true', '1', 'yes', ' TRUE ']) assert.equal(questEnabledFrom(on), true, String(on));
  for (const off of ['false', 'FALSE', '0', 'off', 'no', ' false ']) assert.equal(questEnabledFrom(off), false, off);
});

test('Projects as Realms is off unless explicitly on, and only while Quest Mode is on', () => {
  for (const off of [undefined, '', 'false', '0', 'off', 'no', 'maybe']) assert.equal(projectRealmsFrom(off, true), false, String(off));
  for (const on of ['true', '1', 'on', 'yes', ' TRUE ']) {
    assert.equal(projectRealmsFrom(on, true), true, on);
    assert.equal(projectRealmsFrom(on, false), false, `${on} without Quest Mode`);
  }
});
