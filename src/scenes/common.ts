import { useEffect } from 'react';
import { cancelAnimation, Easing, SharedValue, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Swatch } from '../theme/palette';

export interface SceneProps {
  width: number;
  height: number;
  /** Where the timer ring sits (scenes arrange around it). */
  cx: number;
  cy: number;
  /** Radius of the timer ring. */
  ringR: number;
  /** Today's time toward the target: 1 = the target. */
  progress: number;
  /** This session's seconds (the orbit adds an orb every 10 minutes). */
  sessionSec: number;
  swatch: Swatch;
  /** Bumped when the target is reached: the scene's payoff. */
  payoff: number;
  /** Idle motion on (off with reduce motion, in the background, or while dimmed). */
  moving: boolean;
  /** Reduce motion: a still picture that changes only at milestones. */
  reduced: boolean;
  dark: boolean;
}

/**
 * Progress as the scene draws it: eased toward each new value, or with
 * reduce motion only in quarter steps (so it changes at milestones only).
 */
export function useSceneProgress(progress: number, reduced: boolean): SharedValue<number> {
  const target = reduced ? Math.floor(Math.min(progress, 1) * 4) / 4 + (progress >= 1 ? Math.min(progress - 1, 1) : 0) : progress;
  const v = useSharedValue(target);
  useEffect(() => {
    v.value = reduced ? target : withTiming(target, { duration: 1200, easing: Easing.out(Easing.quad) });
  }, [target, reduced, v]);
  return v;
}

/** A 0→1 clock repeating every `ms` while `run`; parked at 0 otherwise. */
export function useLoop(ms: number, run: boolean): SharedValue<number> {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!run) {
      cancelAnimation(v);
      return;
    }
    v.value = 0;
    v.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1);
    return () => cancelAnimation(v);
  }, [ms, run, v]);
  return v;
}

/** A pulse 0→1→0 each time `trigger` changes (skipped with reduce motion). */
export function usePulse(trigger: number, reduced: boolean): SharedValue<number> {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!trigger || reduced) return;
    v.value = withSequence(withSpring(1, { damping: 7, stiffness: 140 }), withTiming(0, { duration: 1400, easing: Easing.out(Easing.quad) }));
  }, [trigger, reduced, v]);
  return v;
}
