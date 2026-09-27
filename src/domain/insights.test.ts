import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addToGrid,
  hourColumns,
  INSIGHT_WEEKS,
  MIN_HEAT_SESSIONS,
  timeInsight,
  timeOfDay,
  weeklyTrends,
} from './insights';
import { Habit, PersistedState, Session } from './types';

const H = 3600;
const MS = 1000;

function inTZ(tz: string, fn: () => void) {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}

const emptyGrid = () => Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
const at = (m: number, d: number, h: number, min = 0) => new Date(2026, m, d, h, min).getTime();
let n = 0;
const sess = (habitId: string, start: number, sec: number, span = sec): Session => ({
  id: 's' + n++,
  habitId,
  start,
  end: start + span * MS,
  duration: sec,
});
const habit = (id: string, projectId: string): Habit => ({
  id,
  projectId,
  name: id,
  icon: 'code',
  tile: '#fff',
  dailyTargetMin: 30,
  weeklyTargetMin: 150,
});
const data = (sessions: Session[]): PersistedState => ({
  schemaVersion: 3,
  projects: [
    { id: 'p1', name: 'Coding', weeklyTarget: 2 },
    { id: 'p2', name: 'Reading', weeklyTarget: 1 },
  ],
  habits: [habit('h1', 'p1'), habit('h2', 'p2')],
  sessions,
  active: null,
  historyClearedAt: 0,
});

// ---- splitting ---------------------------------------------------------------

test('a session spanning hours is split at hour boundaries', () => {
  const g = emptyGrid();
  addToGrid(g, sess('h1', at(8, 23, 9, 30), 1.5 * H)); // Wed 9:30–11:00
  assert.equal(g[2][9], 30 * 60);
  assert.equal(g[2][10], 60 * 60);
  assert.equal(g[2][11], 0);
});

test('a session crossing midnight lands on both weekdays', () => {
  const g = emptyGrid();
  addToGrid(g, sess('h1', at(8, 27, 23, 15), 1.5 * H)); // Sun 23:15 – Mon 00:45
  assert.equal(g[6][23], 45 * 60);
  assert.equal(g[0][0], 45 * 60);
});

test('slices are scaled to the recorded duration', () => {
  const g = emptyGrid();
  addToGrid(g, sess('h1', at(8, 23, 9, 0), 1 * H, 2 * H)); // 1h tracked over a 2h span
  assert.equal(g[2][9] + g[2][10], H);
  assert.equal(g[2][9], H / 2);
});

test('splitting keeps the total across both DST switches in New York', () => {
  inTZ('America/New_York', () => {
    const sum = (g: number[][]) => g.flat().reduce((a, x) => a + x, 0);
    const spring = emptyGrid();
    addToGrid(spring, sess('h1', at(2, 8, 1, 30), 2 * H)); // Sun Mar 8: 01:30 → 04:30 local
    assert.ok(Math.abs(sum(spring) - 2 * H) < 1e-6);
    assert.equal(spring[6][2], 0, 'no time in the skipped 2am hour');
    assert.equal(spring[6][1] + spring[6][3] + spring[6][4], 2 * H);

    const fall = emptyGrid();
    addToGrid(fall, sess('h1', at(10, 1, 0, 30), 3 * H)); // Sun Nov 1: 01:00 happens twice
    assert.ok(Math.abs(sum(fall) - 3 * H) < 1e-6);
    assert.equal(fall[6][1], 2 * H, 'the repeated hour holds two hours');
  });
});

// ---- columns -----------------------------------------------------------------

function gridWith(hours: number[]) {
  const g = emptyGrid();
  for (const h of hours) g[0][h] = 60;
  return g;
}

test('columns trim to the hours with data, widened to at least 8', () => {
  const cols = hourColumns(gridWith([10, 12]));
  assert.equal(cols.length, 8);
  assert.deepEqual([cols[0].start, cols[cols.length - 1].end], [8, 16]);
  assert.ok(cols.every((c) => c.end - c.start === 1));
});

test('widening stops at the ends of the day', () => {
  const late = hourColumns(gridWith([23]));
  assert.deepEqual([late[0].start, late[late.length - 1].end], [16, 24]);
  const early = hourColumns(gridWith([0]));
  assert.deepEqual([early[0].start, early[early.length - 1].end], [0, 8]);
});

test('up to 12 hours stay hourly; wider ranges use 2-hour blocks', () => {
  assert.equal(hourColumns(gridWith([8, 19])).length, 12);
  const wide = hourColumns(gridWith([7, 22]));
  assert.ok(wide.every((c) => c.end - c.start === 2 && c.start % 2 === 0));
  assert.deepEqual([wide[0].start, wide[wide.length - 1].end], [6, 24]);
  assert.ok(wide.length <= 12);
});

test('no data: no columns', () => {
  assert.deepEqual(hourColumns(emptyGrid()), []);
});

// ---- insight line ------------------------------------------------------------

test('the insight names the busiest 2-hour window and weekday/weekend', () => {
  const weekdays = emptyGrid();
  for (let d = 0; d < 5; d++) weekdays[d][9] = weekdays[d][10] = H;
  assert.equal(timeInsight(weekdays), 'You track most on weekday mornings, 9–11.');

  const weekend = emptyGrid();
  weekend[5][20] = weekend[6][21] = 2 * H;
  weekend[1][20] = 0.5 * H;
  assert.equal(timeInsight(weekend), 'You track most on weekend evenings, 20–22.');

  const mixed = emptyGrid();
  mixed[0][14] = mixed[1][14] = mixed[2][14] = mixed[6][14] = H; // 75% weekday: neither
  assert.equal(timeInsight(mixed), 'You track most in the afternoon, 14–16.', 'a tie starts where the time is');

  const night = emptyGrid();
  night[0][1] = night[1][1] = night[2][1] = night[6][1] = H;
  assert.equal(timeInsight(night), 'You track most at night, 1–3.');

  assert.equal(timeInsight(emptyGrid()), null);
});

// ---- timeOfDay: range, scope, threshold ---------------------------------------

test('timeOfDay only shows the insight once the session threshold is met', () => {
  inTZ('Asia/Almaty', () => {
    const now = at(8, 25, 18); // Fri Sep 25
    const few = Array.from({ length: MIN_HEAT_SESSIONS - 1 }, (_, i) => sess('h1', at(8, 21 + i, 9), H));
    const r = timeOfDay(data(few), null, now);
    assert.equal(r.enough, false);
    assert.equal(r.insight, null);
    const enough = timeOfDay(data([...few, sess('h1', at(8, 25, 9), H)]), null, now);
    assert.equal(enough.enough, true);
    assert.match(enough.insight ?? '', /weekday mornings, 9–11/);
  });
});

test('timeOfDay respects scope and the 12-week range; running timers are ignored', () => {
  inTZ('Asia/Almaty', () => {
    const now = at(8, 25, 18);
    const d = data([
      sess('h1', at(8, 23, 9), H),
      sess('h2', at(8, 23, 20), H),
      sess('h1', at(5, 1, 9), H), // Jun 1: older than 12 weeks
    ]);
    d.active = { habitId: 'h1', startedAt: now - H * MS, baseSec: 0 };
    assert.equal(timeOfDay(d, null, now).sessions, 2);
    assert.equal(timeOfDay(d, 'p1', now).sessions, 1);
    assert.equal(timeOfDay(d, 'p1', now).grid[2][20], 0);
    assert.equal(timeOfDay(d, 'p2', now).grid[2][20], H);
  });
});

// ---- trends ------------------------------------------------------------------

test('weeklyTrends: 12 bars oldest first, current week last, target met per week', () => {
  inTZ('Asia/Almaty', () => {
    const now = at(8, 25, 18); // week of Sep 21
    const d = data([
      sess('h1', at(8, 22, 9), 2.5 * H), // this week, p1
      sess('h1', at(8, 15, 9), 1 * H), // last week, p1
      sess('h2', at(8, 16, 9), 1 * H), // last week, p2
    ]);
    const all = weeklyTrends(d, null, now);
    assert.equal(all.bars.length, INSIGHT_WEEKS);
    assert.equal(all.bars[11].weekStart, '2026-09-21');
    assert.equal(all.bars[11].current, true);
    assert.equal(all.bars[10].sec, 2 * H);
    assert.equal(all.bars[0].weekStart, '2026-07-06');
    assert.equal(all.bars[0].label, 'Jul 6');
    assert.equal(all.targetSec, null);
    assert.equal(all.bars[11].met, null);
    assert.equal(all.weeksWithData, 2);
    assert.equal(all.enough, true);

    const p1 = weeklyTrends(d, 'p1', now);
    assert.equal(p1.targetSec, 2 * H);
    assert.deepEqual([p1.bars[10].met, p1.bars[11].met], [false, true]);
    assert.equal(p1.max, 2.5 * H);
  });
});

test('weeklyTrends needs two weeks with data', () => {
  inTZ('Asia/Almaty', () => {
    const now = at(8, 25, 18);
    const r = weeklyTrends(data([sess('h1', at(8, 22, 9), H), sess('h1', at(8, 23, 9), H)]), null, now);
    assert.equal(r.weeksWithData, 1);
    assert.equal(r.enough, false);
  });
});

test('trend weeks follow local Mondays across the DST switch', () => {
  inTZ('America/New_York', () => {
    const now = at(2, 11, 12); // Wed Mar 11, after spring forward
    const r = weeklyTrends(data([sess('h1', at(2, 8, 23, 30), H), sess('h1', at(2, 9, 0, 15), H)]), null, now);
    assert.equal(r.bars[10].weekStart, '2026-03-02');
    assert.equal(r.bars[10].sec, H);
    assert.equal(r.bars[11].sec, H);
  });
});

test('insights stay fast with 5,000 sessions', () => {
  const now = at(8, 25, 18);
  const many = Array.from({ length: 5000 }, (_, i) => sess(i % 2 ? 'h1' : 'h2', now - i * 3 * H * MS - H * MS, 5400));
  const d = data(many);
  const t = performance.now();
  timeOfDay(d, null, now);
  weeklyTrends(d, null, now);
  timeOfDay(d, 'p1', now);
  weeklyTrends(d, 'p1', now);
  const ms = performance.now() - t;
  assert.ok(ms < 250, `took ${ms.toFixed(1)}ms`);
});
