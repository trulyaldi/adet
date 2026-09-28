// Stats as plain data, for the Stats dashboard: this week against its targets,
// time per day/week/month by project, project progress, the best focus hours,
// records and the badge collection. Pure functions of the data and a clock;
// memoized wrappers live in selectors.ts.
//
// Time is bucketed by each session's start (as projectWeekSec does), and only
// finished sessions count: a running timer shows up once it's saved.

import { capacityOn } from './capacity';
import { ICONS } from './constants';
import { ProjectLook, projectLook } from './look';
import { badgeInfo, BadgeInfo, STREAK_MILESTONES } from './milestones';
import { isArchived } from './projects';
import { addDays, dkey, MONTHS_SHORT, monday, weekPos, weekStartDay } from './time';
import { Badge, PersistedState } from './types';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// ---------- the index everything is built from ----------

/** Seconds per project per day (dkey → projectId → seconds). */
export type DayIndex = Map<string, Map<string, number>>;

export function dayIndex(data: Pick<PersistedState, 'sessions' | 'habits'>): DayIndex {
  const habitProject = new Map(data.habits.map((h) => [h.id, h.projectId]));
  const out: DayIndex = new Map();
  for (const s of data.sessions) {
    const pid = habitProject.get(s.habitId);
    if (!pid || !(s.duration > 0)) continue;
    const k = dkey(new Date(s.start));
    let day = out.get(k);
    if (!day) out.set(k, (day = new Map()));
    day.set(pid, (day.get(pid) || 0) + s.duration);
  }
  return out;
}

/** Seconds per project over `n` days from `from`. */
function sumDays(idx: DayIndex, from: Date, n: number): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const day = idx.get(dkey(addDays(from, i)));
    if (day) for (const [pid, sec] of day) out.set(pid, (out.get(pid) || 0) + sec);
  }
  return out;
}

const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

/** Seconds per project from sessions that started in [from, to). */
function sumRange(data: Pick<PersistedState, 'sessions' | 'habits'>, from: number, to: number): Map<string, number> {
  const habitProject = new Map(data.habits.map((h) => [h.id, h.projectId]));
  const out = new Map<string, number>();
  for (const s of data.sessions) {
    if (s.start < from || s.start >= to || !(s.duration > 0)) continue;
    const pid = habitProject.get(s.habitId);
    if (pid) out.set(pid, (out.get(pid) || 0) + s.duration);
  }
  return out;
}

export type Trend = 'up' | 'down' | 'even';

/** Up or down against a comparison; "even" within 10 minutes or 5%. */
export function trendOf(now: number, before: number): Trend {
  const d = now - before;
  if (Math.abs(d) < Math.max(600, before * 0.05)) return 'even';
  return d > 0 ? 'up' : 'down';
}

/** The day letters of a week, from its first day (Monday or Sunday). */
export function dayLetters(): string[] {
  const mon = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return weekStartDay() === 0 ? ['S', ...mon.slice(0, 6)] : mon;
}

// ---------- This week ----------

export interface WeekSlice {
  projectId: string;
  sec: number;
}

export interface DayDot {
  day: string;
  letter: string;
  logged: boolean;
  today: boolean;
  future: boolean;
}

export type HeroMood = 'relaxed' | 'cheering' | 'idle';

export interface ThisWeek {
  totalSec: number;
  /** Combined weekly target of active projects (0 when none has one). */
  targetSec: number;
  /** Time per project this week, in the projects' order (only projects with time). */
  slices: WeekSlice[];
  /** Time by the same moment last week. */
  lastWeekSec: number;
  trend: Trend;
  dots: DayDot[];
  /** Relaxed when every weekly target is met, cheering when ahead of pace, else idle. */
  mood: HeroMood;
}

/**
 * Ahead of pace: at least the even share of the combined target for the days
 * already behind us (so any time on the week's first day counts as ahead).
 */
export function thisWeek(data: PersistedState, now: number, idx: DayIndex = dayIndex(data)): ThisWeek {
  const start = monday(new Date(now));
  const today = dkey(new Date(now));
  const byProject = sumRange(data, start.getTime(), now + 1);
  const last = sumRange(data, start.getTime() - 7 * DAY_MS, now - 7 * DAY_MS + 1);
  const active = data.projects.filter((p) => !isArchived(p));
  const withTarget = active.filter((p) => p.weeklyTarget > 0);
  const targetSec = withTarget.reduce((a, p) => a + p.weeklyTarget * 3600, 0);
  const totalSec = total(byProject);
  const allMet = withTarget.length > 0 && withTarget.every((p) => (byProject.get(p.id) || 0) >= p.weeklyTarget * 3600);
  const elapsed = weekPos(new Date(now)) / 7;
  const ahead = totalSec > 0 && targetSec > 0 && totalSec >= targetSec * elapsed;
  const letters = dayLetters();
  const dots = Array.from({ length: 7 }, (_, i) => {
    const day = dkey(addDays(start, i));
    return { day, letter: letters[i], logged: total(idx.get(day) ?? new Map()) > 0, today: day === today, future: day > today };
  });
  return {
    totalSec,
    targetSec,
    slices: data.projects.map((p) => ({ projectId: p.id, sec: byProject.get(p.id) || 0 })).filter((s) => s.sec > 0),
    lastWeekSec: total(last),
    trend: trendOf(totalSec, total(last)),
    dots,
    mood: allMet ? 'relaxed' : ahead ? 'cheering' : 'idle',
  };
}

// ---------- Daily chart: week, month, year ----------

export type Period = 'week' | 'month' | 'year';

export interface ChartBar {
  key: string;
  /** Under the bar: a day letter, a week's first date, or a month letter. */
  label: string;
  /** In the detail card: "Mon 22 Sep", "22–28 Sep", "September". */
  title: string;
  totalSec: number;
  /** Project slices, most time first. */
  parts: WeekSlice[];
  /** Capacity over the bar's days, or the average bar with no capacity set. */
  lineSec: number;
  current: boolean;
  future: boolean;
}

export interface Chart {
  period: Period;
  offset: number;
  /** "22–28 Sep", "September 2026", "2026". */
  range: string;
  bars: ChartBar[];
  /** What the dashed line shows. */
  line: 'capacity' | 'average' | 'none';
  /** Top of the scale (largest bar or line). */
  maxSec: number;
  /** The bar selected by default: the current day/week/month, else the last one with time. */
  defaultIndex: number;
  /** Something was logged before this period. */
  hasEarlier: boolean;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "22–28 Sep" or "29 Sep – 5 Oct". */
export function rangeLabel(a: Date, b: Date): string {
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
  return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
}

/** A day's capacity in minutes: what that day was logged with once finished, else the plan. */
function dayCapacity(data: PersistedState, logs: Map<string, number>, day: string): number {
  return logs.get(day) ?? capacityOn(data.prefs, day, data.days?.[day]?.level);
}

export function chart(data: PersistedState, now: number, period: Period, offset = 0, idx: DayIndex = dayIndex(data)): Chart {
  const logs = new Map(data.dailyLogs.map((l) => [l.id, l.capacityMin]));
  const today = dkey(new Date(now));
  const nowD = new Date(now);
  // Each bar is a run of days.
  const spans: { key: string; label: string; title: string; from: Date; n: number }[] = [];
  let range = '';
  let first: Date;
  if (period === 'week') {
    first = addDays(monday(nowD), -7 * offset);
    const letters = dayLetters();
    for (let i = 0; i < 7; i++) {
      const d = addDays(first, i);
      spans.push({ key: dkey(d), label: letters[i], title: `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`, from: d, n: 1 });
    }
    range = rangeLabel(first, addDays(first, 6));
  } else if (period === 'month') {
    first = new Date(nowD.getFullYear(), nowD.getMonth() - offset, 1);
    const next = new Date(first.getFullYear(), first.getMonth() + 1, 1);
    // One bar per week of the month, clipped to the month's days.
    for (let d = new Date(first); d < next; ) {
      const wEnd = addDays(monday(d), 7);
      const end = wEnd < next ? wEnd : next;
      const n = Math.round((end.getTime() - d.getTime()) / DAY_MS);
      const last = addDays(d, n - 1);
      spans.push({ key: dkey(d), label: String(d.getDate()), title: n > 1 ? rangeLabel(d, last) : `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`, from: d, n });
      d = end;
    }
    range = `${MONTHS_LONG[first.getMonth()]} ${first.getFullYear()}`;
  } else {
    first = new Date(nowD.getFullYear() - offset, 0, 1);
    for (let m = 0; m < 12; m++) {
      const from = new Date(first.getFullYear(), m, 1);
      const n = Math.round((new Date(first.getFullYear(), m + 1, 1).getTime() - from.getTime()) / DAY_MS);
      spans.push({ key: dkey(from), label: MONTHS_LONG[m][0], title: `${MONTHS_LONG[m]} ${first.getFullYear()}`, from, n });
    }
    range = String(first.getFullYear());
  }

  const bars: ChartBar[] = spans.map((s) => {
    const sums = sumDays(idx, s.from, s.n);
    const lastDay = dkey(addDays(s.from, s.n - 1));
    let capMin = 0;
    for (let i = 0; i < s.n; i++) capMin += dayCapacity(data, logs, dkey(addDays(s.from, i)));
    return {
      key: s.key,
      label: s.label,
      title: s.title,
      totalSec: total(sums),
      parts: [...sums].map(([projectId, sec]) => ({ projectId, sec })).sort((a, b) => b.sec - a.sec),
      lineSec: capMin * 60,
      current: s.key <= today && today <= lastDay,
      future: s.key > today,
    };
  });

  let line: Chart['line'] = 'capacity';
  if (bars.every((b) => b.lineSec === 0)) {
    const withTime = bars.filter((b) => b.totalSec > 0);
    const avg = withTime.length ? withTime.reduce((a, b) => a + b.totalSec, 0) / withTime.length : 0;
    line = avg > 0 ? 'average' : 'none';
    for (const b of bars) b.lineSec = avg;
  }
  const cur = bars.findIndex((b) => b.current);
  const lastWithTime = bars.map((b) => b.totalSec > 0).lastIndexOf(true);
  const firstDay = [...idx.keys()].sort()[0];
  return {
    period,
    offset,
    range,
    bars,
    line,
    maxSec: Math.max(1, ...bars.map((b) => Math.max(b.totalSec, b.lineSec))),
    defaultIndex: cur >= 0 ? cur : Math.max(0, lastWithTime),
    hasEarlier: !!firstDay && firstDay < dkey(first),
  };
}

// ---------- Project progress ----------

export interface ProjectProgress {
  projectId: string;
  name: string;
  look: ProjectLook;
  iconPath: string;
  weekSec: number;
  /** null without a weekly target. */
  targetSec: number | null;
  /** 0..1+ toward the target (0 without one). */
  frac: number;
  reached: boolean;
  /** Time by the same moment last week, and the trend against it. */
  lastSec: number;
  trend: Trend;
  /** The last four weeks, oldest first (this week last). */
  last4: number[];
  allTimeSec: number;
}

/** Active projects: in progress by percentage, then those without a target, then the ones already reached. */
export function projectProgress(data: PersistedState, now: number, idx: DayIndex = dayIndex(data)): ProjectProgress[] {
  const start = monday(new Date(now));
  const week = sumRange(data, start.getTime(), now + 1);
  const last = sumRange(data, start.getTime() - 7 * DAY_MS, now - 7 * DAY_MS + 1);
  const weeks = [3, 2, 1, 0].map((i) => sumDays(idx, addDays(start, -7 * i), 7));
  const all = new Map<string, number>();
  for (const day of idx.values()) for (const [pid, sec] of day) all.set(pid, (all.get(pid) || 0) + sec);
  const rank = (p: ProjectProgress) => (p.reached ? 2 : p.targetSec === null ? 1 : 0);
  return data.projects
    .filter((p) => !isArchived(p))
    .map((p) => {
      const look = projectLook(p);
      const weekSec = week.get(p.id) || 0;
      const targetSec = p.weeklyTarget > 0 ? p.weeklyTarget * 3600 : null;
      return {
        projectId: p.id,
        name: p.name,
        look,
        iconPath: ICONS[look.icon],
        weekSec,
        targetSec,
        frac: targetSec ? weekSec / targetSec : 0,
        reached: targetSec !== null && weekSec >= targetSec,
        lastSec: last.get(p.id) || 0,
        trend: trendOf(weekSec, last.get(p.id) || 0),
        last4: weeks.map((w) => w.get(p.id) || 0),
        allTimeSec: all.get(p.id) || 0,
      };
    })
    .sort((a, b) => rank(a) - rank(b) || b.frac - a.frac || b.weekSec - a.weekSec);
}

// ---------- Best focus time ----------

export interface FocusHours {
  /** Seconds focused in each hour of the day (0–23) over the window. */
  hours: number[];
  /** Rows by weekday (from the week's first day) × 24 hours. */
  grid: number[][];
  /** Sessions in the window. */
  sessions: number;
  /** The best run of 2–4 consecutive hours ([start, end) in hours, may wrap past midnight). */
  peak: { start: number; end: number; sec: number } | null;
}

export const FOCUS_DAYS = 28;

/** Focused time by hour over the last four weeks (sessions split across the hours they span). */
export function focusHours(data: PersistedState, now: number): FocusHours {
  const habits = new Set(data.habits.map((h) => h.id));
  const today = new Date(now);
  const from = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), -(FOCUS_DAYS - 1)).getTime();
  const hours = Array(24).fill(0);
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  let sessions = 0;
  for (const s of data.sessions) {
    if (s.start < from || s.start > now || !(s.duration > 0) || !habits.has(s.habitId)) continue;
    sessions++;
    const end = s.start + s.duration * 1000;
    for (let t = s.start; t < end; ) {
      const d = new Date(t);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
      const sec = (Math.min(end, next) - t) / 1000;
      hours[d.getHours()] += sec;
      grid[weekPos(d)][d.getHours()] += sec;
      t = next;
    }
  }
  return { hours, grid, sessions, peak: peakWindow(hours) };
}

/**
 * The best focus window: the busiest 2 hours (wrapping past midnight), grown
 * one hour at a time up to 4 while the next busiest neighbor holds at least
 * half the window's hourly average. Ties go to the earlier hour.
 */
export function peakWindow(hours: number[]): FocusHours['peak'] {
  const at = (h: number) => hours[((h % 24) + 24) % 24];
  let best = -1;
  let start = 0;
  for (let h = 0; h < 24; h++) {
    const s = at(h) + at(h + 1);
    if (s > best) {
      best = s;
      start = h;
    }
  }
  if (best <= 0) return null;
  let len = 2;
  let sec = best;
  while (len < 4) {
    const before = at(start - 1);
    const after = at(start + len);
    const add = Math.max(before, after);
    if (add < (sec / len) * 0.5 || add <= 0) break;
    if (after >= before) len++;
    else {
      start = (start + 23) % 24;
      len++;
    }
    sec += add;
  }
  return { start, end: (start + len) % 24, sec };
}

// ---------- Streak milestones ----------

/** The next streak badge not yet earned, and how far the current streak is toward it. */
export function nextStreakMilestone(badges: Badge[], current: number): { value: number; frac: number } | null {
  const have = new Set(badges.map((b) => b.id));
  const value = STREAK_MILESTONES.find((n) => !have.has(`streak-${n}`));
  return value ? { value, frac: Math.min(1, Math.max(0, current / value)) } : null;
}

export interface BadgeView extends BadgeInfo {
  earnedAt: number;
}

/** Earned badges, newest first. */
export function badgeCollection(data: PersistedState): BadgeView[] {
  return data.badges
    .map((b) => {
      const info = badgeInfo(b.id, data);
      return info ? { ...info, earnedAt: b.earnedAt } : null;
    })
    .filter((b): b is BadgeView => !!b)
    .sort((a, b) => b.earnedAt - a.earnedAt);
}

// ---------- Records ----------

export interface Records {
  /** Most time in one day. */
  bestDaySec: number;
  longestSessionSec: number;
  /** Average session length this month (0 with none yet). */
  avgSessionSec: number;
  totalSec: number;
  /** Days with any time logged. */
  daysWithTime: number;
}

export function records(data: PersistedState, now: number, idx: DayIndex = dayIndex(data)): Records {
  const habits = new Set(data.habits.map((h) => h.id));
  const d = new Date(now);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  let bestDaySec = 0;
  let totalSec = 0;
  for (const day of idx.values()) {
    const t = total(day);
    bestDaySec = Math.max(bestDaySec, t);
    totalSec += t;
  }
  let longestSessionSec = 0;
  let monthSec = 0;
  let monthN = 0;
  for (const s of data.sessions) {
    if (!habits.has(s.habitId) || !(s.duration > 0)) continue;
    longestSessionSec = Math.max(longestSessionSec, s.duration);
    if (s.start >= monthStart && s.start <= now) {
      monthSec += s.duration;
      monthN++;
    }
  }
  return { bestDaySec, longestSessionSec, avgSessionSec: monthN ? monthSec / monthN : 0, totalSec, daysWithTime: idx.size };
}

/** Clock bucket for selectors that compare against "the same moment last week". */
export const QUARTER_HOUR_MS = HOUR_MS / 4;
