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

/** Monday of the week containing d (local, ISO week start). */
export function monday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
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
