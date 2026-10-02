// World Mode's rules (PLAN.MD "Damage rules"), its writes and its selectors.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as B from '../game/balance';
import { deriveGameState } from '../game/derive';
import * as ops from '../items/ops';
import { parseItem } from '../items/types';
import { availableSlots, bossProgress, heartsOf, isBoss, isCleared, isRealmConquered, liveWorld, realmView, slotsView, worldCredits, worldOf, worldOps } from '.';

const T0 = Date.UTC(2026, 9, 2, 9);
const empty: ops.QuestSlice = { items: [], links: [] };

/** A realm on slot 0 with one quest `m`. */
function oneMob(): ops.QuestSlice {
  let q = worldOps.claimSlot(empty, 0, 'Databases', 'code', T0);
  q = worldOps.addQuest(q, 'realm:0', 'Normalize the schema', T0 + 1, 'm');
  return q;
}

/** `m` with phases p1, p2 (a boss). */
function oneBoss(): ops.QuestSlice {
  let q = oneMob();
  q = worldOps.addPhase(q, 'm', 'Write the migration', T0 + 2, 'p1');
  q = worldOps.addPhase(q, 'm', 'Backfill old rows', T0 + 3, 'p2');
  return q;
}

const view = (q: ops.QuestSlice) => liveWorld(q.items);
const quest = (q: ops.QuestSlice, id: string) => view(q).quests.find((x) => x.id === id)!;
const hearts = (q: ops.QuestSlice, id: string) => heartsOf(quest(q, id), view(q).results, view(q).quests);
const cleared = (q: ops.QuestSlice, id: string) => isCleared(quest(q, id), view(q).results, view(q).quests);
const tell = (q: ops.QuestSlice, id: string, kind: 'done' | 'partly' | 'not_yet', at: number, rid?: string) => worldOps.recordResult(q, id, kind, at, 's1', rid);

test('every quest starts with 3 hearts', () => {
  assert.equal(B.QUEST_HEARTS, 3);
  assert.equal(hearts(oneMob(), 'm'), 3);
});

test('Partly takes one heart and floors at 1; the last heart only falls to a Done', () => {
  let q = oneMob();
  q = tell(q, 'm', 'partly', T0 + 10);
  assert.equal(hearts(q, 'm'), 2);
  for (let i = 0; i < 5; i++) q = tell(q, 'm', 'partly', T0 + 20 + i);
  assert.equal(hearts(q, 'm'), 1, 'never below 1');
  assert.equal(cleared(q, 'm'), false, 'Partly never clears');
  q = tell(q, 'm', 'done', T0 + 30);
  assert.equal(hearts(q, 'm'), 0);
  assert.equal(cleared(q, 'm'), true);
});

test('only Done clears; Not yet does nothing', () => {
  let q = oneMob();
  q = tell(q, 'm', 'not_yet', T0 + 10);
  q = tell(q, 'm', 'not_yet', T0 + 11);
  assert.equal(hearts(q, 'm'), 3);
  assert.equal(cleared(q, 'm'), false);
  q = tell(q, 'm', 'done', T0 + 12);
  assert.equal(cleared(q, 'm'), true, 'a Done at full hearts clears too');
});

test('Mark done is a Done without a session', () => {
  const q = worldOps.markDone(oneMob(), 'm', T0 + 10, 'r1');
  const r = view(q).results.find((x) => x.id === 'r1')!;
  assert.deepEqual([r.kind, r.sessionId], ['done', undefined]);
  assert.equal(cleared(q, 'm'), true);
});

test('undo restores the heart (a soft delete), only within 6 seconds', () => {
  let q = tell(oneMob(), 'm', 'partly', T0 + 10, 'r1');
  assert.equal(hearts(q, 'm'), 2);
  const late = worldOps.undoResult(q, 'r1', T0 + 10 + B.RESULT_UNDO_MS + 1);
  assert.equal(late, q, 'too late: unchanged');
  q = worldOps.undoResult(q, 'r1', T0 + 10 + B.RESULT_UNDO_MS);
  assert.equal(hearts(q, 'm'), 3);
  assert.ok(!q.items.some((i) => i.id === 'r1'), 'removed (synced as deleted_at)');
  // An undone Done un-clears.
  q = worldOps.markDone(q, 'm', T0 + 20, 'r2');
  q = worldOps.undoResult(q, 'r2', T0 + 21);
  assert.equal(cleared(q, 'm'), false);
});

test('a cleared quest takes no more results; enemies never heal', () => {
  let q = worldOps.markDone(oneMob(), 'm', T0 + 10);
  assert.equal(tell(q, 'm', 'partly', T0 + 11), q);
  assert.equal(worldOps.markDone(q, 'm', T0 + 12), q);
  q = tell(oneMob(), 'm', 'partly', T0 + 10);
  q = tell(q, 'm', 'not_yet', T0 + 11);
  assert.equal(hearts(q, 'm'), 2, 'Not yet never gives a heart back');
});

test('two phases make a boss; one phase leaves a mob', () => {
  let q = worldOps.addPhase(oneMob(), 'm', 'First step', T0 + 2, 'p1');
  assert.equal(isBoss(quest(q, 'm'), view(q).quests), false);
  q = worldOps.addPhase(q, 'm', 'Second step', T0 + 3, 'p2');
  assert.equal(isBoss(quest(q, 'm'), view(q).quests), true);
  assert.equal(hearts(q, 'm'), 3);
  assert.equal(worldOps.addPhase(q, 'p1', 'nested', T0 + 4), q, 'phases do not nest');
  assert.equal(tell(q, 'm', 'done', T0 + 5), q, 'a boss takes no results of its own');
});

test('a boss falls only when all its phases are cleared', () => {
  let q = oneBoss();
  q = worldOps.markDone(q, 'p1', T0 + 10);
  assert.equal(cleared(q, 'm'), false);
  assert.deepEqual(bossProgress(quest(q, 'm'), view(q).quests, view(q).results), { cleared: 1, total: 2, defeated: false });
  q = worldOps.markDone(q, 'p2', T0 + 11);
  assert.equal(cleared(q, 'm'), true);
  assert.equal(hearts(q, 'm'), 0);
  assert.deepEqual(bossProgress(quest(q, 'm'), view(q).quests, view(q).results), { cleared: 2, total: 2, defeated: true });
});

test('phases clear in any order', () => {
  const a = worldOps.markDone(worldOps.markDone(oneBoss(), 'p1', T0 + 10), 'p2', T0 + 11);
  const b = worldOps.markDone(worldOps.markDone(oneBoss(), 'p2', T0 + 10), 'p1', T0 + 11);
  assert.equal(cleared(a, 'm'), true);
  assert.equal(cleared(b, 'm'), true);
});

test('a phase takes Partly like a mob', () => {
  const q = tell(tell(tell(oneBoss(), 'p2', 'partly', T0 + 10), 'p2', 'partly', T0 + 11), 'p2', 'partly', T0 + 12);
  assert.equal(hearts(q, 'p2'), 1);
  assert.equal(hearts(q, 'p1'), 3);
});

test('a cleared mob cannot grow phases (it would heal into a boss)', () => {
  const q = worldOps.markDone(oneMob(), 'm', T0 + 10);
  assert.equal(worldOps.addPhase(q, 'm', 'more', T0 + 11), q);
});

test('a deleted quest drops out, with its phases; its results are ignored', () => {
  let q = worldOps.markDone(oneBoss(), 'p1', T0 + 10);
  q = worldOps.addQuest(q, 'realm:0', 'Another', T0 + 11, 'm2');
  q = worldOps.softDeleteQuest(q, 'm');
  const ids = view(q).quests.map((x) => x.id);
  assert.deepEqual(ids, ['m2']);
  assert.equal(realmView(q.items, 'realm:0')!.path.length, 1);
  // Deleting a phase turns a two-phase boss back into a mob with one phase.
  let b = worldOps.softDeleteQuest(oneBoss(), 'p2');
  assert.equal(isBoss(quest(b, 'm'), view(b).quests), false);
  b = worldOps.recordResult(b, 'p2', 'done', T0 + 20);
  assert.ok(!view(b).results.some((r) => r.questId === 'p2'), 'no results for a deleted quest');
});

test('a realm is conquered when every quest on its path is cleared; a new one opens it again', () => {
  let q = oneBoss();
  q = worldOps.addQuest(q, 'realm:0', 'Index the hot table', T0 + 4, 'm2');
  const realm = () => view(q).realms[0];
  assert.equal(isRealmConquered(realm(), view(q).quests, view(q).results), false);
  q = worldOps.markDone(q, 'p1', T0 + 10);
  q = worldOps.markDone(q, 'p2', T0 + 11);
  assert.equal(isRealmConquered(realm(), view(q).quests, view(q).results), false, 'm2 still stands');
  q = worldOps.markDone(q, 'm2', T0 + 12);
  assert.equal(isRealmConquered(realm(), view(q).quests, view(q).results), true);
  assert.equal(realmView(q.items, 'realm:0')!.conquered, true);
  q = worldOps.addQuest(q, 'realm:0', 'Next thing', T0 + 13);
  assert.equal(isRealmConquered(realm(), view(q).quests, view(q).results), false);
  const bare = worldOps.claimSlot(empty, 1, 'Fitness', 'code', T0);
  assert.equal(isRealmConquered(view(bare).realms[0], [], []), false, 'an empty realm is not conquered');
});

test('at most 7 realms, one per slot', () => {
  let q = empty;
  for (let s = 0; s < 7; s++) q = worldOps.claimSlot(q, s, `Realm ${s}`, 'target', T0 + s);
  assert.equal(view(q).realms.length, 7);
  assert.deepEqual(availableSlots(view(q).realms), []);
  assert.equal(worldOps.claimSlot(q, 7, 'Eighth', 'target', T0), q, 'no slot 7');
  assert.equal(worldOps.claimSlot(q, 3, 'Again', 'target', T0), q, 'a taken slot');
  assert.deepEqual(availableSlots(view(oneMob()).realms), [1, 2, 3, 4, 5, 6]);
  assert.equal(worldOps.claimSlot(empty, 2, '   ', 'target', T0), empty, 'needs a name');
  assert.equal(worldOps.claimSlot(empty, 2, 'X', 'not-an-icon', T0), empty, 'needs a known icon');
  assert.equal(slotsView(oneMob().items).filter((s) => s.realm).length, 1);
});

test('rename a realm; quests need a realm', () => {
  const q = worldOps.renameRealm(oneMob(), 'realm:0', '  SQL  ');
  assert.equal(view(q).realms[0].name, 'SQL');
  assert.equal(worldOps.addQuest(empty, 'realm:0', 'orphan', T0), empty);
});

test('two devices claiming one slot: the first claim wins, the other is ignored', () => {
  const a = worldOps.claimSlot(empty, 0, 'A', 'code', T0).items;
  const b = { ...a[0], id: 'realm:0-other', title: 'B', createdAt: T0 + 5 };
  assert.deepEqual(worldOf([...a, b]).realms.map((r) => r.name), ['A']);
});

test('credits: a bounty per clear and a bigger one per boss, only on the journey', () => {
  let q = ops.startQuest(oneBoss(), T0);
  q = worldOps.addQuest(q, 'realm:0', 'Small one', T0 + 4, 'm2');
  const w = () => liveWorld(q.items);
  q = worldOps.markDone(q, 'm2', T0 + 10);
  assert.equal(worldCredits(w(), T0), B.CLEAR_CREDITS);
  q = worldOps.markDone(q, 'p1', T0 + 11);
  q = worldOps.markDone(q, 'p2', T0 + 12);
  assert.equal(worldCredits(w(), T0), 3 * B.CLEAR_CREDITS + B.BOSS_DEFEAT_CREDITS);
  assert.equal(worldCredits(w(), T0 + 11), 2 * B.CLEAR_CREDITS + B.BOSS_DEFEAT_CREDITS, 'the clear before the journey started earns nothing');
  assert.equal(worldCredits(w(), null), 0);
  const g = deriveGameState({ sessions: [], habits: [], items: q.items, links: q.links, now: T0 + 100 });
  assert.equal(g.credits.earned, 3 * B.CLEAR_CREDITS + B.BOSS_DEFEAT_CREDITS, 'derived credits include result bounties');
});

test('rows parse back; an unknown result kind reads as Not yet (harmless)', () => {
  const q = tell(oneMob(), 'm', 'partly', T0 + 10, 'r1');
  for (const i of q.items) assert.deepEqual(parseItem(JSON.parse(JSON.stringify(i))), i);
  const odd = parseItem({ id: 'r9', type: 'result', props: { questId: 'm', kind: 'crit', at: new Date(T0).toISOString() } });
  assert.equal(odd?.type === 'result' && odd.props.kind, 'not_yet');
  assert.equal(parseItem({ id: 'x', type: 'world_v9_thing' }), null, 'unknown types are still skipped');
});

test('the realm view: path in order, mobs and bosses, empty state', () => {
  assert.equal(realmView(worldOps.claimSlot(empty, 4, 'Iron', 'target', T0).items, 'realm:4')!.empty, true);
  let q = oneBoss();
  q = worldOps.addQuest(q, 'realm:0', 'Later mob', T0 + 9, 'm2');
  q = tell(q, 'p1', 'partly', T0 + 10, 'r1');
  const v = realmView(q.items, 'realm:0')!;
  assert.deepEqual(v.path.map((n) => [n.quest.id, n.kind]), [['m', 'boss'], ['m2', 'mob']]);
  const boss = v.path[0];
  assert.ok(boss.kind === 'boss' && boss.phases[0].hearts === 2 && boss.phases[0].lastResult?.id === 'r1');
  assert.deepEqual([v.cleared, v.total, v.conquered], [0, 2, false]);
  assert.equal(realmView(q.items, 'realm:6'), null);
});
