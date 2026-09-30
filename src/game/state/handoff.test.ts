// Crash on completing a long session (docs/quest/CRASH_INVESTIGATION.md):
// base damage lands when the session is saved, so a long one can beat a boss
// before its chest is opened. Its full-screen scene must never present while
// the focus view or the Loot sheet is still animating in or out.
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { ceremonyMayPlay, ceremonyVisible, detectCeremonies, seedCeremonyMarks } from '../../domain/game/ceremonies';
import { deriveGameState } from '../../domain/game/derive';
import { fixedTz } from '../../domain/game/tz';
import * as ops from '../../domain/items/ops';
import { sess } from '../../domain/testkit';
import { ceremoniesHeld } from '../ceremonies/gate';
import { closeLootAfter, handOffAfterStop, isLootOpen } from './loot';

const GAP = 450;
const D0 = Date.UTC(2026, 8, 1, 6);
const habits = [{ id: 'h1', weeklyTargetMin: 300 }];
const started = ops.startQuest({ items: [], links: [] }, D0 - 1).items;
const derive = (min: number, items = started) =>
  deriveGameState({ sessions: [sess('s1', 'h1', D0, min)], habits, items, links: [], now: D0 + 86_400_000, tz: fixedTz(0) });

test('a fresh journey: 299 focused minutes beat the Fog Wisp on save, 298 do not', () => {
  // 3 mobs + 3 mobs (150) + the tutorial boss (120) = 270; the day cap makes 299 min worth 269.5 → 270.
  assert.equal(derive(298).journey.defeated.length, 0);
  const g = derive(299);
  assert.deepEqual(g.journey.defeated.map((d) => d.biome), ['forest']);
  assert.equal(g.sessions[0].claimed, false, 'no chest opened: base damage alone');
});

test('the boss scene waits through the stop → Loot → close hand-offs', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    // The watcher records the boss as soon as the session is saved.
    const before = deriveGameState({ sessions: [], habits, items: started, links: [], now: D0, tz: fixedTz(0) });
    const marks = seedCeremonyMarks(before);
    const saved = derive(299);
    const items = ops.addAchievements({ items: started, links: [] }, saved.newAchievements, D0).items;
    const game = derive(299, items);
    const [next] = detectCeremonies(marks, game);
    assert.equal(next?.kind, 'boss_defeated', 'a full-screen Modal scene is due');

    // What the host sees: no timer (it just stopped), nothing else up.
    const ctx = () => ({ timerActive: false, lootOpen: isLootOpen(), modalOpen: ceremoniesHeld(), revealPending: false, appActive: true });
    const quietAt: number[] = [];
    let t = 0;
    const step = (to: number) => {
      for (; t < to; t += 10) {
        if (ceremonyMayPlay(ctx()) || ceremonyVisible(ctx())) quietAt.push(t);
        mock.timers.tick(10);
      }
    };

    handOffAfterStop('s1', GAP); // the focus view animates out; Loot comes in at GAP
    step(GAP + 10);
    assert.equal(isLootOpen(), true);
    step(2000); // the chest is opened
    closeLootAfter(GAP, () => {});
    step(2000 + GAP);
    assert.deepEqual(quietAt, [], 'no scene during a hand-off');
    step(2000 + GAP + 20);
    assert.equal(ceremonyMayPlay(ctx()), true, 'then it plays');
  } finally {
    mock.timers.reset();
  }
});

test('a short or edited session has no Loot sheet, and still hands off quietly', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    handOffAfterStop(null, GAP);
    const ctx = { timerActive: false, lootOpen: isLootOpen(), modalOpen: ceremoniesHeld(), revealPending: false, appActive: true };
    assert.equal(ceremonyMayPlay(ctx), false);
    mock.timers.tick(GAP);
    assert.equal(isLootOpen(), false);
    assert.equal(ceremonyMayPlay({ ...ctx, modalOpen: ceremoniesHeld() }), true);
  } finally {
    mock.timers.reset();
  }
});
