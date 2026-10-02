// The Realm screen's layout: at most 8 uncleared quests, the oldest boss in
// the lair, cleared ones off the path (trophies), the slot's biome art.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as ops from '../../../domain/items/ops';
import { realmView, worldOps } from '../../../domain/world';
import { biomeMaps } from '../../../game/content/biomes';
import { MAX_NODES, mobSprite, realmLayout } from './realmModel';

const T0 = Date.UTC(2026, 9, 2, 9);
const maps = biomeMaps();

function realm(slot: number, quests: number): ops.QuestSlice {
  let q = worldOps.claimSlot({ items: [], links: [] }, slot, 'R', 'code', T0);
  for (let i = 0; i < quests; i++) q = worldOps.addQuest(q, `realm:${slot}`, `Quest ${i}`, T0 + 1 + i, `q${i}`);
  return q;
}
const lay = (q: ops.QuestSlice, slot = 0) => realmLayout(maps[slot], realmView(q.items, `realm:${slot}`)!);

test('an empty realm: no nodes, the "+" and camp at the path start', () => {
  const l = lay(realm(0, 0));
  assert.deepEqual([l.nodes.length, l.lair, l.trophies], [0, null, 0]);
  assert.ok(l.plus.y < l.camp.y, 'the "+" sits just up the path from the camp');
});

test('at most 8 uncleared quests show, oldest first', () => {
  const l = lay(realm(0, 11));
  assert.equal(l.nodes.length, MAX_NODES);
  assert.equal(l.hidden, 3);
  assert.deepEqual(l.nodes.map((n) => n.node.quest.id).slice(0, 2), ['q0', 'q1']);
  // Up the path: each next node sits higher on the island.
  for (let i = 1; i < l.nodes.length; i++) assert.ok(l.nodes[i].y < l.nodes[i - 1].y);
});

test('cleared quests leave the path and count as trophies', () => {
  let q = realm(0, 3);
  q = worldOps.markDone(q, 'q1', T0 + 10);
  const l = lay(q);
  assert.deepEqual(l.nodes.map((n) => n.node.quest.id), ['q0', 'q2']);
  assert.equal(l.trophies, 1);
});

test('the oldest uncleared boss takes the lair (and the slot of the 8)', () => {
  let q = realm(0, 9);
  q = worldOps.addPhase(q, 'q3', 'a', T0 + 20, 'a');
  q = worldOps.addPhase(q, 'q3', 'b', T0 + 21, 'b');
  const l = lay(q);
  assert.equal(l.lair?.node.quest.id, 'q3');
  assert.equal(l.lair?.sprite.startsWith('boss.forest.'), true);
  assert.equal(l.nodes.length, MAX_NODES - 1);
  assert.ok(!l.nodes.some((n) => n.node.quest.id === 'q3'));
});

test("the slot's biome supplies the sprites, stable per quest", () => {
  const l = lay(realm(4, 2), 4);
  assert.ok(l.nodes.every((n) => n.sprite.startsWith('mob.iron.')));
  assert.equal(mobSprite('iron', 'q0'), mobSprite('iron', 'q0'));
});
