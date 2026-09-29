// Aqyl's advice. The rule-based fallback always answers; the AI Sage
// (opt-in, Q11) replaces it when configured.

import { useMemo } from 'react';

import { fallbackInsight, fallbackRecap, fallbackSuggestions, SageAdvice } from '../domain/game/sageFallback';
import { activeHabits } from '../domain/projects';
import type { PersistedState } from '../domain/types';

export function useSageAdvice(data: PersistedState, now: number): { advice: SageAdvice; source: 'ai' | 'rules'; loading: boolean } {
  const day = Math.floor(now / 86_400_000);
  const advice = useMemo(() => {
    const habits = activeHabits(data)
      .filter((h) => h.kind !== 'check')
      .map((h) => h.id);
    return { suggestions: fallbackSuggestions(data.sessions, data.items, habits, now), insight: fallbackInsight(data.sessions) };
    // Once per day and whenever tasks or entries change.
  }, [data.sessions, data.items, data.habits, day]);
  return { advice, source: 'rules', loading: false };
}

/** Aqyl's battle report for a beaten boss (the template until the AI Sage answers). */
export function useSageRecap(bossName: string, run: { sessions: number; tasks: number; entries: string[] }): { recap: string; loading: boolean } {
  const recap = useMemo(() => fallbackRecap(bossName, run.sessions, run.tasks, run.entries.length), [bossName, run.sessions, run.tasks, run.entries.length]);
  return { recap, loading: false };
}
