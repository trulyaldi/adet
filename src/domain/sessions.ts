// Pure session rules shared by the edit sheet and manual logging: validation of
// a start/end pair and building the resulting Session record.

import { fmtHM } from './time';
import { PersistedState, Session } from './types';

/** Durations above this need an explicit confirmation. */
export const SESSION_CONFIRM_SEC = 8 * 3600;
/** Durations above this are rejected outright. */
export const SESSION_MAX_SEC = 16 * 3600;
/** Shortest session that can be saved. */
export const SESSION_MIN_SEC = 60;
/** Clock-skew allowance before an end time counts as "in the future". */
const FUTURE_SLACK_MS = 60 * 1000;

export type SessionCheck =
  | { ok: true; duration: number; needsConfirm: boolean }
  | { ok: false; error: string };

/**
 * Validate a start/end pair (epoch ms) against `now`; duration is in seconds.
 * `existing` marks an edit of a saved session, whose too-short error suggests
 * deleting it instead.
 */
export function checkSessionTimes(
  start: number,
  end: number,
  now: number,
  opts: { existing?: boolean } = {}
): SessionCheck {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false, error: 'Pick a start and end time.' };
  }
  if (end <= start) return { ok: false, error: 'End time must be after the start time.' };
  if (end > now + FUTURE_SLACK_MS) return { ok: false, error: "A session can't end in the future." };
  const duration = Math.round((end - start) / 1000);
  if (duration < SESSION_MIN_SEC) {
    return {
      ok: false,
      error: opts.existing
        ? 'Sessions must be at least 1 minute. Delete this one instead?'
        : 'A session must be at least 1 minute long.',
    };
  }
  if (duration > SESSION_MAX_SEC) {
    return {
      ok: false,
      error: `That's ${fmtHM(duration)}. Sessions can be at most ${fmtHM(SESSION_MAX_SEC)}.`,
    };
  }
  return { ok: true, duration, needsConfirm: duration > SESSION_CONFIRM_SEC };
}

export interface SessionFields {
  habitId: string;
  start: number;
  end: number;
  note: string;
}

/**
 * Apply edited fields to an existing session. Returns a new object (so sync
 * change detection picks it up) with duration derived from start/end. The
 * caller must have validated the times with checkSessionTimes.
 */
export function applySessionEdit(session: Session, fields: SessionFields): Session {
  const next: Session = {
    ...session,
    habitId: fields.habitId,
    start: fields.start,
    end: fields.end,
    duration: Math.round((fields.end - fields.start) / 1000),
  };
  const note = fields.note.trim();
  if (note) next.notes = note;
  else delete next.notes;
  return next;
}

/** A manually logged session. The caller must have validated the times. */
export function manualSession(id: string, fields: SessionFields): Session {
  const note = fields.note.trim();
  return {
    id,
    habitId: fields.habitId,
    start: fields.start,
    end: fields.end,
    duration: Math.round((fields.end - fields.start) / 1000),
    manual: true,
    ...(note ? { notes: note } : {}),
  };
}

/**
 * Undo a session delete: put the session back as a fresh object, so sync
 * change detection stamps it newer than the delete and it wins everywhere.
 * No-op if it's already present or its habit no longer exists.
 */
export function restoreSession(data: PersistedState, session: Session): PersistedState {
  if (data.sessions.some((s) => s.id === session.id)) return data;
  if (!data.habits.some((h) => h.id === session.habitId)) return data;
  return { ...data, sessions: [...data.sessions, { ...session }] };
}

const FIVE_MIN_MS = 5 * 60 * 1000;

/**
 * Default start for a manual log of `minutes`: so that it ends at `now`
 * rounded down to 5 minutes (picker-friendly times, never in the future).
 */
export function defaultManualStart(now: number, minutes: number): number {
  return Math.floor(now / FIVE_MIN_MS) * FIVE_MIN_MS - minutes * 60 * 1000;
}

/**
 * Start for a manual log after its duration changes: kept as is unless the
 * session would then end in the future, in which case it's moved earlier so
 * the session ends at `now` (rounded down to 5 minutes).
 */
export function fitManualStart(start: number, minutes: number, now: number): number {
  return start + minutes * 60 * 1000 > now ? defaultManualStart(now, minutes) : start;
}
