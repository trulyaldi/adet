// Weekly recap: a finished week's hours per project against its target, the
// change from the week before, the best day, and the session count. Computed
// from local data on demand; judged against each project's current target.
// Archived projects count toward totals but have no target.

import { DOWFULL, MONTHS } from './constants';
import { isArchived } from './projects';
import { addDays, dkey, fmtH, monday, pkey } from './time';
import { PersistedState } from './types';

export interface ProjectRecap {
  projectId: string;
  name: string;
  doneSec: number;
  /** null when the project has no usable target. */
  targetSec: number | null;
  /** null without a target. */
  hit: boolean | null;
  /** The same project's time in the week before. */
  prevSec: number;
}

export interface WeekRecap {
  /** dkey of the week's Monday. */
  weekStart: string;
  /** e.g. "Sep 21 – 27" or "Sep 28 – Oct 4". */
  rangeLabel: string;
  projects: ProjectRecap[];
  totalSec: number;
  /** Total time in the week before. */
  prevTotalSec: number;
  /** The day with the most tracked time (earliest on a tie), or null for an empty week. */
  bestDay: { key: string; label: string; sec: number } | null;
  sessions: number;
  hitCount: number;
  /** Projects that have a target. */
  targetCount: number;
}

/** dkey of the Monday that starts the last fully finished week before `now`. */
export function lastCompletedWeekStart(now: number): string {
  return dkey(addDays(monday(new Date(now)), -7));
}

function rangeLabel(start: Date): string {
  const end = addDays(start, 6);
  const m = (d: Date) => MONTHS[d.getMonth()].slice(0, 3);
  return start.getMonth() === end.getMonth()
    ? `${m(start)} ${start.getDate()} – ${end.getDate()}`
    : `${m(start)} ${start.getDate()} – ${m(end)} ${end.getDate()}`;
}

/**
 * Recap of the week starting on Monday `weekStart` (a dkey). Sessions count by
 * the local day they start, like everywhere else; sessions whose habit no
 * longer exists are ignored, and a running timer is not part of a past week.
 */
export function weekRecap(data: PersistedState, weekStart: string): WeekRecap {
  const startD = pkey(weekStart);
  const nextStart = dkey(addDays(startD, 7));
  const prevStart = dkey(addDays(startD, -7));
  const projectOf = new Map(data.habits.map((h) => [h.id, h.projectId]));

  const week: Record<string, number> = {};
  const prev: Record<string, number> = {};
  const days: Record<string, number> = {};
  let totalSec = 0;
  let prevTotalSec = 0;
  let sessions = 0;
  for (const s of data.sessions) {
    const pid = projectOf.get(s.habitId);
    if (pid === undefined) continue;
    const k = dkey(new Date(s.start));
    if (k >= weekStart && k < nextStart) {
      week[pid] = (week[pid] || 0) + s.duration;
      days[k] = (days[k] || 0) + s.duration;
      totalSec += s.duration;
      sessions++;
    } else if (k >= prevStart && k < weekStart) {
      prev[pid] = (prev[pid] || 0) + s.duration;
      prevTotalSec += s.duration;
    }
  }

  // Archived projects have no target here; they're listed only if they have time this week.
  const listed = data.projects.filter((p) => !isArchived(p) || (week[p.id] || 0) > 0);
  const projects: ProjectRecap[] = listed.map((p) => {
    const doneSec = week[p.id] || 0;
    const hasTarget = !isArchived(p) && Number.isFinite(p.weeklyTarget) && p.weeklyTarget > 0;
    const targetSec = hasTarget ? p.weeklyTarget * 3600 : null;
    return {
      projectId: p.id,
      name: p.name,
      doneSec,
      targetSec,
      hit: targetSec === null ? null : doneSec >= targetSec,
      prevSec: prev[p.id] || 0,
    };
  });

  let bestDay: WeekRecap['bestDay'] = null;
  for (const k of Object.keys(days).sort()) {
    if (!bestDay || days[k] > bestDay.sec) {
      bestDay = { key: k, label: DOWFULL[pkey(k).getDay()], sec: days[k] };
    }
  }

  return {
    weekStart,
    rangeLabel: rangeLabel(startD),
    projects,
    totalSec,
    prevTotalSec,
    bestDay,
    sessions,
    hitCount: projects.filter((p) => p.hit === true).length,
    targetCount: projects.filter((p) => p.targetSec !== null).length,
  };
}

/**
 * The recap to offer at launch: the last finished week, unless it was already
 * seen on this device or nothing was tracked in it. After a long gap this is
 * still just the most recent finished week.
 */
export function recapToShow(data: PersistedState, now: number, seenWeek: string | null): WeekRecap | null {
  const weekStart = lastCompletedWeekStart(now);
  if (seenWeek === weekStart) return null;
  const recap = weekRecap(data, weekStart);
  return recap.totalSec > 0 ? recap : null;
}

/** Of the last `count` finished weeks, those with tracked time, newest first. */
export function pastRecaps(data: PersistedState, now: number, count: number): WeekRecap[] {
  const out: WeekRecap[] = [];
  let start = pkey(lastCompletedWeekStart(now));
  for (let i = 0; i < count; i++) {
    const r = weekRecap(data, dkey(start));
    if (r.totalSec > 0) out.push(r);
    start = addDays(start, -7);
  }
  return out;
}

/** "up 2h on the week before" / "down 30m …" / "same as the week before" (under a minute counts as same). */
export function changeLabel(sec: number, prevSec: number): string {
  const d = sec - prevSec;
  if (Math.abs(d) < 60) return 'same as the week before';
  return (d > 0 ? 'up ' : 'down ') + fmtH(Math.abs(d)) + ' on the week before';
}

/**
 * One-line summary, e.g. "Hit 2 of 3 targets · 14.5h tracked · up 2h on the
 * week before". `tracked: false` leaves out the total, for views that show it
 * on its own.
 */
export function recapSummary(r: WeekRecap, opts: { tracked?: boolean } = {}): string {
  const parts: string[] = [];
  if (r.targetCount > 0) {
    parts.push(`Hit ${r.hitCount} of ${r.targetCount} target${r.targetCount === 1 ? '' : 's'}`);
  }
  if (opts.tracked !== false) parts.push(fmtH(r.totalSec) + ' tracked');
  parts.push(changeLabel(r.totalSec, r.prevTotalSec));
  return parts.join(' · ');
}
