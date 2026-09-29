import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as ops from '../items/ops';
import { habit, sess, state } from '../testkit';
import { gameStateOf, hasFreshChest, previewClaim } from './fromData';

const NOW = new Date(2026, 8, 29, 18, 0).getTime();

test('the game from app data: archived projects leave the boss target; memoised by slices', () => {
  const started = ops.startQuest({ items: [], links: [] }, NOW - 86_400_000).items;
  const h1 = habit('h1', 30, 5, { kind: 'daily' }, { weeklyTargetMin: 600 });
  const h2 = habit('h2', 30, 5, { kind: 'daily' }, { projectId: 'p2', weeklyTargetMin: 600 });
  const data = state([h1, h2], [sess('s1', 'h1', NOW - 3600_000, 40)], {
    items: started,
    projects: [
      { id: 'p1', name: 'P', weeklyTarget: 8, started: 0 },
      { id: 'p2', name: 'Old', weeklyTarget: 8, started: 0, archivedAt: 1 },
    ],
  });
  const g = gameStateOf(data, NOW);
  assert.equal(g.journey.totalDamage, 40);
  assert.equal(gameStateOf(data, NOW + 3_600_000), g, 'same slices, any time: cached');
  assert.equal(gameStateOf({ ...data, active: { habitId: 'h1', startedAt: NOW, baseSec: 0 } }, NOW), g, 'a timer starting recomputes nothing');
});

test('previewClaim reports what opening a chest adds', () => {
  const started = ops.startQuest({ items: [], links: [] }, NOW - 86_400_000);
  const q = ops.addTask(started, 'h1', 'Ship it', NOW, 't1');
  const data = state([habit('h1', 30, 5)], [sess('s1', 'h1', NOW - 3600_000, 30)], { items: q.items, links: q.links });
  const p = previewClaim(data, NOW, { sessionId: 's1', habitId: 'h1', doneTaskIds: ['t1'], text: 'shipped' });
  assert.equal(p.critDamage, 10);
  assert.equal(p.xpGained, 15 + 6);
  assert.equal(p.creditsGained, 2);
  assert.equal(p.after.chests.unopened.length, 0);
  assert.equal(p.before.chests.unopened.length, 1);
});

test('chest freshness is worked out from the clock, outside the memo', () => {
  const started = ops.startQuest({ items: [], links: [] }, NOW - 86_400_000).items;
  const data = state([habit('h1', 30, 5)], [sess('s1', 'h1', NOW - 3600_000, 30)], { items: started });
  const g = gameStateOf(data, NOW);
  assert.equal(hasFreshChest(g, NOW), true);
  assert.equal(hasFreshChest(g, NOW + 25 * 3600_000), false);
});
