// The app's side of projects as realms: the silent attach by name, the attach
// sheet's question, and the whole pipeline the store effect runs.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { QuestSlice } from '../domain/items/ops';
import type { RealmItem } from '../domain/items/types';
import { liveWorld, projectIdOf, ProjectRef, realmIdForProject, worldOps } from '../domain/world';
import { attachChoiceOf, linkByName } from './projectRealmsModel';

const T0 = Date.UTC(2026, 9, 10, 9);
const empty: QuestSlice = { items: [], links: [] };
const P = (n: number, name = `Project ${n}`, extra: Partial<ProjectRef> = {}): ProjectRef => ({ id: `p${n}`, name, started: n * 1000, ...extra });
const legacy = (q: QuestSlice, slot: number, name: string) => worldOps.claimSlot(q, slot, name, 'code', T0 + slot);
const linkOf = (q: QuestSlice, id: string) => {
  const r = q.items.find((i) => i.id === id) as RealmItem | undefined;
  return r ? projectIdOf(r) : undefined;
};
/** What the store effect does on every change. */
const pipeline = (q: QuestSlice, projects: ProjectRef[], now = T0 + 99) => worldOps.reconcileRealms(linkByName(q, projects), projects, now);
const placed = (q: QuestSlice, projects: ProjectRef[]) => liveWorld(q.items, projects).realms.map((r) => [r.id, r.slot]);

test('a hand-claimed realm whose name matches one project (any case, spacing) is linked silently', () => {
  let q = legacy(empty, 0, 'Databases');
  q = legacy(q, 1, 'Job   hunt');
  const next = linkByName(q, [P(1, 'DATABASES'), P(2, 'job hunt'), P(3, 'Fitness')]);
  assert.equal(linkOf(next, 'realm:0'), 'p1');
  assert.equal(linkOf(next, 'realm:1'), 'p2');
  assert.equal((next.items.find((i) => i.id === 'realm:0') as RealmItem).title, 'Databases', 'its own name is kept');
  assert.equal(linkByName(next, [P(1, 'DATABASES'), P(2, 'job hunt')]), next, 'idempotent');
});

test('no silent link when the name matches nothing, matches two projects, or the project is archived or taken', () => {
  const q = legacy(empty, 0, 'Databases');
  assert.equal(linkByName(q, [P(1, 'Fitness')]), q);
  assert.equal(linkByName(q, [P(1, 'Databases'), P(2, 'databases')]), q, 'ambiguous: the sheet asks');
  assert.equal(linkByName(q, [P(1, 'Databases', { archivedAt: 5 })]), q);
  const kept = worldOps.keepRealm(q, 'realm:0');
  assert.equal(linkByName(kept, [P(1, 'Databases')]), kept, 'a realm kept as it is stays');
  // Two realms of one name, one project: the lower slot gets it, the other is left to the sheet.
  const two = legacy(q, 1, 'databases');
  const next = linkByName(two, [P(1, 'Databases')]);
  assert.deepEqual([linkOf(next, 'realm:0'), linkOf(next, 'realm:1')], ['p1', null]);
});

test('the attach question: the lowest unanswered realm, with the projects that have no realm, oldest first', () => {
  let q = legacy(empty, 2, 'Fitness');
  q = legacy(q, 0, 'Databases');
  const projects = [P(3, 'Reading'), P(1, 'Guitar'), P(2, 'Taken')];
  q = worldOps.claimSlotForProject(q, 'p2', 'Taken', 'code', T0 + 50, projects);
  const ask = attachChoiceOf(q.items, projects)!;
  assert.equal(ask.realm.id, 'realm:0');
  assert.deepEqual(ask.candidates.map((p) => p.id), ['p1', 'p3']);
  assert.equal(attachChoiceOf(q.items, []), null, 'no project to attach to: nothing to ask');
  q = worldOps.linkRealm(q, 'realm:0', 'p1');
  assert.equal(attachChoiceOf(q.items, projects)?.realm.id, 'realm:2', 'then the next realm');
  q = worldOps.keepRealm(q, 'realm:2');
  assert.equal(attachChoiceOf(q.items, projects), null, 'answered, asked no more');
  assert.equal(attachChoiceOf(empty.items, projects), null);
});

test('a fresh account: a project and its realm is on the map, no tap', () => {
  const projects = [P(1, 'Become ML Engineer', { started: null })];
  const q = pipeline(empty, projects);
  assert.deepEqual(placed(q, projects), [[realmIdForProject('p1'), 0]]);
  assert.equal(pipeline(q, projects), q, 'nothing more to do');
});

test('the pipeline: attach waits for the sheet, then realms follow', () => {
  const projects = [P(1, 'Guitar'), P(2, 'Reading')];
  let q = legacy(empty, 0, 'Databases');
  assert.equal(pipeline(q, projects), q, 'paused while the sheet has a question');
  q = worldOps.linkRealm(q, 'realm:0', 'p1');
  q = pipeline(q, projects);
  assert.deepEqual(placed(q, projects), [['realm:0', 0], [realmIdForProject('p2'), 1]]);
});

test('two devices doing the same backfill converge, and two creating at once settle on the older project', () => {
  const both = [P(1), P(2), P(3)];
  const a = pipeline(empty, both, T0 + 10);
  const b = pipeline(empty, both, T0 + 20);
  assert.deepEqual(placed(a, both), placed(b, both), 'same ids, same slots');
  // Offline: A made p1's realm, B made p2's, both on slot 0. Merged, the older project keeps it.
  const projects = [P(1), P(2)];
  const devA = pipeline(empty, [projects[0]], T0 + 10);
  const devB = pipeline(empty, [projects[1]], T0 + 5);
  const merged: QuestSlice = { items: [...devA.items, ...devB.items], links: [] };
  assert.deepEqual(placed(merged, projects), [[realmIdForProject('p1'), 0]], 'the other rests while they tie');
  const settled = pipeline(merged, projects, T0 + 30);
  assert.deepEqual(placed(settled, projects).sort(), [[realmIdForProject('p1'), 0], [realmIdForProject('p2'), 1]].sort());
  assert.equal(pipeline(settled, projects), settled);
});

test('the eighth project has no realm; an archived one frees its slot; nothing is deleted', () => {
  const eight = Array.from({ length: 8 }, (_, i) => P(i + 1));
  let q = pipeline(empty, eight);
  assert.equal(placed(q, eight).length, 7);
  assert.equal(liveWorld(q.items, eight).realms.some((r) => r.projectId === 'p8'), false);
  const archived = eight.map((p) => (p.id === 'p2' ? { ...p, archivedAt: T0 } : p));
  const before = q.items.length;
  q = pipeline(q, archived);
  assert.equal(liveWorld(q.items, archived).realms.some((r) => r.projectId === 'p8'), true, 'the eighth takes the freed slot');
  assert.equal(q.items.length, before + 1, 'one realm added, none deleted');
  assert.ok(q.items.some((i) => i.id === realmIdForProject('p2')), 'the archived realm still exists');
});
