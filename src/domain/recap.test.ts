import assert from 'node:assert/strict';
import { test } from 'node:test';

import { changeLabel, lastCompletedWeekStart, pastRecaps, recapSummary, recapToShow, weekRecap } from './recap';
import { Habit, PersistedState, Session } from './types';

const H = 3600;

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

const habit = (id: string, projectId: string): Habit => ({
  id,
  projectId,
  name: id,
  icon: 'code',
  tile: '#fff',
  dailyTargetMin: 30,
  weeklyTargetMin: 150,
});

let n = 0;
const sess = (habitId: string, start: number, sec: number): Session => ({
  id: 's' + n++,
  habitId,
  start,
  end: start + sec * 1000,
  duration: sec,
});

function data(sessions: Session[], targets: { p1?: number; p2?: number } = {}): PersistedState {
  return {
    schemaVersion: 3,
    projects: [
      { id: 'p1', name: 'Coding', weeklyTarget: targets.p1 ?? 5 },
      { id: 'p2', name: 'Reading', weeklyTarget: targets.p2 ?? 3 },
    ],
    habits: [habit('h1', 'p1'), habit('h2', 'p2')],
    sessions,
    active: null,
    historyClearedAt: 0,
  };
}

const at = (m: number, d: number, h = 12, min = 0) => new Date(2026, m, d, h, min).getTime();

test('last completed week starts the Monday before this week', () => {
  inTZ('Asia/Almaty', () => {
    assert.equal(lastCompletedWeekStart(at(8, 28, 0, 0)), '2026-09-21'); // Mon Sep 28
    assert.equal(lastCompletedWeekStart(at(8, 27, 23, 59)), '2026-09-14'); // Sun Sep 27
    assert.equal(lastCompletedWeekStart(at(8, 30)), '2026-09-21');
  });
});

test('weekRecap: per-project hit/missed, week-before comparison, best day, sessions', () => {
  inTZ('Asia/Almaty', () => {
    const d = data([
      // Week of Sep 21.
      sess('h1', at(8, 21), 2 * H),
      sess('h1', at(8, 23), 3.5 * H), // Wednesday: best day
      sess('h2', at(8, 23, 20), 0.5 * H),
      sess('h2', at(8, 27, 22), 1 * H),
      // Week of Sep 14 (the week before).
      sess('h1', at(8, 15), 4 * H),
      // Outside both weeks.
      sess('h1', at(8, 28, 9), 1 * H),
      sess('gone', at(8, 22), 9 * H), // deleted habit: ignored
    ]);
    const r = weekRecap(d, '2026-09-21');
    assert.equal(r.rangeLabel, 'Sep 21 – 27');
    assert.deepEqual(
      r.projects.map((p) => [p.projectId, p.doneSec, p.targetSec, p.hit, p.prevSec]),
      [
        ['p1', 5.5 * H, 5 * H, true, 4 * H],
        ['p2', 1.5 * H, 3 * H, false, 0],
      ]
    );
    assert.equal(r.totalSec, 7 * H);
    assert.equal(r.prevTotalSec, 4 * H);
    assert.deepEqual(r.bestDay, { key: '2026-09-23', label: 'Wednesday', sec: 4 * H });
    assert.equal(r.sessions, 4);
    assert.equal(r.hitCount, 1);
    assert.equal(r.targetCount, 2);
  });
});

test('ties for best day go to the earliest day; an empty week has none', () => {
  inTZ('Asia/Almaty', () => {
    const r = weekRecap(data([sess('h1', at(8, 25), H), sess('h1', at(8, 22), H)]), '2026-09-21');
    assert.equal(r.bestDay?.label, 'Tuesday');
    assert.equal(weekRecap(data([]), '2026-09-21').bestDay, null);
  });
});

test('projects without a usable target are neither hit nor missed', () => {
  const r = weekRecap(data([], { p1: 0 }), '2026-09-21');
  assert.equal(r.projects[0].targetSec, null);
  assert.equal(r.projects[0].hit, null);
  assert.equal(r.targetCount, 1);
});

test('a range crossing months names both months', () => {
  assert.equal(weekRecap(data([]), '2026-09-28').rangeLabel, 'Sep 28 – Oct 4');
});

test('week edges and a DST week in New York', () => {
  inTZ('America/New_York', () => {
    const d = data([
      sess('h1', at(2, 1, 23, 59), H), // Sun Mar 1: week before
      sess('h1', at(2, 2, 0, 0), 2 * H), // Mon Mar 2 00:00: in
      sess('h1', at(2, 8, 23, 30), 1 * H), // Sun Mar 8 (spring forward): in
      sess('h1', at(2, 9, 0, 0), 5 * H), // Mon Mar 9 00:00: next week
    ]);
    const r = weekRecap(d, '2026-03-02');
    assert.equal(r.totalSec, 3 * H);
    assert.equal(r.prevTotalSec, H);
    assert.equal(r.sessions, 2);
    // Fall-back week: Mon Oct 26 – Sun Nov 1.
    const fall = weekRecap(data([sess('h2', at(10, 1, 1, 30), H), sess('h2', at(10, 2, 0, 5), H)]), '2026-10-26');
    assert.equal(fall.totalSec, H);
    assert.equal(fall.rangeLabel, 'Oct 26 – Nov 1');
  });
});

test('recapToShow offers last week once, and only if something was tracked', () => {
  inTZ('Asia/Almaty', () => {
    const now = at(8, 29); // Tue Sep 29
    const d = data([sess('h1', at(8, 22), H)]);
    assert.equal(recapToShow(d, now, null)?.weekStart, '2026-09-21');
    assert.equal(recapToShow(d, now, '2026-09-14')?.weekStart, '2026-09-21');
    assert.equal(recapToShow(d, now, '2026-09-21'), null, 'already seen on this device');
    assert.equal(recapToShow(data([sess('h1', at(8, 15), H)]), now, null), null, 'last week was empty');
  });
});

test('after a long gap only the most recent finished week is offered', () => {
  inTZ('Asia/Almaty', () => {
    const d = data([sess('h1', at(7, 3), H), sess('h1', at(8, 23), H)]);
    const r = recapToShow(d, at(8, 30), '2026-08-03');
    assert.equal(r?.weekStart, '2026-09-21');
  });
});

test('pastRecaps lists recent finished weeks with data, newest first', () => {
  inTZ('Asia/Almaty', () => {
    const d = data([
      sess('h1', at(8, 23), H), // week of Sep 21
      sess('h1', at(8, 8), H), // week of Sep 7
      sess('h1', at(7, 10), H), // week of Aug 10: outside the last 4
      sess('h1', at(8, 29), H), // current week: not finished
    ]);
    assert.deepEqual(
      pastRecaps(d, at(8, 30), 4).map((r) => r.weekStart),
      ['2026-09-21', '2026-09-07']
    );
  });
});

test('changeLabel says up, down, or same compared with the week before', () => {
  assert.equal(changeLabel(5 * H, 3 * H), 'up 2h on the week before');
  assert.equal(changeLabel(1 * H, 1.5 * H), 'down 30m on the week before');
  assert.equal(changeLabel(H, H + 30), 'same as the week before');
});

test('recapSummary counts targets hit and total time', () => {
  inTZ('Asia/Almaty', () => {
    const d = data([sess('h1', at(8, 22), 5 * H), sess('h2', at(8, 23), 1 * H), sess('h1', at(8, 15), 4 * H)]);
    assert.equal(recapSummary(weekRecap(d, '2026-09-21')), 'Hit 1 of 2 targets · 6h tracked · up 2h on the week before');
    const noTargets = data([sess('h1', at(8, 22), H)], { p1: 0, p2: 0 });
    assert.equal(recapSummary(weekRecap(noTargets, '2026-09-21')), '1h tracked · up 1h on the week before');
  });
});
