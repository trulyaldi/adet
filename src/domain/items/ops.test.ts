import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as ops from './ops';
import { chestClaimId, isQuickLog, logId, parseItem, parseProps, QUEST_META_ID } from './types';

const NOW = Date.UTC(2026, 8, 29, 9, 0, 0);
const empty: ops.QuestSlice = { items: [], links: [] };

test('claiming a chest writes the claim and the entry, once', () => {
  const claimed = ops.claimChest(empty, { sessionId: 's1', habitId: 'h1', text: ' shipped the OTP flow ', now: NOW });
  const ids = claimed.items.map((i) => i.id);
  assert.ok(ids.includes(chestClaimId('s1')));
  const log = claimed.items.find((i) => i.id === logId('s1'));
  assert.ok(log && log.type === 'log' && log.body === 'shipped the OTP flow' && log.props.sessionId === 's1');
  assert.deepEqual(claimed.links.map((l) => l.kind), ['chronicles']);
  assert.equal(ops.claimChest(claimed, { sessionId: 's1', habitId: 'h1', text: 'again', now: NOW }), claimed);
});

test('a chest opened with no line writes only the claim', () => {
  const bare = ops.claimChest(empty, { sessionId: 's2', habitId: null, text: '  ', now: NOW });
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
  const c = ops.claimChest(empty, { sessionId: 's1', habitId: 'h1', text: 'one', now: NOW });
  const e = ops.editLog(c, logId('s1'), 'two');
  assert.equal(e.items.find((i) => i.id === logId('s1'))?.body, 'two');
  assert.equal(ops.editLog(e, logId('s1'), ' two '), e);
});

test('measures: one per habit (a fixed id), edited in place; an empty label changes nothing', () => {
  let q: ops.QuestSlice = { items: [], links: [] };
  q = ops.setMetric(q, 'h1', '  Pages ', 'pages', 1);
  assert.deepEqual(q.items.map((i) => [i.id, i.type, i.habitId, i.props]), [['metric:h1', 'metric_def', 'h1', { label: 'Pages', unit: 'pages' }]]);
  const same = ops.setMetric(q, 'h1', 'Pages', 'pages', 2);
  assert.equal(same, q, 'no change, same slice');
  q = ops.setMetric(q, 'h1', 'Chapters', '', 3);
  assert.equal(q.items.length, 1);
  assert.deepEqual(q.items[0].props, { label: 'Chapters', unit: '' });
  assert.equal(ops.setMetric(q, 'h1', '   ', 'x', 4), q);
});

test('quick logs: saved without a session; an amount rides along; nothing to save is a no-op', () => {
  const empty: ops.QuestSlice = { items: [], links: [] };
  const q = ops.addQuickLog(empty, { habitId: 'h1', text: ' read two chapters ', amount: { value: 12.345, metricId: 'metric:h1' }, now: 5 }, 'q1');
  assert.deepEqual(q.items[0].props, { sessionId: '', amount: 12.35, metricId: 'metric:h1' });
  assert.equal(q.items[0].body, 'read two chapters');
  assert.equal(isQuickLog(q.items[0] as never), true);
  assert.equal(ops.addQuickLog(empty, { habitId: 'h1', text: '  ', now: 5 }), empty);
  assert.equal(ops.addQuickLog(empty, { habitId: 'h1', text: '', amount: { value: -3, metricId: 'm' }, now: 5 }), empty, 'negative amounts are dropped');
});

test('a chest can carry a measure amount, even with no line and no ticks', () => {
  const q = ops.claimChest({ items: [], links: [] }, { sessionId: 's1', habitId: 'h1', text: '', amount: { value: 8, metricId: 'metric:h1' }, now: 1 });
  assert.deepEqual(q.items.find((i) => i.id === logId('s1'))?.props, { sessionId: 's1', amount: 8, metricId: 'metric:h1' });
});

test('new shapes parse from server rows; older rows still parse; bad amounts are dropped', () => {
  assert.deepEqual(parseProps('log', { sessionId: 's1' }), { sessionId: 's1' });
  assert.deepEqual(parseProps('log', { sessionId: '', amount: '7', metricId: 'metric:h1' }), { sessionId: '', amount: 7, metricId: 'metric:h1' });
  assert.deepEqual(parseProps('log', { sessionId: 's', amount: 'lots' }), { sessionId: 's' });
  assert.deepEqual(parseProps('log', { sessionId: 's', amount: -1 }), { sessionId: 's' });
  assert.deepEqual(parseProps('metric_def', { label: ' Pages ', unit: 'p'.repeat(40) }), { label: 'Pages', unit: 'p'.repeat(24) });
  const item = parseItem({ id: 'metric:h1', type: 'metric_def', props: { label: 'Pages', unit: 'pages' }, habitId: 'h1', createdAt: 1 });
  assert.equal(item?.type, 'metric_def');
});
