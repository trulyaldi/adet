import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { springs, timings } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';

interface AnimatedBarProps {
  /** 0..1 (values past 1 are drawn full). */
  value: number;
  color: string;
  track?: string;
  height?: number;
  /** Spoken, e.g. "4 hours 20 minutes of 10 hours this week". */
  label?: string;
}

/**
 * A thick progress bar that springs to each new value (critically damped),
 * then sweeps a shine highlight across the fill. Reduce motion: the value
 * shows at once, no shine.
 */
export function AnimatedBar({ value, color, track, height = 12, label }: AnimatedBarProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const v = Math.max(0, Math.min(1, value));
  const fill = useSharedValue(0);
  const shine = useSharedValue(-1);

  useEffect(() => {
    if (reduced) {
      // No growing bars with reduce motion: the fill just shows its value.
      fill.value = v;
      return;
    }
    const grew = v > fill.value + 0.001;
    fill.value = withSpring(v, springs.progress);
    if (grew && v > 0) {
      cancelAnimation(shine);
      shine.value = -1;
      shine.value = withDelay(350, withSequence(withTiming(1, timings.shine), withTiming(-1, { duration: 0 })));
    }
  }, [v, reduced, fill, shine]);

  const fillStyle = useAnimatedStyle(() => ({ width: Math.max(0, Math.min(1.04, fill.value)) * w }));
  const shineStyle = useAnimatedStyle(() => ({
    opacity: shine.value <= -1 ? 0 : 0.55,
    transform: [{ translateX: shine.value * w }],
  }));

  return (
    <View
      accessible={!!label}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height, borderRadius: height / 2, backgroundColor: track ?? colors.track, overflow: 'hidden' }}
    >
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color, overflow: 'hidden' }, fillStyle]}>
        {/* The top highlight gives the fill a soft, glossy edge. */}
        <View style={{ position: 'absolute', left: height / 2, right: height / 2, top: height * 0.2, height: Math.max(2, height * 0.22), borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.35)' }} />
        {/* The shine travels inside the fill only. */}
        <Animated.View
          style={[{ position: 'absolute', pointerEvents: 'none', top: 0, bottom: 0, width: Math.max(20, w * 0.16), backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: height / 2 }, shineStyle]}
        />
      </Animated.View>
    </View>
  );
}
