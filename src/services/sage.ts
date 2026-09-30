// Aqyl's opt-in AI answers. A local answer is shown immediately and kept
// whenever the Sage endpoint cannot answer safely.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { fallbackInsight, fallbackRecap, fallbackSuggestions, SageAdvice, trailInsight } from '../domain/game/sageFallback';
import { trailOf } from '../domain/progress';
import { activeHabits } from '../domain/projects';
import { itemsOfType, QuestSettings } from '../domain/items/types';
import type { PersistedState } from '../domain/types';
import { supabase } from '../sync/supabase';
import { createSageClient, RecapPayload, SuggestPayload } from './sageClient';

const client = createSageClient({
  url: process.env.EXPO_PUBLIC_SAGE_URL,
  token: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  storage: AsyncStorage,
  fetcher: (...args) => fetch(...args),
  now: () => Date.now(),
});

export const sage = {
  async suggest(input: SuggestPayload & { fallback: SageAdvice; enabled: boolean }): Promise<{ suggestions: SageAdvice['suggestions']; insight: string; source: 'ai' | 'local' }> {
    if (!input.enabled) return { ...input.fallback, source: 'local' };
    const { fallback, enabled, ...payload } = input;
    const answer = await client.suggest(payload, fallback);
    return { ...answer.value, source: answer.source };
  },
  async recap(input: RecapPayload & { fallback: string; enabled: boolean }): Promise<{ recap: string; source: 'ai' | 'local' }> {
    if (!input.enabled) return { recap: input.fallback, source: 'local' };
    const { fallback, enabled, ...payload } = input;
    const answer = await client.recap(payload, { recap: fallback });
    return { ...answer.value, source: answer.source };
  },
};

/** Privacy note on first enable. Cancel leaves Aqyl local. */
export function enableSage(settings: QuestSettings, save: (next: QuestSettings) => void): Promise<boolean> {
  if (settings.aiNoticeSeen) {
    save({ ...settings, ai: true });
    return Promise.resolve(true);
  }
  const enable = () => save({ ...settings, ai: true, aiNoticeSeen: true });
  // react-native-web's Alert shows nothing, so the web build asks the browser.
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined' && window.confirm('Chronicle entries are sent to generate suggestions.');
    if (ok) enable();
    return Promise.resolve(ok);
  }
  return new Promise((resolve) => Alert.alert('Aqyl the Sage', 'Chronicle entries are sent to generate suggestions.', [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Enable', onPress: () => { enable(); resolve(true); } },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}

export function useSageAdvice(data: PersistedState, now: number): { advice: SageAdvice; source: 'ai' | 'local'; loading: boolean } {
  const day = Math.floor(now / 86_400_000);
  const meta = itemsOfType(data.items, 'quest_meta')[0];
  const enabled = !!meta?.props.settings.ai;
  const advice = useMemo(() => {
    const habits = activeHabits(data).filter((h) => h.kind !== 'check').map((h) => h.id);
    // The Trail first ("Reading is rising this week"), else the day-part pattern.
    const trail = trailOf({ sessions: data.sessions, habits: habits.map((id) => ({ id })), items: data.items, now });
    const names = new Map(data.habits.map((h) => [h.id, h.name]));
    return { suggestions: fallbackSuggestions(data.sessions, data.items, habits, now), insight: trailInsight(trail, (id) => names.get(id)) ?? fallbackInsight(data.sessions) };
  }, [data.sessions, data.items, data.habits, day]);
  const payload = useMemo<SuggestPayload>(() => ({
    habits: activeHabits(data).filter((h) => h.kind !== 'check').map((h) => ({
      id: h.id, name: h.name,
      openTasks: itemsOfType(data.items, 'task').filter((t) => t.habitId === h.id && t.props.status === 'open').slice(0, 10).map((t) => t.title),
    })),
    entries: itemsOfType(data.items, 'log').filter((l) => !!l.body.trim() && !!l.habitId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20).map((l) => ({ habitId: l.habitId!, text: l.body.slice(0, 500), at: new Date(l.createdAt).toISOString() })),
  }), [data.habits, data.items]);
  // The answer for one request; a newer request shows the local advice while it loads.
  const [answer, setAnswer] = useState<{ payload: SuggestPayload; advice: SageAdvice; value: SageAdvice; source: 'ai' | 'local' } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    sage.suggest({ ...payload, fallback: advice, enabled }).then((value) => {
      if (live) setAnswer({ payload, advice, value, source: value.source });
    });
    return () => { live = false; };
  }, [enabled, payload, advice]);
  if (!enabled) return { advice, source: 'local', loading: false };
  if (answer && answer.payload === payload && answer.advice === advice) return { advice: answer.value, source: answer.source, loading: false };
  return { advice, source: 'local', loading: true };
}

export function useSageRecap(bossName: string, run: { sessions: number; tasks: number; entries: string[] }, enabled = false, biomeName = ''): { recap: string; loading: boolean } {
  const fallback = fallbackRecap(bossName, run.sessions, run.tasks, run.entries.length);
  const entriesKey = JSON.stringify(run.entries);
  const payload = useMemo<RecapPayload>(() => ({ biomeName, bossName, entries: run.entries.slice(0, 20), sessionCount: run.sessions, taskCount: run.tasks }), [biomeName, bossName, entriesKey, run.sessions, run.tasks]);
  // The recap for one request: the AI's, or the local one after 3 s.
  const [answer, setAnswer] = useState<{ payload: RecapPayload; fallback: string; recap: string } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const settle = (recap: string) => {
      if (!live) return;
      live = false;
      clearTimeout(deadline);
      setAnswer({ payload, fallback, recap });
    };
    const deadline = setTimeout(() => settle(fallback), 3000);
    sage.recap({ ...payload, fallback, enabled }).then((a) => settle(a.recap));
    return () => { live = false; clearTimeout(deadline); };
  }, [enabled, payload, fallback]);
  if (!enabled) return { recap: fallback, loading: false };
  if (answer && answer.payload === payload && answer.fallback === fallback) return { recap: answer.recap, loading: false };
  return { recap: fallback, loading: true };
}
