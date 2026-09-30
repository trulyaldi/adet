// Pacing (v2 N3): a 2 h/day player takes about 8–10 days for the forest, 16–20
// for biome 4 and 24–30 for biome 7 (±25% here); heavier play is faster, but
// the burnout cap and the seals keep it within ~4× of a 1 h/day player.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PROFILES, simulate } from './balanceSim';

const SEEDS = [1, 2, 3];
const avgDays = (minutesPerDay: number) => {
  const p = PROFILES.find((x) => x.minutesPerDay === minutesPerDay)!;
  const runs = SEEDS.map((s) => simulate(p, s));
  return [0, 1, 2, 3, 4, 5, 6].map((b) => {
    const v = runs.map((r) => r.daysPerBiome[b]);
    assert.ok(v.every((x) => x !== null), `${p.name}: biome ${b + 1} cleared`);
    return (v as number[]).reduce((a, x) => a + x, 0) / v.length;
  });
};

const within = (x: number, lo: number, hi: number) => x >= lo * 0.75 && x <= hi * 1.25;

test('2 h/day: biome 1 in 8–10 days, biome 4 in 16–20, biome 7 in 24–30 (±25%)', () => {
  const d = avgDays(120);
  assert.ok(within(d[0], 8, 10), `biome 1: ${d[0]}`);
  assert.ok(within(d[3], 16, 20), `biome 4: ${d[3]}`);
  assert.ok(within(d[6], 24, 30), `biome 7: ${d[6]}`);
});

test('4 h/day is meaningfully faster than 1 h/day, but never more than ~4×', () => {
  const total = (m: number) => avgDays(m).reduce((a, x) => a + x, 0);
  const ratio = total(60) / total(240);
  assert.ok(ratio >= 1.3 && ratio <= 4, `1 h / 4 h = ${ratio.toFixed(2)}`);
});

test('the simulator is deterministic for a seed', () => {
  const p = PROFILES[1];
  assert.deepEqual(simulate(p, 7).daysPerBiome, simulate(p, 7).daysPerBiome);
});
