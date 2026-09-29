// Quest haptics and sounds. Each plays only when both the device's toggle
// (Settings) and the Quest's own toggle are on, and never while a timer is
// running (the focus view stays calm).

import * as Haptics from 'expo-haptics';

import type { QuestSettings } from '../domain/items/types';
import { devicePrefsRef } from '../store/devicePrefs';
import { playQuestSound, QuestSound } from './audio';

let settings: Pick<QuestSettings, 'haptics' | 'sfx'> = { haptics: true, sfx: true };
let timerRunning = false;

/** Kept current by the Quest watcher. */
export function setQuestFeedbackState(s: Pick<QuestSettings, 'haptics' | 'sfx'>, running: boolean): void {
  settings = s;
  timerRunning = running;
}

export function questHaptic(kind: 'light' | 'medium' | 'success'): void {
  if (!settings.haptics || !devicePrefsRef.current.haptics) return;
  const p =
    kind === 'success'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  p.catch(() => {});
}

export function questSound(name: QuestSound): void {
  if (timerRunning || !settings.sfx || !devicePrefsRef.current.sound) return;
  playQuestSound(name);
}
