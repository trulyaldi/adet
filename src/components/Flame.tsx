import React, { useEffect } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useAppActive, useReducedMotion } from '../theme/useMotion';

/** Flame looks by streak length: small at 1–6 days, bigger at 7+, new colors at 30+ and 100+. */
export function flameTier(days: number): { scale: number; outer: string; inner: string } {
  if (days >= 100) return { scale: 1.2, outer: '#7A48F0', inner: '#4FC3FF' };
  if (days >= 30) return { scale: 1.15, outer: '#F2489A', inner: '#FFC01E' };
  if (days >= 7) return { scale: 1.1, outer: '#FF6A2B', inner: '#FFC01E' };
  if (days >= 1) return { scale: 0.95, outer: '#FF8A1F', inner: '#FFD35C' };
  return { scale: 0.9, outer: '#B8BDC7', inner: '#E1E4EA' };
}

const OUTER = 'M12 22c4.4 0 7.4-2.8 7.4-6.9 0-2.9-1.6-5.4-3.4-7.4-.4 1.2-1 2.2-2 2.9C14 7.5 13.3 4 9.9 1.3c.3 2.9-.8 5-2.4 6.9-1.5 1.8-2.8 3.9-2.8 6.9 0 4.1 3 6.9 7.3 6.9z';
const INNER = 'M12 21c2.2 0 3.7-1.4 3.7-3.5 0-1.5-.8-2.8-1.8-3.8-.2.7-.6 1.2-1.1 1.5.1-1.8-.3-3.5-2-4.9.2 1.5-.4 2.6-1.3 3.6-.8.9-1.4 2-1.4 3.6 0 2.1 1.6 3.5 3.9 3.5z';

/**
 * The streak flame: always a gentle flicker (a still flame with reduce
 * motion, or in the background). Grey at 0 days, so its shape still shows.
 */
export function Flame({ days, size = 22 }: { days: number; size?: number }) {
  const reduced = useReducedMotion();
  const active = useAppActive();
  const tier = flameTier(days);
  const f = useSharedValue(0);

  useEffect(() => {
    if (reduced || !active || days <= 0) {
      cancelAnimation(f);
      f.value = 0;
      return;
    }
    f.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }),
        withTiming(-0.6, { duration: 380, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 300, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    return () => cancelAnimation(f);
  }, [reduced, active, days, f]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: size * 0.5 },
      { scaleY: tier.scale * (1 + f.value * 0.06) },
      { scaleX: tier.scale * (1 - f.value * 0.03) },
      { rotate: `${f.value * 3}deg` },
      { translateY: -size * 0.5 },
    ],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={OUTER} fill={tier.outer} />
        <Path d={INNER} fill={tier.inner} />
      </Svg>
    </Animated.View>
  );
}
