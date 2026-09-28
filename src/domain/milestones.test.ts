import assert from 'node:assert/strict';
import test from 'node:test';

import { award, badgeInfo, celebrationOrder, enqueueCelebrations, newBadges } from './milestones';
import { habit, sess, state } from './testkit';

const NOW = new Date(2026, 8, 30, 12).getTime(); // Wednesday

test('first session, streak steps, hours and the weekly target', () => {
  const d = state([habit('a', 60, 5)], [sess('s1', 'a', new Date(2026, 8, 29, 9).getTime(), 11 * 60)], {
    projects: [{ id: 'p1', name: 'P', weeklyTarget: 10, started: 0 }],
  });
  assert.deepEqual(newBadges(d, 7, NOW).sort(), ['first-session', 'hours-p1-10', 'streak-3', 'streak-7', 'week-p1-2026-09-28'].sort());
  const got = award(d, newBadges(d, 7, NOW), NOW);
  assert.deepEqual(newBadges(got, 7, NOW), [], 'each badge once');
  assert.deepEqual(newBadges(got, 14, NOW), ['streak-14']);
});

test('badge ids read back', () => {
  assert.deepEqual(badgeInfo('streak-30'), { id: 'streak-30', kind: 'streak', value: 30 });
  assert.equal(badgeInfo('hours-g12-50')?.projectId, 'g12');
  assert.equal(badgeInfo('week-g1-2026-09-28')?.kind, 'week');
  assert.equal(badgeInfo('nope'), null);
});

test('the celebration queue never repeats and puts streaks first', () => {
  const q = enqueueCelebrations(['streak-3'], celebrationOrder(['first-session', 'streak-3', 'hours-p-10']));
  assert.deepEqual(q, ['streak-3', 'hours-p-10', 'first-session']);
});
