// Shared motion presets. Every animation in the app picks one of these, so
// press, appear, reorder, progress and celebration all feel like one family.

import { Easing, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

export const springs = {
  /** A tactile button going down and back up. */
  press: { damping: 14, stiffness: 520, mass: 0.6 } satisfies WithSpringConfig,
  /** Cards and sheets settling into place. */
  appear: { damping: 18, stiffness: 180, mass: 0.9 } satisfies WithSpringConfig,
  /** Rows moving to make room while reordering. */
  reorder: { damping: 20, stiffness: 260, mass: 0.8 } satisfies WithSpringConfig,
  /** Bars and rings filling to a new value, with a slight overshoot. */
  progress: { damping: 13, stiffness: 110, mass: 1 } satisfies WithSpringConfig,
  /** Badges and checkmarks popping in. */
  celebrate: { damping: 9, stiffness: 160, mass: 0.8 } satisfies WithSpringConfig,
  /** Small bounces (active tab, streak pill). */
  bounce: { damping: 7, stiffness: 300, mass: 0.6 } satisfies WithSpringConfig,
};

export const timings = {
  fade: { duration: 220, easing: Easing.out(Easing.quad) } satisfies WithTimingConfig,
  quick: { duration: 140, easing: Easing.out(Easing.quad) } satisfies WithTimingConfig,
  draw: { duration: 700, easing: Easing.inOut(Easing.cubic) } satisfies WithTimingConfig,
  /** The shine sweeping across a bar after it fills. */
  shine: { duration: 900, easing: Easing.inOut(Easing.quad) } satisfies WithTimingConfig,
  /** Idle breathing in scenes and the companion. */
  breathe: { duration: 2600, easing: Easing.inOut(Easing.sin) } satisfies WithTimingConfig,
};

/** Delay between cards rising in, per index. */
export const STAGGER_MS = 45;
/** How far a card rises as it appears. */
export const RISE_PX = 12;

/** iOS presents one modal at a time: wait this long after closing one before opening the next. */
export const MODAL_GAP_MS = 450;
