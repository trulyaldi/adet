// Aqyl's advice. The rule-based fallback always answers; the AI Sage
// (opt-in, Q11) replaces it when configured.

import { useMemo } from 'react';

import { fallbackInsight, fallbackSuggestions, SageAdvice } from '../domain/game/sageFallback';
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
