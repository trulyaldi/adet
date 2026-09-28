import assert from 'node:assert/strict';
import test from 'node:test';

import { ILMEK_BLUE, ilmekTones, tonesFrom } from './mascot';
import { PROJECT_COLORS } from './palette';

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbDistance = (a: string, b: string) => Math.max(...channels(a).map((v, i) => Math.abs(v - channels(b)[i])));

test('no tint is the reference brand blue', () => {
  assert.deepEqual(ilmekTones(), ILMEK_BLUE);
});

test('derived tones reproduce the reference sheet from its body color', () => {
  const d = tonesFrom(ILMEK_BLUE.body);
  for (const k of ['shade', 'gloss', 'belly'] as const) assert.ok(rgbDistance(d[k], ILMEK_BLUE[k]) <= 10, `${k}: ${d[k]} vs ${ILMEK_BLUE[k]}`);
});

test('every project tint swaps all four tones: shade darker, gloss and belly lighter', () => {
  for (const k of PROJECT_COLORS) {
    const t = ilmekTones(k);
    assert.notDeepEqual(t, ILMEK_BLUE);
    const lum = (hex: string) => channels(hex).reduce((a, v) => a + v, 0);
    assert.ok(lum(t.shade) < lum(t.body), `${k} shade`);
    assert.ok(lum(t.gloss) > lum(t.body) && lum(t.belly) > lum(t.gloss), `${k} gloss/belly`);
  }
});
