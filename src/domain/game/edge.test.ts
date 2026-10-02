// Q13 edge cases that cross modules: late sync, two devices, a balance
// change. The single-rule cases live in derive.test.ts and ceremonies.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as ops from '../items/ops';
import { mergeRemote } from '../sync';
import { sess, state } from '../testkit';
import { detectCeremonies, markCeremonyStarted, seedCeremonyMarks } from './ceremonies';
import { deriveGameState } from './derive';
import { fixedTz } from './tz';

const UTC = fixedTz(0);
const D0 = Date.UTC(2026, 8, 1);
const DAY = 86_400_000;
const habits = [{ id: 'h1', weeklyTargetMin: 300 }];
const started = ops.startQuest({ items: [], links: [] }, D0 - 1).items;
const derive = (sessions: ReturnType<typeof sess>[], items = started) =>
  deriveGameState({ sessions, habits, items, links: [], now: D0 + 30 * DAY, tz: UTC });

test('an offline session that syncs later celebrates once, and only what is new', () => {
  const here = [sess('s1', 'h1', D0 + DAY, 60)];
  const marks = seedCeremonyMarks(derive(here));
  // Another device's older, longer sessions arrive after this one was seen.
  const late = [...here, sess('s0', 'h1', D0 + 2 * 3600_000, 240), sess('s2', 'h1', D0 + 2 * DAY, 240)];
  const g = derive(late);
  const events = detectCeremonies(marks, g);
  assert.ok(events.length >= 1);
  assert.ok(events.filter((e) => e.kind === 'level_up').length <= 1, 'levels coalesce');
  const after = events.reduce((m, e) => markCeremonyStarted(m, e, g), marks);
  assert.deepEqual(detectCeremonies(after, g), []);
  // The order sessions arrive in never changes the result.
  assert.deepEqual(derive([...late].reverse()).xp, g.xp);
});

test('quest_meta edited on two devices: the later write wins whole', () => {
  const base = state([], [], { items: started.map((i) => ({ ...i, updatedAt: D0 })) });
  const phone = ops.updateQuestMeta(base, (p) => ({ ...p, avatar: { gear: { cloak: 'cloak.moss' } } }), D0 + 10);
  const tablet = ops.updateQuestMeta(base, (p) => ({ ...p, avatar: { gear: { helmet: 'helmet.leaf' } } }), D0 + 20);
  const tabletMeta = ops.questMetaOf(tablet.items)!;
  const merged = mergeRemote({ ...base, items: phone.items.map((i) => ({ ...i, updatedAt: D0 + 10 })) }, {}, [
    { table: 'items', id: tabletMeta.id, deletedAt: null, record: { ...tabletMeta, updatedAt: D0 + 20 } },
  ], D0 + 30);
  const meta = ops.questMetaOf(merged.data.items)!;
  assert.deepEqual(meta.props.avatar.gear, { helmet: 'helmet.leaf' });
  assert.equal(meta.props.startedAt, ops.questMetaOf(started)!.props.startedAt, 'the journey start never moves');
});

test('a balance change that lowers the level replays nothing and un-defeats nothing', () => {
  // The forest's six mobs, then three deep days at the Wisp, two with a chronicle line (its seals).
  const sessions = [...Array.from({ length: 6 }, (_, i) => sess(`s${i}`, 'h1', D0 + i * DAY, 90)), ...Array.from({ length: 3 }, (_, i) => sess(`b${i}`, 'h1', D0 + (6 + i) * DAY, 150))];
  let q: ops.QuestSlice = { items: started, links: [] };
  for (const id of ['b0', 'b1']) q = ops.claimChest(q, { sessionId: id, habitId: 'h1', text: 'a line', now: D0 });
  const before = derive(sessions, q.items);
  assert.ok(before.journey.defeated.length >= 1);
  const recorded = ops.addAchievements(q, before.newAchievements, D0).items;
  const marks = seedCeremonyMarks(derive(sessions, recorded));
  // Fewer minutes count after the "rebalance": the stored defeat keeps the journey.
  const after = derive(sessions.slice(0, 2), recorded);
  assert.ok(after.xp.level < before.xp.level);
  assert.ok(after.journey.defeated.length >= before.journey.defeated.length);
  assert.deepEqual(detectCeremonies(marks, after), []);
});
