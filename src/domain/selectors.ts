// Memoized views of the data, shared by every component that shows them.
// Each remembers its last result, so a screen, a sheet and a watcher reading
// the same thing in one render compute it once, and switching tabs doesn't
// recompute what hasn't changed. The functions they wrap stay pure.

import { planFor } from './dailyLog';
import { selectToday, TodayItem, TodayModel } from './day';
import { selectProjectsView } from './projectsView';
import { badgeCollection, projectTotals, weeklyByProject } from './stats';
import { streakV5 } from './streaks';
import { PersistedState, Session } from './types';

const HOUR_MS = 3_600_000;

/**
 * Remember the last call: when every key (compared by identity) matches,
 * the previous result comes back. `keys` defaults to the arguments.
 */
export function memoLast<A extends unknown[], R>(fn: (...args: A) => R, keys: (...args: A) => unknown[] = (...args) => args): (...args: A) => R {
  let lastKeys: unknown[] | null = null;
  let last: R;
  return (...args) => {
    const k = keys(...args);
    if (lastKeys && lastKeys.length === k.length && lastKeys.every((v, i) => Object.is(v, k[i]))) return last;
    last = fn(...args);
    lastKeys = k;
    return last;
  };
}

/** Today's plan and progress. */
export const todayOf = memoLast((data: PersistedState, now: number) => selectToday(data, now));

export interface TodayLists {
  /** Planned and not done yet (the reorderable list). */
  pending: TodayItem[];
  done: TodayItem[];
  /** Extra habits shown under the plan. */
  bonus: TodayItem[];
  /** What the summary card lists once the day is complete. */
  summary: TodayItem[];
}

/** Today's items split the way the Today screen lists them. */
export const todayListsOf = memoLast((model: TodayModel): TodayLists => ({
  pending: model.items.filter((i) => !i.done && !i.running),
  done: model.items.filter((i) => i.done && !i.running),
  bonus: model.bonus.filter((b) => !b.running && !(model.complete && b.done)),
  summary: [...model.items, ...model.bonus.filter((b) => b.done)],
}));

/** The day streak (v5 rules) as of `day`. */
export const dayStreakOf = memoLast((data: PersistedState, day: string) =>
  streakV5(data, day, data.streakCarry, planFor(data, day).items.length === 0)
);

export const projectsViewOf = memoLast((data: PersistedState, now: number) => selectProjectsView(data, now));

/** Weekly minutes per project; refreshed hourly (and on data changes). */
export const weeklyByProjectOf = memoLast(
  (data: PersistedState, now: number) => weeklyByProject(data, now),
  (data, now) => [data, Math.floor(now / HOUR_MS)]
);

export const projectTotalsOf = memoLast((data: PersistedState) => projectTotals(data));

export const badgeCollectionOf = memoLast((data: PersistedState) => badgeCollection(data));

/** The latest sessions since history was cleared, newest first. */
export const recentSessionsOf = memoLast(
  (sessions: Session[], clearedAt: number, limit: number) =>
    sessions
      .filter((s) => s.end > clearedAt)
      .sort((a, b) => b.start - a.start)
      .slice(0, limit)
);
