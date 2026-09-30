// v2 N5: the player's character replaced the old mascot everywhere, and every
// avatar animation has frames on every layer, for every rank tier and piece of gear.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';

import { TIER_COUNT } from '../domain/game/avatar';
import { hasSprite, sprite } from './assets/manifest';
import { AVATAR_ANIMATIONS, avatarLayers, POSE } from './avatar';
import { SHOP } from './content/shop';

const root = join(__dirname, '..', '..');
const OLD_NAME = ['il', 'mek'].join(''); // spelled apart so this file doesn't match itself

test('no trace of the old mascot in src/, assets/ or docs/', () => {
  let hits = '';
  try {
    hits = execFileSync('git', ['grep', '-il', OLD_NAME, '--', 'src', 'assets', 'docs'], { cwd: root, encoding: 'utf8' });
  } catch (e) {
    // git grep exits 1 when nothing matches.
    if ((e as { status?: number }).status !== 1) throw e;
  }
  assert.equal(hits.trim(), '');
});

test('every avatar animation has frames on every layer, for all tiers and gear', () => {
  const gearSkus = SHOP.filter((s) => s.slot).map((s) => s.sku);
  const looks = [
    ...Array.from({ length: TIER_COUNT }, (_, tier) => ({ tier, gear: {} })),
    ...gearSkus.map((sku) => ({ tier: 2, gear: { [SHOP.find((s) => s.sku === sku)!.slot!]: sku } })),
  ];
  for (const look of looks) {
    for (const id of avatarLayers(look)) {
      assert.ok(hasSprite(id), id);
      const frames = sprite(id).frames.length;
      for (const anim of AVATAR_ANIMATIONS) {
        const need = Math.max(...POSE[anim]) + 1;
        assert.ok(frames >= need, `${id} has ${frames} frames; ${anim} needs ${need}`);
      }
    }
  }
  for (const id of ['fx.zzz', 'avatar.wave']) assert.ok(sprite(id).frames.length > 0, id);
});

test('all layers of a pose share one frame size (gear never detaches)', () => {
  const sizes = new Set(avatarLayers({ tier: 6, gear: {} }).flatMap((id) => sprite(id).frames.map((f) => `${f[2]}x${f[3]}`)));
  assert.deepEqual([...sizes], ['20x26']);
});
