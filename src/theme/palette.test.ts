import assert from 'node:assert/strict';
import test from 'node:test';

import { BRAND, contrast, INK, mix, PROJECT_COLORS, resolveSwatch, SWATCHES, WHITE } from './palette';
import { DARK_THEME, LIGHT_THEME } from './theme';

test('eight project colors, each with base, light, dark and on-color', () => {
  assert.equal(PROJECT_COLORS.length, 8);
  for (const k of PROJECT_COLORS) {
    const s = SWATCHES[k];
    for (const v of [s.base, s.light, s.dark, s.on]) assert.match(v, /^#[0-9A-F]{6}$/);
  }
});

test('WCAG AA (4.5:1) for text on every project color', () => {
  for (const k of PROJECT_COLORS) {
    const s = SWATCHES[k];
    assert.ok(contrast(s.on, s.base) >= 4.5, `${k}: on-color on base ${contrast(s.on, s.base).toFixed(2)}`);
    assert.ok(contrast(s.dark, s.light) >= 4.5, `${k}: dark text on light ${contrast(s.dark, s.light).toFixed(2)}`);
    assert.ok(contrast(s.dark, WHITE) >= 4.5, `${k}: dark text on white`);
    assert.ok(contrast(INK, s.light) >= 4.5, `${k}: ink on light`);
    // Dark theme: ink (light) on the deep tint.
    const d = resolveSwatch(s, true, DARK_THEME.colors.card);
    assert.ok(contrast(DARK_THEME.colors.ink, d.light) >= 4.5, `${k}: dark-theme ink on tint`);
  }
});

test('theme text colors pass AA on their backgrounds', () => {
  for (const t of [LIGHT_THEME, DARK_THEME]) {
    const c = t.colors;
    for (const surface of [c.bg, c.card]) {
      assert.ok(contrast(c.ink, surface) >= 4.5);
      assert.ok(contrast(c.sub, surface) >= 4.5, `sub on ${surface}: ${contrast(c.sub, surface).toFixed(2)}`);
    }
    assert.ok(contrast(c.amber, c.amberBg) >= 4.5, 'amber on amberBg');
  }
});

test('brand blue stays #0A7AFF; white on it passes AA for large bold text (3:1)', () => {
  assert.equal(BRAND.base, '#0A7AFF');
  assert.ok(contrast(WHITE, BRAND.base) >= 3);
});

test('mix blends linearly', () => {
  assert.equal(mix('#000000', '#FFFFFF', 0), '#000000');
  assert.equal(mix('#000000', '#FFFFFF', 1), '#FFFFFF');
});
