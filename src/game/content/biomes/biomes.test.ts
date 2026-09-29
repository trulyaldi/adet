import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BIOME_IDS } from '../../../domain/game/biomes';
import { hasSprite } from '../../assets/manifest';
import { NPCS, ROSTER } from '../roster';
import { BAND_W, BAND_X, BIOME_H, BIOMES, biomeMaps, wordCount } from './index';

test('seven biomes, bottom to top, each with its own slice of the world', () => {
  const maps = biomeMaps();
  assert.equal(maps.length, 7);
  maps.forEach((m, i) => {
    assert.equal(m.id, BIOME_IDS[i]);
    assert.equal(m.top, (6 - i) * BIOME_H);
  });
});

for (const id of BIOME_IDS) {
  test(`${id}: 6 mobs, 1 camp in the middle, the boss at the gate`, () => {
    const m = biomeMaps()[BIOME_IDS.indexOf(id)];
    assert.equal(m.nodes.filter((n) => n.kind === 'mob').length, 6);
    assert.equal(m.nodes[3].kind, 'camp');
    assert.equal(m.nodes[7].kind, 'boss');
    // Nodes climb: each is above the last.
    for (let i = 1; i < m.nodes.length; i++) assert.ok(m.nodes[i].y < m.nodes[i - 1].y, `node ${i} climbs`);
  });

  test(`${id}: a valid path inside the island`, () => {
    const m = biomeMaps()[BIOME_IDS.indexOf(id)];
    assert.ok(m.path.length > 50);
    for (const p of m.path) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(p.x >= BAND_X && p.x <= BAND_X + BAND_W, `path x ${p.x} in band`);
      assert.ok(p.y >= m.top && p.y <= m.top + BIOME_H + 8, `path y ${p.y} in biome`);
    }
    // Continuous: no jumps.
    for (let i = 1; i < m.path.length; i++) assert.ok(Math.hypot(m.path[i].x - m.path[i - 1].x, m.path[i].y - m.path[i - 1].y) < 8);
  });

  test(`${id}: every sprite it uses resolves`, () => {
    const m = biomeMaps()[BIOME_IDS.indexOf(id)];
    const ids = [...m.ground.flat().filter((x): x is string => !!x), ...m.edges.map((e) => e.id), ...m.decor.map((d) => d.id), ...m.lights.map((l) => l.id), ...m.critters.map((c) => c.id), ...m.villagers.map((v) => v.id)];
    const missing = [...new Set(ids)].filter((i) => !hasSprite(i));
    assert.deepEqual(missing, []);
    assert.ok(m.decor.length >= 20, 'a lived-in island');
  });

  test(`${id}: lore and boss lines are warm and short (≤12 words)`, () => {
    const d = BIOMES[id];
    assert.ok(d.lore.length >= 8);
    for (const line of [...d.lore, ...d.boss.before, d.boss.defeat]) {
      assert.ok(wordCount(line) <= 12, `"${line}" is ${wordCount(line)} words`);
      assert.doesNotMatch(line, /\b(fail(ed)?|lazy|shame|guilt|should have|behind|disappoint)/i, `no guilt in "${line}"`);
    }
    assert.equal(ROSTER[id].mobs.length, 3);
  });
}

test('the builder is deterministic', () => {
  const a = JSON.stringify(biomeMaps());
  assert.equal(JSON.stringify(biomeMaps()), a);
  assert.ok(Object.keys(NPCS).length === 3);
});
