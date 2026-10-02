import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ceremonyMayPlay, ceremonyVisible, detectCeremonies, markCeremonyStarted, seedCeremonyMarks, withWorldMarks } from './ceremonies';
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

test('a scene hidden by a session waits for the Loot sheet and other sheets before coming back', () => {
  const quiet = { timerActive: false, lootOpen: false, modalOpen: false };
  assert.equal(ceremonyVisible(quiet), true);
  assert.equal(ceremonyVisible({ ...quiet, timerActive: true }), false);
  // The session just ended and its Loot sheet is up: still hidden.
  assert.equal(ceremonyVisible({ ...quiet, lootOpen: true }), false);
  assert.equal(ceremonyVisible({ ...quiet, modalOpen: true }), false);
});

test('world-4: a fallen boss, then its realm conquered; each once', () => {
  const g = game(2, 0);
  const none = { bosses: [], realms: [] };
  const fell = { bosses: [{ id: 'm', title: 'Ship it' }], realms: [{ id: 'realm:0', name: 'Work' }] };
  const marks = seedCeremonyMarks(g, none);
  const events = detectCeremonies(marks, g, fell);
  assert.deepEqual(events.map((e) => e.kind), ['world_boss', 'realm_conquered']);
  const after = events.reduce((m, e) => markCeremonyStarted(m, e, g), marks);
  assert.deepEqual(detectCeremonies(after, g, fell), []);
  // Reopened by a new quest and conquered again: no replay.
  assert.deepEqual(detectCeremonies(after, g, { bosses: fell.bosses, realms: fell.realms }), []);
});

test('world-4: marks saved before World Mode seed silently; nothing already cleared replays', () => {
  const g = game(2, 0);
  const old = seedCeremonyMarks(g);
  const fell = { bosses: [{ id: 'm', title: 'Ship it' }], realms: [] };
  assert.deepEqual(detectCeremonies(old, g, fell), [], 'unseeded world marks announce nothing');
  const seeded = withWorldMarks(old, fell);
  assert.deepEqual(seeded.worldBosses, ['m']);
  assert.equal(withWorldMarks(seeded, { bosses: [], realms: [] }), seeded, 'seeded once');
  const later = { bosses: [...fell.bosses, { id: 'b2', title: 'Next' }], realms: [] };
  assert.deepEqual(detectCeremonies(seeded, g, later).map((e) => e.id), ['world:b2']);
});
