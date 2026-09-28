// Memoized views of the data, shared by every component that shows them.
// Each remembers its last result, so a screen, a sheet and a watcher reading
// the same thing in one render compute it once, and switching tabs doesn't
// recompute what hasn't changed. The functions they wrap stay pure.

import { planFor } from './dailyLog';
import { selectToday, TodayItem, TodayModel } from './day';
import { selectProjectsView } from './projectsView';
import { badgeCollection, chart, dayIndex, focusHours, Period, projectProgress, QUARTER_HOUR_MS, records, thisWeek } from './stats';
import { streakV5 } from './streaks';
import { dkey, weekStartDay } from './time';
import { PersistedState } from './types';

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

// ---------- Stats ----------
// Keyed on the slices each view reads (never on `data` itself, which changes
// identity when a timer starts or pauses) and on a clock bucket: the day, or a
// quarter hour for views that compare with "the same moment last week" (and
// the week start, a global read at call time). So a running timer elsewhere
// and the store's 15s tick recompute nothing.

const day = (now: number) => dkey(new Date(now));
const quarter = (now: number) => Math.floor(now / QUARTER_HOUR_MS);

/** Seconds per project per day: the index the stats views share. */
export const dayIndexOf = memoLast((data: PersistedState) => dayIndex(data), (data) => [data.sessions, data.habits]);

export const thisWeekOf = memoLast(
  (data: PersistedState, now: number) => thisWeek(data, now, dayIndexOf(data)),
  (data, now) => [data.sessions, data.habits, data.projects, quarter(now), weekStartDay()]
);

export const projectProgressOf = memoLast(
  (data: PersistedState, now: number) => projectProgress(data, now, dayIndexOf(data)),
  (data, now) => [data.sessions, data.habits, data.projects, quarter(now), weekStartDay()]
);

export const chartOf = memoLast(
  (data: PersistedState, now: number, period: Period, offset: number) => chart(data, now, period, offset, dayIndexOf(data)),
  (data, now, period, offset) => [data.sessions, data.habits, data.projects, data.prefs, data.dailyLogs, data.days, day(now), period, offset, weekStartDay()]
);

export const focusHoursOf = memoLast(
  (data: PersistedState, now: number) => focusHours(data, now),
  (data, now) => [data.sessions, data.habits, day(now), weekStartDay()]
);

export const recordsOf = memoLast(
  (data: PersistedState, now: number) => records(data, now, dayIndexOf(data)),
  (data, now) => [data.sessions, data.habits, day(now)]
);

export const badgeCollectionOf = memoLast((data: PersistedState) => badgeCollection(data), (data) => [data.badges, data.projects]);
