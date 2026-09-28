// The week view: seven days (Monday to Sunday) and each habit's progress
// toward its weekly target. Past unfinished days are neutral, never failures.

import { ICONS, MONTHS } from './constants';
import { WEEKDAY_LETTERS, weeklyTargetOf } from './frequency';
import { completionOn, habitDaySec, PlanSettings } from './plan';
import { activeHabits } from './projects';
import { dayRecords, habitWeekStreak, planStreak } from './streaks';
import { addDays, dkey, monday, pkey } from './time';
import { PersistedState } from './types';

/**
 * `complete`: a check; `rest`: a moon; `progress`: today, a partial ring;
 * `empty`: a neutral circle (not complete, a free day, or before tracking
 * started); `future`: a fainter circle.
 */
export type WeekCellKind = 'complete' | 'rest' | 'progress' | 'empty' | 'future';

export interface WeekCell {
  key: string;
  letter: string;
  /** Day of the month. */
  date: number;
  kind: WeekCellKind;
  today: boolean;
  /** Today's planned habits done, and planned (for the partial ring). */
  done: number;
  total: number;
  /** Spoken description. */
  label: string;
}

export interface WeekHabitRow {
  habitId: string;
  name: string;
  iconPath: string;
  tile: string;
  done: number;
  target: number;
  /** Consecutive weeks on target, as of this week. */
  streakWeeks: number;
}

export interface WeekModel {
  /** e.g. "Sep 28 – Oct 4". */
  rangeLabel: string;
  cells: WeekCell[];
  habits: WeekHabitRow[];
  /** Main streak (days) as of today, and the longest. */
  streak: number;
  longest: number;
  /** This is the current week (nothing later to page to). */
  isCurrent: boolean;
  /** An earlier week has tracked history to page back to. */
  hasEarlier: boolean;
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The week `offset` weeks back from the current one (0 = this week). */
export function selectWeek(data: PersistedState, settings: PlanSettings, now: number, offset = 0): WeekModel {
  const today = dkey(new Date(now));
  const days = habitDaySec(data, now);
  const records = dayRecords(data, days, today, settings);
  const streak = planStreak(records, today, data.streakCarry);
  const byKey = new Map(records.map((r) => [r.key, r]));
  const mon = addDays(monday(new Date(now)), -7 * Math.max(0, offset));
  const keys = Array.from({ length: 7 }, (_, i) => dkey(addDays(mon, i)));
  const sunday = keys[6];

  const cells: WeekCell[] = keys.map((k, i) => {
    const rec = byKey.get(k);
    const mark = streak.marks.get(k);
    const isToday = k === today;
    let kind: WeekCellKind;
    if (k > today) kind = 'future';
    else if (mark === 'complete') kind = 'complete';
    else if (mark === 'rest') kind = 'rest';
    else if (mark === 'today') kind = 'progress';
    else kind = 'empty';
    const total = rec?.plan?.length ?? 0;
    const done = rec?.done ?? 0;
    const name = WEEKDAY_NAMES[i];
    const label =
      kind === 'complete'
        ? `${name}, complete`
        : kind === 'rest'
          ? `${name}, rest day`
          : kind === 'progress'
            ? `${name}, ${done} of ${total} done`
            : name;
    return { key: k, letter: WEEKDAY_LETTERS[i], date: pkey(k).getDate(), kind, today: isToday, done, total, label };
  });

  // Habits as of that week: the weekly counts only include days up to today.
  const until = sunday < today ? sunday : today;
  const habits: WeekHabitRow[] = activeHabits(data).map((h) => {
    let done = 0;
    for (const k of keys) if (k <= until && completionOn(h, days, k)) done++;
    return {
      habitId: h.id,
      name: h.name,
      iconPath: ICONS[h.icon] || ICONS.code,
      tile: h.tile,
      done,
      target: weeklyTargetOf(h.frequency),
      streakWeeks: habitWeekStreak(h, days, until),
    };
  });

  const end = pkey(sunday);
  const m = (d: Date) => MONTHS[d.getMonth()].slice(0, 3);
  const rangeLabel =
    mon.getMonth() === end.getMonth()
      ? `${m(mon)} ${mon.getDate()} – ${end.getDate()}`
      : `${m(mon)} ${mon.getDate()} – ${m(end)} ${end.getDate()}`;

  return {
    rangeLabel,
    cells,
    habits,
    streak: streak.current,
    longest: streak.longest,
    isCurrent: offset <= 0,
    hasEarlier: records.length > 0 && records[0].key < keys[0],
  };
}
