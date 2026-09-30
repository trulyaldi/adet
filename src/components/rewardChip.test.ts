import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rewardChipText } from './rewardChip';

test('reward chips say only what was gained', () => {
  assert.equal(rewardChipText({ xp: 10, credits: 0 }, { xp: 15, credits: 0 }), '+5 XP');
  assert.equal(rewardChipText({ xp: 0, credits: 10 }, { xp: 0, credits: 15 }), '+5 credits');
  assert.equal(rewardChipText({ xp: 0, credits: 0 }, { xp: 60, credits: 40 }), '+60 XP  +40 credits');
  assert.equal(rewardChipText({ xp: 20, credits: 5 }, { xp: 15, credits: 5 }), null, 'a loss shows nothing (no negative chips)');
});
