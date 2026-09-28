import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_CAPACITY_MIN, learnedCapacity, raiseCapacityToFit, scaleTargetsToFit, targetCheck } from './capacity';
import { planToday } from './planner';
import { habit, sess, state } from './testkit';
import { dkey, setWeekStartDay } from './time';
import { Project } from './types';

// Monday Sep 28, 2026.
const MON = new Date(2026, 8, 28);
const day = (i: number) => dkey(new Date(2026, 8, 28 + i));
const at = (i: number, h = 9) => new Date(2026, 8, 28 + i, h).getTime();
const SETTINGS = { capacityMin: DEFAULT_CAPACITY_MIN };
const proj = (id: string, weeklyTarget: number): Project => ({ id, name: id, weeklyTarget, started: 0 });

// One project asking for exactly the week's capacity (19h).
const P = [proj('p1', 19)];
const H = [habit('a', 60, 5)];
const shareOf = (sessions: ReturnType<typeof sess>[], i: number, extra = {}) =>
  planToday(P, H, sessions, { ...SETTINGS, ...extra }, day(i)).projects[0].shareMin;

test('with targets equal to capacity, each day gets exactly its capacity', () => {
  assert.equal(MON.getDay(), 1);
  assert.equal(shareOf([], 0), 180);
  const plan = planToday(P, H, [], SETTINGS, day(0));
  assert.equal(plan.capacityMin, 180);
  assert.deepEqual(plan.items, [{ habitId: 'a', projectId: 'p1', kind: 'timed', shareMin: 180 }]);
});

test('a light day makes the rest of the week slightly heavier', () => {
  const light = [sess('s1', 'a', at(0), 60)];
  // 1080 min left over Tue–Sun (4×180 + 2×120 = 960 capacity): Tuesday 1080 × 180/960.
  assert.equal(shareOf(light, 1), 203);
  assert.ok(shareOf(light, 1) > 180);
});

test('a heavy day makes the rest of the week lighter', () => {
  const heavy = [sess('s1', 'a', at(0), 300)];
  // 840 left: Tuesday 840 × 180/960.
  assert.equal(shareOf(heavy, 1), 158);
  assert.ok(shareOf(heavy, 1) < 180);
});

test("today's share is fixed from before today: working today doesn't move it", () => {
  assert.equal(shareOf([sess('s1', 'a', at(0, 8), 120)], 0), 180);
});

test('the light/normal/heavy tap scales only today', () => {
  // Light Monday: 90 of 90 + 960.
  assert.equal(shareOf([], 0, { level: 'light' }), Math.round((1140 * 90) / 1050));
  assert.equal(planToday(P, H, [], { ...SETTINGS, level: 'heavy' }, day(0)).capacityMin, 270);
});

test('a met target plans nothing (a free day), and there is never a backlog into next week', () => {
  const done = [sess('s1', 'a', at(0), 19 * 60)];
  assert.equal(planToday(P, H, done, SETTINGS, day(1)).items.length, 0);
  // Nothing done all last week: this Monday is a normal Monday.
  assert.equal(shareOf([], 7), 180);
});

test('a project with more habits splits its slice by their lengths', () => {
  const plan = planToday([proj('p1', 19)], [habit('a', 60, 5), habit('b', 30, 5)], [], SETTINGS, day(0));
  assert.deepEqual(plan.items.map((i) => [i.habitId, i.shareMin]), [['a', 120], ['b', 60]]);
});

test('setting a habit aside gives its time to the project’s other habits', () => {
  const hs = [habit('a', 60, 5), habit('b', 30, 5)];
  const plan = planToday([proj('p1', 19)], hs, [], SETTINGS, day(0), { aside: ['a'] });
  assert.deepEqual(plan.items.map((i) => [i.habitId, i.shareMin]), [['b', 180]]);
  // The only habit set aside: its time moves to later days.
  const alone = planToday(P, H, [], SETTINGS, day(0), { aside: ['a'] });
  assert.equal(alone.items.length, 0);
});

test('a dragged order is kept', () => {
  const hs = [habit('a', 60, 5), habit('b', 30, 5)];
  const plan = planToday([proj('p1', 19)], hs, [], SETTINGS, day(0), { order: ['b', 'a'] });
  assert.deepEqual(plan.items.map((i) => i.habitId), ['b', 'a']);
});

test('times-a-week habits spread out; check-offs are planned with no time', () => {
  const hs = [habit('w', 30, 5, { kind: 'weekly', times: 3 }), habit('c', 5, 5, { kind: 'daily' }, { kind: 'check' })];
  const mon = planToday([proj('p1', 5)], hs, [], SETTINGS, day(0));
  assert.deepEqual(mon.items.map((i) => [i.habitId, i.kind]), [['w', 'timed'], ['c', 'check']]);
  assert.equal(mon.items[1].shareMin, 0);
  // Done Monday: not due Tuesday (2 left over 6 days is ahead of 3/7), so the
  // project's hours go to it anyway as the least recently done.
  const tue = planToday([proj('p1', 5)], hs, [sess('s1', 'w', at(0), 30)], SETTINGS, day(1));
  assert.equal(tue.items[0].habitId, 'w');
});

test('archived projects and zero-capacity days plan nothing', () => {
  assert.equal(planToday([{ ...proj('p1', 19), archivedAt: 1 }], H, [], SETTINGS, day(0)).items.length, 0);
  const rest = [...DEFAULT_CAPACITY_MIN.slice(0, 6), 0];
  assert.equal(planToday(P, H, [], { capacityMin: rest }, day(6)).items.length, 0);
});

test('a Sunday week start moves where the week begins', () => {
  setWeekStartDay(0);
  try {
    // Sunday Oct 4 starts a new week: nothing done in it yet.
    const plan = planToday(P, H, [sess('s1', 'a', at(1), 600)], SETTINGS, day(6));
    assert.equal(plan.projects[0].remainingMin, 19 * 60);
  } finally {
    setWeekStartDay(1);
  }
});

test('target vs capacity: flags only an excess, and both fixes resolve it', () => {
  const d = state([], [], { projects: [proj('a', 12), proj('b', 10)] });
  const chk = targetCheck(d);
  assert.deepEqual([chk.targetMin, chk.capacityMin, chk.over], [1320, 1140, true]);
  assert.equal(targetCheck(state([], [], { projects: [proj('a', 19)] })).over, false);
  assert.equal(targetCheck(state([], [], { projects: [proj('a', 12), { ...proj('b', 30), archivedAt: 1 }] })).over, false);

  const scaled = scaleTargetsToFit(d.projects, chk.capacityMin);
  assert.ok(scaled.reduce((a, p) => a + p.weeklyTarget * 60, 0) <= chk.capacityMin);
  assert.ok(scaled[0].weeklyTarget > scaled[1].weeklyTarget, 'proportional');
  const raised = raiseCapacityToFit(DEFAULT_CAPACITY_MIN, chk.targetMin);
  assert.ok(raised.reduce((a, b) => a + b, 0) >= chk.targetMin);
  assert.ok(raised.every((m) => m % 15 === 0));
});

test('learned capacity waits for 14 days, then suggests weekday medians', () => {
  const sessions = [];
  for (let back = 1; back <= 28; back++) {
    const d = new Date(2026, 8, 28 - back, 10);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    sessions.push(sess('s' + back, 'a', d.getTime(), weekend ? 30 : 90));
  }
  const s = learnedCapacity(sessions, DEFAULT_CAPACITY_MIN, day(0));
  assert.deepEqual(s, [90, 90, 90, 90, 90, 30, 30]);
  assert.equal(learnedCapacity(sessions.slice(0, 10), DEFAULT_CAPACITY_MIN, day(0)), null, 'too little history');
  assert.equal(learnedCapacity(sessions, [90, 90, 90, 90, 90, 30, 30], day(0)), null, 'nothing to change');
});
