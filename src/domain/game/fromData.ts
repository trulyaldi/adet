// The game from the app's data: input building and memoised state, keyed like
// the other selectors (the slices it reads plus a clock bucket), so a running
// timer or the store's tick recomputes nothing.

import { daySecByHabit, itemDone, planFor } from '../dailyLog';
import { claimChest, QuestSlice } from '../items/ops';
import { markIndex } from '../marks';
import { activeHabits, isArchived } from '../projects';
import { memoLast } from '../selectors';
import { dkey, monday } from '../time';
import type { PersistedState } from '../types';
import { FRESH_CHEST_MS } from './balance';
import { DeriveInput, deriveGameState, GameState } from './derive';


/**
 * Days whose plan was completed (the Today ring full): finished days from
 * their once-a-day log, and `today` from its live plan. A day the app never
 * logged earns nothing (the log is how a past day is judged elsewhere too).
 */
export function goalDaysOf(data: PersistedState, today: string): string[] {
  const out = new Set<string>();
  for (const l of data.dailyLogs) if (l.id < today && l.items.length > 0 && l.doneCount >= l.items.length) out.add(l.id);
  const plan = planFor(data, today);
  if (plan.items.length) {
    const secs = daySecByHabit(data, today);
    const idx = markIndex(data.marks);
    if (plan.items.every((it) => itemDone(data, idx, it, today, secs.get(it.habitId) || 0))) out.add(today);
  }
  return [...out].sort();
}

/**
 * Weeks (their first day) in which every active project with a weekly target
 * met it, as the Stats hero judges "all met": time by session start, against
 * the projects' current targets.
 */
export function bountyWeeksOf(data: PersistedState): string[] {
  const targets = data.projects.filter((p) => !isArchived(p) && p.weeklyTarget > 0);
  if (!targets.length) return [];
  const habitProject = new Map(data.habits.map((h) => [h.id, h.projectId]));
  const perWeek = new Map<string, Map<string, number>>();
  for (const s of data.sessions) {
    const pid = habitProject.get(s.habitId);
    if (!pid || !(s.duration > 0)) continue;
    const w = dkey(monday(new Date(s.start)));
    let m = perWeek.get(w);
    if (!m) perWeek.set(w, (m = new Map()));
    m.set(pid, (m.get(pid) || 0) + s.duration);
  }
  const out: string[] = [];
  for (const [w, m] of perWeek) if (targets.every((p) => (m.get(p.id) || 0) >= p.weeklyTarget * 3600)) out.push(w);
  return out.sort();
}

export function gameInput(data: PersistedState, now: number, quest?: QuestSlice, today?: string): DeriveInput {
  return {
    sessions: data.sessions,
    habits: data.habits,
    items: quest?.items ?? data.items,
    links: quest?.links ?? data.links,
    now,
    weeklyTargetMin: activeHabits(data).reduce((a, h) => a + (h.weeklyTargetMin || 0), 0),
    goalDays: today ? goalDaysOf(data, today) : [],
    bountyWeeks: bountyWeeksOf(data),
  };
}

/**
 * The game, memoised on the slices it reads and the local day (never the
 * clock itself), so a ticking store or a timer starting elsewhere recomputes
 * nothing. Only today's plan (a completed day earns credits) and chest
 * freshness depend on time; freshness is worked out separately by
 * hasFreshChest (the `fresh` flags inside are never set).
 */
export const gameStateOf = memoLast(
  (data: PersistedState, now: number = Date.now()): GameState => deriveGameState(gameInput(data, 0, undefined, dkey(new Date(now)))),
  // The day's plan reads marks, per-day edits, logs and prefs; only the local day of `now` matters.
  (data, now = Date.now()) => [data.sessions, data.habits, data.projects, data.items, data.links, data.marks, data.days, data.dailyLogs, data.prefs, dkey(new Date(now))]
);

/** Unopened chests younger than FRESH_CHEST_MS (the tab badge). */
export function hasFreshChest(game: GameState, now: number): boolean {
  return game.chests.unopened.some((c) => now - c.end < FRESH_CHEST_MS);
}

export interface ClaimPreview {
  before: GameState;
  after: GameState;
  xpGained: number;
  creditsGained: number;
}

/** What opening a chest would do (the Loot sheet counts these up). */
export function previewClaim(
  data: PersistedState,
  now: number,
  claim: { sessionId: string; habitId: string | null; text: string }
): ClaimPreview {
  const before = gameStateOf(data);
  const q = claimChest({ items: data.items, links: data.links }, { ...claim, now });
  const after = deriveGameState(gameInput(data, 0, q, dkey(new Date(now))));
  return {
    before,
    after,
    xpGained: after.xp.total - before.xp.total,
    creditsGained: after.credits.earned - before.credits.earned,
  };
}
