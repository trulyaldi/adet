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
