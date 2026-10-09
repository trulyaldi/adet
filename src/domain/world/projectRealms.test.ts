// Projects as realms (docs/quest/world/PROJECT_REALMS.md): a realm is a
// project, its id derives from the project, and a project's lifecycle moves
// the realm's place on the map but never its quests or results.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as ops from '../items/ops';
import { parseItem, parseProps, RealmItem } from '../items/types';
import {
  attachPending,
  heartsOf,
  liveWorld,
  openQuestsOf,
  projectIdOf,
  ProjectRef,
  projectsWithoutRealm,
  realmIdForProject,
  realmNameFrom,
  realmOfProject,
  realmView,
  slotsView,
  targetOf,
  UNPLACED,
  unlinkedRealms,
  worldCredits,
  worldMoments,
  worldOf,
  worldOps,
} from '.';

const T0 = Date.UTC(2026, 9, 9, 9);
const empty: ops.QuestSlice = { items: [], links: [] };
const P = (n: number, extra: Partial<ProjectRef> = {}): ProjectRef => ({ id: `p${n}`, name: `Project ${n}`, started: n * 1000, ...extra });
const rid = realmIdForProject;
const claim = (q: ops.QuestSlice, p: ProjectRef, now = T0, projects?: ProjectRef[]) => worldOps.claimSlotForProject(q, p.id, p.name, 'code', now, projects);
const item = (q: ops.QuestSlice, id: string) => q.items.find((i) => i.id === id) as RealmItem | undefined;
const slotOf = (q: ops.QuestSlice, id: string) => item(q, id)?.props.slot;
const reconcile = (q: ops.QuestSlice, projects: ProjectRef[], now = T0 + 100) => worldOps.reconcileRealms(q, projects, now);
const slots = (q: ops.QuestSlice, projects?: ProjectRef[]) => slotsView(q.items, projects).map((s) => s.realm?.id ?? null);
const credits = (q: ops.QuestSlice, projects?: ProjectRef[]) => worldCredits(liveWorld(q.items, projects), T0 - 1);

/** Realms for p1..pn, on slots 0..n-1. */
function realms(n: number): { q: ops.QuestSlice; projects: ProjectRef[] } {
  const projects = Array.from({ length: n }, (_, i) => P(i + 1));
  let q = empty;
  for (const p of projects) q = claim(q, p);
  return { q, projects };
}

/** p1's realm with a mob `m` (cleared, +credits) and a mob `n` hurt by a Partly. */
function played(): { q: ops.QuestSlice; projects: ProjectRef[] } {
  const { q: q0, projects } = realms(1);
  let q = worldOps.addQuest(q0, rid('p1'), 'Normalize the schema', T0 + 1, 'm');
  q = worldOps.addQuest(q, rid('p1'), 'Index the joins', T0 + 2, 'n');
  q = worldOps.markDone(q, 'm', T0 + 3, 'r1');
  q = worldOps.recordResult(q, 'n', 'partly', T0 + 4, 's1', 'r2');
  return { q, projects };
}
const heartsOfN = (q: ops.QuestSlice, projects?: ProjectRef[]) => {
  const w = liveWorld(q.items, projects);
  return heartsOf(w.quests.find((x) => x.id === 'n')!, w.results, w.quests);
};
const sameQuests = (a: ops.QuestSlice, b: ops.QuestSlice) =>
  assert.deepEqual(
    a.items.filter((i) => i.type !== 'realm'),
    b.items.filter((i) => i.type !== 'realm'),
    'no quest or result changed'
  );

// ---- reading -----------------------------------------------------------------

test('a realm reads props.projectId; old realms without it parse unchanged', () => {
  const old = worldOps.claimSlot(empty, 0, 'Databases', 'code', T0);
  const [legacy] = worldOf(old.items).realms;
  assert.deepEqual(legacy, { id: 'realm:0', slot: 0, name: 'Databases', icon: 'code' });
  const linked = claim(empty, P(1));
  assert.equal(worldOf(linked.items).realms[0].projectId, 'p1');
  assert.equal(parseProps('realm', { slot: 2, icon: 'code', projectId: 'p9', manual: true, extra: 1 }).projectId, 'p9');
  assert.deepEqual(parseProps('realm', { slot: 2, icon: 'code' }), { slot: 2, icon: 'code' });
});

test('malformed realm items: no crash, no link, no slot', () => {
  assert.deepEqual(parseProps('realm', { slot: 1, icon: 'code', projectId: 42, manual: 'yes' }), { slot: 1, icon: 'code' });
  assert.deepEqual(parseProps('realm', { slot: 'x', projectId: '' }), { slot: -1, icon: '' });
  assert.equal(parseItem({ id: 'realm:p:p1', type: 'realm', props: '{"slot":1,"projectId":"p1"}' })?.type, 'realm');
  assert.equal(projectIdOf({ id: 'realm:p:', props: {} }), null);
  assert.equal(projectIdOf({ id: 'realm:3', props: {} }), null);
  assert.equal(projectIdOf({ id: 'realm:p:p7', props: {} }), 'p7', 'the id heals a stripped link');
  const junk = [
    { id: 'realm:a', type: 'realm', title: 'No slot', body: '', props: { slot: -1, icon: 'code' }, habitId: null, createdAt: T0 },
    { id: 'realm:b', type: 'realm', title: 'Slot 9', body: '', props: { slot: 9, icon: 'nope' }, habitId: null, createdAt: T0 + 1 },
    { id: 'realm:c', type: 'realm', title: 'Fine', body: '', props: { slot: 4, icon: 'nope' }, habitId: null, createdAt: T0 + 2 },
  ] as RealmItem[];
  const w = worldOf(junk);
  assert.deepEqual(w.realms.map((r) => [r.id, r.slot, r.icon]), [['realm:c', 4, 'target']]);
  assert.deepEqual(w.resting.map((r) => [r.id, r.slot]), [['realm:a', UNPLACED], ['realm:b', UNPLACED]], 'kept, not dropped');
});

test('a project gives its realm its name and icon, clamped; blank falls back to the stored title', () => {
  const { q } = realms(1);
  const renamed = [{ ...P(1), name: '  Become   an ML engineer who ships real products every week  ', icon: 'book' as const }];
  const [r] = worldOf(q.items, renamed).realms;
  assert.equal(r.name.length, 32);
  assert.ok(r.name.endsWith('…'));
  assert.equal(r.icon, 'book');
  assert.equal(realmNameFrom('Exactly thirty-two characters!!!!'.slice(0, 32)).length, 32);
  assert.equal(worldOf(q.items, [{ ...P(1), name: '   ' }]).realms[0].name, 'Project 1', 'stored title');
  assert.equal(worldOf(q.items).realms[0].name, 'Project 1', 'without projects: stored values');
});

// ---- slots -------------------------------------------------------------------

test('projects take the lowest free slot, in the order they are given a realm', () => {
  const { q } = realms(7);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((n) => slotOf(q, rid(`p${n}`))), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(item(q, rid('p1'))?.props.projectId, 'p1');
  // Hand-claimed realms hold slots too: the project goes round them.
  let m = worldOps.claimSlot(empty, 1, 'Fitness', 'gym', T0);
  m = claim(m, P(1));
  m = claim(m, P(2));
  assert.deepEqual([slotOf(m, rid('p1')), slotOf(m, rid('p2'))], [0, 2]);
});

test('an eighth project gets no realm; its sessions stay free', () => {
  const { q } = realms(7);
  const eighth = claim(q, P(8));
  assert.equal(eighth, q, 'nothing written');
  assert.deepEqual(projectsWithoutRealm(liveWorld(q.items), ['p1', 'p8']), ['p8']);
  assert.equal(realmOfProject(liveWorld(q.items), 'p8'), undefined);
});

test('claimSlotForProject: one realm per project, a name and a known icon', () => {
  const { q } = realms(1);
  assert.equal(claim(q, P(1)), q, 'already has a realm');
  assert.equal(worldOps.claimSlotForProject(empty, 'p1', '   ', 'code', T0), empty);
  assert.equal(worldOps.claimSlotForProject(empty, 'p1', 'X', 'not-an-icon', T0), empty);
  assert.equal(worldOps.claimSlotForProject(empty, '', 'X', 'code', T0), empty);
});

test('two devices racing for a slot: the older project keeps it, the other rests with its quests', () => {
  const mk = (id: string, pid: string, createdAt: number): RealmItem => ({ id, type: 'realm', title: pid, body: '', props: { slot: 0, icon: 'code', projectId: pid }, habitId: null, createdAt });
  // p1 is the older project, but its realm was written second.
  let q: ops.QuestSlice = { items: [mk(rid('p2'), 'p2', T0), mk(rid('p1'), 'p1', T0 + 5)], links: [] };
  q = { ...q, items: [...q.items, { id: 'x', type: 'quest', title: 'Kept', body: '', props: { realmId: rid('p2') }, habitId: null, createdAt: T0 + 6 }] };
  const projects = [P(1), P(2)];
  const w = liveWorld(q.items, projects);
  assert.deepEqual(w.realms.map((r) => r.id), [rid('p1')]);
  assert.deepEqual(w.resting.map((r) => [r.id, r.slot]), [[rid('p2'), UNPLACED]]);
  assert.ok(w.quests.some((x) => x.id === 'x'), 'the loser keeps its quests');
  // Without the projects it is first claim wins, as worldOf always did.
  assert.deepEqual(worldOf(q.items).realms.map((r) => r.id), [rid('p2')]);
  // The reconcile gives the loser the next free slot; nothing else changes.
  const next = reconcile(q, projects);
  assert.deepEqual([slotOf(next, rid('p1')), slotOf(next, rid('p2'))], [0, 1]);
  sameQuests(q, next);
});

test('one realm per project: a second realm linked to it rests', () => {
  const a = claim(empty, P(1), T0);
  const dup: RealmItem = { id: 'realm:3', type: 'realm', title: 'Old', body: '', props: { slot: 3, icon: 'code', projectId: 'p1' }, habitId: null, createdAt: T0 + 9 };
  const w = worldOf([...a.items, dup]);
  assert.deepEqual(w.realms.map((r) => r.id), [rid('p1')]);
  assert.deepEqual(w.resting.map((r) => r.id), ['realm:3']);
});

// ---- attach ------------------------------------------------------------------

test('linkRealm: the one-time attach sets only the project; twice is a no-op', () => {
  let q = worldOps.claimSlot(empty, 3, 'Job hunt', 'briefcase', T0);
  q = worldOps.addQuest(q, 'realm:3', 'Send 5 applications', T0 + 1, 'a');
  const before = item(q, 'realm:3')!;
  const linked = worldOps.linkRealm(q, 'realm:3', 'p1');
  const after = item(linked, 'realm:3')!;
  assert.deepEqual(after.props, { ...before.props, projectId: 'p1' });
  assert.equal(after.title, 'Job hunt', 'its own name and icon are kept');
  assert.equal(after.id, 'realm:3');
  sameQuests(q, linked);
  assert.equal(worldOps.linkRealm(linked, 'realm:3', 'p1'), linked, 'idempotent');
  assert.equal(realmOfProject(liveWorld(linked.items), 'p1')?.id, 'realm:3');
  // The project, once known, gives the name and icon.
  const [r] = worldOf(linked.items, [{ ...P(1), name: 'Applications', icon: 'globe' }]).realms;
  assert.deepEqual([r.name, r.icon, r.slot], ['Applications', 'globe', 3]);
});

test('linkRealm refuses: another project, a project that has a realm, a kept realm, an unknown realm', () => {
  let q = worldOps.claimSlot(empty, 0, 'A', 'code', T0);
  q = worldOps.claimSlot(q, 1, 'B', 'code', T0 + 1);
  const a = worldOps.linkRealm(q, 'realm:0', 'p1');
  assert.equal(worldOps.linkRealm(a, 'realm:0', 'p2'), a, 'already linked elsewhere');
  assert.equal(worldOps.linkRealm(a, 'realm:1', 'p1'), a, 'p1 already has a realm');
  const kept = worldOps.keepRealm(q, 'realm:1');
  assert.equal(worldOps.linkRealm(kept, 'realm:1', 'p2'), kept, 'kept as it is');
  assert.equal(worldOps.linkRealm(q, 'realm:9', 'p2'), q);
  assert.equal(worldOps.linkRealm(q, 'realm:0', ''), q);
  assert.equal(worldOps.keepRealm(kept, 'realm:1'), kept, 'keep is idempotent');
  assert.equal(worldOps.keepRealm(a, 'realm:0'), a, 'a linked realm cannot be "kept"');
  const own = claim(empty, P(1));
  assert.equal(worldOps.linkRealm(own, rid('p1'), 'p2'), own, 'a project realm is not re-linked');
});

test('selectors: unlinked realms, projects without a realm, and when the attach sheet has something to ask', () => {
  let q = worldOps.claimSlot(empty, 0, 'A', 'code', T0);
  q = worldOps.claimSlot(q, 1, 'B', 'code', T0 + 1);
  q = claim(q, P(1));
  const w = () => liveWorld(q.items);
  assert.deepEqual(unlinkedRealms(w()).map((r) => r.id), ['realm:0', 'realm:1']);
  assert.deepEqual(projectsWithoutRealm(w(), ['p1', 'p2', 'p3']), ['p2', 'p3']);
  assert.equal(attachPending(w(), ['p2']), true);
  assert.equal(attachPending(w(), []), false, 'no candidate project: nothing to ask');
  q = worldOps.keepRealm(q, 'realm:1');
  q = worldOps.linkRealm(q, 'realm:0', 'p2');
  assert.deepEqual(unlinkedRealms(w()), []);
  assert.equal(attachPending(w(), ['p3']), false);
});

// ---- open quests -------------------------------------------------------------

test('openQuestsOf: uncleared, oldest first, a boss as its next phase', () => {
  let q = claim(empty, P(1));
  const r = rid('p1');
  q = worldOps.addQuest(q, r, 'First', T0 + 1, 'a');
  q = worldOps.addQuest(q, r, 'Second (boss)', T0 + 2, 'b');
  q = worldOps.addPhase(q, 'b', 'Phase 1', T0 + 3, 'b1');
  q = worldOps.addPhase(q, 'b', 'Phase 2', T0 + 4, 'b2');
  q = worldOps.addQuest(q, r, 'Third', T0 + 5, 'c');
  q = worldOps.addQuest(q, r, 'Done already', T0 + 6, 'd');
  q = worldOps.markDone(q, 'd', T0 + 7, 'r1');
  const ids = () => openQuestsOf(liveWorld(q.items), r).map((x) => x.id);
  assert.deepEqual(ids(), ['a', 'b1', 'c']);
  assert.equal(openQuestsOf(liveWorld(q.items), r)[1].parentQuestId, 'b');
  q = worldOps.markDone(q, 'b1', T0 + 8, 'r2');
  assert.deepEqual(ids(), ['a', 'b2', 'c'], 'the boss moves to its next phase');
  q = worldOps.markDone(q, 'b2', T0 + 9, 'r3');
  assert.deepEqual(ids(), ['a', 'c'], 'a fallen boss is gone');
  assert.deepEqual(openQuestsOf(liveWorld(q.items), 'nope'), []);
});

// ---- lifecycle ---------------------------------------------------------------

test('archive: the realm rests at once, nothing earned or told changes', () => {
  const { q, projects } = played();
  const credits0 = credits(q, projects);
  assert.ok(credits0 > 0);
  const archived = [{ ...projects[0], archivedAt: T0 + 50 }];
  // Derived at once, before anything is written.
  assert.deepEqual(slots(q, archived), Array(7).fill(null));
  const w = liveWorld(q.items, archived);
  assert.deepEqual([w.realms.length, w.resting?.length], [0, 1]);
  assert.equal(credits(q, archived), credits0, 'credits survive');
  assert.equal(w.quests.length, 2, 'quests stay live (trophies)');
  assert.equal(heartsOfN(q, archived), heartsOfN(q, projects), 'hearts unchanged');
  assert.equal(targetOf(w, 'n'), null, 'a session against it is free');
  assert.equal(realmView(q.items, rid('p1'), archived), null);
  assert.deepEqual(worldMoments(w), { bosses: [], realms: [] });
  // Written by the reconcile: only the slot changes, and the id stays.
  const next = reconcile(q, archived);
  assert.equal(slotOf(next, rid('p1')), UNPLACED);
  assert.equal(item(next, rid('p1'))?.title, 'Project 1');
  sameQuests(q, next);
  assert.equal(next.items.length, q.items.length, 'nothing deleted');
  assert.equal(credits(next), credits0, 'still, with the project-blind view');
  assert.equal(reconcile(next, archived), next, 'idempotent');
});

test('archive frees the slot; a new project takes it without touching the archived realm\'s quests', () => {
  const { q, projects } = played();
  const archived = [{ ...projects[0], archivedAt: T0 + 50 }, P(2)];
  let next = reconcile(q, archived);
  assert.equal(slotOf(next, rid('p2')), 0, 'the freed slot');
  next = worldOps.addQuest(next, rid('p2'), 'Fresh start', T0 + 200, 'z');
  const w = liveWorld(next.items, archived);
  assert.deepEqual(w.quests.filter((x) => x.realmId === rid('p2')).map((x) => x.id), ['z']);
  assert.deepEqual(w.quests.filter((x) => x.realmId === rid('p1')).map((x) => x.id), ['m', 'n'], 'p1 keeps its own');
  assert.equal(w.results.length, 2);
  assert.deepEqual(realmView(next.items, rid('p2'), archived)?.path.map((n) => n.quest.id), ['z']);
  assert.equal(credits(next, archived), credits(q, projects), 'p2 earned nothing yet, p1 lost nothing');
});

test('restore: the realm is placed again on the lowest free slot and never evicts a project on the map', () => {
  const { q, projects } = played();
  const p2 = P(2);
  const archived = [{ ...projects[0], archivedAt: T0 + 50 }, p2];
  let s = reconcile(q, archived);
  s = reconcile(claim(s, p2, T0 + 60, archived), archived); // p2 now on slot 0
  assert.equal(slotOf(s, rid('p2')), 0);
  const restored = [projects[0], p2];
  assert.deepEqual(slots(s, restored).slice(0, 2), [rid('p2'), null], 'a restored project with its slot cleared is not on the map yet');
  const back = reconcile(s, restored);
  assert.deepEqual([slotOf(back, rid('p2')), slotOf(back, rid('p1'))], [0, 1]);
  assert.equal(heartsOfN(back, restored), heartsOfN(q, projects), 'enemies never healed while it rested');
  assert.equal(credits(back, restored), credits(q, projects));
  sameQuests(q, back);
  assert.equal(reconcile(back, restored), back, 'idempotent');
});

test('restore with every slot taken: the realm waits, and is placed when one frees (oldest project first)', () => {
  const { q, projects } = played();
  const others = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => P(n));
  let s = reconcile(q, [{ ...projects[0], archivedAt: T0 + 50 }, ...others]);
  assert.equal(others.filter((p) => slotOf(s, rid(p.id)) !== undefined && slotOf(s, rid(p.id)) !== UNPLACED).length, 7, 'seven fit; p9 has none');
  assert.equal(item(s, rid('p9')), undefined);
  const all = [projects[0], ...others];
  s = reconcile(s, all);
  assert.equal(slotOf(s, rid('p1')), UNPLACED, 'waits: no slot');
  assert.equal(realmOfProject(liveWorld(s.items, all), 'p1')?.slot, UNPLACED);
  assert.equal(heartsOfN(s, all), heartsOfN(q, projects));
  // Another project is archived: p1, the oldest without a place, takes its slot; p9 keeps waiting.
  const freed = all.map((p) => (p.id === 'p4' ? { ...p, archivedAt: T0 + 90 } : p));
  s = reconcile(s, freed);
  assert.equal(slotOf(s, rid('p1')), 2, 'the slot p4 left');
  assert.equal(item(s, rid('p9')), undefined, 'p9 is younger than p1');
  assert.equal(slotOf(s, rid('p4')), UNPLACED);
});

test('delete (here or from another device): the realm rests for good with its quests, credits and trophies', () => {
  const { q, projects } = played();
  const credits0 = credits(q, projects);
  const gone: ProjectRef[] = []; // the project is no longer in the list
  const w = liveWorld(q.items, gone);
  assert.equal(w.resting?.[0].name, 'Project 1', 'the snapshot name');
  assert.equal(credits(q, gone), credits0);
  assert.equal(w.quests.length, 2);
  const next = reconcile(q, gone);
  assert.equal(slotOf(next, rid('p1')), UNPLACED);
  assert.equal(next.items.length, q.items.length, 'nothing deleted');
  sameQuests(q, next);
  assert.equal(reconcile(next, gone), next);
  // A later project does not adopt it, and the deleted project is no attach candidate.
  const fresh = [P(2)];
  const made = reconcile(next, fresh);
  assert.equal(slotOf(made, rid('p2')), 0);
  assert.deepEqual(liveWorld(made.items, fresh).quests.filter((x) => x.realmId === rid('p2')), []);
  assert.deepEqual(worldMoments(liveWorld(made.items, fresh)).realms, []);
  assert.equal(credits(made, fresh), credits0);
});

test('an eighth project gets a realm when a slot frees', () => {
  const { projects } = realms(7);
  const all = [...projects, P(8)];
  let s = reconcile(empty, all);
  assert.equal(item(s, rid('p8')), undefined);
  assert.equal(slotOf(s, rid('p7')), 6);
  const freed = all.map((p) => (p.id === 'p3' ? { ...p, archivedAt: T0 + 90 } : p));
  s = reconcile(s, freed);
  assert.equal(slotOf(s, rid('p8')), 2);
  assert.equal(slotOf(s, rid('p3')), UNPLACED);
});

test('a resting realm announces nothing, however conquered', () => {
  const { q, projects } = realms(1);
  let s = worldOps.addQuest(q, rid('p1'), 'Only quest', T0 + 1, 'a');
  s = worldOps.markDone(s, 'a', T0 + 2, 'r1');
  assert.deepEqual(worldMoments(liveWorld(s.items, projects)).realms.map((r) => r.id), [rid('p1')]);
  assert.deepEqual(worldMoments(liveWorld(s.items, [{ ...projects[0], archivedAt: 1 }])).realms, []);
});

// ---- the reconcile -----------------------------------------------------------

test('reconcile creates realms for existing projects, oldest first, null `started` first', () => {
  const projects = [P(3), { id: 'g1', name: 'Become ML Engineer', started: null }, P(2)];
  const s = reconcile(empty, projects);
  assert.deepEqual([slotOf(s, rid('g1')), slotOf(s, rid('p2')), slotOf(s, rid('p3'))], [0, 1, 2]);
  assert.equal(reconcile(s, projects), s, 'a second run changes nothing');
  assert.equal(reconcile(empty, []), empty);
});

test('reconcile waits while the attach choice has something to ask, then runs', () => {
  const legacy = worldOps.claimSlot(empty, 0, 'Databases', 'code', T0);
  const projects = [P(1)];
  assert.equal(reconcile(legacy, projects), legacy, 'paused');
  const kept = worldOps.keepRealm(legacy, 'realm:0');
  assert.equal(slotOf(reconcile(kept, projects), rid('p1')), 1, 'goes round the kept realm');
  const linked = worldOps.linkRealm(legacy, 'realm:0', 'p1');
  assert.equal(reconcile(linked, projects), linked, 'p1 already has its realm');
  assert.equal(reconcile(legacy, []), legacy, 'no candidate project: nothing to ask, nothing to do');
});

test('reconcile never touches a hand-claimed realm, nor mirrors onto an attached one', () => {
  let q = worldOps.claimSlot(empty, 0, 'Databases', 'code', T0);
  q = worldOps.claimSlot(q, 1, 'Fitness', 'gym', T0 + 1);
  q = worldOps.keepRealm(q, 'realm:1');
  q = worldOps.linkRealm(q, 'realm:0', 'p1');
  const projects = [{ ...P(1), name: 'Renamed', icon: 'book' as const }];
  const next = reconcile(q, projects);
  assert.equal(next, q, 'nothing to do');
  assert.equal(item(next, 'realm:0')?.title, 'Databases');
  assert.equal(item(next, 'realm:0')?.props.icon, 'code');
  // Archiving the project of an attached legacy realm frees its slot like any other.
  const rested = reconcile(q, [{ ...projects[0], archivedAt: 1 }]);
  assert.equal(slotOf(rested, 'realm:0'), UNPLACED);
  assert.equal(slotOf(rested, 'realm:1'), 1, 'a kept realm is not a project event');
  // And claimSlot never writes over it afterwards (the reuse bug).
  assert.equal(worldOps.claimSlot(rested, 0, 'Reused', 'code', T0 + 9), rested);
});

test('reconcile mirrors a renamed project into the realm it created', () => {
  const { q } = realms(1);
  const renamed = [{ ...P(1), name: 'Deep learning', icon: 'book' as const }];
  const next = reconcile(q, renamed);
  assert.deepEqual([item(next, rid('p1'))?.title, item(next, rid('p1'))?.props.icon], ['Deep learning', 'book']);
  assert.equal(slotOf(next, rid('p1')), 0);
  assert.equal(reconcile(next, renamed), next);
});

test('the project-blind world never rests a project realm (sync has not settled)', () => {
  const { q } = played();
  const w = liveWorld(q.items);
  assert.deepEqual([w.realms.length, w.resting?.length], [1, 0]);
});

test('claimSlot and renameRealm keep working for hand-claimed realms', () => {
  let q = worldOps.claimSlot(empty, 2, 'Fitness', 'gym', T0);
  q = worldOps.renameRealm(q, 'realm:2', 'Strength');
  assert.equal(worldOf(q.items).realms[0].name, 'Strength');
  assert.equal(worldOps.syncRealmLook(q, 'realm:2', 'Strength', 'gym'), q, 'no change, same slice');
});

test('a resting realm takes no new quest, phase or result; undo still works', () => {
  const { q, projects } = played();
  const own = worldOps.recordResult(q, 'n', 'done', T0 + 20, 's2', 'r3');
  const rested = reconcile(own, [{ ...projects[0], archivedAt: T0 + 50 }]);
  assert.equal(worldOps.addQuest(rested, rid('p1'), 'Late', T0 + 60, 'z'), rested);
  assert.equal(worldOps.addPhase(rested, 'n', 'Late phase', T0 + 60, 'zp'), rested);
  assert.equal(worldOps.recordResult(rested, 'm', 'partly', T0 + 60, 's9', 'r9'), rested);
  assert.equal(worldOps.markDone(rested, 'n', T0 + 60, 'r8'), rested);
  assert.notEqual(worldOps.undoResult(rested, 'r3', T0 + 21), rested, 'a result can still be taken back');
});
