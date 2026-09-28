import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_CONFIG } from './config';
import { recommendedHabitId, selectProjects, selectStats, selectToday } from './engine';
import { activeHabits, activeProjects, archivedProjects, isArchived } from './projects';
import { Habit, PersistedState } from './types';

const NOW = new Date(2026, 8, 16, 12, 0).getTime(); // Wed Sep 16
const at = (d: number, h = 9) => new Date(2026, 8, d, h, 0).getTime();

const habit = (id: string, projectId: string): Habit => ({
  id,
  projectId,
  name: id,
  icon: 'code',
  tile: '#fff',
  dailyTargetMin: 30,
  weeklyTargetMin: 150,
});

function data(): PersistedState {
  return {
    schemaVersion: 3,
    projects: [
      { id: 'p1', name: 'Active A', weeklyTarget: 8, started: at(1) },
      { id: 'p2', name: 'Old', weeklyTarget: 10, started: at(1), archivedAt: at(10) },
      { id: 'p3', name: 'Active B', weeklyTarget: 4, started: at(1) },
      { id: 'p4', name: 'Older', weeklyTarget: 2, started: at(1), archivedAt: at(5) },
    ],
    habits: [habit('h1', 'p1'), habit('h2', 'p2'), habit('h3', 'p3'), habit('h4', 'p4')],
    sessions: [
      { id: 'a', habitId: 'h1', start: at(14), end: at(14) + 3600_000, duration: 3600 },
      { id: 'b', habitId: 'h2', start: at(14), end: at(14) + 7200_000, duration: 7200 },
      { id: 'c', habitId: 'h3', start: at(15), end: at(15) + 1800_000, duration: 1800 },
    ],
    active: null,
    historyClearedAt: 0,
  };
}

test('archive helpers', () => {
  const d = data();
  assert.deepEqual(activeProjects(d).map((p) => p.id), ['p1', 'p3']);
  assert.deepEqual(archivedProjects(d).map((p) => p.id), ['p2', 'p4'], 'most recently archived first');
  assert.deepEqual(activeHabits(d).map((h) => h.id), ['h1', 'h3']);
  assert.equal(isArchived({ id: 'x', name: 'x', weeklyTarget: 1 }), false, 'absent = active (older data)');
  assert.equal(isArchived({ id: 'x', name: 'x', weeklyTarget: 1, archivedAt: null }), false);
});

test('archived projects leave Today, its pace sums and Up next', () => {
  const t = selectToday(data(), DEFAULT_CONFIG, NOW);
  assert.deepEqual(t.groups.map((g) => g.projectId), ['p1', 'p3']);
  assert.ok(t.summary);
  // 1h + 30m against 8h + 4h; the archived 2h and 10h target are left out.
  assert.equal(t.summary!.weekLabel, '1.5h / 12h this week');
  const rec = recommendedHabitId(data(), DEFAULT_CONFIG, NOW);
  assert.ok(rec === 'h1' || rec === 'h3');

  // Everything archived: Today shows its empty state.
  const all = data();
  all.projects = all.projects.map((p) => ({ ...p, archivedAt: at(15) }));
  const empty = selectToday(all, DEFAULT_CONFIG, NOW);
  assert.equal(empty.groups.length, 0);
  assert.equal(empty.noHabits, true);
  assert.equal(empty.summary, null);
  assert.equal(recommendedHabitId(all, DEFAULT_CONFIG, NOW), null);
});

test('Projects lists archived projects separately; header counts active ones', () => {
  const m = selectProjects(data(), DEFAULT_CONFIG, NOW);
  assert.deepEqual(m.cards.map((c) => c.projectId), ['p1', 'p3']);
  assert.equal(m.sub, '2 projects · 2 habits');
  assert.deepEqual(
    m.archived.map((a) => [a.projectId, a.sub]),
    [
      ['p2', '2h lifetime · archived Sep 2026'],
      ['p4', '0m lifetime · archived Sep 2026'],
    ]
  );
});

test('archived history still counts in Stats lifetime and Time by project', () => {
  const s = selectStats(data(), DEFAULT_CONFIG, NOW, { heatSel: null });
  assert.equal(s.lifetimeLabel, '3.5 hours');
  assert.equal(s.weekHours, '3.5h');
  const old = s.projDist.find((d) => d.name.startsWith('Old'));
  assert.ok(old);
  assert.equal(old!.name, 'Old (archived)');
  assert.match(old!.label, /^57% · 2h$/);
});

test('a timer running on an archived project keeps that project on Today, outside the summary', () => {
  const d = { ...data(), active: { habitId: 'h2', startedAt: NOW - 60_000, baseSec: 0 } };
  const t = selectToday(d, DEFAULT_CONFIG, NOW);
  assert.deepEqual(t.groups.map((g) => g.projectId), ['p1', 'p2', 'p3']);
  assert.equal(t.groups[1].rows[0].running, true);
  assert.equal(t.summary!.weekLabel, '1.5h / 12h this week');
});
