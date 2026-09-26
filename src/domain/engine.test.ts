import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_CONFIG } from './config';
import {
  activeSec,
  daySecMap,
  recommendedHabitId,
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

  const stats = selectStats(data, DEFAULT_CONFIG, NOW, { heatSel: null });
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

test('selectToday focus summary and recommendation use deterministic daily progress', () => {
  const today = dkey(new Date(NOW));
  assert.equal(today, '2026-07-10');
  const data: PersistedState = {
    schemaVersion: 3,
    projects: [
      { id: 'p1', name: 'Practice', weeklyTarget: 8, started: NOW - 86_400_000 },
    ],
    habits: [
      {
        id: 'h1',
        projectId: 'p1',
        name: 'Writing',
        icon: 'code',
        tile: '#EDE7F6',
        dailyTargetMin: 60,
        weeklyTargetMin: 300,
      },
      {
        id: 'h2',
        projectId: 'p1',
        name: 'Reading',
        icon: 'book',
        tile: '#E3F2FD',
        dailyTargetMin: 30,
        weeklyTargetMin: 150,
      },
    ],
    sessions: [
      {
        id: 's1',
        habitId: 'h1',
        start: new Date(2026, 6, 10, 8, 0, 0).getTime(),
        end: new Date(2026, 6, 10, 8, 30, 0).getTime(),
        duration: 30 * 60,
      },
      {
        id: 's2',
        habitId: 'h2',
        start: new Date(2026, 6, 10, 9, 0, 0).getTime(),
        end: new Date(2026, 6, 10, 9, 10, 0).getTime(),
        duration: 10 * 60,
      },
    ],
    active: null,
    historyClearedAt: 0,
  };

  const model = selectToday(data, DEFAULT_CONFIG, NOW);
  assert.equal(model.focusPctLabel, '44%');
  assert.equal(model.focusDotsLabel, '0 of 2 habits done');
  assert.equal(model.hasHabits, true);
  assert.equal(recommendedHabitId(data, DEFAULT_CONFIG, NOW), 'h2');
});

test('manual sessions surface an edit payload and a "logged manually" marker in history', () => {
  const start = new Date(2026, 6, 8, 12, 0, 0).getTime(); // Wed Jul 8
  const data: PersistedState = {
    schemaVersion: 3,
    projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: start }],
    habits: [
      {
        id: 'h1',
        projectId: 'p1',
        name: 'Reading',
        icon: 'book',
        tile: '#E3F2FD',
        dailyTargetMin: 30,
        weeklyTargetMin: 150,
      },
    ],
    sessions: [
      { id: 'm1', habitId: 'h1', start, end: start + 45 * 60000, duration: 45 * 60, manual: true, notes: 'chapter 3' },
    ],
    active: null,
    historyClearedAt: 0,
  };

  const model = selectStats(data, DEFAULT_CONFIG, NOW, { heatSel: null });
  const row = model.historyRows.find((r) => r.id === 'm1');
  assert.ok(row);
  assert.equal(row!.editMinutes, 45);
  assert.equal(row!.editNote, 'chapter 3');
  assert.ok(row!.sub.includes('logged manually'));
  assert.ok(row!.editMeta.startsWith('Reading · '));
});

test('activity heatmap: inline card caps at base weeks, full history extends back to first day', () => {
  const mk = (daysAgo: number, id: string) => {
    const start = NOW - daysAgo * 86400000;
    return { id, habitId: 'h1', start, end: start + 3600_000, duration: 3600 };
  };
  const data: PersistedState = {
    schemaVersion: 3,
    projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: NOW - 200 * 86400000 }],
    habits: [
      { id: 'h1', projectId: 'p1', name: 'Reading', icon: 'book', tile: '#E3F2FD', dailyTargetMin: 30, weeklyTargetMin: 150 },
    ],
    sessions: [mk(1, 's1'), mk(200, 's2')], // ~28+ weeks of span
    active: null,
    historyClearedAt: 0,
  };

  const model = selectStats(data, DEFAULT_CONFIG, NOW, { heatSel: null });
  // inline card is capped at the config base (default 10 weeks)
  assert.equal(model.heatRows.length, 10);
  // every row is a full 7-day week
  assert.ok(model.heatRows.every((r) => r.cells.length === 7));
  // history spans far enough that the "see full history" affordance shows
  assert.equal(model.heatCanToggle, true);
  // full sheet shows at least ~6 months and reaches back to the first active day
  assert.ok(model.heatFullRows.length >= 26);
  assert.ok(model.heatFullRows.length >= model.heatRows.length);
  assert.match(model.heatOpenLabel, /^See full history · \d+ weeks?$/);
});

test('stats insights surface a weekly leader and an ahead/behind-pace note', () => {
  const thisWeek = new Date(2026, 6, 7, 10, 0, 0).getTime(); // Tue in NOW's week
  const lastWeek = new Date(2026, 5, 30, 10, 0, 0).getTime(); // prior week
  const data: PersistedState = {
    schemaVersion: 3,
    projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: lastWeek }],
    habits: [
      { id: 'h1', projectId: 'p1', name: 'Reading', icon: 'book', tile: '#E3F2FD', dailyTargetMin: 30, weeklyTargetMin: 150 },
    ],
    sessions: [
      { id: 's1', habitId: 'h1', start: thisWeek, end: thisWeek + 2 * 3600_000, duration: 2 * 3600 },
      { id: 's2', habitId: 'h1', start: lastWeek, end: lastWeek + 3600_000, duration: 3600 },
    ],
    active: null,
    historyClearedAt: 0,
  };

  const model = selectStats(data, DEFAULT_CONFIG, NOW, { heatSel: null });
  assert.equal(model.hasInsights, true);
  assert.ok(model.insights.some((i) => i.text.includes('Reading is leading this week')));
  assert.ok(model.insights.some((i) => i.text.includes('ahead of last week')));
});
