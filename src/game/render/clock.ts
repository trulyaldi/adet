// One clock for the Quest world. It only runs while the world is on screen and
// the app is in front, stands still with reduced motion, and drops to 30 fps
// when frames run over budget.

import { useEffect } from 'react';
import { SharedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

/** Frames slower than this (ms, smoothed) switch to the 30 fps fallback. */
const BUDGET_MS = 20;

/**
 * Milliseconds of world time (a shared value, advanced on the UI thread).
 * With `stepMs`, it publishes only in whole steps (a stepped, low-fps world:
 * whatever reads it redraws that often, not every frame).
 */
export function useGameClock(running: boolean, stepMs = 0): SharedValue<number> {
  const t = useSharedValue(0);
  const inner = useSharedValue(0);
  const avg = useSharedValue(16);
  const odd = useSharedValue(false);
  const cb = useFrameCallback((info) => {
    'worklet';
    const dt = Math.min(100, info.timeSincePreviousFrame ?? 16);
    inner.value += dt;
    avg.value = avg.value * 0.95 + dt * 0.05;
    // Over budget: publish every other frame (halves the work of everything that reads the clock).
    if (avg.value > BUDGET_MS) {
      odd.value = !odd.value;
      if (odd.value) return;
    }
    if (stepMs > 0) {
      const stepped = Math.floor(inner.value / stepMs) * stepMs;
      if (stepped !== t.value) t.value = stepped;
      return;
    }
    t.value = inner.value;
  }, false);
  useEffect(() => {
    cb.setActive(running);
  }, [running, cb]);
  return t;
}
