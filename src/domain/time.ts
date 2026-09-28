// Pure date + formatting helpers, ported verbatim from the design's DCLogic utils.

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar-day key, e.g. "2026-07-10". */
export function dkey(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate())
  );
}

/** Parse a dkey back into a local Date at midnight. */
export function pkey(k: string): Date {
  const p = k.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** First day of the week, as Date.getDay(): 1 = Monday (default), 0 = Sunday. */
export type WeekStartDay = 0 | 1;
let WEEK_START: WeekStartDay = 1;

/**
 * Set the week start used by every week calculation (the user's preference).
 * Weekday identities (capacity per weekday, fixed habit days) stay
 * Monday-based; only where a week begins and ends moves.
 */
export function setWeekStartDay(d: WeekStartDay): void {
  WEEK_START = d === 0 ? 0 : 1;
}

export function weekStartDay(): WeekStartDay {
  return WEEK_START;
}

/** Position of d in its week: 0 = the first day (Monday by default) … 6. */
export function weekPos(d: Date): number {
  return (d.getDay() - WEEK_START + 7) % 7;
}

/**
 * The first day of the week containing d (local midnight). Named for the
 * default; it follows setWeekStartDay.
 */
export function monday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - weekPos(x));
  return x;
}

/** Deterministic pseudo-random in [0,1) — used only for seed data. */
export function rand(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** "1h 05m" / "12m" from seconds. */
export function fmtHM(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? h + 'h ' + pad(m) + 'm' : m + 'm';
}

/** "1h 20m" / "45m" / "0m" from seconds (no zero padding, for labels). */
export function fmtDur(sec: number): string {
  const total = Math.max(0, Math.floor(sec / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return m + 'm';
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Spoken duration: "1 hour 20 minutes". */
export function sayDur(sec: number): string {
  const total = Math.max(0, Math.floor(sec / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hs = h ? `${h} hour${h === 1 ? '' : 's'}` : '';
  const ms = m || !h ? `${m} minute${m === 1 ? '' : 's'}` : '';
  return [hs, ms].filter(Boolean).join(' ');
}

/** "1h 30m" / "45m" from a minute count. */
export function fmtMin(min: number): string {
  return fmtHM(min * 60);
}

/** Stepper increment for a minute value: 30 at >=120, 15 at >=60, else 5. */
export function stepFor(m: number): number {
  return m >= 120 ? 30 : m >= 60 ? 15 : 5;
}

/** Compact hours label: "120h" / "3.5h" / "45m". */
export function fmtH(sec: number): string {
  const h = sec / 3600;
  return h >= 100
    ? Math.round(h) + 'h'
    : h >= 1
    ? h.toFixed(1).replace('.0', '') + 'h'
    : Math.floor(sec / 60) + 'm';
}

/** Clock display "1:02:05" / "02:05". */
export function fmtClock(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
}
