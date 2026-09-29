import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nodeAt } from '../../domain/game/derive';
import { BAND_W, BAND_X, biomeMaps } from '../../game/content/biomes';
import { avatarSpot, biomeStatus, campLayout, hitTest, nodeState, planReveal, REVEAL_MAX_MS, targetAt } from './model';

const maps = biomeMaps();

test('biomes and nodes show as past, current or ahead of the position', () => {
  const pos = nodeAt(8 + 2); // swamp, node 2
  assert.equal(biomeStatus(0, pos), 'past');
  assert.equal(biomeStatus(1, pos), 'current');
  assert.equal(biomeStatus(2, pos), 'future');
  assert.equal(nodeState(1, 1, pos), 'defeated');
  assert.equal(nodeState(1, 2, pos), 'active');
  assert.equal(nodeState(1, 3, pos), 'ahead');
  assert.equal(nodeState(0, 7, pos), 'defeated');
});

test('the avatar stands just below the node it faces', () => {
  for (const m of maps) {
    for (const n of m.nodes) {
      const s = avatarSpot(m, n.index);
      assert.ok(s.y > n.y, `${m.id} node ${n.index}`);
      assert.ok(s.y - n.y < 40);
    }
  }
});

test('the camp stays on the island, wherever the avatar is', () => {
  for (const x of [BAND_X + 4, 64, BAND_X + BAND_W - 4]) {
    for (const c of campLayout({ x, y: 100 })) {
      assert.ok(c.x >= BAND_X + 8 && c.x <= BAND_X + BAND_W - 8, `${c.thing} at ${c.x}`);
    }
  }
});

test('the reveal walks node to node in under four seconds, popping beaten mobs', () => {
  assert.equal(planReveal(maps, 5, 5), null);
  const r = planReveal(maps, 0, 5)!;
  assert.equal(r.points.length, 6);
  assert.ok(r.stepMs * (r.points.length - 1) <= REVEAL_MAX_MS);
  // Nodes 0, 1, 2 and 4 are mobs that were passed (3 is the camp).
  assert.equal(r.pops.length, 4);
  const long = planReveal(maps, 0, 200)!;
  assert.ok(long.points.length <= 13, 'long gaps skip ahead');
  assert.ok(long.stepMs * (long.points.length - 1) <= REVEAL_MAX_MS);
});

test('tap targets are at least the minimum size, and the nearest wins', () => {
  const a = targetAt('node', 'a', 50, 50, 4, 4, 15);
  const b = targetAt('node', 'b', 60, 50, 16, 16, 15);
  assert.equal(a.w, 15);
  assert.equal(hitTest([a, b], 51, 43)?.key, 'a');
  assert.equal(hitTest([a, b], 61, 42)?.key, 'b');
  assert.equal(hitTest([a, b], 200, 200), null);
});
