// Which chest the Loot sheet is open for (the loot host, mounted app-wide,
// shows it): right after a session, or from the camp's chest pile.

import { useSyncExternalStore } from 'react';

import { holdCeremonies } from '../ceremonies/gate';

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

/**
 * A stopped session hands the screen from the focus view to the Loot sheet
 * (or to nothing) once the focus view has gone. Ceremonies are held through
 * the hand-off: a long session can beat a boss before its chest is opened,
 * and iOS must never present that scene while a modal animates in or out.
 */
export function handOffAfterStop(lootFor: string | null, gapMs: number): void {
  const release = holdCeremonies();
  setTimeout(() => {
    if (lootFor) openLoot({ sessionId: lootFor, fresh: true });
    release();
  }, gapMs);
}

/** Close the Loot sheet; ceremonies wait until it has gone, then `then` runs. */
export function closeLootAfter(gapMs: number, then: () => void): void {
  const release = holdCeremonies();
  closeLoot();
  setTimeout(() => {
    release();
    then();
  }, gapMs);
}

export function closeLoot(): void {
  current = null;
  listeners.forEach((l) => l());
}

/** The Loot sheet is up (full-screen celebrations wait for it). */
export function isLootOpen(): boolean {
  return current !== null;
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
