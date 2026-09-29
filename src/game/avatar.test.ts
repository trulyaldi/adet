import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveAvatarLayers } from '../domain/game/avatar';
import { hasSprite } from './assets/manifest';
import { avatarLayers } from './avatar';
import { GEAR_SKUS, isEquippable, SHOP_BY_SKU } from './content/shop';

test('all seven tiers compose from existing layers', () => {
  for (let t = 0; t < 7; t++) {
    const layers = avatarLayers({ tier: t, gear: {} });
    assert.ok(layers.includes('avatar.body'));
    assert.ok(layers.includes(`avatar.outfit.${t}`));
    for (const l of layers) assert.ok(hasSprite(l), l);
  }
  for (const sku of GEAR_SKUS) assert.ok(hasSprite(`avatar.${sku}`), sku);
  assert.ok(hasSprite('avatar.wave'));
});

test('resolveAvatarLayers: z-order back → body → outfit → head → hand → pips', () => {
  const l = resolveAvatarLayers(3, { cloak: 'cloak.dusk', helmet: 'helmet.star', weapon: 'weapon.sun', banner: 'banner.tide' }, 2, SHOP_BY_SKU);
  assert.deepEqual(
    l.map((x) => [x.layer, x.id]),
    [
      ['back', 'avatar.banner.tide'],
      ['back', 'avatar.cloak.dusk'],
      ['body', 'avatar.body'],
      ['outfit', 'avatar.outfit.3'],
      ['head', 'avatar.helmet.star'],
      ['hand', 'avatar.weapon.sun'],
      ['pip', 'avatar.pip'],
      ['pip', 'avatar.pip'],
    ]
  );
});

test('resolveAvatarLayers: unknown or misplaced SKUs fall back to the tier default', () => {
  const plain = resolveAvatarLayers(3, {}, 0, SHOP_BY_SKU);
  // A newer build's cloak, a helmet in the weapon slot: both ignored.
  const odd = resolveAvatarLayers(3, { cloak: 'cloak.future', weapon: 'helmet.leaf' }, 0, SHOP_BY_SKU);
  assert.deepEqual(odd, plain);
  assert.deepEqual(
    plain.map((x) => x.id),
    ['avatar.back.3', 'avatar.body', 'avatar.outfit.3', 'avatar.weapon.basic']
  );
  // Tier 0 carries the staff; out-of-range tiers clamp.
  assert.equal(resolveAvatarLayers(0, {}, 0, SHOP_BY_SKU).at(-1)!.id, 'avatar.weapon.staff');
  assert.ok(resolveAvatarLayers(99, {}, 0, SHOP_BY_SKU).some((x) => x.id === 'avatar.outfit.6'));
  assert.ok(resolveAvatarLayers(-4, {}, 0, SHOP_BY_SKU).some((x) => x.id === 'avatar.outfit.0'));
});

test('resolveAvatarLayers: one pip per ascension, at most three', () => {
  const pips = (n: number) => resolveAvatarLayers(1, {}, n, SHOP_BY_SKU).filter((x) => x.layer === 'pip').length;
  assert.equal(pips(0), 0);
  assert.equal(pips(2), 2);
  assert.equal(pips(9), 3);
  assert.equal(pips(NaN), 0);
});

test('isEquippable: owned, rank-gated, right slot', () => {
  const owned = new Set(['cloak.moss', 'cloak.aurora', 'pet.fox', 'fire.crystal']);
  assert.equal(isEquippable('cloak.moss', 'cloak', owned, 0), true);
  // Not owned.
  assert.equal(isEquippable('cloak.dusk', 'cloak', owned, 6), false);
  // Owned but above the current rank (Aurora needs Warden, tier 4).
  assert.equal(isEquippable('cloak.aurora', 'cloak', owned, 3), false);
  assert.equal(isEquippable('cloak.aurora', 'cloak', owned, 4), true);
  // Wrong slot, unknown SKU.
  assert.equal(isEquippable('cloak.moss', 'helmet', owned, 6), false);
  assert.equal(isEquippable('pet.fox', 'companion', owned, 0), true);
  assert.equal(isEquippable('pet.fox', 'camp', owned, 0), false);
  assert.equal(isEquippable('fire.crystal', 'camp', owned, 4), true);
  assert.equal(isEquippable('cloak.future', 'cloak', new Set(['cloak.future']), 6), false);
});
