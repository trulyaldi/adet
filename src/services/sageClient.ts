// Pure transport for Aqyl. The caller supplies the local answer, so every
// network, auth, timeout or validation failure quietly keeps that answer.

import { parseRecap, parseSuggestions, RecapPayload, SuggestPayload } from '../../supabase/functions/_shared/sageContract';

export { parseRecap, parseSuggestions };
export type { RecapPayload, SageSuggestion, SuggestPayload } from '../../supabase/functions/_shared/sageContract';
export interface SageAnswer<T> { value: T; source: 'ai' | 'local' }
export interface SageStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> }
export interface SageTransport {
  url: string | undefined;
  token(): Promise<string | null>;
  storage: SageStorage;
  fetcher: typeof fetch;
  now(): number;
}

// FNV-1a over the exact input: a small, stable cache key with no private text
// in the key. The cache value stays in device-local AsyncStorage.
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function createSageClient(t: SageTransport) {
  async function ask<T>(path: string, input: object, fallback: T, validate: (v: unknown) => T | null): Promise<SageAnswer<T>> {
    if (!t.url) return { value: fallback, source: 'local' };
    const body = JSON.stringify(input);
    const day = new Date(t.now()).toISOString().slice(0, 10);
    const key = `adet.sage.v1:${day}:${path}:${hash(body)}`;
    try {
      const cached = await t.storage.getItem(key);
      if (cached) {
        const value = validate(JSON.parse(cached));
        if (value) return { value, source: 'ai' };
      }
      const token = await t.token();
      if (!token) return { value: fallback, source: 'local' };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let response: Response;
      try {
        response = await t.fetcher(`${t.url.replace(/\/$/, '')}/sage/${path}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body, signal: controller.signal,
        });
      } finally { clearTimeout(timeout); }
      if (!response.ok) return { value: fallback, source: 'local' };
      const value = validate(await response.json());
      if (!value) return { value: fallback, source: 'local' };
      await t.storage.setItem(key, JSON.stringify(value)).catch(() => {});
      return { value, source: 'ai' };
    } catch {
      return { value: fallback, source: 'local' };
    }
  }
  return {
    suggest(input: SuggestPayload, fallback: { suggestions: { habitId: string; title: string }[]; insight: string }) {
      const allowed = new Set(input.habits.map((h) => h.id));
      return ask('suggest', input, fallback, (v) => parseSuggestions(v, allowed));
    },
    recap(input: RecapPayload, fallback: { recap: string }) {
      return ask('recap', input, fallback, parseRecap);
    },
  };
}
