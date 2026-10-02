// A session's target and its result (world-4): the result-to-damage mapping,
// one result per session, undo, and the ceremony moments.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deriveGameState } from '../game/derive';
import * as B from '../game/balance';
import * as ops from '../items/ops';
import { effectOf, liveWorld, targetOf, worldMoments, worldOps } from '.';

const T0 = Date.UTC(2026, 9, 2, 9);
const empty: ops.QuestSlice = { items: [], links: [] };

function realm(): ops.QuestSlice {
  let q = worldOps.claimSlot(empty, 0, 'Databases', 'code', T0);
  q = worldOps.addQuest(q, 'realm:0', 'Normalize the schema', T0 + 1, 'm');
  return q;
}
function boss(): ops.QuestSlice {
  let q = realm();
  q = worldOps.addPhase(q, 'm', 'Write the migration', T0 + 2, 'p1');
  q = worldOps.addPhase(q, 'm', 'Backfill old rows', T0 + 3, 'p2');
  return q;
}
const target = (q: ops.QuestSlice, id: string | null) => targetOf(liveWorld(q.items), id);

test('result to damage: Done clears, Partly pops one heart (never the last), Not yet does nothing', () => {
  assert.deepEqual(effectOf('done', 3), { effect: 'cleared', hearts: 0 });
  assert.deepEqual(effectOf('done', 1), { effect: 'cleared', hearts: 0 });
  assert.deepEqual(effectOf('partly', 3), { effect: 'heart', hearts: 2 });
  assert.deepEqual(effectOf('partly', 2), { effect: 'heart', hearts: 1 });
  assert.deepEqual(effectOf('partly', 1), { effect: 'none', hearts: 1 });
  assert.deepEqual(effectOf('not_yet', 2), { effect: 'none', hearts: 2 });
});

test('the mapping agrees with the rules engine', () => {
  for (const kind of ['done', 'partly', 'not_yet'] as const) {
    let q = realm();
    q = worldOps.recordResult(q, 'm', 'partly', T0 + 10, 'a');
    const before = target(q, 'm')!.hearts;
    q = worldOps.recordResult(q, 'm', kind, T0 + 20, 'b');
    const after = target(q, 'm');
    const want = effectOf(kind, before);
    assert.equal(after?.hearts ?? 0, want.hearts, kind);
    assert.equal(after === null, want.effect === 'cleared', kind);
  }
});

test('a mob targets itself; a boss targets its oldest uncleared phase, with pips', () => {
  assert.equal(target(realm(), 'm')!.quest.id, 'm');
  assert.equal(target(realm(), 'm')!.boss, null);
  let q = boss();
  let t = target(q, 'm')!;
  assert.equal(t.quest.id, 'p1');
  assert.equal(t.boss!.id, 'm');
  assert.deepEqual(t.phases, { cleared: 0, total: 2 });
  q = worldOps.recordResult(q, 'p1', 'done', T0 + 10, 'a');
  t = target(q, 'm')!;
  assert.equal(t.quest.id, 'p2');
  assert.deepEqual(t.phases, { cleared: 1, total: 2 });
  // A phase picked directly is fought directly, under its boss.
  assert.equal(target(boss(), 'p2')!.quest.id, 'p2');
  assert.equal(target(boss(), 'p2')!.boss!.id, 'm');
});

test('nothing to fight: no quest, a cleared one, a deleted one', () => {
  assert.equal(target(realm(), null), null);
  assert.equal(target(realm(), 'nope'), null);
  assert.equal(target(worldOps.markDone(realm(), 'm', T0 + 5), 'm'), null);
  assert.equal(target(worldOps.softDeleteQuest(realm(), 'm'), 'm'), null);
});

test('one result per session: a double tap records once; undo frees the session', () => {
  let q = realm();
  q = worldOps.recordResult(q, 'm', 'partly', T0 + 10, 's1', 'r1');
  const again = worldOps.recordResult(q, 'm', 'partly', T0 + 11, 's1', 'r2');
  assert.equal(again, q);
  assert.equal(target(q, 'm')!.hearts, 2);
  // Undo (a soft delete) gives the heart back, and the session may answer again.
  q = worldOps.undoResult(q, 'r1', T0 + 10 + B.RESULT_UNDO_MS);
  assert.equal(target(q, 'm')!.hearts, 3);
  q = worldOps.recordResult(q, 'm', 'done', T0 + 20, 's1', 'r3');
  assert.equal(target(q, 'm'), null);
  // Past the 6 s window the result stays.
  assert.equal(worldOps.undoResult(q, 'r3', T0 + 21 + B.RESULT_UNDO_MS), q);
});

test('a Done pays the bounty once, through the derived credits only', () => {
  let q = ops.startQuest(realm(), T0);
  const earned = (x: ops.QuestSlice) => deriveGameState({ sessions: [], habits: [], items: x.items, links: x.links, now: T0 + 100 }).credits.earned;
  const before = earned(q);
  q = worldOps.recordResult(q, 'm', 'done', T0 + 10, 's1');
  assert.equal(earned(q) - before, B.CLEAR_CREDITS);
  assert.equal(earned(worldOps.recordResult(q, 'm', 'done', T0 + 11, 's2')), earned(q), 'a cleared quest takes no second Done');
});

test('moments: a fallen boss and a conquered realm', () => {
  let q = boss();
  assert.deepEqual(worldMoments(liveWorld(q.items)), { bosses: [], realms: [] });
  q = worldOps.recordResult(q, 'p1', 'done', T0 + 10, 'a');
  q = worldOps.recordResult(q, 'p2', 'done', T0 + 11, 'b');
  assert.deepEqual(worldMoments(liveWorld(q.items)), { bosses: ['m'], realms: ['realm:0'] });
});
