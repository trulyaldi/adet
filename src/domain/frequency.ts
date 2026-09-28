// How often a habit is due: every day, a number of times per week, or on fixed
// weekdays. Weeks run Monday to Sunday (see monday() in time.ts); weekday
// indexes follow that order, 0 = Monday … 6 = Sunday.

export type Frequency =
  | { kind: 'daily' }
  /** 1..6 times per week, on any days (7 is stored as daily). */
  | { kind: 'weekly'; times: number }
  /** Fixed weekdays, sorted and unique, 0 = Monday … 6 = Sunday; never empty. */
  | { kind: 'days'; days: number[] };

export const DAILY: Frequency = { kind: 'daily' };

/** Full weekday names in week order, for spoken labels. */
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** One-letter weekday marks in week order. */
export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** 0 = Monday … 6 = Sunday, for a local date. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Completions a week asks for: 7 for daily, n for n times, one per fixed weekday. */
export function weeklyTargetOf(f: Frequency): number {
  switch (f.kind) {
    case 'daily':
      return 7;
    case 'weekly':
      return f.times;
    case 'days':
      return f.days.length;
  }
}

/** The canonical form: counts clamped to 1..7, 7 times a week as daily, weekdays sorted and unique. */
export function normalizeFrequency(f: Frequency): Frequency {
  if (f.kind === 'weekly') {
    const times = Math.min(7, Math.max(1, Math.round(f.times)));
    return times === 7 ? DAILY : { kind: 'weekly', times };
  }
  if (f.kind === 'days') {
    const days = [...new Set(f.days.map((d) => Math.round(d)).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
    if (!days.length) return { kind: 'weekly', times: 1 };
    return days.length === 7 ? DAILY : { kind: 'days', days };
  }
  return DAILY;
}

/** Read a stored or synced frequency, falling back to daily for anything unusable. */
export function parseFrequency(v: unknown): Frequency {
  const raw = typeof v === 'string' ? safeJson(v) : v;
  if (!raw || typeof raw !== 'object') return DAILY;
  const f = raw as Record<string, unknown>;
  if (f.kind === 'weekly' && typeof f.times === 'number' && Number.isFinite(f.times)) {
    return normalizeFrequency({ kind: 'weekly', times: f.times });
  }
  if (f.kind === 'days' && Array.isArray(f.days) && f.days.every((d) => typeof d === 'number' && Number.isFinite(d))) {
    return normalizeFrequency({ kind: 'days', days: f.days as number[] });
  }
  return DAILY;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** True when the habit is pinned to this weekday. */
export function isFixedOn(f: Frequency, weekday: number): boolean {
  return f.kind === 'days' && f.days.includes(weekday);
}

/** Spoken description, e.g. "Every day", "3 times a week", "Monday, Wednesday and Friday". */
export function frequencyLabel(f: Frequency): string {
  if (f.kind === 'daily') return 'Every day';
  if (f.kind === 'weekly') return f.times === 1 ? 'Once a week' : `${f.times} times a week`;
  const names = f.days.map((d) => WEEKDAY_NAMES[d]);
  return names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

/** Default minimum for a habit: 5 minutes, or the full length when that's already 5 or less. */
export function defaultMinMin(fullMin: number): number {
  return Math.max(1, Math.min(5, Math.round(fullMin)));
}

/** A minimum clamped to 1..full minutes. */
export function clampMinMin(minMin: number, fullMin: number): number {
  return Math.max(1, Math.min(Math.round(fullMin), Math.round(minMin)));
}
