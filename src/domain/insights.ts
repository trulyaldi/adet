// Patterns in tracked time over the last INSIGHT_WEEKS weeks (the current week
// included): when during the day and week time is tracked, and weekly totals.
// Only finished sessions count, so results don't change while a timer runs.
// Scope is one project, or all projects when projectId is null.

import { MONTHS } from './constants';
import { addDays, dkey, monday } from './time';
import { PersistedState, Session } from './types';

export const INSIGHT_WEEKS = 12;
/** Time-of-day patterns need at least this many sessions in range. */
export const MIN_HEAT_SESSIONS = 5;
/** Trends need tracked time in at least this many weeks. */
export const MIN_TREND_WEEKS = 2;
/** Fewest hour columns the heatmap shows. */
export const MIN_HOUR_SPAN = 8;
/** Most hourly columns before switching to 2-hour blocks. */
export const MAX_HOUR_COLUMNS = 12;

/** Monday (local) that starts the insight range. */
export function rangeStart(now: number): Date {
  return addDays(monday(new Date(now)), -7 * (INSIGHT_WEEKS - 1));
}

/** Finished sessions in scope that start within the insight range. */
function scoped(data: PersistedState, projectId: string | null, now: number): Session[] {
  const from = rangeStart(now).getTime();
  const inScope = new Set(
    data.habits.filter((h) => projectId === null || h.projectId === projectId).map((h) => h.id)
  );
  return data.sessions.filter((s) => inScope.has(s.habitId) && s.start >= from && s.start <= now);
}

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------

/** A heatmap column: hours [start, end). */
export interface HourColumn {
  start: number;
  end: number;
}

export interface TimeOfDay {
  /** Seconds per [weekday Mon=0..Sun=6][hour 0..23]. */
  grid: number[][];
  sessions: number;
  /** At least MIN_HEAT_SESSIONS sessions: show the heatmap and insight. */
  enough: boolean;
  columns: HourColumn[];
  /** Seconds per [weekday][column]. */
  cells: number[][];
  /** Largest cell, for shading. */
  max: number;
  /** e.g. "You track most on weekday mornings, 9–11." Only when enough. */
  insight: string | null;
}

/**
 * Spread a session over the local weekday/hour slots it covers, splitting at
 * hour boundaries (and midnight). Slices are scaled so they add up to the
 * session's duration.
 */
export function addToGrid(grid: number[][], s: Session): void {
  const span = s.end - s.start;
  if (span <= 0) {
    const d = new Date(s.start);
    grid[(d.getDay() + 6) % 7][d.getHours()] += s.duration;
    return;
  }
  const scale = s.duration / (span / 1000);
  let t = s.start;
  while (t < s.end) {
    const d = new Date(t);
    const nextHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
    // Guard against a non-advancing boundary around DST changes.
    const sliceEnd = Math.min(s.end, nextHour > t ? nextHour : t + 3600 * 1000);
    grid[(d.getDay() + 6) % 7][d.getHours()] += ((sliceEnd - t) / 1000) * scale;
    t = sliceEnd;
  }
}

/**
 * Columns to show: the hours that have data, widened evenly to at least
 * MIN_HOUR_SPAN; if that's more than MAX_HOUR_COLUMNS, 2-hour blocks aligned
 * to even hours. Empty grid: no columns.
 */
export function hourColumns(grid: number[][]): HourColumn[] {
  const used = Array.from({ length: 24 }, (_, h) => grid.some((row) => row[h] > 0));
  let lo = used.indexOf(true);
  if (lo < 0) return [];
  let hi = used.lastIndexOf(true);
  while (hi - lo + 1 < MIN_HOUR_SPAN) {
    if (hi < 23) hi++;
    if (hi - lo + 1 < MIN_HOUR_SPAN && lo > 0) lo--;
  }
  if (hi - lo + 1 <= MAX_HOUR_COLUMNS) {
    return Array.from({ length: hi - lo + 1 }, (_, i) => ({ start: lo + i, end: lo + i + 1 }));
  }
  const cols: HourColumn[] = [];
  for (let h = lo - (lo % 2); h <= hi; h += 2) cols.push({ start: h, end: h + 2 });
  return cols;
}

function partOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/** One line naming the busiest 2-hour window, e.g. "You track most on weekday mornings, 9–11." */
export function timeInsight(grid: number[][]): string | null {
  const hourSec = (h: number) => grid.reduce((a, row) => a + row[h], 0);
  let best = -1;
  let bestSec = 0;
  for (let h = 0; h < 23; h++) {
    const sec = hourSec(h) + hourSec(h + 1);
    // On a tie, prefer the window that starts where the time is.
    if (sec > bestSec || (sec === bestSec && sec > 0 && hourSec(h) > hourSec(best))) {
      bestSec = sec;
      best = h;
    }
  }
  if (best < 0) return null;
  const weekday = grid.slice(0, 5).reduce((a, row) => a + row[best] + row[best + 1], 0);
  const part = partOfDay(best);
  const hours = `${best}–${best + 2}`;
  // Weekdays are 5 of 7 days, so they need a clear majority to be named.
  if (weekday / bestSec >= 0.8) return `You track most on weekday ${part}s, ${hours}.`;
  if ((bestSec - weekday) / bestSec >= 0.5) return `You track most on weekend ${part}s, ${hours}.`;
  return part === 'night'
    ? `You track most at night, ${hours}.`
    : `You track most in the ${part}, ${hours}.`;
}

export function timeOfDay(data: PersistedState, projectId: string | null, now: number): TimeOfDay {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const sessions = scoped(data, projectId, now);
  for (const s of sessions) addToGrid(grid, s);
  const enough = sessions.length >= MIN_HEAT_SESSIONS;
  const columns = hourColumns(grid);
  const cells = grid.map((row) =>
    columns.map((c) => row.slice(c.start, c.end).reduce((a, x) => a + x, 0))
  );
  return {
    grid,
    sessions: sessions.length,
    enough,
    columns,
    cells,
    max: Math.max(0, ...cells.flat()),
    insight: enough ? timeInsight(grid) : null,
  };
}

// ---------------------------------------------------------------------------
// Weekly trends
// ---------------------------------------------------------------------------

export interface WeekBar {
  /** dkey of the week's Monday. */
  weekStart: string;
  /** e.g. "Sep 21". */
  label: string;
  sec: number;
  /** Met the project's target; null for all projects or no target. */
  met: boolean | null;
  /** The week in progress. */
  current: boolean;
}

export interface Trends {
  /** Oldest first; the last bar is the current week. */
  bars: WeekBar[];
  /** The project's weekly target; null for all projects or no target. */
  targetSec: number | null;
  /** Largest of the bars and the target, for scaling. */
  max: number;
  weeksWithData: number;
  /** At least MIN_TREND_WEEKS weeks with time: show the chart. */
  enough: boolean;
}

export function weeklyTrends(data: PersistedState, projectId: string | null, now: number): Trends {
  const project = projectId === null ? null : data.projects.find((p) => p.id === projectId);
  const targetSec =
    project && Number.isFinite(project.weeklyTarget) && project.weeklyTarget > 0 ? project.weeklyTarget * 3600 : null;

  const byWeek: Record<string, number> = {};
  for (const s of scoped(data, projectId, now)) {
    const w = dkey(monday(new Date(s.start)));
    byWeek[w] = (byWeek[w] || 0) + s.duration;
  }

  const bars: WeekBar[] = [];
  let w = rangeStart(now);
  for (let i = 0; i < INSIGHT_WEEKS; i++) {
    const k = dkey(w);
    const sec = byWeek[k] || 0;
    bars.push({
      weekStart: k,
      label: MONTHS[w.getMonth()].slice(0, 3) + ' ' + w.getDate(),
      sec,
      met: targetSec === null ? null : sec >= targetSec,
      current: i === INSIGHT_WEEKS - 1,
    });
    w = addDays(w, 7);
  }
  const weeksWithData = bars.filter((b) => b.sec > 0).length;
  return {
    bars,
    targetSec,
    max: Math.max(targetSec ?? 0, ...bars.map((b) => b.sec)),
    weeksWithData,
    enough: weeksWithData >= MIN_TREND_WEEKS,
  };
}
