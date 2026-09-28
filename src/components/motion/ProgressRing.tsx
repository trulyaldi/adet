import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { springs, timings } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';

const ACircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  size: number;
  stroke: number;
  /** Progress toward the target: 1 = one full lap. Past 1 a second lap draws in `bonusColor`. */
  value: number;
  color: string;
  bonusColor?: string;
  track?: string;
  /**
   * A live timer: ease linearly over each second instead of springing, so
   * the ring moves continuously.
   */
  live?: boolean;
  /** Draw the target marker (a notch at 12 o'clock where the lap completes). */
  marker?: boolean;
  children?: React.ReactNode;
  label?: string;
}

/**
 * A progress ring that springs to new values with a slight overshoot and
 * sends a shine along the fill as it grows. Time past the target keeps
 * counting as a lighter bonus lap.
 */
export function ProgressRing({ size, stroke, value, color, bonusColor, track, live, marker, children, label }: ProgressRingProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2 - 1;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(2, value));
  const p = useSharedValue(v);
  const shine = useSharedValue(0);

  useEffect(() => {
    if (live || reduced) {
      p.value = withTiming(v, live ? { duration: 1000, easing: Easing.linear } : timings.fade);
      return;
    }
    const grew = v > p.value + 0.005;
    p.value = withSpring(v, springs.progress);
    if (grew) shine.value = withSequence(withTiming(0, { duration: 0 }), withDelay(300, withTiming(1, timings.shine)));
  }, [v, live, reduced, p, shine]);

  const lap1 = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - Math.max(0, Math.min(1, p.value))) }));
  const lap2 = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - Math.max(0, Math.min(1, p.value - 1))) }));
  // A short bright arc travelling from the start to the fill's end.
  const shineLen = circ * 0.06;
  const head = useDerivedValue(() => Math.min(1, p.value) * shine.value);
  const shineProps = useAnimatedProps(() => ({
    strokeDashoffset: -(circ * head.value - shineLen),
    strokeOpacity: shine.value > 0 && shine.value < 1 ? 0.55 : 0,
  }));

  return (
    <View
      accessible={!!label}
      accessibilityLabel={label}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${c}, ${c}`}>
          <Circle cx={c} cy={c} r={r} fill="none" stroke={track ?? colors.track} strokeWidth={stroke} />
          <ACircle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} animatedProps={lap1} />
          {bonusColor && (
            <ACircle cx={c} cy={c} r={r} fill="none" stroke={bonusColor} strokeWidth={stroke * 0.62} strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} animatedProps={lap2} />
          )}
          {!reduced && (
            <ACircle cx={c} cy={c} r={r} fill="none" stroke="#FFFFFF" strokeWidth={stroke * 0.45} strokeLinecap="round" strokeDasharray={`${shineLen} ${circ}`} animatedProps={shineProps} />
          )}
        </G>
        {marker && (
          // The target notch: a small ring-colored bead with a card-colored core.
          <>
            <Circle cx={c} cy={c - r} r={stroke * 0.62} fill={colors.card} stroke={color} strokeWidth={2.5} />
          </>
        )}
      </Svg>
      {children}
    </View>
  );
}
