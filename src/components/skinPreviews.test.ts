// Every skin has a preview of the right size, drawn only in known colours.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TIMER_SKINS } from '../domain/game/timerSkin';
import { SKIN_PREVIEW_COLORS, SKIN_PREVIEW_COLS, SKIN_PREVIEW_ROWS, SKIN_PREVIEWS } from './skinPreviews';

test('skin previews: 12×10, every pixel a known colour', () => {
  for (const skin of TIMER_SKINS) {
    const grid = SKIN_PREVIEWS[skin];
    assert.equal(grid.length, SKIN_PREVIEW_ROWS, skin);
    for (const row of grid) {
      assert.equal(row.length, SKIN_PREVIEW_COLS, `${skin}: ${row}`);
      for (const c of row) assert.ok(c in SKIN_PREVIEW_COLORS, `${skin}: '${c}'`);
    }
  }
});
