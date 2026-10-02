// The result sheet's request (World Mode, world-4): a session that targeted a
// quest asks what happened, once the focus view has gone. The chest (for a
// session long enough) follows it. Ceremonies are held from the moment the
// session stops until the sheet and its undo window are gone, so a boss can't
// fall on screen and then be taken back.

import { useSyncExternalStore } from 'react';

import type { SessionTarget } from '../../domain/world/target';
import { holdCeremonies } from '../ceremonies/gate';

export interface ResultRequest {
  sessionId: string;
  /** The fight as the session ended (the sheet plays its result on it). */
  target: SessionTarget;
  /** The chest to open next, if the session earned one. */
  lootFor: string | null;
}

let current: ResultRequest | null = null;
let release: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openResult(req: ResultRequest): void {
  release?.();
  release = holdCeremonies();
  current = req;
  emit();
}

/** The sheet is done: after it has gone, `then` runs (it opens the chest, or asks the ceremony host). */
export function closeResult(gapMs: number, then: (lootFor: string | null) => void): void {
  const req = current;
  const held = release;
  release = null;
  current = null;
  emit();
  setTimeout(() => {
    held?.();
    then(req?.lootFor ?? null);
  }, gapMs);
}

export function isResultOpen(): boolean {
  return current !== null;
}

export function useResultRequest(): ResultRequest | null {
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
