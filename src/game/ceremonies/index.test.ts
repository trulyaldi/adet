import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deriveGameState } from '../../domain/game/derive';
import * as ops from '../../domain/items/ops';
import { bossRun } from '.';

test('battle report counts sessions in the defeated biome', () => {
  const at = Date.UTC(2026, 8, 1);
  const meta = ops.startQuest({ items: [], links: [] }, at - 1).items;
  const session = { id: 's1', habitId: 'h1', start: at, end: at + 160 * 60_000, duration: 160 * 60 };
  const game = deriveGameState({ sessions: [session], habits: [{ id: 'h1', weeklyTargetMin: 300 }], items: meta, links: [], now: at });
  assert.deepEqual(bossRun(game, 'forest:0'), { sessions: 1, tasks: 0, entries: [] });
});
