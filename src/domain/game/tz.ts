// How the game reads local time. The default follows the device, like the
// rest of the app (dkey); tests pass fixed-offset zones.

export interface GameTz {
  /** Local calendar day, "YYYY-MM-DD". */
  dayKey(ms: number): string;
  /** Local hour, 0–23. */
  hour(ms: number): number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const DEVICE_TZ: GameTz = {
  dayKey: (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
  hour: (ms) => new Date(ms).getHours(),
};

/** A zone at a fixed offset from UTC, in minutes (e.g. +300 for UTC+5). */
export function fixedTz(offsetMin: number): GameTz {
  const shift = (ms: number) => new Date(ms + offsetMin * 60_000);
  return {
    dayKey: (ms) => {
      const d = shift(ms);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    },
    hour: (ms) => shift(ms).getUTCHours(),
  };
}

/** The calendar day before a day key (pure calendar arithmetic, any zone). */
export function prevDayKey(k: string): string {
  const [y, m, d] = k.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
