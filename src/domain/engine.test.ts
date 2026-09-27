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

test('manual sessions show a "logged manually" marker and their note in history', () => {
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
  assert.ok(row!.sub.includes('logged manually'));
  assert.ok(row!.sub.includes('chapter 3'));
});

test('selected heatmap day lists each session in time order with its range and note', () => {
  const at = (h: number, m: number) => new Date(2026, 6, 8, h, m).getTime(); // Wed Jul 8
  const habit = (id: string, name: string) => ({
    id,
    projectId: 'p1',
    name,
    icon: 'book' as const,
    tile: '#E3F2FD',
    dailyTargetMin: 30,
    weeklyTargetMin: 150,
  });
  const data: PersistedState = {
    schemaVersion: 3,
    projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: at(0, 0) }],
    habits: [habit('h1', 'Reading'), habit('h2', 'Writing')],
    sessions: [
      { id: 'late', habitId: 'h1', start: at(20, 0), end: at(20, 30), duration: 1800, notes: 'chapter 3' },
      { id: 'early', habitId: 'h2', start: at(9, 5), end: at(10, 10), duration: 3900 },
      { id: 'otherDay', habitId: 'h1', start: at(9, 0) + 86400000, end: at(10, 0) + 86400000, duration: 3600 },
      { id: 'orphan', habitId: 'gone', start: at(12, 0), end: at(13, 0), duration: 3600 },
    ],
    active: null,
    historyClearedAt: 0,
  };

  const model = selectStats(data, DEFAULT_CONFIG, NOW, { heatSel: '2026-07-08' });
  assert.deepEqual(
    model.heatSelSessions.map((s) => [s.id, s.name, s.sub, s.timeLabel]),
    [
      ['early', 'Writing', '09:05–10:10', '1h 05m'],
      ['late', 'Reading', '20:00–20:30 · chapter 3', '30m'],
    ]
  );
  assert.deepEqual(selectStats(data, DEFAULT_CONFIG, NOW, { heatSel: null }).heatSelSessions, []);
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

test('project pace uses local Monday-start weeks across the New York DST switch', () => {
  const prev = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const at = (m: number, d: number, h: number, min: number) => new Date(2026, m, d, h, min).getTime();
    const data: PersistedState = {
      schemaVersion: 3,
      projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: at(2, 1, 0, 0) }],
      habits: [
        { id: 'h1', projectId: 'p1', name: 'Reading', icon: 'book', tile: '#fff', dailyTargetMin: 30, weeklyTargetMin: 150 },
      ],
      sessions: [
        // Sun Mar 8, the spring-forward day: last week.
        { id: 'a', habitId: 'h1', start: at(2, 8, 23, 30), end: at(2, 9, 0, 0), duration: 1800 },
        // Mon Mar 9 just after midnight: this week.
        { id: 'b', habitId: 'h1', start: at(2, 9, 0, 15), end: at(2, 9, 2, 15), duration: 7200 },
      ],
      active: null,
      historyClearedAt: 0,
    };
    const wed = at(2, 11, 12, 0);
    const group = selectToday(data, DEFAULT_CONFIG, wed).groups[0];
    assert.equal(group.paceLabel, '6h left · ~1.2h/day for 5 days');
    assert.equal(group.paceMet, false);
    assert.equal(selectProjects(data, DEFAULT_CONFIG, wed).cards[0].paceLabel, '6h left · ~1.2h/day for 5 days');
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
});

test('streaks on Today, Projects and Stats use freezes and the given now', () => {
  const day = (d: number) => new Date(2026, 8, d, 10, 0).getTime();
  const s = (id: string, d: number) => ({ id, habitId: 'h1', start: day(d), end: day(d) + 1800_000, duration: 1800 });
  const data: PersistedState = {
    schemaVersion: 3,
    projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: day(1) }],
    habits: [
      { id: 'h1', projectId: 'p1', name: 'Reading', icon: 'book', tile: '#fff', dailyTargetMin: 30, weeklyTargetMin: 150 },
    ],
    // Sep 10 ✓, 11 ✓, 12 ✗ (frozen), 13 ✓, 14 ✓; today is Sep 15, untracked.
    sessions: [s('a', 10), s('b', 11), s('c', 13), s('d', 14)],
    active: null,
    historyClearedAt: 0,
  };
  const now = new Date(2026, 8, 15, 9, 0).getTime();
  assert.equal(selectToday(data, DEFAULT_CONFIG, now).streakLabel, '4 days');
  assert.equal(selectProjects(data, DEFAULT_CONFIG, now).cards[0].streakLabel, '4d');
  assert.equal(selectStats(data, DEFAULT_CONFIG, now, { heatSel: null }).recStreak, '4d');
});

test('Today project line: compact streaks, weekly part hidden at 0, at-risk nudge', () => {
  const at = (d: number) => new Date(2026, 8, d, 10, 0).getTime();
  const s = (id: string, d: number, sec = 1800) => ({ id, habitId: 'h1', start: at(d), end: at(d) + sec * 1000, duration: sec });
  const base = (sessions: ReturnType<typeof s>[], weeklyTarget = 8): PersistedState => ({
    schemaVersion: 3,
    projects: [{ id: 'p1', name: 'Practice', weeklyTarget, started: at(1) }],
    habits: [
      { id: 'h1', projectId: 'p1', name: 'Reading', icon: 'book', tile: '#fff', dailyTargetMin: 30, weeklyTargetMin: 150 },
    ],
    sessions,
    active: null,
    historyClearedAt: 0,
  });
  const wed = new Date(2026, 8, 16, 12, 0).getTime(); // Wed Sep 16

  // Weeks of Sep 7 and Sep 14 both reach 1h against a 1h target; Sep 14–16 tracked.
  const met = base([s('a', 8, 3600), s('b', 14, 1800), s('c', 15, 1800), s('d', 16, 600)], 1);
  const g = selectToday(met, DEFAULT_CONFIG, wed).groups[0];
  assert.match(g.consistencyLabel, /^3d streak · 2w target · [↑↓] /);
  assert.equal(g.streakAtRisk, false);
  const card = selectProjects(met, DEFAULT_CONFIG, wed).cards[0];
  assert.equal(card.weekStreakLabel, '2w');
  assert.equal(card.streakAtRisk, false);

  // No week met: the weekly part is hidden.
  const none = selectToday(base([s('a', 15), s('b', 16)]), DEFAULT_CONFIG, wed).groups[0];
  assert.match(none.consistencyLabel, /^2d streak · [↑↓] /);

  // Sep 13–14 tracked, Sep 15 (yesterday) missed, today untracked: at risk.
  const risky = selectToday(base([s('a', 13), s('b', 14)]), DEFAULT_CONFIG, wed).groups[0];
  assert.equal(risky.consistencyLabel, '2d streak · track today to keep it');
  assert.equal(risky.streakAtRisk, true);
  assert.equal(selectProjects(base([s('a', 13), s('b', 14)]), DEFAULT_CONFIG, wed).cards[0].streakAtRisk, true);
});
