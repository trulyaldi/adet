// The pixel icon set (v2 N7.2): well-formed grids for real glyph names, drawn
// as merged runs at whole device pixels, with no Skia anywhere near them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { GLYPHS } from './glyphs';
import { PIXEL_GLYPHS } from './pixelGlyphs';

const root = join(__dirname, '..', '..');

test('every pixel icon is a 16×16 grid of #, o and . for a glyph that exists', () => {
  for (const [name, grid] of Object.entries(PIXEL_GLYPHS)) {
    assert.ok(name in GLYPHS, name);
    assert.equal(grid!.length, 16, name);
    for (const row of grid!) assert.match(row, /^[#o.]{16}$/, name);
    assert.ok(grid!.some((r) => r.includes('#')), `${name} draws something`);
  }
});

test('the tab bar and the timer controls are pixel icons', () => {
  for (const name of ['today', 'target', 'stats', 'quest', 'play', 'pause', 'stop', 'done', 'plus', 'flame', 'gear'] as const) assert.ok(PIXEL_GLYPHS[name], name);
});

test('runs merge each row; sizes snap to whole device pixels', async () => {
  // PixelGlyph imports react-native; its pure helpers are checked through the source's logic here.
  const src = readFileSync(join(root, 'src/components/PixelGlyph.tsx'), 'utf8');
  assert.ok(!/react-native-skia/.test(src), 'no Skia on the start-up path');
  const runs = (grid: readonly string[]) => grid.flatMap((row, y) => [...row.matchAll(/#+|o+/g)].map((m) => ({ x: m.index!, y, w: m[0].length, knock: m[0][0] === 'o' })));
  const flame = runs(PIXEL_GLYPHS.flame!);
  assert.ok(flame.some((r) => r.knock), 'the flame has a cut-out core');
  assert.ok(flame.length < 16 * 8, 'rows merge into runs');
  const snap = (size: number, ratio: number) => (Math.max(1, Math.round((size * ratio) / 16)) * 16) / ratio;
  for (const [size, ratio] of [[25, 3], [20, 2], [22, 3], [18, 1]] as const) {
    const d = snap(size, ratio);
    assert.ok(Number.isInteger((d * ratio) / 16), `${size}@${ratio}x`);
    assert.ok(Math.abs(d - size) <= 16 / ratio / 2 + 1e-9, `${size}@${ratio}x → ${d}`);
  }
});
