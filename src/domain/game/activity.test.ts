// Activity outside sessions (v2 N7.4): every row of the activity table, with
// its caps, once-per-day / once-per-week rules and day boundaries.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as ops from '../items/ops';
import { habit, sess, state } from '../testkit';
import { dkey } from '../time';
import * as B from './balance';
import { DAY_ACTIVITY_XP_MAX, DAY_SESSION_XP_MAX, DeriveInput, deriveGameState } from './derive';
import { bountyWeeksOf, gameStateOf, goalDaysOf } from './fromData';
import { fixedTz } from './tz';

const UTC = fixedTz(0);
const D0 = Date.UTC(2026, 8, 1); // Tuesday
const H = 3600_000;
const DAY = 24 * H;
const started = ops.startQuest({ items: [], links: [] }, D0 - DAY);

const derive = (q: ops.QuestSlice, extra: Partial<DeriveInput> = {}) =>
  deriveGameState({ sessions: [], habits: [{ id: 'h1', weeklyTargetMin: 300 }], items: q.items, links: q.links, now: D0 + 30 * DAY, tz: UTC, ...extra });

/** `n` weak points done outside any session, one an hour from `at`. */
function doneOutside(q: ops.QuestSlice, n: number, at: number, prefix = 't') {
  for (let i = 0; i < n; i++) {
    q = ops.addTask(q, 'h1', `wp ${i}`, at - DAY, `${prefix}${i}`);
    q = ops.setTaskStatus(q, `${prefix}${i}`, 'done', at + i * H);
  }
  return q;
}

test('the non-session day cap is 10% of what a day of sessions can earn', () => {
  assert.equal(DAY_SESSION_XP_MAX, 300);
  assert.equal(DAY_ACTIVITY_XP_MAX, 30);
});

test('a weak point done outside a session: +5 XP, at most 5 a day', () => {
  const g = derive(doneOutside(started, 7, D0 + 8 * H));
  assert.equal(g.activity.outsideTaskXp, 5 * B.OUTSIDE_TASK_XP);
  assert.equal(g.xp.total, 25);
  // The next day starts again (UTC+0), and a UTC+5 zone moves 20:00 UTC into the next local day.
  const late = doneOutside(doneOutside(started, 5, D0 + 8 * H, 'a'), 1, D0 + 20 * H, 'b');
  assert.equal(derive(late).activity.outsideTaskXp, 25);
  assert.equal(derive(late, { tz: fixedTz(300) }).activity.outsideTaskXp, 30);
});

test('a weak point completed in a session pays through its chest, not twice', () => {
  const s = sess('s1', 'h1', D0 + 9 * H, 30);
  let q = ops.addTask(started, 'h1', 'wp', D0, 'w1');
  q = ops.claimChest(q, { sessionId: 's1', habitId: 'h1', doneTaskIds: ['w1'], text: '', now: D0 + 10 * H });
  const g = derive(q, { sessions: [s] });
  assert.equal(g.activity.outsideTaskXp, 0);
  assert.equal(g.sessions[0].completedTasks, 1);
});

test('only on the journey: a weak point done before it started earns nothing', () => {
  assert.equal(derive(doneOutside(started, 2, D0 - 3 * DAY)).activity.outsideTaskXp, 0);
});

test('deleting a weak point done outside a session removes its XP (like deleting a session)', () => {
  const q = doneOutside(started, 2, D0 + 8 * H);
  assert.equal(derive(q).xp.total, 10);
  assert.equal(derive(ops.deleteTask(q, 't0')).xp.total, 5);
});

test('quick logs and outside weak points share the 30 XP day cap', () => {
  let q = doneOutside(started, 5, D0 + 8 * H); // 25
  for (let i = 0; i < 3; i++) q = ops.addQuickLog(q, { habitId: 'h1', text: 'x', now: D0 + (14 + i) * H }, `q${i}`); // 9
  const g = derive(q);
  assert.equal(g.activity.outsideTaskXp + g.activity.quickLogXp, DAY_ACTIVITY_XP_MAX);
  assert.deepEqual([g.activity.outsideTaskXp, g.activity.quickLogXp], [25, 5], 'in time order: the last quick log gets what is left');
});

test('a completed day plan: +5 credits once per day, on the journey only', () => {
  const g = derive(started, { goalDays: ['2026-09-01', '2026-09-01', '2026-09-02', '2026-08-20'] });
  assert.equal(g.activity.goalDays, 2);
  assert.equal(g.credits.earned, 2 * B.GOAL_DAY_CREDITS);
  assert.equal(g.xp.total, 0, 'credits only');
});

test('every weekly target met: +40 credits and +60 XP once per week', () => {
  const g = derive(started, { bountyWeeks: ['2026-08-31', '2026-08-31', '2026-09-07', '2026-08-17'] });
  assert.equal(g.activity.bounties, 2, 'the week the journey started counts; an older one does not');
  assert.equal(g.credits.earned, 2 * B.BOUNTY_CREDITS);
  assert.equal(g.xp.total, 2 * B.BOUNTY_XP);
});

test('before the journey: no activity rewards at all', () => {
  const g = deriveGameState({ sessions: [], habits: [], items: [], links: [], now: D0, tz: UTC, goalDays: ['2026-09-01'], bountyWeeks: ['2026-08-31'] });
  assert.deepEqual([g.activity.xp, g.activity.credits], [0, 0]);
});

// ---- from the app's data ----

const NOW = new Date(2026, 8, 16, 18).getTime();
const today = dkey(new Date(NOW));

test('goal days: logged days whose plan was all done, and today once its plan is done', () => {
  const h = habit('h1', 30, 5);
  const logs = [
    { id: '2026-09-14', capacityMin: 60, plannedMin: 30, actualMin: 30, items: [{ habitId: 'h1', projectId: 'p1', shareMin: 30 }], doneCount: 1 },
    { id: '2026-09-15', capacityMin: 60, plannedMin: 30, actualMin: 5, items: [{ habitId: 'h1', projectId: 'p1', shareMin: 30 }], doneCount: 0 },
    { id: '2026-09-13', capacityMin: 60, plannedMin: 0, actualMin: 0, items: [], doneCount: 0 },
  ];
  const quiet = state([h], [], { dailyLogs: logs });
  assert.deepEqual(goalDaysOf(quiet, today), ['2026-09-14']);
  // The planner gives the habit its share of today's capacity (110 min here): two hours completes it.
  const part = state([h], [sess('s1', 'h1', new Date(2026, 8, 16, 9).getTime(), 30)], { dailyLogs: logs });
  assert.deepEqual(goalDaysOf(part, today), ['2026-09-14'], 'half a plan is not a completed day');
  const done = state([h], [sess('s1', 'h1', new Date(2026, 8, 16, 9).getTime(), 120)], { dailyLogs: logs });
  assert.deepEqual(goalDaysOf(done, today), ['2026-09-14', today]);
});

test('the game follows a check-off: marking today done changes it (the memo reads marks)', () => {
  const check = habit('c1', 0, 0, { kind: 'daily' }, { kind: 'check' });
  const base = state([check], [], { items: ops.startQuest({ items: [], links: [] }, NOW - 5 * DAY).items });
  const before = gameStateOf(base, NOW);
  const marked = { ...base, marks: [{ id: 'm1', habitId: 'c1', day: today }] };
  const after = gameStateOf(marked, NOW);
  assert.notEqual(after, before);
  assert.equal(after.credits.earned - before.credits.earned, B.GOAL_DAY_CREDITS);
});

test('bounty weeks: every active project with a target met, archived ones aside', () => {
  const h1 = habit('h1', 30, 5);
  const h2 = habit('h2', 30, 5, { kind: 'daily' }, { projectId: 'p2' });
  const mon = new Date(2026, 8, 14, 9).getTime();
  const projects = [
    { id: 'p1', name: 'A', weeklyTarget: 2, started: 0 },
    { id: 'p2', name: 'B', weeklyTarget: 1, started: 0 },
  ];
  const both = state([h1, h2], [sess('a', 'h1', mon, 120), sess('b', 'h2', mon + DAY, 60)], { projects });
  assert.deepEqual(bountyWeeksOf(both), ['2026-09-14']);
  const short = state([h1, h2], [sess('a', 'h1', mon, 120), sess('b', 'h2', mon + DAY, 59)], { projects });
  assert.deepEqual(bountyWeeksOf(short), []);
  const archived = state([h1, h2], [sess('a', 'h1', mon, 120)], { projects: [projects[0], { ...projects[1], archivedAt: 1 }] });
  assert.deepEqual(bountyWeeksOf(archived), ['2026-09-14']);
  assert.deepEqual(bountyWeeksOf(state([h1], [sess('a', 'h1', mon, 500)], { projects: [{ ...projects[0], weeklyTarget: 0 }] })), [], 'no targets: no bounty');
});
