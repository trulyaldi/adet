// Weekly pacing: how much of a project's weekly target is left and what daily
// pace would meet it. Weeks run Monday to Sunday in local time (see monday()).

import { fmtH } from './time';

export type PaceKind = 'noTarget' | 'met' | 'lastDay' | 'pace';

export interface WeekPace {
  kind: PaceKind;
  doneSec: number;
  /** null when the project has no usable target. */
  targetSec: number | null;
  /** Seconds still needed, rounded up to whole minutes; 0 once met. */
  leftSec: number;
  /** Days left in the week including today: Monday 7 … Sunday 1. */
  daysLeft: number;
  /** leftSec spread over daysLeft. */
  perDaySec: number;
  label: string;
}

/** Days left in the local week including today: Monday 7 … Sunday 1. */
export function daysLeftInWeek(now: number): number {
  return 7 - ((new Date(now).getDay() + 6) % 7);
}

/**
 * Pace toward a weekly target. `targetHours` is the project's raw target; zero,
 * negative or non-numeric means "no target" (the UI can't set one, but a
 * synced row could carry it).
 */
export function weekPace(doneSec: number, targetHours: number, now: number): WeekPace {
  const daysLeft = daysLeftInWeek(now);
  const done = Math.max(0, doneSec);
  if (!Number.isFinite(targetHours) || targetHours <= 0) {
    return { kind: 'noTarget', doneSec: done, targetSec: null, leftSec: 0, daysLeft, perDaySec: 0, label: fmtH(done) + ' this week' };
  }
  const targetSec = targetHours * 3600;
  if (done >= targetSec) {
    const over = done - targetSec;
    return {
      kind: 'met',
      doneSec: done,
      targetSec,
      leftSec: 0,
      daysLeft,
      perDaySec: 0,
      label: over >= 60 ? 'Target met · ' + fmtH(over) + ' over' : 'Target met',
    };
  }
  const leftSec = Math.ceil((targetSec - done) / 60) * 60;
  const perDaySec = leftSec / daysLeft;
  if (daysLeft === 1) {
    return { kind: 'lastDay', doneSec: done, targetSec, leftSec, daysLeft, perDaySec, label: fmtH(leftSec) + ' left today' };
  }
  return {
    kind: 'pace',
    doneSec: done,
    targetSec,
    leftSec,
    daysLeft,
    perDaySec,
    label: fmtH(leftSec) + ' left · ~' + fmtH(perDaySec) + '/day for ' + daysLeft + ' days',
  };
}

/** A usable weekly target in seconds, or null (see weekPace). */
function targetSecOf(targetHours: number): number | null {
  return Number.isFinite(targetHours) && targetHours > 0 ? targetHours * 3600 : null;
}

/**
 * Time still to track today to stay on pace: today's even share of what was
 * left when the day began, less what's already tracked today. Rounded up to
 * whole minutes; 0 once today's share is done, the target is met, or there is
 * no target. On Sunday the share is everything left.
 */
export function todayPaceSec(weekSec: number, todaySec: number, targetHours: number, now: number): number {
  const targetSec = targetSecOf(targetHours);
  if (targetSec === null) return 0;
  const today = Math.max(0, todaySec);
  const before = Math.max(0, weekSec - today);
  const share = Math.max(0, targetSec - before) / daysLeftInWeek(now);
  return Math.ceil(Math.max(0, share - today) / 60) * 60;
}

export interface WeekSummaryItem {
  weekSec: number;
  todaySec: number;
  targetHours: number;
}

export interface WeekSummary {
  /** Projects with a usable target; only these count. */
  projects: number;
  doneSec: number;
  targetSec: number;
  /** Sum of each project's todayPaceSec. */
  todaySec: number;
  /** Every counted project has met its target. */
  allMet: boolean;
  /** e.g. "12.5h / 20h this week". */
  weekLabel: string;
  /** e.g. "1.2h more today to stay on pace", "On pace for today", "All targets met". */
  todayLabel: string;
}

/** This week across projects: time vs. the sum of targets, and today's pace. */
export function weekSummary(items: WeekSummaryItem[], now: number): WeekSummary {
  let projects = 0;
  let doneSec = 0;
  let targetSec = 0;
  let todaySec = 0;
  let allMet = true;
  for (const it of items) {
    const t = targetSecOf(it.targetHours);
    if (t === null) continue;
    projects++;
    const done = Math.max(0, it.weekSec);
    doneSec += done;
    targetSec += t;
    todaySec += todayPaceSec(done, it.todaySec, it.targetHours, now);
    if (done < t) allMet = false;
  }
  allMet = allMet && projects > 0;
  return {
    projects,
    doneSec,
    targetSec,
    todaySec,
    allMet,
    weekLabel: fmtH(doneSec) + ' / ' + fmtH(targetSec) + ' this week',
    todayLabel: allMet
      ? 'All targets met'
      : todaySec > 0
      ? fmtH(todaySec) + ' more today to stay on pace'
      : 'On pace for today',
  };
}
