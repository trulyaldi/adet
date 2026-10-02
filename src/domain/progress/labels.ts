// What VoiceOver says for the Trail (v2 N8): the verdict and its reasons in words.

import type { HabitProgress, Reason, Verdict } from './index';

export const VERDICT_WORD: Record<Verdict, string> = { rising: 'rising', steady: 'steady', resting: 'resting' };
export const REASON_WORD: Record<Reason, string> = { time: 'more time', perHour: 'more per hour', level: 'a level' };

export function trailLine(t: { rising: number; steady: number; resting: number }): string {
  return `${t.rising} rising, ${t.steady} steady, ${t.resting} resting`;
}

export function habitLabel(name: string, h: Pick<HabitProgress, 'empty' | 'verdict' | 'reasons'>): string {
  if (h.empty) return `${name}: nothing on the trail yet`;
  const why = h.reasons.map((r) => REASON_WORD[r]).join(', ');
  return `${name}: ${VERDICT_WORD[h.verdict]}${why ? `, ${why}` : ''}`;
}
