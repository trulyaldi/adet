import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDailyLog, missingLogs, planFor } from './dailyLog';
import { addMark } from './marks';
import { habit, sess, state } from './testkit';

const at = (d: number, h = 9) => new Date(2026, 8, d, h).getTime();

test("a finished day's log records plan vs actual and what got done", () => {
  const d = addMark(state([habit('a', 60, 5), habit('b', 30, 5)], [sess('s1', 'a', at(28), 45)], { projects: [{ id: 'p1', name: 'P', weeklyTarget: 19, started: 0 }] }), 'b', '2026-09-28');
  const log = buildDailyLog(d, '2026-09-28');
  assert.equal(log.id, '2026-09-28');
  assert.equal(log.capacityMin, 180);
  assert.equal(log.plannedMin, 180);
  assert.equal(log.actualMin, 45);
  assert.equal(log.doneCount, 1, 'b was marked done; a (45 of 120) was not');
});

test('logs are written once per finished day since the update, at most two weeks back', () => {
  const d = state([habit('a', 60, 5)], [], { planSince: '2026-09-20' });
  const logs = missingLogs(d, '2026-09-28', d.planSince);
  assert.deepEqual(logs.map((l) => l.id), ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  assert.deepEqual(missingLogs({ ...d, dailyLogs: logs }, '2026-09-28', d.planSince), []);
});

test("the day's edits (level, aside) shape its plan", () => {
  const d = state([habit('a', 60, 5)], [], { days: { '2026-09-28': { level: 'light', aside: [] } }, projects: [{ id: 'p1', name: 'P', weeklyTarget: 19, started: 0 }] });
  assert.equal(planFor(d, '2026-09-28').capacityMin, 90);
});
