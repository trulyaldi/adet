// Whether the Quest tab is the one on screen (the app has no navigation
// library; tabs are the store's `screen`). Sheets and ceremonies above it
// pause the map by marking themselves covering.

import { useSyncExternalStore } from 'react';

import { useUi } from '../../store/StreakStore';

let covers = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Something full-screen is over the map (a ceremony, the playground): pause it. */
export function coverWorld(): () => void {
  covers++;
  emit();
  return () => {
    covers = Math.max(0, covers - 1);
    emit();
  };
}

export function useIsFocused(): boolean {
  const screen = useUi((u) => u.screen);
  const covered = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => covers > 0
  );
  return screen === ('quest' as typeof screen) && !covered;
}
