// Who is in the way of a ceremony, and whether one is playing. Quest sheets
// and panels hold ceremonies back while they are up; full-screen
// celebrations wait while a ceremony plays (as they do for the Loot sheet).

import { useSyncExternalStore } from 'react';

let holds = 0;
let playing = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Hold ceremonies back until the returned release is called. */
export function holdCeremonies(): () => void {
  holds++;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    emit();
  };
}

export const useCeremoniesHeld = () => useSyncExternalStore(subscribe, () => holds > 0);

export function setCeremonyPlaying(on: boolean): void {
  if (playing === on) return;
  playing = on;
  emit();
}

export const isCeremonyPlaying = () => playing;
export const useCeremonyPlaying = () => useSyncExternalStore(subscribe, () => playing);
