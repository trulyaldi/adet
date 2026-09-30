// Shared motion presets. Every animation in the app picks one of these, so
// press, appear, reorder, progress and celebration all feel like one family.

import { Easing, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

export const springs = {
  /** Cards and sheets settling into place. */
  appear: { damping: 18, stiffness: 180, mass: 0.9 } satisfies WithSpringConfig,
  /** Rows moving to make room while reordering, and cards expanding: critically damped, no overshoot. */
  reorder: { damping: 30, stiffness: 260, mass: 0.8, overshootClamping: true } satisfies WithSpringConfig,
  /** Bars and rings filling to a new value: critically damped, no overshoot. */
  progress: { damping: 22, stiffness: 110, mass: 1, overshootClamping: true } satisfies WithSpringConfig,
  /** Badges and checkmarks popping in (celebrations only). */
  celebrate: { damping: 9, stiffness: 160, mass: 0.8 } satisfies WithSpringConfig,
  /** Small bounces (celebrations only: the streak pill, the day-complete ring). */
  bounce: { damping: 7, stiffness: 300, mass: 0.6 } satisfies WithSpringConfig,
};

/**
 * Touch feedback, like iOS system controls: quick and small, no bounce.
 * Press in eases down at once; release returns on a critically damped spring.
 * Bigger things move less. Reduce Motion swaps movement for a dim.
 */
export const press = {
  in: { duration: 90, easing: Easing.out(Easing.quad) } satisfies WithTimingConfig,
  out: { damping: 26, stiffness: 380, mass: 0.8, overshootClamping: true } satisfies WithSpringConfig,
  /** Pressed scale per element size: none (the pixel look presses down a pixel instead). */
  scale: { icon: 1, button: 1, card: 1, hero: 1 },
  /** Everything but chunky buttons moves down this many px when pressed. */
  nudgePx: 1,
  /** Pressed opacity: cards and hero elements dim slightly as a highlight. */
  dim: { icon: 1, button: 1, card: 0.9, hero: 0.9 },
  /** Chunky buttons: the face sinks into its darker edge by this many px (no scale). */
  edgePx: 2,
  /** Pressed opacity with Reduce Motion (no movement). */
  reducedOpacity: 0.85,
};
export type PressKind = keyof typeof press.scale;

export const timings = {
  fade: { duration: 220, easing: Easing.out(Easing.quad) } satisfies WithTimingConfig,
  quick: { duration: 140, easing: Easing.out(Easing.quad) } satisfies WithTimingConfig,
  draw: { duration: 700, easing: Easing.inOut(Easing.cubic) } satisfies WithTimingConfig,
  /** The shine sweeping across a bar after it fills. */
  shine: { duration: 900, easing: Easing.inOut(Easing.quad) } satisfies WithTimingConfig,
  /** Idle breathing in scenes. */
  breathe: { duration: 2600, easing: Easing.inOut(Easing.sin) } satisfies WithTimingConfig,
};

/** Delay between cards rising in, per index. */
export const STAGGER_MS = 45;
/** How far a card rises as it appears. */
export const RISE_PX = 12;

/** iOS presents one modal at a time: wait this long after closing one before opening the next. */
export const MODAL_GAP_MS = 450;
