// Base damage lands when a session is saved, so a long one can beat a boss
// before its chest is opened (found while investigating the long-session
// crash on fix/quest-crash). Its full-screen scene must never present while
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
const DAY = 86_400_000;
// The forest's six 90-HP mobs, then two claimed 150-minute days at the Wisp (420 HP): it has
// 120 HP left and its seals (3 days counting the next one, a deep session, 2 lines) are met.
const history = [...Array.from({ length: 6 }, (_, i) => sess(`m${i}`, 'h1', D0 + i * DAY, 90)), sess('b0', 'h1', D0 + 6 * DAY, 150), sess('b1', 'h1', D0 + 7 * DAY, 150)];
let slice: ops.QuestSlice = ops.startQuest({ items: [], links: [] }, D0 - 1);
for (const id of ['b0', 'b1']) slice = ops.claimChest(slice, { sessionId: id, habitId: 'h1', doneTaskIds: [], text: 'a line', now: D0 });
const started = slice.items;
const derive = (min: number, items = started, withLast = true) =>
  deriveGameState({ sessions: withLast ? [...history, sess('s1', 'h1', D0 + 8 * DAY, min)] : history, habits, items, links: slice.links, now: D0 + 9 * DAY, tz: fixedTz(0) });

test('the Fog Wisp at 120 HP with its seals met: 120 focused minutes fell it on save, 119 do not', () => {
  assert.equal(derive(119).journey.defeated.length, 0);
  const g = derive(120);
  assert.deepEqual(g.journey.defeated.map((d) => d.biome), ['forest']);
  assert.equal(g.sessions.at(-1)!.claimed, false, 'no chest opened: base damage alone');
});

test('the boss scene waits through the stop → Loot → close hand-offs', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    // The watcher records the boss as soon as the session is saved.
    const before = derive(0, started, false);
    const marks = seedCeremonyMarks(before);
    const saved = derive(120);
    const items = ops.addAchievements({ items: started, links: slice.links }, saved.newAchievements, D0).items;
    const game = derive(120, items);
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
