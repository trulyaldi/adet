import React from 'react';
import { Text } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { TargetCheck } from '../domain/capacity';
import { fmtDur } from '../domain/time';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../theme/useMotion';
import { Glyph, IconButton } from './Glyph';

/**
 * A calm amber pill when weekly targets ask for more than the week's
 * capacity ("28h / 19h" with a clock). Tap to fix it. Never an alert.
 */
export function CapacityIndicator({ check, onPress }: { check: TargetCheck; onPress(): void }) {
  const { colors, radius } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View key={check.signature} entering={reduced ? FadeIn : FadeInDown.springify().damping(14)} style={{ alignSelf: 'flex-start', marginTop: 12 }}>
      <IconButton
        label={`Weekly targets ${fmtDur(check.targetMin * 60)}, more than the week's ${fmtDur(check.capacityMin * 60)}. Tap to balance`}
        onPress={onPress}
        bg={colors.amberBg}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill }}
      >
        <Glyph name="clock" size={16} color={colors.amber} bg={colors.amberBg} />
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.amber, fontVariant: ['tabular-nums'] }}>
          {fmtDur(check.targetMin * 60)} / {fmtDur(check.capacityMin * 60)}
        </Text>
      </IconButton>
    </Animated.View>
  );
}
