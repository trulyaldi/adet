import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../theme/useMotion';
import { AdetMark } from './AdetMark';

/** The loading screen: the Adet mark, softly breathing (still with reduce motion). */
export function Loading() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const b = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    b.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    return () => cancelAnimation(b);
  }, [reduced, b]);
  const style = useAnimatedStyle(() => ({ opacity: 0.55 + b.value * 0.45, transform: [{ scale: 0.96 + b.value * 0.06 }] }));
  return (
    <View accessible accessibilityLabel="Loading" style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={style}>
        <AdetMark height={48} color={colors.brand} />
      </Animated.View>
    </View>
  );
}
