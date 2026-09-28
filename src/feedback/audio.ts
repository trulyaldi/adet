// The audio service: every sound is loaded once at startup and played by
// event name. Playing never blocks or throws into the UI. The audio session
// is "ambient" (playsInSilentMode off), so the iPhone silent switch mutes it,
// and it mixes with whatever else is playing.

import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import type { FeedbackEvent } from './feedback';

const SOURCES: Record<FeedbackEvent, number> = {
  tap: require('../../assets/sounds/tap.wav'),
  session_start: require('../../assets/sounds/session_start.wav'),
  target_reached: require('../../assets/sounds/target_reached.wav'),
  session_complete: require('../../assets/sounds/session_complete.wav'),
  day_complete: require('../../assets/sounds/day_complete.wav'),
  streak_up: require('../../assets/sounds/streak_up.wav'),
  milestone: require('../../assets/sounds/milestone.wav'),
  undo: require('../../assets/sounds/undo.wav'),
};

const players: Partial<Record<FeedbackEvent, AudioPlayer>> = {};
let started = false;

/** Load every sound and set the audio session. Safe to call more than once. */
export function preloadSounds(): void {
  if (started) return;
  started = true;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});
  for (const [name, src] of Object.entries(SOURCES) as [FeedbackEvent, number][]) {
    try {
      players[name] = createAudioPlayer(src);
    } catch {
      // A sound that fails to load stays silent; nothing else depends on it.
    }
  }
}

export function playSound(name: FeedbackEvent): void {
  const p = players[name];
  if (!p) return;
  try {
    // Restart from the top; seekTo is async but play() doesn't need to wait.
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // ignore
  }
}
