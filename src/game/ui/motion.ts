// The Quest world's motion, in one place (v2 N9): a few durations everything
// picks from, so sheets, scenes and ceremonies move as one family. Calm rules
// still apply (nothing flashes; reduced motion skips these).

import { withSequence, withTiming } from 'react-native-reanimated';

export const QUEST_MS = {
  /** One step of a hit shake. */
  shake: 40,
  /** A small hop (cheer). */
  hop: 140,
  /** The camera easing onto the avatar. */
  camera: 250,
  /** The HP bar's gold ghost draining. */
  drain: 420,
  /** An iris or panel opening. */
  open: 500,
  /** A banner unrolling. */
  banner: 650,
  /** A pixel burst. */
  burst: 700,
  /** A bar filling. */
  fill: 900,
  /** Light changing (dusk for a nap). */
  light: 1200,
} as const;

/** One soft hit shake: `amp` px each way, then back. */
export function shakeOnce(amp = 2, step: number = QUEST_MS.shake) {
  return withSequence(withTiming(amp, { duration: step }), withTiming(-amp, { duration: step }), withTiming(0, { duration: step * 1.5 }));
}
