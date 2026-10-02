// The Trail: per habit, is it rising, steady or resting? Compares this week so
// far with last week to the same moment (as the Stats hero does), from data the
// app already has: sessions, a habit's measure and its skill
// level. Pure; weeks follow the app's week-start setting and local days.

import { skillLevel } from '../game/level';
import { isQuickLog, Item, itemsOfType, metricDefId } from '../items/types';
import { addDays, dkey, monday } from '../time';
import type { Habit, Session } from '../types';
import { RISE_MINUTES, RISE_PER_HOUR, RISE_SIGNALS, SERIES_WEEKS } from './constants';

export type Verdict = 'rising' | 'steady' | 'resting';
/** Why a habit is rising: more time, more per hour, a level gained. */
export type Reason = 'time' | 'perHour' | 'level';

export interface WindowStats {
  /** Focused minutes (every session, by its start). */
  minutes: number;
  /** Sessions of 10+ minutes. */
  sessions: number;
  /** Total of the habit's measure, or null without one. */
  measure: number | null;
  /** Measure per focused hour; null without a measure or without minutes. */
  perHour: number | null;
  /** Skill levels gained within the window. */
  levelsGained: number;
}

export interface HabitProgress {
  habitId: string;
  metric: { id: string; label: string; unit: string } | null;
  thisWeek: WindowStats;
  lastWeek: WindowStats;
  /** Focused minutes per week, oldest first (the last is this week so far). */
  series: { weekStart: string; minutes: number }[];
  verdict: Verdict;
  reasons: Reason[];
  /** Nothing at all in the series: shown as a friendly empty row. */
  empty: boolean;
}

export interface Trail {
  habits: HabitProgress[];
  rising: number;
  steady: number;
  resting: number;
  /** No habit has anything yet. */
  empty: boolean;
}

export interface ProgressInput {
  sessions: readonly Session[];
  /** The habits to show (current ones; a deleted habit's history is left out). */
  habits: readonly Pick<Habit, 'id'>[];
  items: readonly Item[];
  now: number;
  /** Effective minutes per session id (the game's day cap), for skill levels. Default: focused minutes of 10+ minute sessions. */
  effMinutes?: ReadonlyMap<string, number>;
}

const MIN_SESSION_MIN = 10;

function stats(
  habitId: string,
  from: number,
  to: number,
  input: ProgressInput,
  byHabit: Session[],
  metricId: string | null,
  sessionStart: Map<string, number>
): WindowStats {
  let minutes = 0;
  let sessions = 0;
  let before = 0;
  let upTo = 0;
  for (const s of byHabit) {
    const eff = input.effMinutes ? input.effMinutes.get(s.id) ?? 0 : s.duration / 60 >= MIN_SESSION_MIN ? s.duration / 60 : 0;
    if (s.start < from) before += eff;
    if (s.start < to) upTo += eff;
    if (s.start < from || s.start >= to) continue;
    minutes += s.duration / 60;
    if (s.duration / 60 >= MIN_SESSION_MIN) sessions++;
  }
  let measure: number | null = null;
  if (metricId) {
    measure = 0;
    for (const l of itemsOfType(input.items, 'log')) {
      if (l.habitId !== habitId || l.props.metricId !== metricId || l.props.amount === undefined) continue;
      // A session's entry counts when the session did; a quick log when it was written.
      const at = isQuickLog(l) ? l.createdAt : sessionStart.get(l.props.sessionId) ?? l.createdAt;
      if (at >= from && at < to) measure += l.props.amount;
    }
  }
  const perHour = measure !== null && minutes > 0 ? measure / (minutes / 60) : null;
  const levelsGained = skillLevel(Math.round(upTo)).level - skillLevel(Math.round(before)).level;
  return { minutes: Math.round(minutes), sessions, measure, perHour, levelsGained };
}

/** Up by at least `share` (anything is up from nothing). */
const upBy = (cur: number, prev: number, share: number) => cur > prev && (prev <= 0 || cur >= prev * (1 + share));

export function verdictOf(cur: WindowStats, prev: WindowStats): { verdict: Verdict; reasons: Reason[] } {
  const reasons: Reason[] = [];
  if (upBy(cur.minutes, prev.minutes, RISE_MINUTES)) reasons.push('time');
  if (cur.perHour !== null && prev.perHour !== null && upBy(cur.perHour, prev.perHour, RISE_PER_HOUR)) reasons.push('perHour');
  if (cur.levelsGained > 0) reasons.push('level');
  const verdict: Verdict = reasons.length >= RISE_SIGNALS ? 'rising' : cur.minutes < prev.minutes && reasons.length === 0 ? 'resting' : 'steady';
  return { verdict, reasons };
}

export function trailOf(input: ProgressInput): Trail {
  const now = new Date(input.now);
  const weekStart = monday(now);
  const sameMomentLastWeek = addDays(now, -7).getTime() + 1;
  const sessionStart = new Map(input.sessions.map((s) => [s.id, s.start]));
  const metrics = new Map(itemsOfType(input.items, 'metric_def').map((m) => [m.id, m]));
  const habits: HabitProgress[] = input.habits.map((h) => {
    const byHabit = input.sessions.filter((s) => s.habitId === h.id && s.duration > 0);
    const m = metrics.get(metricDefId(h.id));
    const metric = m ? { id: m.id, label: m.props.label, unit: m.props.unit } : null;
    const win = (from: number, to: number) => stats(h.id, from, to, input, byHabit, metric?.id ?? null, sessionStart);
    const thisWeek = win(weekStart.getTime(), input.now + 1);
    const lastWeek = win(addDays(weekStart, -7).getTime(), sameMomentLastWeek);
    const series = Array.from({ length: SERIES_WEEKS }, (_, i) => {
      const start = addDays(weekStart, (i - (SERIES_WEEKS - 1)) * 7);
      const end = i === SERIES_WEEKS - 1 ? input.now + 1 : addDays(start, 7).getTime();
      return { weekStart: dkey(start), minutes: win(start.getTime(), end).minutes };
    });
    const { verdict, reasons } = verdictOf(thisWeek, lastWeek);
    const empty = series.every((w) => w.minutes === 0) && !thisWeek.measure && !lastWeek.measure;
    return { habitId: h.id, metric, thisWeek, lastWeek, series, verdict: empty ? 'steady' : verdict, reasons: empty ? [] : reasons, empty };
  });
  const shown = habits.filter((h) => !h.empty);
  return {
    habits,
    rising: shown.filter((h) => h.verdict === 'rising').length,
    steady: shown.filter((h) => h.verdict === 'steady').length,
    resting: shown.filter((h) => h.verdict === 'resting').length,
    empty: shown.length === 0,
  };
}
