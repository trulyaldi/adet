import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';

import { colors, radius } from '../theme/tokens';
import { Glyph } from './Glyph';
import { useReducedMotion } from './useReducedMotion';

export const AMBER = '#E08A00';

interface BudgetBarProps {
  /** Planned full minutes. */
  usedMin: number;
  budgetMin: number;
  accent: string;
  /**
   * Bump to flash the bar amber and shake it once, e.g. when a swap would go
   * over the budget and was blocked.
   */
  shakeKey?: number;
}

/** A thin bar of planned minutes against the daily budget, with "38/60" and a clock glyph. */
export function BudgetBar({ usedMin, budgetMin, accent, shakeKey = 0 }: BudgetBarProps) {
  const shake = useRef(new Animated.Value(0)).current;
  const [flash, setFlash] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!shakeKey) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 900);
    if (!reduced) {
      shake.setValue(0);
      Animated.sequence(
        [8, -8, 6, -6, 3, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 55, useNativeDriver: true }))
      ).start();
    }
    return () => clearTimeout(t);
  }, [shakeKey, reduced, shake]);

  const over = usedMin > budgetMin;
  const warn = flash || over;
  const pct = budgetMin > 0 ? Math.min(100, (usedMin / budgetMin) * 100) : 0;
  const tone = warn ? AMBER : accent;

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${usedMin} of ${budgetMin} minutes planned`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, transform: [{ translateX: shake }] }}
    >
      <Glyph name="clock" size={14} color={warn ? AMBER : colors.subtext} />
      <View style={{ flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.track2, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: radius.pill, backgroundColor: tone }} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: '700', color: warn ? AMBER : colors.subtext, fontVariant: ['tabular-nums'] }}>
        {usedMin}/{budgetMin}
      </Text>
    </Animated.View>
  );
}
