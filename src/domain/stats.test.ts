import assert from 'node:assert/strict';
import test from 'node:test';

import { projectWeekSec } from './projects';
import { chartOf, focusHoursOf, thisWeekOf } from './selectors';
import { chart, focusHours, nextStreakMilestone, peakWindow, projectProgress, records, thisWeek, trendOf } from './stats';
import { habit, sess, state } from './testkit';
import { setWeekStartDay } from './time';
import { PersistedState, Session } from './types';

// Local times: Monday 21 Sep 2026 is the start of the current test week.
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const NOW = at(2026, 9, 23, 15); // Wednesday 15:00

/**
 * Four projects over four weeks with gaps: p1 steady (target 5h), p2 over its
 * target (2h), p3 rare (no target), p4 archived with old history.
 */
function fixture(extra: Session[] = []): PersistedState {
  const habits = [
    habit('h1', 60, 10, undefined, { projectId: 'p1' }),
    habit('h2', 60, 10, undefined, { projectId: 'p2' }),
    habit('h3', 60, 10, undefined, { projectId: 'p3' }),
    habit('h4', 60, 10, undefined, { projectId: 'p4' }),
  ];
  const sessions: Session[] = [];
  let n = 0;
  const add = (h: string, t: number, min: number) => sessions.push(sess(`s${n++}`, h, t, min));
  // Three past weeks: p1 on Mon/Wed/Fri at 9:00 for 60m, skipping every Tuesday/Thursday (empty days).
  for (const monday of [at(2026, 8, 31), at(2026, 9, 7), at(2026, 9, 14)]) {
    for (const d of [0, 2, 4]) add('h1', monday + d * 86_400_000 + 9 * 3_600_000, 60);
    add('h2', monday + 1 * 86_400_000 + 20 * 3_600_000, 45);
  }
  add('h4', at(2026, 8, 20, 10), 90);
  // Last week, after this Wednesday's 15:00: must not count in "the same moment last week".
  add('h1', at(2026, 9, 16, 18), 30);
  // This week: p1 Mon 60m + Wed 9:00 60m, p2 Tue 150m (over its 2h target), p3 Wed 13:00 20m.
  add('h1', at(2026, 9, 21, 9), 60);
  add('h1', at(2026, 9, 23, 9), 60);
  add('h2', at(2026, 9, 22, 20), 150);
  add('h3', at(2026, 9, 23, 13), 20);
  return state(habits, [...sessions, ...extra], {
    projects: [
      { id: 'p1', name: 'Code', weeklyTarget: 5, color: 'indigo' },
      { id: 'p2', name: 'Read', weeklyTarget: 2, color: 'green' },
      { id: 'p3', name: 'Draw', weeklyTarget: 0, color: 'pink' },
      { id: 'p4', name: 'Old', weeklyTarget: 3, color: 'orange', archivedAt: at(2026, 9, 1) },
    ],
  });
}

test('this week: totals match Today per project, and compare with the same moment last week', () => {
  const data = fixture();
  const w = thisWeek(data, NOW);
  for (const p of data.projects) {
    const slice = w.slices.find((s) => s.projectId === p.id)?.sec ?? 0;
    assert.equal(slice, projectWeekSec(data, p.id, NOW, false), p.id);
  }
  assert.equal(w.totalSec, (60 + 60 + 150 + 20) * 60);
  // Last week Mon–Wed by 15:00: p1 Mon 60 + Wed 60, p2 Tue 45 (the Wed 18:00 session is later).
  assert.equal(w.lastWeekSec, (60 + 60 + 45) * 60);
  assert.equal(w.trend, 'up');
  assert.equal(w.targetSec, 7 * 3600, 'active projects only (the archived one is left out)');
  assert.deepEqual(
    w.dots.map((d) => [d.letter, d.logged, d.today, d.future]),
    [
      ['M', true, false, false],
      ['T', true, false, false],
      ['W', true, true, false],
      ['T', false, false, true],
      ['F', false, false, true],
      ['S', false, false, true],
      ['S', false, false, true],
    ]
  );
  // 4h50m of a 7h target by Wednesday (2 of 7 days behind us) is ahead of pace.
  assert.equal(w.mood, 'cheering');
});

test('this week: the comparison moves with the time of day, and mood follows targets', () => {
  const data = fixture();
  // Wednesday 19:00: last week's Wed 18:00 session now counts.
  const evening = thisWeek(data, at(2026, 9, 23, 19));
  assert.equal(evening.lastWeekSec, (60 + 60 + 45 + 30) * 60);
  // Monday 08:00, before anything this week: nothing yet, and idle.
  const early = thisWeek(data, at(2026, 9, 21, 8));
  assert.equal(early.totalSec, 0);
  assert.equal(early.mood, 'idle');
  assert.equal(early.lastWeekSec, 0);
  assert.equal(early.trend, 'even');
  // Every target met: relaxed.
  const met = fixture([sess('x', 'h1', at(2026, 9, 23, 10), 180)]);
  assert.equal(thisWeek(met, NOW).mood, 'relaxed');
  // Behind pace late in the week: idle, never a negative mood.
  assert.equal(thisWeek(data, at(2026, 9, 27, 12)).mood, 'idle');
});

test('the memoized hero recomputes when the quarter hour turns, not on every tick', () => {
  const data = fixture();
  const a = thisWeekOf(data, NOW);
  assert.equal(thisWeekOf({ ...data }, NOW + 60_000), a, 'same slices, same quarter hour: the cached result');
  assert.notEqual(thisWeekOf(data, NOW + 20 * 60_000), a);
});

test('week chart: days, per-project parts, capacity line, today selected', () => {
  const c = chart(fixture(), NOW, 'week');
  assert.equal(c.range, '21–27 Sep');
  assert.deepEqual(c.bars.map((b) => b.label), ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  assert.deepEqual(c.bars.map((b) => b.totalSec / 60), [60, 150, 80, 0, 0, 0, 0]);
  assert.deepEqual(c.bars[2].parts, [
    { projectId: 'p1', sec: 3600 },
    { projectId: 'p3', sec: 1200 },
  ]);
  assert.equal(c.defaultIndex, 2);
  assert.equal(c.line, 'capacity');
  // Default capacity: 180 minutes on weekdays, 120 at the weekend.
  assert.deepEqual(c.bars.map((b) => b.lineSec / 60), [180, 180, 180, 180, 180, 120, 120]);
  assert.equal(c.maxSec, 180 * 60);
  assert.equal(c.bars[3].future, true);
  assert.equal(c.hasEarlier, true);
});

test('a finished day uses the capacity it was logged with', () => {
  const data = fixture();
  data.dailyLogs = [{ id: '2026-09-22', capacityMin: 90, plannedMin: 90, actualMin: 150, items: [], doneCount: 1 }];
  assert.equal(chart(data, NOW, 'week').bars[1].lineSec, 90 * 60);
});

test('month chart: one bar per week, clipped to the month, summing to the month total', () => {
  const data = fixture();
  const c = chart(data, NOW, 'month');
  assert.equal(c.range, 'September 2026');
  // Sep 2026 starts on a Tuesday: 1–6, 7–13, 14–20, 21–27, 28–30.
  assert.deepEqual(c.bars.map((b) => b.label), ['1', '7', '14', '21', '28']);
  assert.equal(c.bars[0].title, '1–6 Sep');
  assert.equal(c.defaultIndex, 3);
  const days = chart(data, NOW, 'week', 1).bars; // 14–20 Sep, fully inside the month
  assert.equal(c.bars[2].totalSec, days.reduce((a, b) => a + b.totalSec, 0));
  // The first bar excludes Monday 31 Aug.
  const firstWeek = chart(data, NOW, 'week', 3).bars; // 31 Aug – 6 Sep
  assert.equal(c.bars[0].totalSec, firstWeek.slice(1).reduce((a, b) => a + b.totalSec, 0));
  // Capacity over a clipped week counts only its days (Tue–Fri 180, Sat–Sun 120).
  assert.equal(c.bars[0].lineSec, (4 * 180 + 2 * 120) * 60);
});

test('year chart: twelve months, archived history included', () => {
  const c = chart(fixture(), NOW, 'year');
  assert.equal(c.range, '2026');
  assert.equal(c.bars.length, 12);
  assert.equal(c.bars[7].label, 'A');
  const aug = c.bars[7].totalSec / 60;
  assert.equal(aug, 90 + 60, 'the archived project in August, plus Mon 31 Aug');
  assert.equal(c.defaultIndex, 8);
  assert.equal(c.hasEarlier, false);
});

test('no capacity set: the line falls back to the average bar with time', () => {
  const data = fixture();
  data.prefs = { ...data.prefs, capacityMin: [0, 0, 0, 0, 0, 0, 0] };
  const c = chart(data, NOW, 'week');
  assert.equal(c.line, 'average');
  assert.equal(c.bars[0].lineSec, ((60 + 150 + 80) * 60) / 3);
});

test('weeks can start on Sunday', () => {
  setWeekStartDay(0);
  try {
    const c = chart(fixture(), NOW, 'week');
    assert.equal(c.range, '20–26 Sep');
    assert.deepEqual(c.bars.map((b) => b.label), ['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    // Capacity follows the weekday, not the position: Sunday 120.
    assert.equal(c.bars[0].lineSec, 120 * 60);
    assert.equal(thisWeek(fixture(), NOW).dots[0].letter, 'S');
  } finally {
    setWeekStartDay(1);
  }
});

test('memoized chart: switching period recomputes, the same period does not', () => {
  const data = fixture();
  const w = chartOf(data, NOW, 'week', 0);
  assert.equal(chartOf(data, NOW + 15_000, 'week', 0), w);
  assert.equal(chartOf(data, NOW, 'month', 0).period, 'month');
});

test('project progress: in progress by percentage, no target next, reached last', () => {
  const rows = projectProgress(fixture(), NOW);
  assert.deepEqual(rows.map((r) => r.projectId), ['p1', 'p3', 'p2'], 'archived projects are left out');
  const [code, draw, read] = rows;
  assert.equal(code.weekSec, 120 * 60);
  assert.equal(code.targetSec, 5 * 3600);
  assert.equal(code.frac, 0.4);
  assert.equal(code.trend, 'even', 'same 2h as by this point last week');
  assert.deepEqual(code.last4.map((s) => s / 60), [180, 180, 210, 120]);
  assert.equal(code.allTimeSec, (9 * 60 + 30 + 120) * 60);
  assert.equal(draw.targetSec, null);
  assert.equal(read.reached, true);
  assert.equal(read.trend, 'up');
});

test('best focus time: hours over four weeks, split across hour boundaries', () => {
  const data = fixture([sess('late', 'h3', at(2026, 9, 22, 22, 30), 60)]);
  const f = focusHours(data, NOW);
  // 22:30–23:30 is half in each hour; Tuesday's 20:00–22:30 session adds the first half of 22.
  assert.equal(f.hours[22], 60 * 60);
  assert.equal(f.hours[23], 30 * 60);
  // Evening p2 sessions at 20:00 (45m ×3 weeks inside the window, plus 150m this week spilling to 22:30).
  assert.ok(f.hours[20] > 0 && f.hours[21] > 0);
  assert.equal(f.grid.length, 7);
  assert.equal(f.grid[1][23], 30 * 60, 'Tuesday row');
  assert.equal(f.sessions, data.sessions.filter((s) => s.start >= at(2026, 8, 27) && s.start <= NOW).length);
  assert.equal(focusHoursOf(data, NOW + 60_000), focusHoursOf(data, NOW));
});

test('peak window: the busiest two hours, grown while neighbors keep up, wrapping midnight', () => {
  const h = (m: Record<number, number>) => Array.from({ length: 24 }, (_, i) => m[i] ?? 0);
  assert.equal(peakWindow(h({})), null);
  assert.deepEqual(peakWindow(h({ 9: 60, 10: 60 })), { start: 9, end: 11, sec: 120 });
  assert.deepEqual(peakWindow(h({ 12: 50, 13: 60, 14: 60, 15: 40, 16: 5 })), { start: 12, end: 16, sec: 210 });
  // Ties go to the earlier hour.
  assert.deepEqual(peakWindow(h({ 8: 10, 9: 10, 17: 10, 18: 10 })), { start: 8, end: 10, sec: 20 });
  assert.deepEqual(peakWindow(h({ 22: 30, 23: 60, 0: 60, 1: 30 })), { start: 22, end: 2, sec: 180 });
});

test('records and the next streak milestone', () => {
  const r = records(fixture(), NOW);
  assert.equal(r.bestDaySec, 150 * 60);
  assert.equal(r.longestSessionSec, 150 * 60);
  // Every session started in September so far: 16 of them, 935 minutes.
  assert.equal(r.avgSessionSec, (935 * 60) / 16);
  assert.equal(r.totalSec, (9 * 60 + 3 * 45 + 90 + 30 + 60 + 60 + 150 + 20) * 60);
  assert.equal(r.daysWithTime, 16);
  assert.deepEqual(nextStreakMilestone([{ id: 'streak-3', earnedAt: 1 }], 5), { value: 7, frac: 5 / 7 });
  assert.equal(nextStreakMilestone([3, 7, 14, 30, 50, 100].map((n) => ({ id: `streak-${n}`, earnedAt: 1 })), 120), null);
});

test('trend: even within 10 minutes or 5%', () => {
  assert.equal(trendOf(3600, 3100), 'even');
  assert.equal(trendOf(3600, 2000), 'up');
  assert.equal(trendOf(2000, 3600), 'down');
  assert.equal(trendOf(100_000, 96_000), 'even');
});
