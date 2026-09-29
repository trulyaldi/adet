import assert from 'node:assert/strict';
import { test } from 'node:test';

import { feedbackAllowed, hasSfxFile } from './gate';

test('running and paused sessions mute all Quest feedback', () => {
  for (const context of ['quest', 'loot', 'ceremony', 'timer'] as const) assert.equal(feedbackAllowed(context, true), false);
  assert.equal(feedbackAllowed('timer', false), false);
  assert.equal(feedbackAllowed('quest', false), true);
  assert.equal(feedbackAllowed('loot', false), true);
});

test('missing sound files are silent no-ops', () => {
  assert.equal(hasSfxFile('ui_tap'), true);
  assert.equal(hasSfxFile('boss_defeat'), false);
  assert.equal(hasSfxFile('chest_open'), false);
});
