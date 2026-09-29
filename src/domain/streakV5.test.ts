import assert from 'node:assert/strict';
import test from 'node:test';

import { hydrate } from './migrations';
import { addMark } from './marks';
import { streakV5 } from './streaks';
import { habit, sess, state } from './testkit';
import { dkey } from './time';

const at = (m: number, d: number) => new Date(2026, m, d, 9).getTime();
const k = (m: number, d: number) => dkey(new Date(2026, m, d));

/** Sessions on the given September days. */
const days = (...ds: number[]) => ds.map((d) => sess('s' + d, 'a', at(8, d), 20));

test('any logged time counts; today in progress breaks nothing', () => {
  const d = state([habit('a', 30, 5)], days(21, 22, 23, 24));
  assert.equal(streakV5(d, k(8, 25), null).current, 4);
  assert.equal(streakV5(d, k(8, 25), null).marks.get(k(8, 25)), 'today');
});

test('a check-off alone counts for the day', () => {
  const d = addMark(state([habit('a', 30, 5)], days(21, 22)), 'a', k(8, 23));
  assert.equal(streakV5(d, k(8, 23), null).current, 3);
});

test('the first quiet day of a week is a rest day (a moon), neutral', () => {
  // Mon 21, Tue 22, (Wed 23 quiet), Thu 24.
  const s = streakV5(state([habit('a', 30, 5)], days(21, 22, 24)), k(8, 24), null);
  assert.equal(s.marks.get(k(8, 23)), 'rest');
  assert.equal(s.current, 3);
});

test('more quiet days use the month’s two freezes, then the streak resets', () => {
  // Week of Sep 21: quiet Tue 22 (rest), Wed 23 (freeze), Thu 24 (freeze), Fri 25 (break).
  const s = streakV5(state([habit('a', 30, 5)], days(21, 26)), k(8, 26), null);
  assert.deepEqual([22, 23, 24, 25].map((d) => s.marks.get(k(8, d))), ['rest', 'freeze', 'freeze', 'open']);
  assert.equal(s.current, 1);
  assert.equal(s.longest, 1);
});

test('a day with nothing planned (targets met) is neutral', () => {
  const d = state([habit('a', 30, 5)], days(21, 22, 24, 25), {
    dailyLogs: [{ id: k(8, 23), capacityMin: 180, plannedMin: 0, actualMin: 0, items: [], doneCount: 0 }],
  });
  const s = streakV5(d, k(8, 25), null);
  assert.equal(s.marks.get(k(8, 23)), 'free');
  assert.equal(s.current, 4);
});

test('the pre-redesign streak is a floor until the streak breaks', () => {
  const d = state([habit('a', 30, 5)], days(24, 25));
  const carry = { current: 40, longest: 40, day: k(8, 23) };
  assert.equal(streakV5(d, k(8, 25), carry).current, 42, '40 carried + 2 new days');
  assert.equal(streakV5(state([habit('a', 30, 5)]), k(8, 25), carry).current, 40, 'nothing tracked since: still 40');
});

test('upgrading from v4 never shows a lower streak', () => {
  // A v4 save: 30 tracked days in a row up to yesterday, judged by old plans with a carry.
  const sessions = Array.from({ length: 30 }, (_, i) => sess('s' + i, 'a', at(8, i + 1), 5));
  const v4 = {
    ...state([habit('a', 60, 5)], sessions),
    schemaVersion: 4,
    streakCarry: { current: 55, longest: 70, day: k(8, 1) },
  } as any;
  delete v4.marks;
  const now = new Date(2026, 8, 30, 20).getTime(); // Sep 30, nothing yet today
  const r = hydrate({ v3: JSON.stringify(v4), v2: null }, now);
  const s = streakV5(r, k(8, 30), r.streakCarry);
  assert.ok(r.streakCarry && r.streakCarry.current >= 55);
  assert.ok(s.current >= r.streakCarry!.current, `${s.current} >= ${r.streakCarry!.current}`);
  assert.ok(s.longest >= 70);
});

test('v5: freezes bought for a month extend that month only', () => {
  // Three quiet days in one week after a streak: rest, then two freezes, then a break.
  const day = (k: string, min = 30) => ({ id: 's' + k, habitId: 'h', start: new Date(k + 'T09:00:00').getTime(), end: new Date(k + 'T09:00:00').getTime() + min * 60000, duration: min * 60 });
  const sessions = ['2026-09-07', '2026-09-08', '2026-09-12'].map((k) => day(k));
  const data = state([habit('h', 30, 5)], sessions);
  // Sep 9 rest, 10 and 11 frozen (2/month) → streak survives to the 12th.
  const plain = streakV5(data, '2026-09-12', null);
  assert.equal(plain.current, 3);
  // Four quiet days: the 4th breaks it, unless a freeze was bought for September.
  const gap = { ...data, sessions: ['2026-09-07', '2026-09-08', '2026-09-13'].map((k) => day(k)) };
  assert.equal(streakV5(gap, '2026-09-13', null).current, 1);
  assert.equal(streakV5(gap, '2026-09-13', null, false, { '2026-09': 1 }).current, 3);
  assert.equal(streakV5(gap, '2026-09-13', null, false, { '2026-10': 1 }).current, 1);
});
