import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { RISE_PX, springs, STAGGER_MS } from '../../theme/motion';
import { useReducedMotion } from '../../theme/useMotion';

/** Entering animation for card `index` in a list: a small staggered rise (a fade with reduce motion). */
export function useEnter(index = 0) {
  const reduced = useReducedMotion();
  if (reduced) return FadeIn.duration(200);
  return FadeInDown.delay(Math.min(index, 8) * STAGGER_MS)
    .springify()
    .damping(springs.appear.damping)
    .stiffness(springs.appear.stiffness)
    .mass(springs.appear.mass)
    .withInitialValues({ opacity: 0, transform: [{ translateY: RISE_PX }] });
}

/** Layout transition for list reorder and rows collapsing (none with reduce motion). */
export function useLayoutMotion() {
  const reduced = useReducedMotion();
  return reduced ? undefined : LinearTransition.springify().damping(springs.reorder.damping).stiffness(springs.reorder.stiffness);
}

/** A card that rises in with the list's stagger and moves smoothly when the list changes. */
export function Appear({ index = 0, style, children }: { index?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const entering = useEnter(index);
  const layout = useLayoutMotion();
  return (
    <Animated.View entering={entering} exiting={FadeOut.duration(160)} layout={layout} style={style}>
      {children}
    </Animated.View>
  );
}

/** A tab's screen coming in: a quick fade with a small spring rise (plain fade with reduce motion). */
export function ScreenIn({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const entering = reduced
    ? FadeIn.duration(160)
    : FadeInDown.springify().damping(springs.appear.damping).stiffness(springs.appear.stiffness).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });
  return (
    <Animated.View entering={entering} style={{ flex: 1 }}>
      {children}
    </Animated.View>
  );
}
