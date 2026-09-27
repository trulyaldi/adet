// Pure session rules shared by the edit sheet and manual logging: validation of
// a start/end pair and building the resulting Session record.

import { fmtHM } from './time';
import { Session } from './types';

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

/** Validate a start/end pair (epoch ms) against `now`; duration is in seconds. */
export function checkSessionTimes(start: number, end: number, now: number): SessionCheck {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false, error: 'Pick a start and end time.' };
  }
  if (end <= start) return { ok: false, error: 'End time must be after the start time.' };
  if (end > now + FUTURE_SLACK_MS) return { ok: false, error: "A session can't end in the future." };
  const duration = Math.round((end - start) / 1000);
  if (duration < SESSION_MIN_SEC) return { ok: false, error: 'A session must be at least 1 minute long.' };
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
