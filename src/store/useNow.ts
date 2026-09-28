import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * The current time, refreshed every `ms` in just the component that asks
 * (live clocks), and right away when the app comes back to the foreground.
 * The store's own `now` only ticks every few seconds, so a running timer
 * doesn't re-render the whole app every second.
 */
export function useNow(ms = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [ms, enabled]);
  return now;
}
