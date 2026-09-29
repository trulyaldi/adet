// Which chest the Loot sheet is open for (the loot host, mounted app-wide,
// shows it): right after a session, or from the camp's chest pile.

import { useSyncExternalStore } from 'react';

export interface LootRequest {
  sessionId: string;
  /** Just finished (bounces in with the session's planned weak points) or from the pile. */
  fresh: boolean;
}

let current: LootRequest | null = null;
const listeners = new Set<() => void>();

export function openLoot(req: LootRequest): void {
  current = req;
  listeners.forEach((l) => l());
}

export function closeLoot(): void {
  current = null;
  listeners.forEach((l) => l());
}

export function useLootRequest(): LootRequest | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => current
  );
}
