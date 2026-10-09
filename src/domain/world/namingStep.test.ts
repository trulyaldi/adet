// Projects as Realms, session 5: a free session in a project that has a realm
// is offered a naming step, under exactly these conditions and no others.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as B from '../game/balance';
import * as ops from '../items/ops';
import { afterSession, liveWorld, ProjectRef, realmIdForProject, worldOps } from '.';

const T0 = Date.UTC(2026, 9, 9, 9);
const empty: ops.QuestSlice = { items: [], links: [] };
const P = (n: number, extra: Partial<ProjectRef> = {}): ProjectRef => ({ id: `p${n}`, name: `Project ${n}`, started: n * 1000, ...extra });
const R1 = realmIdForProject('p1');
const long = { id: 's1', duration: B.MIN_SESSION_MIN * 60 };
const short = { id: 's2', duration: (B.MIN_SESSION_MIN * 60) - 1 };

/** Project 1 has a realm with one mob ('m'). */
function withRealm(): ops.QuestSlice {
  const q = worldOps.claimSlotForProject(empty, 'p1', 'Project 1', 'code', T0);
  return worldOps.addQuest(q, R1, 'Read chapter 3', T0 + 1, 'm');
}
const world = (q: ops.QuestSlice, projects: ProjectRef[] = [P(1)]) => liveWorld(q.items, projects);

test('naming: no bound quest, long enough, not editing, a project with a realm', () => {
  const out = afterSession(long, null, world(withRealm()), false, 'p1');
  assert.equal(out.lootFor, 's1');
  assert.equal(out.target, null);
  assert.equal(out.naming!.realm.id, R1);
  assert.deepEqual(out.naming!.quests.map((q) => q.id), ['m']);
});

test('naming: an empty realm is still offered (the text field is the way in)', () => {
  const q = worldOps.claimSlotForProject(empty, 'p1', 'Project 1', 'code', T0);
  assert.deepEqual(afterSession(long, null, world(q), false, 'p1').naming!.quests, []);
});

test('naming: the minimum is the chest minimum, inclusive', () => {
  const w = world(withRealm());
  assert.ok(afterSession(long, null, w, false, 'p1').naming, 'exactly MIN_SESSION_MIN');
  const under = afterSession(short, null, w, false, 'p1');
  assert.deepEqual(under, { lootFor: null, target: null });
  assert.ok(!('naming' in under));
});

test('naming: not when the times are being edited first', () => {
  const out = afterSession(long, null, world(withRealm()), true, 'p1');
  assert.deepEqual(out, { lootFor: null, target: null });
});

test('naming: not when the session had a quest', () => {
  const out = afterSession(long, 'm', world(withRealm()), false, 'p1');
  assert.equal(out.target!.quest.id, 'm');
  assert.ok(!('naming' in out));
});

test('naming: not when the bound quest has since gone (that stays a free session)', () => {
  const gone = worldOps.softDeleteQuest(withRealm(), 'm');
  assert.deepEqual(afterSession(long, 'm', world(gone), false, 'p1'), { lootFor: 's1', target: null });
  const cleared = worldOps.markDone(withRealm(), 'm', T0 + 5);
  assert.deepEqual(afterSession(long, 'm', world(cleared), false, 'p1'), { lootFor: 's1', target: null });
});

test('naming: not for a project with no realm, or an unknown project', () => {
  const w = world(withRealm(), [P(1), P(2)]);
  assert.deepEqual(afterSession(long, null, w, false, 'p2'), { lootFor: 's1', target: null });
  assert.deepEqual(afterSession(long, null, w, false, 'nope'), { lootFor: 's1', target: null });
});

test('naming: not for a resting realm (its project is archived or gone)', () => {
  const q = withRealm();
  assert.deepEqual(afterSession(long, null, world(q, [P(1, { archivedAt: T0 + 9 })]), false, 'p1'), { lootFor: 's1', target: null });
  assert.deepEqual(afterSession(long, null, world(q, []), false, 'p1'), { lootFor: 's1', target: null });
});

test('naming: not when the flag is off (the caller passes no project)', () => {
  const w = world(withRealm());
  assert.deepEqual(afterSession(long, null, w, false), { lootFor: 's1', target: null });
  assert.deepEqual(afterSession(long, null, w, false, null), { lootFor: 's1', target: null });
  assert.deepEqual(afterSession(long, null, w, false, undefined), { lootFor: 's1', target: null });
});

test('naming: not for a hand-claimed realm, which has no project', () => {
  const q = worldOps.claimSlot(empty, 0, 'Databases', 'code', T0);
  assert.deepEqual(afterSession(long, null, liveWorld(q.items, [P(1)]), false, 'p1'), { lootFor: 's1', target: null });
});

test('naming: a boss is offered as its next phase; cleared quests are not offered', () => {
  let q = withRealm();
  q = worldOps.addPhase(q, 'm', 'Outline', T0 + 2, 'a1');
  q = worldOps.addPhase(q, 'm', 'Draft', T0 + 3, 'a2');
  q = worldOps.addQuest(q, R1, 'Email Sam', T0 + 4, 'n');
  q = worldOps.markDone(q, 'n', T0 + 5, 'r1');
  const quests = afterSession(long, null, world(q), false, 'p1').naming!.quests;
  assert.deepEqual(quests.map((x) => x.id), ['a1']);
  assert.equal(quests[0].parentQuestId, 'm');
});
