// The build's release guard, as a unit: a stand-in without an allowlist
// entry is refused.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { unlistedStandIns } from '../../../scripts/art-sources';

test('stand-ins must be on the needs-art allowlist', () => {
  const provenance = new Map([
    ['tile.forest.ground.a', { source: 'recolor' as const, pack: 'kenney-tiny-town', file: 'x.png' }],
    ['boss.forest.wisp.idle', { source: 'stand-in' as const }],
    ['mob.forest.slime.idle', { source: 'stand-in' as const }],
  ]);
  assert.deepEqual(unlistedStandIns(provenance, { 'boss.forest.wisp.idle': 'needs a 64 px boss' }), ['mob.forest.slime.idle']);
  assert.deepEqual(unlistedStandIns(provenance, { 'boss.forest.wisp.idle': 'x', 'mob.forest.slime.idle': 'y' }), []);
});
