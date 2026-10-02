// Aqyl without AI: suggestions, a one-line insight and a battle recap from
// the data alone. Always available, offline included.

import type { Session } from '../types';
import { MIN_SESSION_MIN } from './balance';
import type { Trail } from '../progress';
import type { GameTz } from './tz';
import { DEVICE_TZ } from './tz';

/** Dormant: the AI contract still returns suggestions (they were weak points); nothing shows them. */
export interface Suggestion {
  habitId: string;
  title: string;
  taskId?: string;
}

export interface SageAdvice {
  suggestions: Suggestion[];
  insight: string;
}

const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/** A computed pattern: the best part of the day, else the best weekday (≤12 words). */
export function fallbackInsight(sessions: readonly Session[], tz: GameTz = DEVICE_TZ): string {
  const q = sessions.filter((s) => s.duration / 60 >= MIN_SESSION_MIN);
  if (q.length < 5) return 'Every session sharpens the blade.';
  const parts = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const days = new Array(7).fill(0);
  let total = 0;
  for (const s of q) {
    const m = s.duration / 60;
    const h = tz.hour(s.start);
    const part = h >= 5 && h < 12 ? 'morning' : h < 17 && h >= 12 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'night';
    parts[part] += m;
    const [y, mo, d] = tz.dayKey(s.start).split('-').map(Number);
    days[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()] += m;
    total += m;
  }
  const [best, bm] = Object.entries(parts).sort((a, b) => b[1] - a[1])[0];
  if (bm / total >= 0.45) {
    return best === 'morning'
      ? 'You fight best before noon.'
      : best === 'afternoon'
        ? 'Afternoons are when your blade is sharpest.'
        : best === 'evening'
          ? 'Evenings bring out your best focus.'
          : 'The night owl in you focuses well.';
  }
  const di = days.indexOf(Math.max(...days));
  return `${WEEKDAYS[di]} are your strongest days.`;
}

/** A one-line trail note ("Reading is rising this week."), or null when nothing is rising. */
export function trailInsight(trail: Pick<Trail, 'habits'>, nameOf: (habitId: string) => string | undefined): string | null {
  const rising = trail.habits.find((h) => !h.empty && h.verdict === 'rising' && nameOf(h.habitId));
  if (!rising) return null;
  const name = nameOf(rising.habitId)!.trim();
  // Twelve words at most: a long habit name is shortened.
  const short = name.split(/\s+/).slice(0, 6).join(' ');
  return `${short} is rising this week.`;
}

/** The battle report when no AI is used: counts, warmly. */
export function fallbackRecap(bossName: string, sessions: number, entries: number): string {
  if (sessions === 0) return `${bossName} is beaten. Well fought.`;
  const s = `${sessions} session${sessions === 1 ? '' : 's'}`;
  const e = entries ? ` You wrote ${entries} line${entries === 1 ? '' : 's'} along the way.` : '';
  return `You faced ${bossName.replace(/^The /, 'the ')} across ${s}.${e} Well fought.`;
}
