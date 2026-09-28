import React from 'react';
import { GestureResponderEvent, Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { press, PressKind } from '../../theme/motion';
import { useReducedMotion } from '../../theme/useMotion';

const APressable = Animated.createAnimatedComponent(Pressable);

/**
 * The app's one press animation (theme/motion `press`). Returns handlers for a
 * Pressable and the style for whatever should move: scale by `kind`, or with
 * `edge` the face sinking into a chunky button's edge. Each press restarts
 * from the current value, so rapid taps never stack. A press cancelled by a
 * scroll or drag gets onPressOut without onPress, and simply returns to rest.
 */
export function usePressMotion(
  kind: PressKind,
  { disabled, edge, opacity = 1 }: { disabled?: boolean; edge?: boolean; /** The element's own resting opacity (the animated style owns opacity). */ opacity?: number } = {},
) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const scale = press.scale[kind];
  const dim = press.dim[kind];

  const style = useAnimatedStyle(() => {
    if (reduced) return { opacity: opacity * (1 - p.value * (1 - press.reducedOpacity)), transform: [{ translateY: 0 }, { scale: 1 }] };
    return {
      opacity: opacity * (1 - p.value * (1 - (edge ? 1 : dim))),
      transform: [{ translateY: edge ? p.value * press.edgePx : 0 }, { scale: edge ? 1 : 1 - p.value * (1 - scale) }],
    };
  });

  const onPressIn = () => {
    if (!disabled) p.value = withTiming(1, press.in);
  };
  const onPressOut = () => {
    p.value = withSpring(0, press.out);
  };
  return { style, onPressIn, onPressOut };
}

type PressProps = Omit<PressableProps, 'style'> & {
  /** How much it moves: icon 0.92, button 0.96, card 0.98 with a dim, hero dims only. */
  kind: PressKind;
  style?: StyleProp<ViewStyle>;
};

/** A Pressable with the shared press animation (see usePressMotion). */
export function Press({ kind, style, disabled, onPressIn, onPressOut, ...rest }: PressProps) {
  const m = usePressMotion(kind, { disabled: !!disabled, opacity: Number(StyleSheet.flatten(style)?.opacity ?? 1) });
  return (
    <APressable
      {...rest}
      disabled={disabled}
      onPressIn={(e: GestureResponderEvent) => {
        m.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        m.onPressOut();
        onPressOut?.(e);
      }}
      style={[style, m.style]}
    />
  );
}
