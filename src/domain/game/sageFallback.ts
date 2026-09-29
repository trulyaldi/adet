// Aqyl without AI: suggestions, a one-line insight and a battle recap from
// the data alone. Always available, offline included.

import { itemsOfType, Item, TaskItem } from '../items/types';
import type { Session } from '../types';
import { MIN_SESSION_MIN } from './balance';
import type { GameTz } from './tz';
import { DEVICE_TZ } from './tz';

export interface Suggestion {
  habitId: string;
  title: string;
  /** An existing open task (pinning moves it to the top), else a new one. */
  taskId?: string;
}

export interface SageAdvice {
  suggestions: Suggestion[];
  insight: string;
}

/** Habits by minutes over the last `days` (most-used first). */
export function habitsByUse(sessions: readonly Session[], now: number, days = 30): string[] {
  const since = now - days * 86_400_000;
  const min = new Map<string, number>();
  for (const s of sessions) if (s.start >= since) min.set(s.habitId, (min.get(s.habitId) ?? 0) + s.duration / 60);
  return [...min.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

export function fallbackSuggestions(sessions: readonly Session[], items: readonly Item[], habitIds: readonly string[], now: number): Suggestion[] {
  const live = new Set(habitIds);
  const used = habitsByUse(sessions, now).filter((h) => live.has(h));
  const order = [...used, ...habitIds.filter((h) => !used.includes(h))];
  const open = itemsOfType(items, 'task').filter((t) => t.props.status === 'open');
  const out: Suggestion[] = [];
  // "Continue …" from the latest chronicle entry with text.
  const logs = itemsOfType(items, 'log')
    .filter((l) => l.body.trim() && l.habitId && live.has(l.habitId))
    .sort((a, b) => b.createdAt - a.createdAt);
  if (logs[0]) out.push({ habitId: logs[0].habitId!, title: clip(`Continue: ${logs[0].body.trim()}`, 80) });
  // Then the oldest open weak point of each most-used habit.
  for (const h of order) {
    if (out.length >= 3) break;
    const oldest = open.filter((t) => t.habitId === h).sort((a: TaskItem, b: TaskItem) => a.createdAt - b.createdAt)[0];
    if (oldest && !out.some((s) => s.taskId === oldest.id)) out.push({ habitId: h, title: oldest.title, taskId: oldest.id });
  }
  return out.slice(0, 3);
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

/** The battle report when no AI is used: counts, warmly. */
export function fallbackRecap(bossName: string, sessions: number, tasks: number, entries: number): string {
  if (sessions === 0) return `${bossName} is beaten. Well fought.`;
  const s = `${sessions} session${sessions === 1 ? '' : 's'}`;
  const t = tasks ? ` and ${tasks} task${tasks === 1 ? '' : 's'}` : '';
  const e = entries ? ` You wrote ${entries} line${entries === 1 ? '' : 's'} along the way.` : '';
  return `You faced ${bossName.replace(/^The /, 'the ')} across ${s}${t}.${e} Well fought.`;
}
