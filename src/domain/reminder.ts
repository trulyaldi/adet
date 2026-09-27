// Long-running timer reminder: when to ask "Still working on <habit>?".
// Pure; src/notifications/ does the scheduling.

import { ActiveTimer } from './types';

/** Default hours of tracked time before the reminder fires. */
export const DEFAULT_REMINDER_HOURS = 3;
/** Largest selectable reminder delay; 0 means reminders are off. */
export const MAX_REMINDER_HOURS = 12;

/**
 * Epoch ms at which the timer's total tracked time (including paused
 * segments) reaches `hours`, or null when there's nothing to schedule: no
 * timer, a paused timer, or reminders off. May be in the past.
 */
export function reminderFireAt(active: ActiveTimer | null, hours: number): number | null {
  if (!active || active.startedAt === null || hours <= 0) return null;
  return Math.round(active.startedAt + (hours * 3600 - active.baseSec) * 1000);
}

/** Clamp a stored or stepped reminder setting to 0 (off)..MAX_REMINDER_HOURS whole hours. */
export function clampReminderHours(hours: unknown): number {
  const n = typeof hours === 'number' && Number.isFinite(hours) ? Math.round(hours) : DEFAULT_REMINDER_HOURS;
  return Math.min(MAX_REMINDER_HOURS, Math.max(0, n));
}

/**
 * Stopping a timer that ran longer than this offers to trim it: the reminder
 * delay N, or the default when reminders are off.
 */
export function longSessionSec(reminderHours: number): number {
  return (reminderHours > 0 ? reminderHours : DEFAULT_REMINDER_HOURS) * 3600;
}
