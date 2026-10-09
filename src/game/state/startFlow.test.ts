// The Start sheet's objective (Projects as Realms, session 4): chips, and what a tap does.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { QuestSlice } from '../../domain/items/ops';
import type { Habit } from '../../domain/types';
import { liveWorld, ProjectRef, realmIdForProject, worldOps } from '../../domain/world';
import { chipsFor, cleanObjective, firstTimedHabit, placedRealmOf, planStart, START_CHIPS_MAX, StartInput } from './startFlow';

const T0 = Date.UTC(2026, 9, 9, 9);
const P = (n: number, extra: Partial<ProjectRef> = {}): ProjectRef => ({ id: `p${n}`, name: `Project ${n}`, started: n * 1000, ...extra });
const habit = (id: string, kind?: 'check'): Habit => ({ id, projectId: 'p1', name: id, icon: 'code', kind }) as unknown as Habit;
const timed = [habit('h1'), habit('h2')];
const claim = (q: QuestSlice, p: ProjectRef) => worldOps.claimSlotForProject(q, p.id, p.name, 'code', T0);
const quest = (q: QuestSlice, id: string, at: number, realm = realmIdForProject('p1')) => worldOps.addQuest(q, realm, id, T0 + at, id);
const world = (q: QuestSlice, projects?: ProjectRef[]) => liveWorld(q.items, projects);
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const base: StartInput = { check: false, pending: null, chipQuestId: null, objective: '', realmId: 'realm:p:p1' };

function withRealm(...questIds: string[]): QuestSlice {
  let q = claim({ items: [], links: [] }, P(1));
  questIds.forEach((id, i) => (q = quest(q, id, i + 1)));
  return q;
}

test('cleanObjective: one tidy line, the length a quest title keeps, blank is none', () => {
  assert.equal(cleanObjective('  Fix   the\n join  '), 'Fix the join');
  assert.equal(cleanObjective('   '), '');
  assert.equal(cleanObjective('x'.repeat(200)).length, 80);
});

test('chips: open quests of the project’s realm, oldest first, at most three', () => {
  const q = withRealm('a', 'b', 'c', 'd', 'e');
  assert.equal(START_CHIPS_MAX, 3);
  assert.deepEqual(ids(chipsFor(world(q), 'p1', timed)), ['a', 'b', 'c']);
});

test('chips: oldest first by creation, whatever order the items arrived in (sync)', () => {
  let q = claim({ items: [], links: [] }, P(1));
  q = quest(q, 'late', 5);
  q = quest(q, 'early', 1);
  q = quest(q, 'mid', 3);
  assert.deepEqual(ids(chipsFor(world(q), 'p1', timed)), ['early', 'mid', 'late']);
});

test('chips: a cleared quest never shows, the next open one takes its place', () => {
  const q = worldOps.markDone(withRealm('a', 'b', 'c', 'd'), 'b', T0 + 50, 'r1');
  assert.deepEqual(ids(chipsFor(world(q), 'p1', timed)), ['a', 'c', 'd']);
});

test('chips: a boss shows its next open phase, not the boss', () => {
  let q = withRealm('a');
  q = worldOps.addPhase(q, 'a', 'a1', T0 + 10, 'a1');
  q = worldOps.addPhase(q, 'a', 'a2', T0 + 11, 'a2');
  assert.deepEqual(ids(chipsFor(world(q), 'p1', timed)), ['a1']);
});

test('chips: none for a project with no realm (the eighth, or none yet)', () => {
  const q = withRealm('a');
  assert.deepEqual(chipsFor(world(q), 'p2', timed), []);
  assert.equal(placedRealmOf(world(q), 'p2'), null);
});

test('chips: none when the project has no habit with a session', () => {
  const q = withRealm('a');
  assert.deepEqual(chipsFor(world(q), 'p1', [habit('c1', 'check')]), []);
  assert.deepEqual(chipsFor(world(q), 'p1', []), []);
});

test('chips: none for a resting realm (project archived) even though its quests exist', () => {
  const q = withRealm('a', 'b');
  const projects = [P(1, { archivedAt: T0 + 5 })];
  assert.deepEqual(chipsFor(world(q, projects), 'p1', timed), []);
  assert.equal(placedRealmOf(world(q, projects), 'p1'), null);
  // still the project’s realm while the project is active
  assert.equal(placedRealmOf(world(q, [P(1)]), 'p1')?.id, realmIdForProject('p1'));
});

test('firstTimedHabit skips checks', () => {
  assert.equal(firstTimedHabit([habit('c1', 'check'), habit('h2'), habit('h3')])?.id, 'h2');
  assert.equal(firstTimedHabit([habit('c1', 'check')]), undefined);
});

test('planStart: nothing typed or picked is a free session', () => {
  assert.deepEqual(planStart(base), { kind: 'free' });
});

test('planStart: typed text in a realm creates a mob there', () => {
  assert.deepEqual(planStart({ ...base, objective: '  Fix  joins ' }), { kind: 'create', realmId: 'realm:p:p1', title: 'Fix joins' });
});

test('planStart: blank text creates nothing', () => {
  assert.deepEqual(planStart({ ...base, objective: '   ' }), { kind: 'free' });
});

test('planStart: typed text where the project has no realm stays a free session', () => {
  assert.deepEqual(planStart({ ...base, objective: 'Fix joins', realmId: null }), { kind: 'free' });
});

test('planStart: a tapped chip binds that quest, and wins over typed text', () => {
  assert.deepEqual(planStart({ ...base, chipQuestId: 'q9' }), { kind: 'bind', questId: 'q9' });
  assert.deepEqual(planStart({ ...base, chipQuestId: 'q9', objective: 'Fix joins' }), { kind: 'bind', questId: 'q9' });
});

test('planStart: the Realm screen’s pending quest is kept over everything else', () => {
  assert.deepEqual(planStart({ ...base, pending: 'q1', chipQuestId: 'q9', objective: 'x' }), { kind: 'bind', questId: 'q1' });
  assert.deepEqual(planStart({ ...base, pending: 'q1', realmId: null }), { kind: 'bind', questId: 'q1' });
});

test('planStart: a check has no session, so no quest is created or bound', () => {
  assert.deepEqual(planStart({ ...base, check: true, objective: 'Fix joins' }), { kind: 'free' });
  assert.deepEqual(planStart({ ...base, check: true, pending: 'q1', chipQuestId: 'q9' }), { kind: 'free' });
});
