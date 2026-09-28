// The redesign, end to end on realistic old data: nine daily habits with
// timer lengths from 3 to 90 minutes, five months of history with an
// unbroken streak, a running timer, notes and manual logs, saved in the exact
// v3 shape an old version wrote (and once more via a v4 save).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { selectToday } from './day';
import { withLooks } from './look';
import { hydrate, persistedSlice } from './migrations';
import { qualifiedBadges } from './milestones';
import { seed } from './seed';
import { dailyStreak, streakV5 } from './streaks';
import { isUntouchedSeed } from './sync';
import { addDays, dkey } from './time';
import { PersistedState } from './types';

// Wednesday Sep 30, 2026, 08:00.
const NOW = new Date(2026, 8, 30, 8, 0).getTime();
const LENGTHS: [string, number][] = [
  ['Coding', 60],
  ['LeetCode', 30],
  ['Reading', 20],
  ['Portfolio', 45],
  ['Gym', 90],
  ['Meditate', 10],
  ['Walk', 25],
  ['Guitar', 15],
  ['Flashcards', 3],
];
const STREAK_DAYS = 150;

/** What the previous version saved: schema 3, no frequency, minimum or plans. */
function oldSave() {
  const habits = LENGTHS.map(([name, min], i) => ({
    id: 'h' + i,
    projectId: i < 5 ? 'p1' : 'p2',
    name,
    icon: 'book',
    tile: '#E4E0F7',
    dailyTargetMin: min,
    weeklyTargetMin: min * 5,
    updatedAt: 1_700_000_000_000 + i,
  }));
  const sessions: any[] = [];
  const today = new Date(NOW);
  for (let back = STREAK_DAYS; back >= 1; back--) {
    const day = addDays(today, -back);
    // Two or three habits a day, rotating; a different length each time.
    for (let j = 0; j < 2 + (back % 2); j++) {
      const h = habits[(back + j * 3) % habits.length];
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 7 + j * 4, 15).getTime();
      const minutes = 5 + ((back * 7 + j * 11) % 50);
      sessions.push({
        id: `s${back}-${j}`,
        habitId: h.id,
        start,
        end: start + minutes * 60_000,
        duration: minutes * 60,
        ...(back % 17 === 0 ? { notes: 'felt good' } : {}),
        ...(back % 23 === 0 ? { manual: true } : {}),
        updatedAt: 1_700_000_000_000,
      });
    }
  }
  return {
    schemaVersion: 3,
    projects: [
      { id: 'p1', name: 'Become ML Engineer', weeklyTarget: 12, started: sessions[0].start, updatedAt: 1_700_000_000_000 },
      { id: 'p2', name: 'Health', weeklyTarget: 5, started: sessions[0].start, updatedAt: 1_700_000_000_000 },
    ],
    habits,
    sessions,
    active: { habitId: 'h2', startedAt: NOW - 4 * 60_000, baseSec: 0, updatedAt: NOW - 4 * 60_000 },
    historyClearedAt: 1_700_000_000_500,
  };
}

function upgraded(): { old: ReturnType<typeof oldSave>; data: PersistedState } {
  const old = oldSave();
  return { old, data: hydrate({ v3: JSON.stringify(old), v2: null }, NOW) };
}

const streakOf = (d: PersistedState, now: number) => streakV5(d, dkey(new Date(now)), d.streakCarry);

test('upgrade: loads with nothing lost', () => {
  const { old, data } = upgraded();
  assert.equal(data.schemaVersion, 5);
  assert.deepEqual(data.projects, old.projects);
  assert.deepEqual(data.sessions, old.sessions, 'every session, note and manual flag kept as is');
  assert.deepEqual(data.active, old.active, 'the running timer keeps running');
  assert.equal(data.historyClearedAt, old.historyClearedAt);
  assert.equal(data.habits.length, 9);
  for (const [i, h] of data.habits.entries()) {
    const { frequency, minTargetMin, kind, ...rest } = h;
    assert.equal(kind, 'timed', 'every existing habit is timed');
    assert.deepEqual(rest, old.habits[i], `${h.name}: old fields unchanged`);
    assert.deepEqual(frequency, { kind: 'daily' }, 'daily habits stay every day');
    assert.equal(minTargetMin, Math.min(5, old.habits[i].dailyTargetMin));
  }
  assert.equal(isUntouchedSeed(data, seed(NOW)), false, 'real data is never mistaken for the sample');
});

test('upgrade: the long streak is kept, never lower under the new rules', () => {
  const { old, data } = upgraded();
  const oldMap: Record<string, number> = {};
  for (const s of old.sessions) oldMap[dkey(new Date(s.start))] = (oldMap[dkey(new Date(s.start))] || 0) + s.duration;
  const before = dailyStreak(oldMap, NOW);
  assert.equal(before.current, STREAK_DAYS);
  assert.ok(data.streakCarry && data.streakCarry.current >= STREAK_DAYS);
  const s = streakOf(data, NOW);
  assert.ok(s.current >= STREAK_DAYS, `${s.current}`);
  assert.ok(s.longest >= STREAK_DAYS);
  // Doing anything today adds a day.
  const later = NOW + 3600_000;
  const done = { ...data, sessions: [...data.sessions, { id: 'today', habitId: 'h1', start: NOW + 60_000, end: NOW + 20 * 60_000, duration: 19 * 60 }] };
  assert.equal(streakOf(done, later).current, s.current + 1);
});

test('upgrade: projects get distinct colors, icons and scenes; habits become timed', () => {
  const { data } = upgraded();
  const looked = withLooks(data);
  const colors = looked.projects.map((p) => p.color);
  assert.equal(new Set(colors).size, colors.length);
  assert.ok(looked.projects.every((p) => p.icon && p.scene));
  assert.ok(data.habits.every((h) => h.kind === 'timed'));
  assert.equal(data.rebalancePending, false, 'the welcome flow replaces the old screen');
});

test("upgrade: today's plan follows the weekly targets; the check never shows at the start", () => {
  const { data } = upgraded();
  const t = selectToday(data, NOW);
  assert.ok(t.items.length > 0);
  assert.equal(t.complete, false);
  assert.ok(t.active, 'the running timer shows as the active session');
  assert.equal(t.active!.habitId, 'h2');
  assert.ok(t.plannedMin > 0);
});

test('upgrade: milestones already reached are recorded quietly, not celebrated', () => {
  const { data } = upgraded();
  assert.equal(data.badgesPrimed, false);
  const ids = qualifiedBadges(data, streakOf(data, NOW).current, NOW);
  assert.ok(ids.includes('first-session') && ids.includes('streak-100'));
});

test('upgrade: saved and loaded again, nothing changes and nothing migrates twice', () => {
  const { data } = upgraded();
  const again = hydrate({ v3: JSON.stringify(persistedSlice(data)), v2: null }, NOW + 60_000);
  assert.deepEqual(again, persistedSlice(data));
});

test('upgrade from a v4 save: the streak that build showed is the floor', () => {
  // The same history, saved by a v4 build ten days ago with a big carry.
  const saved = { ...oldSave(), schemaVersion: 4, streakCarry: { current: 400, longest: 400, day: dkey(addDays(new Date(NOW), -1)) }, plans: {}, planSince: dkey(addDays(new Date(NOW), -1)), rebalancePending: false };
  saved.habits = saved.habits.map((h: any) => ({ ...h, frequency: { kind: 'daily' }, minTargetMin: 5 }));
  const r = hydrate({ v3: JSON.stringify(saved), v2: null }, NOW);
  assert.ok(streakOf(r, NOW).current >= 400);
});
