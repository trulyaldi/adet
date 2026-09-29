import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ATLAS_SIZES, frameAt, hasSprite, REQUIRED_IDS, sprite } from './manifest';

test('the manifest has zero missing ids', () => {
  const missing = REQUIRED_IDS.filter((id) => !hasSprite(id));
  assert.deepEqual(missing, []);
});

test('every frame sits inside its atlas, and frames of one sprite share a size', () => {
  for (const id of REQUIRED_IDS) {
    const m = sprite(id);
    const [W, H] = ATLAS_SIZES[m.atlas];
    for (const [x, y, w, h] of m.frames) {
      assert.ok(x >= 0 && y >= 0 && x + w <= W && y + h <= H, `${id} out of bounds`);
      assert.equal(w, m.w, id);
      assert.equal(h, m.h, id);
    }
  }
});

test('one pixel density: tiles are 16 px, mobs 16 px, bosses 64 px', () => {
  assert.equal(sprite('tile.forest.ground.a').w, 16);
  assert.equal(sprite('mob.swamp.toad.idle').w, 16);
  assert.equal(sprite('boss.swamp.hydra.idle').w, 64);
  assert.equal(sprite('boss.forest.wisp.idle').frames.length, 4);
});

test('frames advance at the sprite fps; unknown ids never throw', () => {
  const m = sprite('mob.forest.slime.idle');
  assert.equal(frameAt(m, 0), 0);
  assert.equal(frameAt(m, 1000 / m.fps), 1);
  assert.equal(frameAt(m, (2 * 1000) / m.fps), 0);
  assert.equal(sprite('nope.nothing').id, 'nope.nothing');
});
