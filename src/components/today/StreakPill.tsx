import React, { useEffect, useRef } from 'react';

import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { feedback } from '../../feedback/feedback';
import { springs } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';
import { Flame } from '../Flame';
import { Text } from '../Text';

/** Flame and day count; bounces (with the streak sound) when the streak grows on screen. */
export function StreakPill({ days }: { days: number }) {
  const { colors, radius } = useTheme();
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const prev = useRef(days);
  useEffect(() => {
    if (days > prev.current) {
      feedback('streak_up');
      if (!reduced) s.value = withSequence(withSpring(1.25, springs.bounce), withSpring(1, springs.bounce));
    }
    prev.current = days;
  }, [days, reduced, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${days} day streak`}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, borderRadius: radius.pill, paddingVertical: 5, paddingLeft: 8, paddingRight: 12, borderWidth: 2, borderColor: colors.line }, style]}
    >
      <Flame days={days} size={20} />
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{days}</Text>
    </Animated.View>
  );
}
