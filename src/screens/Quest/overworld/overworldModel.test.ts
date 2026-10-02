// The Overworld's layout: 7 slots in biome order bottom → top, a path
// joining them, the hero's walk, and which slot the token stands on.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BIOME_IDS } from '../../../domain/game/biomes';
import { slotsView, worldOps } from '../../../domain/world';
import { hasSprite } from '../../../game/assets/manifest';
import { along, currentSlot, islandCells, islandClouds, islandDecor, nextClaimable, OW_H, overworldLayout, route, slotAt, travelMs, TRAVEL_MAX_MS } from './overworldModel';

const T0 = Date.UTC(2026, 9, 2, 9);
const layout = overworldLayout();

test('slots stack in biome order, slot 0 at the bottom, all inside the map', () => {
  assert.equal(layout.slots.length, BIOME_IDS.length);
  layout.slots.forEach((s, i) => {
    assert.equal(s.biome, BIOME_IDS[i]);
    assert.ok(s.y > 0 && s.y < OW_H);
    if (i) assert.ok(s.y < layout.slots[i - 1].y, 'each slot is above the last');
    assert.equal(slotAt(s.y), i, 'a tap on the island finds its slot');
  });
  assert.equal(slotAt(0), null);
  assert.ok(layout.path.length > 10);
});

test('islands, decor and clouds use the biome palette and existing sprites', () => {
  for (const s of layout.slots) {
    assert.ok(islandCells(s).reduce((n, c) => n + c.xy.length, 0) > 100);
    for (const d of [...islandDecor(s), ...islandClouds(s)]) assert.ok(hasSprite(d.id), d.id);
    assert.ok(hasSprite(`prop.${s.biome}.flag`));
  }
  assert.deepEqual(islandCells(layout.slots[2]), islandCells(layout.slots[2]), 'deterministic');
});

test('the walk follows the path from one island to the other, in under 900 ms', () => {
  const r = route(layout, 0, 3);
  assert.deepEqual(along(r, 0), { x: layout.slots[0].x, y: layout.slots[0].y });
  assert.deepEqual(along(r, 1), { x: layout.slots[3].x, y: layout.slots[3].y });
  const back = route(layout, 3, 0);
  assert.deepEqual(along(back, 1), { x: layout.slots[0].x, y: layout.slots[0].y });
  assert.deepEqual(along(route(layout, 2, 2), 0.5), { x: layout.slots[2].x, y: layout.slots[2].y });
  for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) assert.ok(travelMs(a, b) <= TRAVEL_MAX_MS && TRAVEL_MAX_MS < 900);
});

test('the token stands on the stored slot while it is claimed, else the lowest claimed one', () => {
  const none = slotsView([]);
  assert.equal(currentSlot(none, null), null);
  assert.equal(nextClaimable(none), 0);
  let q = worldOps.claimSlot({ items: [], links: [] }, 0, 'My first realm', 'target', T0);
  q = worldOps.claimSlot(q, 3, 'Fitness', 'gym', T0 + 1);
  const slots = slotsView(q.items);
  assert.equal(currentSlot(slots, null), 0, 'a Session 3 temp realm is slot 0, the default');
  assert.equal(currentSlot(slots, 3), 3);
  assert.equal(currentSlot(slots, 5), 0, 'an unclaimed stored slot falls back');
  assert.equal(nextClaimable(slots), 1);
});
