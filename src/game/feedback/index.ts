import * as Haptics from 'expo-haptics';

import { devicePrefsRef } from '../../store/devicePrefs';
import { playQuestSound, setQuestMusicBiome } from '../audio';
import { feedbackAllowed, FeedbackContext, HapticKind, SfxId } from './gate';

let timerActive = false;
let lastLightAt = 0;

export const feedback = {
  setTimerActive(active: boolean): void { timerActive = active; if (active) setQuestMusicBiome(null); },
  sfx(id: SfxId, context: FeedbackContext): void {
    const p = devicePrefsRef.current;
    if (!feedbackAllowed(context, timerActive) || !p.sound || !p.questSfx) return;
    playQuestSound(id);
  },
  haptic(kind: HapticKind, context: FeedbackContext): void {
    const p = devicePrefsRef.current;
    if (!feedbackAllowed(context, timerActive) || !p.haptics || !p.questHaptics) return;
    if (kind === 'light') {
      const now = Date.now();
      if (now - lastLightAt < 120) return;
      lastLightAt = now;
    }
    const promise = kind === 'success'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    promise.catch(() => {});
  },
  music: {
    setBiome(id: string | null): void {
      if (timerActive || !devicePrefsRef.current.questMusic) { setQuestMusicBiome(null); return; }
      setQuestMusicBiome(id);
    },
  },
};
