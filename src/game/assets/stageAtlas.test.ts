// The timer Stage (and its skins) batches sprites by atlas (v2 N6): every id it draws must
// live in the atlas it names, or a batch reads another atlas's pixels.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BIOME_IDS } from '../../domain/game/biomes';
import { bossId, mobId, ROSTER } from '../content/roster';
import { hasSprite, sprite } from './manifest';

test('the Stage draws each sprite from its own atlas', () => {
  for (const b of BIOME_IDS) {
    for (const id of [`parallax.${b}.cloud`, `parallax.${b}.far.a`, `parallax.${b}.far.b`, `tile.${b}.ground.a`, `tile.${b}.ground.b`, `tile.${b}.ground.c`, `decor.${b}.landmark`]) {
      assert.ok(hasSprite(id), id);
      assert.equal(sprite(id).atlas, b, id);
    }
    for (const m of ROSTER[b].mobs) assert.ok(hasSprite(`${mobId(b, m.key)}.idle`));
    for (const pose of ['idle', 'low']) assert.ok(hasSprite(`${bossId(b)}.${pose}`));
  }
  for (const id of ['fx.zzz', 'fx.dazed', 'fx.hit', 'icon.coin', 'icon.calendar', 'icon.sword', 'icon.quill', 'fx.glow.warm', 'prop.campfire.default.lit', 'npc.sage.idle@flip']) {
    assert.ok(hasSprite(id), id);
    assert.equal(sprite(id).atlas, 'shared', id);
  }
});
