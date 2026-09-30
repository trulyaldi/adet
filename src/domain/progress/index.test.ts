// The Trail's comparisons (v2 N4). Local-time windows, so the zone is pinned
// (Node reads TZ when Dates are used, so setting it after the imports works).
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import * as ops from '../items/ops';
import type { Item } from '../items/types';
import { setWeekStartDay } from '../time';
import type { Session } from '../types';
import { trailOf, verdictOf, WindowStats } from './index';
import { habitLabel, trailLine } from './labels';

process.env.TZ = 'UTC';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
// Wednesday 2026-09-16 12:00 UTC; the week (Monday start) began 2026-09-14.
const NOW = Date.UTC(2026, 8, 16, 12);
const MON = Date.UTC(2026, 8, 14);
let n = 0;
const s = (start: number, min: number, habitId = 'h1'): Session => ({ id: `s${++n}`, habitId, start, end: start + min * 60_000, duration: min * 60 });
const habits = [{ id: 'h1' }];
const trail = (sessions: Session[], items: Item[] = [], extra: Partial<Parameters<typeof trailOf>[0]> = {}) => trailOf({ sessions, habits, items, now: NOW, ...extra });

afterEach(() => {
  setWeekStartDay(1);
  process.env.TZ = 'UTC';
});

const W = (p: Partial<WindowStats>): WindowStats => ({ minutes: 0, sessions: 0, weakPoints: 0, measure: null, perHour: null, levelsGained: 0, ...p });

test('no data: a friendly empty trail, no NaN anywhere', () => {
  const t = trail([]);
  assert.equal(t.empty, true);
  assert.deepEqual([t.rising, t.steady, t.resting], [0, 0, 0]);
  const h = t.habits[0];
  assert.equal(h.empty, true);
  assert.equal(h.verdict, 'steady');
  assert.deepEqual(h.series.map((w) => w.minutes), [0, 0, 0, 0]);
  const walk = (v: unknown): void => {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `non-finite ${v}`);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(t);
  assert.equal(h.thisWeek.perHour, null);
  assert.equal(trailOf({ sessions: [], habits: [], items: [], now: NOW }).empty, true);
});

test('windows: this week so far vs last week to the same moment', () => {
  const t = trail([
    s(MON, 60), // this week
    s(MON - 1, 30), // last Sunday 23:59: last week
    s(NOW - 7 * DAY - HOUR, 20), // last week, before the same moment: counts
    s(NOW - 7 * DAY + HOUR, 45), // last week, after the same moment: not compared
  ]);
  const h = t.habits[0];
  assert.equal(h.thisWeek.minutes, 60);
  assert.equal(h.lastWeek.minutes, 20, 'only last week up to the same moment');
  assert.deepEqual(h.series.map((w) => w.minutes), [0, 0, 30 + 20 + 45, 60]);
  assert.equal(h.series[3].weekStart, '2026-09-14');
});

test('windows follow the week-start setting (Sunday)', () => {
  setWeekStartDay(0);
  const h = trail([s(MON - 1, 30)]).habits[0]; // Sunday 23:59 now starts this week
  assert.equal(h.thisWeek.minutes, 30);
  assert.equal(h.series[3].weekStart, '2026-09-13');
});

test('DST: a week that loses an hour still starts at local midnight', () => {
  process.env.TZ = 'America/New_York';
  // 2026-03-08 is the US spring-forward Sunday; Wednesday 11 March, noon local.
  const now = new Date(2026, 2, 11, 12).getTime();
  const monday = new Date(2026, 2, 9).getTime();
  const t = trailOf({ sessions: [s(monday, 40), s(monday - 60_000, 25)], habits, items: [], now });
  assert.equal(t.habits[0].thisWeek.minutes, 40);
  assert.equal(t.habits[0].series[3].weekStart, '2026-03-09');
  assert.equal(t.habits[0].series[2].weekStart, '2026-03-02');
  assert.equal(t.habits[0].series[2].minutes, 25);
});

test('verdicts: two signals rise; minutes down with nothing else rests; the rest is steady', () => {
  assert.equal(verdictOf(W({ minutes: 115 }), W({ minutes: 100 })).verdict, 'steady', 'one signal (+15% time) alone');
  assert.deepEqual(verdictOf(W({ minutes: 115, weakPoints: 2 }), W({ minutes: 100, weakPoints: 1 })), { verdict: 'rising', reasons: ['time', 'weakPoints'] });
  assert.equal(verdictOf(W({ minutes: 114, weakPoints: 2 }), W({ minutes: 100, weakPoints: 1 })).verdict, 'steady', '+14% is not enough');
  assert.equal(verdictOf(W({ minutes: 80 }), W({ minutes: 100 })).verdict, 'resting');
  assert.equal(verdictOf(W({ minutes: 80, levelsGained: 1 }), W({ minutes: 100 })).verdict, 'steady', 'a level gained is progress');
  assert.deepEqual(verdictOf(W({ minutes: 60, perHour: 22, levelsGained: 1 }), W({ minutes: 100, perHour: 20 })).reasons, ['perHour', 'level']);
  assert.equal(verdictOf(W({ minutes: 60, perHour: 21.9 }), W({ minutes: 60, perHour: 20 })).reasons.length, 0, '+9.5% per hour is not enough');
  assert.equal(verdictOf(W({ minutes: 30 }), W({})).reasons[0], 'time', 'anything is up from nothing');
});

test('a measure: total and per focused hour; no minutes means no per-hour (never a division by zero)', () => {
  let q: ops.QuestSlice = { items: [], links: [] };
  q = ops.setMetric(q, 'h1', 'Pages', 'pages', MON);
  const a = s(MON + HOUR, 120);
  q = ops.claimChest(q, { sessionId: a.id, habitId: 'h1', doneTaskIds: [], text: '', amount: { value: 40, metricId: 'metric:h1' }, now: NOW });
  q = ops.addQuickLog(q, { habitId: 'h1', text: '', amount: { value: 10, metricId: 'metric:h1' }, now: MON + 5 * HOUR });
  const h = trail([a], q.items).habits[0];
  assert.deepEqual(h.metric, { id: 'metric:h1', label: 'Pages', unit: 'pages' });
  assert.equal(h.thisWeek.measure, 50);
  assert.equal(h.thisWeek.perHour, 25);
  assert.equal(h.lastWeek.measure, 0);
  assert.equal(h.lastWeek.perHour, null, 'no minutes last week');
  // Only the quick log: a measure, no minutes.
  const only = trail([], ops.addQuickLog(ops.setMetric({ items: [], links: [] }, 'h1', 'Words', '', MON), { habitId: 'h1', text: 'x', amount: { value: 300, metricId: 'metric:h1' }, now: MON + HOUR }).items).habits[0];
  assert.equal(only.thisWeek.measure, 300);
  assert.equal(only.thisWeek.perHour, null);
  assert.equal(only.empty, false);
});

test('weak points count by when they were done; skill levels by effective minutes', () => {
  let q: ops.QuestSlice = { items: [], links: [] };
  q = ops.addTask(q, 'h1', 'a', MON - DAY, 't1');
  q = ops.setTaskStatus(q, 't1', 'done', MON + HOUR);
  q = ops.addTask(q, 'h1', 'b', MON - DAY, 't2');
  q = ops.setTaskStatus(q, 't2', 'done', MON - 6 * DAY); // last Tuesday, before the same moment
  // 20 min (skill 1) → 25 needed for level 2: one session this week crosses it.
  const h = trail([s(MON - 2 * DAY, 20), s(MON + 2 * HOUR, 30)], q.items).habits[0];
  assert.equal(h.thisWeek.weakPoints, 1);
  assert.equal(h.lastWeek.weakPoints, 1);
  assert.equal(h.thisWeek.levelsGained, 1);
  assert.equal(h.lastWeek.levelsGained, 0);
});

test('deleted habits are left out; the trail line counts the rest', () => {
  const t = trailOf({
    sessions: [s(MON + HOUR, 60, 'h1'), s(NOW - 7 * DAY - HOUR, 120, 'h2'), s(MON + HOUR, 200, 'gone')],
    habits: [{ id: 'h1' }, { id: 'h2' }],
    items: [],
    now: NOW,
  });
  // h1: more time and a level gained; h2: time only last week.
  assert.deepEqual(t.habits.map((h) => [h.habitId, h.verdict]), [['h1', 'rising'], ['h2', 'resting']]);
  assert.deepEqual([t.rising, t.steady, t.resting, t.empty], [1, 0, 1, false]);
});

test('what VoiceOver hears: the verdict and its reasons in words', () => {
  assert.equal(habitLabel('Reading', { empty: false, verdict: 'rising', reasons: ['time', 'level'] }), 'Reading: rising, more time, a level');
  assert.equal(habitLabel('Piano', { empty: false, verdict: 'resting', reasons: [] }), 'Piano: resting');
  assert.equal(habitLabel('New', { empty: true, verdict: 'steady', reasons: [] }), 'New: nothing on the trail yet');
  assert.equal(trailLine({ rising: 2, steady: 1, resting: 0 }), '2 rising, 1 steady, 0 resting');
});

test('one habit without a measure and one with: only the second has a total and per hour', () => {
  let q: ops.QuestSlice = { items: [], links: [] };
  q = ops.setMetric(q, 'h2', 'Pages', 'p', MON);
  q = ops.addQuickLog(q, { habitId: 'h2', text: '', amount: { value: 12, metricId: 'metric:h2' }, now: MON + HOUR });
  const t = trailOf({ sessions: [s(MON + HOUR, 60, 'h1'), s(MON + 2 * HOUR, 60, 'h2')], habits: [{ id: 'h1' }, { id: 'h2' }], items: q.items, now: NOW });
  const [a, b] = t.habits;
  assert.deepEqual([a.metric, a.thisWeek.measure, a.thisWeek.perHour], [null, null, null]);
  assert.deepEqual([b.metric?.label, b.thisWeek.measure, b.thisWeek.perHour], ['Pages', 12, 12]);
});
