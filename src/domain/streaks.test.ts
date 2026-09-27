import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dailyStreak, FREEZES_PER_MONTH, weeklyTargetStreak } from './streaks';
import { addDays, dkey, pkey } from './time';

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
