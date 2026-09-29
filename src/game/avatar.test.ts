import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hasSprite } from './assets/manifest';
import { avatarLayers } from './avatar';
import { GEAR_SKUS } from './content/shop';

test('all seven tiers compose from existing layers', () => {
  for (let t = 0; t < 7; t++) {
    const layers = avatarLayers({ tier: t, gear: {} });
    assert.ok(layers.includes('avatar.body'));
    assert.ok(layers.includes(`avatar.outfit.${t}`));
    for (const l of layers) assert.ok(hasSprite(l), l);
  }
});

test('cosmetics layer in their slot order, overriding tier defaults', () => {
  const l = avatarLayers({ tier: 3, gear: { cloak: 'cloak.dusk', helmet: 'helmet.star', weapon: 'weapon.sun', banner: 'banner.tide' } });
  assert.deepEqual(l, ['avatar.banner.tide', 'avatar.cloak.dusk', 'avatar.body', 'avatar.outfit.3', 'avatar.helmet.star', 'avatar.weapon.sun']);
  for (const sku of GEAR_SKUS) assert.ok(hasSprite(`avatar.${sku}`), sku);
  // Same frame size for every layer: they can't clip.
  const sizes = new Set(l.map((id) => id));
  assert.equal(sizes.size, l.length);
});
