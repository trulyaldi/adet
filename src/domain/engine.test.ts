import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_CONFIG } from './config';
import {
  activeSec,
  daySecMap,
  selectProjects,
  selectStats,
  selectStageSheet,
  selectTimer,
  selectToday,
  stageOf,
  stagesFor,
  streakOf,
} from './engine';
import { seed } from './seed';
import { addDays, dkey } from './time';
import { PersistedState } from './types';

const NOW = new Date(2026, 6, 10, 12, 0, 0).getTime(); // 2026-07-10

test('stageOf maps lifetime hours to the right stage', () => {
  const stages = stagesFor(DEFAULT_CONFIG);
  assert.equal(stageOf(0, stages)[0], 'Novice');
  assert.equal(stageOf(9 * 3600, stages)[0], 'Novice');
  assert.equal(stageOf(10 * 3600, stages)[0], 'Learner');
  assert.equal(stageOf(80 * 3600, stages)[0], 'Practitioner');
  assert.equal(stageOf(1000 * 3600, stages)[0], 'Master');
});

test('streakOf counts consecutive days ending today/yesterday', () => {
  const t = new Date();
  const map: Record<string, number> = {};
  map[dkey(t)] = 100;
  map[dkey(addDays(t, -1))] = 100;
  map[dkey(addDays(t, -2))] = 100;
  // gap at -3
  map[dkey(addDays(t, -4))] = 100;
  assert.equal(streakOf(map), 3);
});

test('activeSec accumulates base + running segment', () => {
  const now = 10_000;
  assert.equal(activeSec(null, now), 0);
  assert.equal(activeSec({ habitId: 'h', startedAt: null, baseSec: 42 }, now), 42);
  assert.equal(
    activeSec({ habitId: 'h', startedAt: now - 5000, baseSec: 10 }, now),
    15
  );
});

test('seed is deterministic and self-consistent', () => {
  const a = seed(NOW);
  const b = seed(NOW);
  assert.equal(a.sessions.length, b.sessions.length);
  assert.ok(a.sessions.length > 50, 'seed should generate many sessions');
  assert.equal(a.projects[0].id, 'g1');
  assert.equal(a.habits.length, 4);
  // started backfilled to earliest session
  const earliest = Math.min(...a.sessions.map((s) => s.start));
  assert.equal(a.projects[0].started, earliest);
});

test('selectToday / selectProjects / selectStats produce coherent output on seed', () => {
  const data = seed(NOW);
  const today = selectToday(data, DEFAULT_CONFIG, NOW);
  assert.equal(today.groups.length, 1);
  assert.equal(today.groups[0].rows.length, 4);
  assert.match(today.streakLabel, /days?$/);

  const projects = selectProjects(data, DEFAULT_CONFIG, NOW);
  assert.equal(projects.cards.length, 1);
  assert.equal(projects.cards[0].habits.length, 4);
  // habit shares are sorted descending
  const shares = projects.cards[0].habits.map((h) => h.shareBarW);
  assert.deepEqual(shares, shares.slice().sort((a, b) => b - a));

  const stats = selectStats(data, DEFAULT_CONFIG, NOW, {
    heatSel: null,
    heatExpanded: false,
  });
  assert.ok(stats.heatRows.length >= 8);
  assert.equal(stats.projDist.length, 1);
  assert.ok(stats.hasTopHabit);
});

test('selectStageSheet returns ladder with a current stage', () => {
  const data = seed(NOW);
  const sheet = selectStageSheet(data, DEFAULT_CONFIG, 'g1', NOW)!;
  assert.ok(sheet);
  assert.equal(sheet.ladder.length, 7);
  assert.equal(sheet.ladder.filter((l) => l.current).length, 1);
});

test('active timer contributes to today/day totals and timer model', () => {
  const base = seed(NOW);
  const data: PersistedState = {
    ...base,
    active: { habitId: 'h1', startedAt: NOW - 600_000, baseSec: 0 },
  };
  const timer = selectTimer(data, DEFAULT_CONFIG, NOW)!;
  assert.equal(timer.habitId, 'h1');
  assert.ok(timer.displaySec >= 599 && timer.displaySec <= 601);

  const map = daySecMap(data, NOW, ['h1']);
  assert.ok(map[dkey(new Date(NOW))] >= 600);
});
