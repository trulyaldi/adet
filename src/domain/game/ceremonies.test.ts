import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ceremonyMayPlay, detectCeremonies, markCeremonyStarted, seedCeremonyMarks } from './ceremonies';
import type { GameState } from './derive';

const game = (level: number, rank: number, bosses: { biome: string; loop: number }[] = []): GameState => ({
  xp: { level }, rank: { tier: rank }, journey: { defeated: bosses },
  bossAchievements: bosses.map((d) => `${d.biome}:${d.loop}`),
} as GameState);

test('seeding a veteran or second device plays nothing', () => {
  const g = game(20, 5, [{ biome: 'forest', loop: 0 }, { biome: 'astral', loop: 0 }]);
  const marks = seedCeremonyMarks(g);
  assert.deepEqual(marks, { level: 20, rank: 5, bosses: ['forest:0', 'astral:0'], ascensions: 1 });
  assert.deepEqual(detectCeremonies(marks, g), []);
});

test('boss then ascension then rank; rank coalesces levels', () => {
  const marks = seedCeremonyMarks(game(2, 0));
  const g = game(12, 3, [{ biome: 'astral', loop: 0 }]);
  const events = detectCeremonies(marks, g);
  assert.deepEqual(events.map((e) => e.kind), ['boss_defeated', 'ascension', 'rank_up']);
  const after = events.reduce((m, e) => markCeremonyStarted(m, e, g), marks);
  assert.deepEqual(detectCeremonies(after, g), []);
});

test('levels coalesce; a rebalance lowering level never replays', () => {
  const marks = seedCeremonyMarks(game(3, 1));
  const high = game(5, 1);
  const events = detectCeremonies(marks, high);
  assert.deepEqual(events, [{ id: 'level:5', kind: 'level_up', level: 5 }]);
  const after = markCeremonyStarted(marks, events[0], high);
  assert.deepEqual(detectCeremonies(after, game(4, 1)), []);
});

test('multi-loop bosses have distinct ids and ascension increases', () => {
  const marks = seedCeremonyMarks(game(3, 1, [{ biome: 'astral', loop: 0 }]));
  const events = detectCeremonies(marks, game(3, 1, [{ biome: 'astral', loop: 0 }, { biome: 'astral', loop: 1 }]));
  assert.deepEqual(events.map((e) => e.id), ['boss:astral:1', 'ascension:2']);
});

test('a derived boss waits until its achievement has been recorded', () => {
  const marks = seedCeremonyMarks(game(1, 0));
  const pending = game(1, 0, [{ biome: 'forest', loop: 0 }]);
  pending.bossAchievements = [];
  assert.deepEqual(detectCeremonies(marks, pending), []);
  pending.bossAchievements = ['forest:0'];
  assert.deepEqual(detectCeremonies(marks, pending).map((e) => e.id), ['boss:forest:0']);
});

test('host defers during running or paused sessions, loot, other sheets, reveal and background', () => {
  const quiet = { timerActive: false, lootOpen: false, modalOpen: false, revealPending: false, appActive: true };
  assert.equal(ceremonyMayPlay(quiet), true);
  assert.equal(ceremonyMayPlay({ ...quiet, timerActive: true }), false);
  assert.equal(ceremonyMayPlay({ ...quiet, lootOpen: true }), false);
  assert.equal(ceremonyMayPlay({ ...quiet, modalOpen: true }), false);
  assert.equal(ceremonyMayPlay({ ...quiet, revealPending: true }), false);
  assert.equal(ceremonyMayPlay({ ...quiet, appActive: false }), false);
});
