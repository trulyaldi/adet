import React, { useEffect, useRef } from 'react';

import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { feedback } from '../../feedback/feedback';
import { timings } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';
import { Flame } from '../Flame';
import { Glyph } from '../Glyph';
import { Text } from '../Text';

/**
 * The campfire and day count; bounces (with the streak sound) when the streak
 * grows on screen. `shielded`: a freeze kept it lit, shown as a small ember shield.
 */
export function StreakPill({ days, shielded = false }: { days: number; shielded?: boolean }) {
  const { colors, radius } = useTheme();
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const prev = useRef(days);
  useEffect(() => {
    if (days > prev.current) {
      feedback('streak_up');
      if (!reduced) s.value = withSequence(withTiming(1.12, timings.quick), withTiming(1, timings.fade));
    }
    prev.current = days;
  }, [days, reduced, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${days} day streak${shielded ? ', kept by an ember shield' : ''}`}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, borderRadius: radius.pill, paddingVertical: 5, paddingLeft: 8, paddingRight: 12, borderWidth: 2, borderColor: colors.line }, style]}
    >
      <Flame days={days} size={20} />
      {shielded && <Glyph name="quest" size={14} color={colors.amber} bg={colors.card} />}
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{days}</Text>
    </Animated.View>
  );
}
