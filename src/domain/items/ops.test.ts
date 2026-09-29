import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as ops from './ops';
import { chestClaimId, logId, QUEST_META_ID } from './types';

const NOW = Date.UTC(2026, 8, 29, 9, 0, 0);
const empty: ops.QuestSlice = { items: [], links: [] };

test('tasks are added in order per habit, trimmed, and empty titles ignored', () => {
  let q = ops.addTask(empty, 'h1', '  Fix   the login  ', NOW, 'a');
  q = ops.addTask(q, 'h1', 'Write tests', NOW + 1, 'b');
  q = ops.addTask(q, 'h2', 'Other habit', NOW + 2, 'c');
  assert.equal(ops.addTask(q, 'h1', '   ', NOW), q);
  const h1 = ops.tasksFor(q.items, 'h1');
  assert.deepEqual(h1.map((t) => [t.id, t.title, t.props.order]), [
    ['a', 'Fix the login', 0],
    ['b', 'Write tests', 1],
  ]);
});

test('reorder, done and delete only touch what changed', () => {
  let q = ops.addTask(empty, 'h1', 'A', NOW, 'a');
  q = ops.addTask(q, 'h1', 'B', NOW, 'b');
  q = ops.addTask(q, 'h1', 'C', NOW, 'c');
  const r = ops.reorderTasks(q, 'h1', ['c', 'a', 'b']);
  assert.deepEqual(ops.openTasksFor(r.items, 'h1').map((t) => t.id), ['c', 'a', 'b']);
  assert.equal(ops.reorderTasks(r, 'h1', ['c', 'a', 'b']), r, 'same order is a no-op');

  const done = ops.setTaskStatus(r, 'a', 'done', NOW);
  assert.equal(done.items.find((i) => i.id === 'b'), r.items.find((i) => i.id === 'b'), 'untouched items keep identity');
  const a = done.items.find((i) => i.id === 'a');
  assert.ok(a && a.type === 'task' && a.props.status === 'done' && a.props.doneAt === new Date(NOW).toISOString());
  assert.deepEqual(ops.tasksFor(done.items, 'h1').map((t) => t.id), ['c', 'b', 'a'], 'done tasks sort last');

  const reopened = ops.setTaskStatus(done, 'a', 'open', NOW);
  const a2 = reopened.items.find((i) => i.id === 'a');
  assert.ok(a2 && a2.type === 'task' && a2.props.doneAt === undefined);

  const planned = ops.planTasks(done, 's1', ['b'], NOW);
  const del = ops.deleteTask(planned, 'b');
  assert.equal(del.items.some((i) => i.id === 'b'), false);
  assert.equal(del.links.length, 0, 'its planned link goes too');
});

test('claiming a chest writes the claim, the entry, completed links and done tasks, once', () => {
  let q = ops.addTask(empty, 'h1', 'A', NOW, 'a');
  q = ops.addTask(q, 'h1', 'B', NOW, 'b');
  q = ops.planTasks(q, 's1', ['a', 'b'], NOW);
  const claimed = ops.claimChest(q, { sessionId: 's1', habitId: 'h1', doneTaskIds: ['a'], text: ' shipped the OTP flow ', now: NOW });
  const ids = claimed.items.map((i) => i.id);
  assert.ok(ids.includes(chestClaimId('s1')));
  const log = claimed.items.find((i) => i.id === logId('s1'));
  assert.ok(log && log.type === 'log' && log.body === 'shipped the OTP flow' && log.props.sessionId === 's1');
  assert.deepEqual(claimed.links.map((l) => l.kind).sort(), ['chronicles', 'completed_in', 'planned_for', 'planned_for']);
  const a = claimed.items.find((i) => i.id === 'a');
  assert.ok(a && a.type === 'task' && a.props.status === 'done');
  assert.equal(ops.claimChest(claimed, { sessionId: 's1', habitId: 'h1', doneTaskIds: ['b'], text: 'again', now: NOW }), claimed);
});

test('a chest opened with ticks only still writes an (empty) entry; with nothing, only the claim', () => {
  let q = ops.addTask(empty, 'h1', 'A', NOW, 'a');
  const ticks = ops.claimChest(q, { sessionId: 's1', habitId: 'h1', doneTaskIds: ['a'], text: '', now: NOW });
  const log = ticks.items.find((i) => i.id === logId('s1'));
  assert.ok(log && log.body === '');
  const bare = ops.claimChest(empty, { sessionId: 's2', habitId: null, doneTaskIds: [], text: '  ', now: NOW });
  assert.deepEqual(bare.items.map((i) => i.type), ['chest_claim']);
});

test('achievements are append-only and idempotent', () => {
  const at = new Date(NOW).toISOString();
  const q = ops.addAchievements(empty, [{ kind: 'boss_defeated', ref: 'forest:0', at }], NOW);
  assert.equal(q.items.length, 1);
  assert.equal(ops.addAchievements(q, [{ kind: 'boss_defeated', ref: 'forest:0', at: 'later' }], NOW), q);
});

test('quest meta is created once and edited in place', () => {
  const started = ops.startQuest(empty, NOW);
  assert.equal(ops.startQuest(started, NOW + 5), started);
  const meta = ops.questMetaOf(started.items);
  assert.ok(meta && meta.id === QUEST_META_ID && meta.props.startedAt === new Date(NOW).toISOString());
  const edited = ops.updateQuestMeta(started, (p) => ({ ...p, companion: 'pet.fox' }), NOW);
  assert.equal(ops.questMetaOf(edited.items)?.props.companion, 'pet.fox');
  assert.equal(ops.updateQuestMeta(edited, (p) => p, NOW), edited);
  // Editing before the quest started changes nothing (only onboarding starts it).
  assert.equal(ops.updateQuestMeta(empty, (p) => ({ ...p, companion: 'pet.fox' }), NOW), empty);
  // Starting again keeps the original start.
  assert.equal(ops.startQuest(edited, NOW + 1000), edited);
});

test('purchases and logs', () => {
  const q = ops.addPurchase(empty, 'freeze', 60, NOW, '2026-09', 'p1');
  assert.deepEqual(q.items[0].props, { sku: 'freeze', cost: 60, month: '2026-09' });
  const c = ops.claimChest(empty, { sessionId: 's1', habitId: 'h1', doneTaskIds: [], text: 'one', now: NOW });
  const e = ops.editLog(c, logId('s1'), 'two');
  assert.equal(e.items.find((i) => i.id === logId('s1'))?.body, 'two');
  assert.equal(ops.editLog(e, logId('s1'), ' two '), e);
});
