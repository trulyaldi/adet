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
  // The most active habit is now a line in Insights.
  assert.ok(stats.insights.some((i) => /leading this week|most-tracked/.test(i.text)));
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

test('Today rows show time tracked today; recommendation is deterministic', () => {
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
  assert.equal(model.hasHabits, true);
  assert.equal(recommendedHabitId(data, DEFAULT_CONFIG, NOW), 'h2');
  // Rows show time tracked today, never the (hidden) daily target.
  const rows = model.groups[0].rows;
  assert.deepEqual(rows.map((r) => r.sub), ['30m today', '10m today']);
  assert.ok(rows.every((r) => !r.sub.includes('/')));
  assert.deepEqual(rows.map((r) => r.btnLabel), ['Continue', 'Continue']);
  // One project: no separate summary card (the project card says the same).
  assert.equal(model.summary, null);
  assert.equal(model.groups[0].weekLabel, '40m / 8h this week');
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
  assert.equal(row!.note, 'chapter 3');
  assert.ok(!row!.sub.includes('chapter 3'), 'the note has its own line');
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
    model.heatSelSessions.map((s) => [s.id, s.name, s.sub, s.note, s.timeLabel]),
    [
      ['early', 'Writing', '09:05–10:10', '', '1h 05m'],
      ['late', 'Reading', '20:00–20:30', 'chapter 3', '30m'],
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

test('stats insights: one card, each fact once', () => {
  const thisWeek = new Date(2026, 6, 7, 10, 0, 0).getTime(); // Tue in NOW's week
  const lastWeek = new Date(2026, 5, 30, 10, 0, 0).getTime(); // prior week
  const habit = (id: string, name: string) => ({
    id,
    projectId: 'p1',
    name,
    icon: 'book' as const,
    tile: '#E3F2FD',
    dailyTargetMin: 30,
    weeklyTargetMin: 150,
  });
  const sess = (id: string, habitId: string, start: number, sec: number) => ({ id, habitId, start, end: start + sec * 1000, duration: sec });
  const base: PersistedState = {
    schemaVersion: 3,
    projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: lastWeek }],
    habits: [habit('h1', 'Reading'), habit('h2', 'Writing')],
    sessions: [
      sess('s1', 'h1', thisWeek, 2 * 3600),
      sess('s2', 'h2', thisWeek + 3 * 3600_000, 1800),
      sess('s3', 'h1', lastWeek, 3600),
    ],
    active: null,
    historyClearedAt: 0,
  };

  const texts = (d: PersistedState) => selectStats(d, DEFAULT_CONFIG, NOW, { heatSel: null }).insights.map((i) => i.text);

  // Leading this week and overall: one line, not two.
  const t = texts(base);
  assert.ok(t.includes('Reading is leading this week with 2h, and overall with 3h.'));
  assert.ok(!t.some((x) => x.includes('most-tracked')));
  assert.ok(t.some((x) => x.includes('ahead of last week')));
  assert.equal(new Set(t).size, t.length, 'no repeated lines');

  // Different leaders: the lifetime one gets its own line (the old "Most active habit" card).
  const other = { ...base, sessions: [...base.sessions, sess('s4', 'h2', lastWeek - 7 * 86_400_000, 5 * 3600)] };
  const t2 = texts(other);
  assert.ok(t2.includes('Reading is leading this week with 2h.'));
  assert.ok(t2.includes('Writing is your most-tracked habit, with 5.5h in total.'));

  // A single habit: nothing that would just repeat the This week / Lifetime totals.
  const solo = { ...base, habits: [base.habits[0]], sessions: base.sessions.filter((s) => s.habitId === 'h1') };
  assert.ok(!texts(solo).some((x) => x.includes('leading') || x.includes('most-tracked')));

  // The time-of-day line (formerly on the Patterns card) joins once there are enough sessions.
  assert.ok(!t.some((x) => x.startsWith('You track most')));
  const many = {
    ...base,
    sessions: [0, 1, 2, 3, 4].map((i) => sess('m' + i, 'h1', new Date(2026, 6, 6 + (i % 4), 9, 0).getTime(), 3600)),
  };
  assert.equal(texts(many).filter((x) => x.startsWith('You track most')).length, 1);
});

test('stats lifetime line does not repeat the average-per-day tile', () => {
  const m = selectStats(seed(NOW), DEFAULT_CONFIG, NOW, { heatSel: null });
  assert.match(m.lifetimeSub, /^Since [A-Z][a-z]{2} \d+$/);
  assert.ok(!m.lifetimeSub.includes(m.avgDaily));
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
  assert.equal(selectProjects(data, DEFAULT_CONFIG, now).cards[0].streakLabel, '4d streak');
  assert.equal(selectStats(data, DEFAULT_CONFIG, now, { heatSel: null }).recStreak, '4d');
});

test('Today project line: compact streak only, at-risk nudge, hidden with a single project', () => {
  const at = (d: number) => new Date(2026, 8, d, 10, 0).getTime();
  const s = (id: string, d: number, sec = 1800, habitId = 'h1') => ({ id, habitId, start: at(d), end: at(d) + sec * 1000, duration: sec });
  const base = (sessions: ReturnType<typeof s>[], weeklyTarget = 8): PersistedState => ({
    schemaVersion: 3,
    projects: [
      { id: 'p1', name: 'Practice', weeklyTarget, started: at(1) },
      { id: 'p2', name: 'Other', weeklyTarget: 2, started: at(1) },
    ],
    habits: [
      { id: 'h1', projectId: 'p1', name: 'Reading', icon: 'book', tile: '#fff', dailyTargetMin: 30, weeklyTargetMin: 150 },
      { id: 'h2', projectId: 'p2', name: 'Other', icon: 'book', tile: '#fff', dailyTargetMin: 30, weeklyTargetMin: 150 },
    ],
    sessions,
    active: null,
    historyClearedAt: 0,
  });
  const wed = new Date(2026, 8, 16, 12, 0).getTime(); // Wed Sep 16

  // Weeks of Sep 7 and Sep 14 both reach 1h against a 1h target; Sep 14–16 tracked.
  const met = base([s('a', 8, 3600), s('b', 14, 1800), s('c', 15, 1800), s('d', 16, 600)], 1);
  const g = selectToday(met, DEFAULT_CONFIG, wed).groups[0];
  // No target-week streak and no "vs last week" delta on Today.
  assert.equal(g.streakLabel, '3d streak');
  assert.equal(g.streakAtRisk, false);
  const card = selectProjects(met, DEFAULT_CONFIG, wed).cards[0];
  assert.equal(card.weekStreakLabel, '2w');
  assert.equal(card.streakAtRisk, false);

  // No streak: nothing shown.
  assert.equal(selectToday(base([]), DEFAULT_CONFIG, wed).groups[0].streakLabel, '');

  // Sep 13–14 tracked, Sep 15 (yesterday) missed, today untracked: at risk.
  const risky = selectToday(base([s('a', 13), s('b', 14)]), DEFAULT_CONFIG, wed).groups[0];
  assert.equal(risky.streakLabel, '2d streak · track today');
  assert.equal(risky.streakAtRisk, true);
  assert.equal(selectProjects(base([s('a', 13), s('b', 14)]), DEFAULT_CONFIG, wed).cards[0].streakAtRisk, true);

  // A single project's streak is the header chip's, so it isn't repeated.
  const one = base([s('a', 15), s('b', 16)]);
  one.projects = one.projects.slice(0, 1);
  one.habits = one.habits.slice(0, 1);
  const solo = selectToday(one, DEFAULT_CONFIG, wed);
  assert.equal(solo.streakLabel, '2 days');
  assert.equal(solo.groups[0].streakLabel, '');
});

test('Today rows: running and paused timers replace the today label; Up next never on the running habit', () => {
  const data = seed(NOW);
  const running: PersistedState = { ...data, active: { habitId: 'h1', startedAt: NOW - 125_000, baseSec: 0 } };
  const rows = selectToday(running, DEFAULT_CONFIG, NOW).groups[0].rows;
  const r = rows.find((x) => x.habitId === 'h1')!;
  assert.equal(r.running, true);
  assert.equal(r.sub, 'Running');
  assert.equal(r.elapsedSec, 125);
  assert.equal(r.recommended, false);
  const others = rows.filter((x) => x.habitId !== 'h1');
  assert.ok(others.every((x) => !x.running && x.elapsedSec === 0));

  const paused: PersistedState = { ...data, active: { habitId: 'h1', startedAt: null, baseSec: 90 } };
  const p = selectToday(paused, DEFAULT_CONFIG, NOW).groups[0].rows.find((x) => x.habitId === 'h1')!;
  assert.equal(p.paused, true);
  assert.equal(p.sub, 'Paused');
  assert.equal(p.elapsedSec, 90);
});

test('Today header chip shows freezes left, or a nudge when the streak is at risk', () => {
  const at = (d: number) => new Date(2026, 8, d, 10, 0).getTime();
  const s = (id: string, d: number) => ({ id, habitId: 'h1', start: at(d), end: at(d) + 1800_000, duration: 1800 });
  const data = (sessions: ReturnType<typeof s>[]): PersistedState => ({
    schemaVersion: 3,
    projects: [{ id: 'p1', name: 'Practice', weeklyTarget: 8, started: at(1) }],
    habits: [
      { id: 'h1', projectId: 'p1', name: 'Reading', icon: 'book', tile: '#fff', dailyTargetMin: 30, weeklyTargetMin: 150 },
    ],
    sessions,
    active: null,
    historyClearedAt: 0,
  });
  const now = new Date(2026, 8, 16, 12, 0).getTime(); // Sep 16

  // Sep 12 frozen: one of September's two freezes used.
  const alive = selectToday(data([s('a', 11), s('b', 13), s('c', 14), s('d', 15)]), DEFAULT_CONFIG, now);
  assert.equal(alive.streakLabel, '4 days');
  assert.equal(alive.streakNote, '❄ 1');
  assert.equal(alive.streakAtRisk, false);

  const risky = selectToday(data([s('a', 13), s('b', 14)]), DEFAULT_CONFIG, now);
  assert.equal(risky.streakLabel, '2 days');
  assert.equal(risky.streakNote, 'track today');
  assert.equal(risky.streakAtRisk, true);

  assert.equal(selectToday(data([]), DEFAULT_CONFIG, now).streakNote, '', 'no streak: no freeze count');
});

test('Today week summary: two or more projects with targets, pace summed per project', () => {
  const wed = new Date(2026, 8, 16, 12, 0).getTime(); // Wed Sep 16: 5 days left
  const at = (d: number, h: number) => new Date(2026, 8, d, h, 0).getTime();
  const habit = (id: string, projectId: string) => ({
    id,
    projectId,
    name: id,
    icon: 'book' as const,
    tile: '#fff',
    dailyTargetMin: 30,
    weeklyTargetMin: 150,
  });
  const sess = (id: string, habitId: string, start: number, sec: number) => ({ id, habitId, start, end: start + sec * 1000, duration: sec });
  const data: PersistedState = {
    schemaVersion: 3,
    projects: [
      { id: 'p1', name: 'A', weeklyTarget: 8, started: at(1, 9) },
      { id: 'p2', name: 'B', weeklyTarget: 3, started: at(1, 9) },
      { id: 'p3', name: 'No habits', weeklyTarget: 10, started: at(1, 9) },
    ],
    habits: [habit('h1', 'p1'), habit('h2', 'p2')],
    sessions: [
      sess('a', 'h1', at(14, 9), 3 * 3600), // Mon: 3h
      sess('b', 'h2', at(16, 9), 1800), // today: 30m
    ],
    active: null,
    historyClearedAt: 0,
  };
  const m = selectToday(data, DEFAULT_CONFIG, wed);
  // p3 has no habits, so Today doesn't show it and it isn't summed.
  assert.equal(m.groups.length, 2);
  assert.ok(m.summary);
  assert.equal(m.summary!.weekLabel, '3.5h / 11h this week');
  assert.equal(m.summary!.pct, 32);
  // p1: (8h-3h)/5 = 1h; p2: 3h/5 = 36m, less 30m done today = 6m.
  assert.equal(m.summary!.todaySec, 3600 + 360);
  assert.equal(m.summary!.todayLabel, '1.1h more today to stay on pace');
  // No level badge on Today.
  assert.ok(!('stageLabel' in m.groups[0]));
});

test('Projects card: each number once; habit share only with two or more habits', () => {
  const at = (d: number, h = 10) => new Date(2026, 8, d, h, 0).getTime();
  const habit = (id: string, projectId: string) => ({
    id,
    projectId,
    name: id,
    icon: 'book' as const,
    tile: '#fff',
    dailyTargetMin: 30,
    weeklyTargetMin: 150,
  });
  const sess = (id: string, habitId: string, start: number, sec: number) => ({ id, habitId, start, end: start + sec * 1000, duration: sec });
  const data: PersistedState = {
    schemaVersion: 3,
    projects: [
      { id: 'p1', name: 'Two habits', weeklyTarget: 8, started: at(1) },
      { id: 'p2', name: 'One habit', weeklyTarget: 2, started: at(1) },
    ],
    habits: [habit('h1', 'p1'), habit('h2', 'p1'), habit('h3', 'p2')],
    sessions: [
      sess('a', 'h1', at(14), 3 * 3600),
      sess('b', 'h2', at(15), 3600),
      sess('c', 'h3', at(15), 1800),
    ],
    active: null,
    historyClearedAt: 0,
  };
  const wed = new Date(2026, 8, 16, 12, 0).getTime();
  const [two, one] = selectProjects(data, DEFAULT_CONFIG, wed).cards;

  assert.equal(two.weekLabel, '4h / 8h this week');
  assert.equal(two.lifetimeLabel, '4h');
  assert.equal(two.sessionsLabel, '2');
  assert.equal(two.startedLabel, 'Started Sep 2026');
  // The level panel names stages only; lifetime hours appear once, in the tile.
  assert.equal(two.nextStageLabel, '→ Learner at 10h');
  assert.ok(!('stageHoursLabel' in two) && !('weekShort' in two) && !('sub' in two));
  assert.deepEqual(
    two.habits.map((h) => [h.shareLabel, h.sub]),
    [
      ['75% of project time', '3h lifetime · 3h this week · 1 session'],
      ['25% of project time', '1h lifetime · 1h this week · 1 session'],
    ]
  );

  // A single habit's numbers are the project's: no share, no stats.
  assert.deepEqual(one.habits.map((h) => [h.shareLabel, h.sub]), [['', '']]);
});
