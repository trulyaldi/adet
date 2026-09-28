// One call per moment: plays the matching sound and haptic, each only when
// its toggle in Settings is on. Fire and forget; never blocks the UI.

import * as Haptics from 'expo-haptics';

import { devicePrefsRef } from '../store/devicePrefs';
import { playSound } from './audio';

export type FeedbackEvent =
  | 'tap'
  | 'session_start'
  | 'target_reached'
  | 'session_complete'
  | 'day_complete'
  | 'streak_up'
  | 'milestone'
  | 'undo';

type Haptic = { impact: Haptics.ImpactFeedbackStyle } | { notify: Haptics.NotificationFeedbackType } | null;

/** Light for taps, medium for reaching a target, success for completions. */
export const HAPTICS: Record<FeedbackEvent, Haptic> = {
  tap: { impact: Haptics.ImpactFeedbackStyle.Light },
  session_start: { impact: Haptics.ImpactFeedbackStyle.Medium },
  target_reached: { impact: Haptics.ImpactFeedbackStyle.Medium },
  session_complete: { notify: Haptics.NotificationFeedbackType.Success },
  day_complete: { notify: Haptics.NotificationFeedbackType.Success },
  streak_up: { impact: Haptics.ImpactFeedbackStyle.Medium },
  milestone: { notify: Haptics.NotificationFeedbackType.Success },
  undo: { impact: Haptics.ImpactFeedbackStyle.Soft },
};

/**
 * Pass `haptic: false` for plain navigation taps (tabs, opening a sheet,
 * expanding a card): the sound still plays, the haptic is kept for actions.
 */
export function feedback(event: FeedbackEvent, { haptic = true }: { haptic?: boolean } = {}): void {
  const prefs = devicePrefsRef.current;
  if (prefs.sound) playSound(event);
  if (!prefs.haptics || !haptic) return;
  const h = HAPTICS[event];
  if (!h) return;
  const p = 'impact' in h ? Haptics.impactAsync(h.impact) : Haptics.notificationAsync(h.notify);
  p.catch(() => {});
}
