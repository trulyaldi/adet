import assert from 'node:assert/strict';
import { test } from 'node:test';

import { habitDaySec } from './plan';
import { dailyStreak, dayRecords, FREEZES_PER_MONTH, habitWeekStreak, planStreak, weeklyTargetStreak } from './streaks';
import { habit, sess, state } from './testkit';
import { addDays, dkey, pkey } from './time';
import { PersistedState } from './types';

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

/** Day map from a pattern ending at `last`: '1' tracked, '0' missed (oldest first). */
function days(pattern: string, last: string): Record<string, number> {
  const map: Record<string, number> = {};
  const end = pkey(last);
  [...pattern].forEach((c, i) => {
    if (c === '1') map[dkey(addDays(end, i - (pattern.length - 1)))] = 1800;
  });
  return map;
}

const noon = (k: string) => pkey(k).getTime() + 12 * H * 1000;

test('no history: nothing to count, full freezes', () => {
  assert.deepEqual(dailyStreak({}, noon('2026-09-15')), {
    current: 0,
    longest: 0,
    atRisk: false,
    freezesLeft: FREEZES_PER_MONTH,
  });
});

test('consecutive days, today tracked or still in progress', () => {
  const today = '2026-09-15';
  assert.equal(dailyStreak(days('111', today), noon(today)).current, 3);
  // Today not tracked yet: the run through yesterday stands, not at risk.
  const s = dailyStreak(days('1110', today), noon(today));
  assert.equal(s.current, 3);
  assert.equal(s.atRisk, false);
});

test('a single missed day is frozen: it keeps the streak but does not count', () => {
  const today = '2026-09-15';
  const s = dailyStreak(days('11011', today), noon(today));
  assert.equal(s.current, 4);
  assert.equal(s.freezesLeft, 1);
});

test('two missed days in a row break the streak', () => {
  const today = '2026-09-15';
  const s = dailyStreak(days('111001', today), noon(today));
  assert.equal(s.current, 1);
  assert.equal(s.longest, 3);
  assert.equal(s.freezesLeft, 2, 'a broken gap uses no freeze');
});

test('only two freezes per calendar month; the third gap breaks', () => {
  const today = '2026-09-20'; // all gaps in September
  const s = dailyStreak(days('1101101101', today), noon(today));
  // Gaps on Sep 13, 16 (frozen) and Sep 19 (third: breaks).
  assert.equal(s.current, 1);
  assert.equal(s.longest, 6);
  assert.equal(s.freezesLeft, 0);
});

test('a new month brings new freezes', () => {
  // Gaps Sep 26 and Sep 28 use September's two; Oct 2 uses one of October's.
  const today = '2026-10-03';
  const s = dailyStreak(days('1101011101', today), noon(today));
  assert.equal(s.current, 7);
  assert.equal(s.freezesLeft, 1, 'only October counts toward this month');
});

test('yesterday missed and today untracked: alive but at risk while a freeze is available', () => {
  const today = '2026-09-15';
  // Sep 11 ✓, 12 ✓, 13 ✓, 14 ✗ (yesterday), 15 today untracked.
  const s = dailyStreak(days('11100', today), noon(today));
  assert.equal(s.current, 3);
  assert.equal(s.atRisk, true);
  assert.equal(s.freezesLeft, 2, 'the freeze is only applied once today is tracked');
});

test('tracking today after a missed yesterday applies the freeze', () => {
  const today = '2026-09-15';
  const s = dailyStreak(days('11101', today), noon(today));
  assert.equal(s.current, 4);
  assert.equal(s.atRisk, false);
  assert.equal(s.freezesLeft, 1);
});

test('if today ends with no time, the streak breaks the next day', () => {
  const s = dailyStreak(days('111000', '2026-09-16'), noon('2026-09-16'));
  assert.equal(s.current, 0);
  assert.equal(s.atRisk, false);
  assert.equal(s.longest, 3);
});

test('yesterday missed with no freeze left: broken, not at risk', () => {
  // Sep 9 ✓, 10 ✗, 11 ✓, 12 ✗, 13 ✓, 14 ✗ (yesterday), 15 today untracked.
  // Sep 10 and 12 use September's freezes, so Sep 14 can't be covered.
  const today = '2026-09-15';
  const s = dailyStreak(days('1010100', today), noon(today));
  assert.equal(s.current, 0);
  assert.equal(s.atRisk, false);
});

test('an at-risk yesterday in the previous month uses that month\'s freezes', () => {
  // Sep 30 missed with September's freezes left; today is Oct 1, untracked.
  const s = dailyStreak(days('1100', '2026-10-01'), noon('2026-10-01'));
  assert.equal(s.atRisk, true);
  assert.equal(s.current, 2);
});

test('the walk holds across the New York DST switch', () => {
  inTZ('America/New_York', () => {
    // Mar 7 ✓, Mar 8 (spring forward) ✗ frozen, Mar 9 ✓, Mar 10 ✓.
    const s = dailyStreak(days('1011', '2026-03-10'), noon('2026-03-10'));
    assert.equal(s.current, 3);
    const fall = dailyStreak(days('111', '2026-11-02'), noon('2026-11-02')); // Oct 31 – Nov 2
    assert.equal(fall.current, 3);
  });
});

// ---- existing streaks never shrink -------------------------------------------

/** The pre-freeze current streak (streakOf), with an explicit now. */
function oldCurrent(map: Record<string, number>, now: number): number {
  const t = new Date(now);
  let sd = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  if (!map[dkey(sd)]) sd = addDays(sd, -1);
  let n = 0;
  while (map[dkey(sd)] > 0) {
    n++;
    sd = addDays(sd, -1);
  }
  return n;
}

/** The pre-freeze longest streak (Stats' recStreak). */
function oldLongest(map: Record<string, number>): number {
  let best = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const k of Object.keys(map).sort()) {
    cur = prev && dkey(addDays(pkey(prev), 1)) === k ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = k;
  }
  return best;
}

test('property: new current and longest streaks are never below the old ones', () => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 500; i++) {
    const len = 1 + Math.floor(rnd() * 120);
    const density = 0.3 + rnd() * 0.65;
    const pattern = Array.from({ length: len }, () => (rnd() < density ? '1' : '0')).join('');
    const today = dkey(addDays(pkey('2026-09-15'), Math.floor(rnd() * 60)));
    const map = days(pattern, today);
    const now = noon(today);
    const s = dailyStreak(map, now);
    assert.ok(s.current >= oldCurrent(map, now), `current shrank for ${pattern} @ ${today}`);
    assert.ok(s.longest >= oldLongest(map), `longest shrank for ${pattern} @ ${today}`);
    assert.ok(s.longest >= s.current);
  }
});

// ---- weekly target streak -----------------------------------------------------

/** Day map with `hours` tracked on the Wednesday of each week starting at the given Mondays. */
function weeks(entries: [monday: string, hours: number][]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [m, h] of entries) if (h > 0) map[dkey(addDays(pkey(m), 2))] = h * H;
  return map;
}

test('weekly streak: finished weeks that met the target, current week counts once met', () => {
  const map = weeks([
    ['2026-08-24', 2], // missed
    ['2026-08-31', 5],
    ['2026-09-07', 6],
    ['2026-09-14', 5],
  ]);
  // Current week (Sep 21) not met yet: in progress, doesn't break.
  assert.equal(weeklyTargetStreak(map, 5, noon('2026-09-23')), 3);
  // Current week met: counts.
  map['2026-09-22'] = 5 * H;
  assert.equal(weeklyTargetStreak(map, 5, noon('2026-09-23')), 4);
});

test('weekly streak: a missed finished week breaks it; no target means none', () => {
  const map = weeks([
    ['2026-08-31', 5],
    ['2026-09-07', 1], // missed
    ['2026-09-14', 5],
  ]);
  assert.equal(weeklyTargetStreak(map, 5, noon('2026-09-23')), 1);
  assert.equal(weeklyTargetStreak(map, 0, noon('2026-09-23')), 0);
  assert.equal(weeklyTargetStreak({}, 5, noon('2026-09-23')), 0);
});

test('weekly streak: time on the DST Sunday counts in its own week', () => {
  inTZ('America/New_York', () => {
    const map: Record<string, number> = {
      '2026-03-08': 5 * H, // Sunday of the week of Mar 2 (spring forward)
      '2026-02-25': 5 * H, // week of Feb 23
    };
    assert.equal(weeklyTargetStreak(map, 5, noon('2026-03-11')), 2);
  });
});

// ---------- plan-based streak (schema v4) ----------

const S = { budgetMin: 60, planCap: 3 };
const on = (m: number, d: number, h = 9) => new Date(2026, m, d, h, 0).getTime();
/** One daily habit; a 10-minute session on each given day of September / October. */
function daily(days: [number, number][], extra: Partial<PersistedState> = {}) {
  const a = habit('a', 10, 5);
  return state([a], days.map(([m, d], i) => sess('s' + i, 'a', on(m, d), 10)), { planSince: '2026-09-01', ...extra });
}
function streakOf(d: PersistedState, now: number) {
  const today = dkey(new Date(now));
  return planStreak(dayRecords(d, habitDaySec(d, now), today, S), today, d.streakCarry);
}
const range = (m: number, from: number, to: number): [number, number][] =>
  Array.from({ length: to - from + 1 }, (_, i) => [m, from + i] as [number, number]);

test('plan streak: complete days add up; today in progress breaks nothing', () => {
  // Sep 21–30 done; today Oct 1 not yet.
  const d = daily(range(8, 21, 30));
  assert.equal(streakOf(d, on(9, 1, 12)).current, 10);
  // Done today: +1.
  const done = daily([...range(8, 21, 30), [9, 1]]);
  assert.equal(streakOf(done, on(9, 1, 12)).current, 11);
});

test('one off day a week is a rest day (a moon): the streak survives', () => {
  // Week of Sep 21: Wed Sep 23 missed. Week of Sep 28: Tue Sep 29 missed.
  const d = daily([...range(8, 21, 22), ...range(8, 24, 28), ...range(8, 30, 30)]);
  const s = streakOf(d, on(9, 1, 12));
  assert.equal(s.current, 8, 'rest days neither break nor add');
  assert.equal(s.marks.get('2026-09-23'), 'rest');
  assert.equal(s.marks.get('2026-09-29'), 'rest');
});

test('a second off day in the same week breaks the streak (shown neutral)', () => {
  // Sep 22 and Sep 24 both missed in the week of Sep 21.
  const d = daily([[8, 21], [8, 23], ...range(8, 25, 30)]);
  const s = streakOf(d, on(9, 1, 12));
  assert.equal(s.marks.get('2026-09-22'), 'rest');
  assert.equal(s.marks.get('2026-09-24'), 'open');
  assert.equal(s.current, 6);
  assert.equal(s.longest, 6);
});

test('Sunday to Monday: each week gets its own rest day', () => {
  // Sun Sep 27 and Mon Sep 28 both missed: one per week, the streak lives.
  const d = daily([...range(8, 21, 26), ...range(8, 29, 30)]);
  const s = streakOf(d, on(9, 1, 12));
  assert.equal(s.marks.get('2026-09-27'), 'rest');
  assert.equal(s.marks.get('2026-09-28'), 'rest');
  assert.equal(s.current, 8);
});

test('days with nothing due are free: they neither break nor add', () => {
  const w = habit('w', 10, 5, { kind: 'weekly', times: 2 });
  // Mon + Tue do the week; Wed–Sun are free; next Mon + Tue again.
  const d = state([w], [sess('1', 'w', on(8, 21), 10), sess('2', 'w', on(8, 22), 10), sess('3', 'w', on(8, 28), 10), sess('4', 'w', on(8, 29), 10)], {
    planSince: '2026-09-01',
  });
  const s = streakOf(d, on(8, 30, 12));
  assert.equal(s.marks.get('2026-09-25'), 'free');
  assert.equal(s.current, 4);
});

test("skipping the app doesn't make a day free: it's judged by the plan it would have had", () => {
  // Sep 21–24 done, then nothing until today (Oct 1): the gap breaks the streak.
  const d = daily(range(8, 21, 24));
  const s = streakOf(d, on(9, 1, 12));
  assert.equal(s.marks.get('2026-09-25'), 'rest');
  assert.equal(s.marks.get('2026-09-26'), 'open');
  assert.equal(s.current, 0);
  assert.equal(s.longest, 4);
});

test('before plans existed, any tracked time counts (the old rule), with the new rest days', () => {
  const a = habit('a', 60, 30);
  // 5 minutes a day: under the minimum, but these days predate plans.
  const d = state([a], range(8, 21, 27).map(([m, x], i) => sess('s' + i, 'a', on(m, x), 5)), { planSince: '2026-09-28' });
  assert.equal(streakOf(d, on(8, 28, 12)).current, 7);
});

test('the old streak is kept as a floor until the new one breaks', () => {
  const carry = { current: 40, longest: 55, day: '2026-09-28' };
  // Under the new rules only Sep 26–27 count (2), but the old streak was 40 on the migration day.
  const d = daily(range(8, 26, 27), { planSince: '2026-09-28', streakCarry: carry });
  let s = streakOf(d, on(8, 28, 12));
  assert.equal(s.current, 40);
  assert.equal(s.longest, 55, 'the old longest is kept too');

  // Two more complete days after the migration day: 42.
  s = streakOf(daily([...range(8, 26, 30)], { planSince: '2026-09-28', streakCarry: carry }), on(8, 30, 20));
  assert.equal(s.current, 42);

  // A break after the migration day ends the carry: back to the new count.
  const broken = daily([[8, 28], [8, 29], ...range(9, 3, 5)], { planSince: '2026-09-28', streakCarry: carry });
  // Sep 30 and Oct 1 are both in the week of Sep 28: the first is its rest day, the second breaks.
  s = streakOf(broken, on(9, 5, 20));
  assert.equal(s.marks.get('2026-09-30'), 'rest');
  assert.equal(s.marks.get('2026-10-01'), 'open');
  assert.equal(s.current, 3);
  assert.equal(s.longest, 55);
});

test('per-habit streak: consecutive weeks on target; the week in progress never breaks it', () => {
  const w = habit('w', 10, 5, { kind: 'weekly', times: 2 });
  const sessions = [
    // Weeks of Sep 7, 14, 21: 2 each.
    sess('1', 'w', on(8, 7), 10), sess('2', 'w', on(8, 9), 10),
    sess('3', 'w', on(8, 14), 10), sess('4', 'w', on(8, 16), 10),
    sess('5', 'w', on(8, 21), 10), sess('6', 'w', on(8, 22, 20), 10),
    // Week of Sep 28 (current): 1 so far.
    sess('7', 'w', on(8, 28), 10),
  ];
  const d = state([w], sessions);
  const days = habitDaySec(d);
  assert.equal(habitWeekStreak(w, days, '2026-09-30'), 3);
  assert.equal(habitWeekStreak(w, habitDaySec({ ...d, sessions: [...sessions, sess('8', 'w', on(8, 30), 10)] }), '2026-09-30'), 4);
  // A week under target breaks it.
  assert.equal(habitWeekStreak(w, habitDaySec({ ...d, sessions: sessions.filter((s) => s.id !== '4') }), '2026-09-30'), 1);
});

test('the carry: finishing the migration day itself still adds one', () => {
  // The old streak was 30 through Sep 27; the update came on Sep 28, before anything was tracked.
  const carry = { current: 30, longest: 30, day: '2026-09-27' };
  const before = daily(range(8, 26, 27), { planSince: '2026-09-28', streakCarry: carry });
  assert.equal(streakOf(before, on(8, 28, 12)).current, 30);
  const after = daily([...range(8, 26, 27), [8, 28]], { planSince: '2026-09-28', streakCarry: carry });
  assert.equal(streakOf(after, on(8, 28, 20)).current, 31);
  // An old-rule freeze day just before the update that the new rules call a break doesn't drop the carry.
  const frozen = daily([[8, 21], [8, 23], [8, 25]], { planSince: '2026-09-26', streakCarry: { current: 3, longest: 9, day: '2026-09-25' } });
  assert.equal(streakOf(frozen, on(8, 26, 12)).current, 3);
});
