import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';
import { useAppActive, useReducedMotion } from '../theme/useMotion';

/**
 * Adet's companion: Dot, a soft rounded drop in brand blue with big eyes.
 * `idle` breathes and blinks, `sleepy` dozes (closed eyes, drifting z's),
 * `cheer` hops with happy eyes and raised arms. Original art, drawn in SVG.
 */
export type CompanionMood = 'idle' | 'sleepy' | 'cheer';

const AEllipse = Animated.createAnimatedComponent(Ellipse);

// A soft drop: rounded bottom, gently pointed top.
const BODY = 'M50 10C62 22 84 38 84 62C84 81 69 92 50 92C31 92 16 81 16 62C16 38 38 22 50 10Z';
const SHINE = 'M34 40C36 33 41 28 46 25';

export function Companion({ mood = 'idle', size = 96 }: { mood?: CompanionMood; size?: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const active = useAppActive();
  const breathe = useSharedValue(0);
  const blink = useSharedValue(1);
  const hop = useSharedValue(0);
  const z = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(breathe);
    cancelAnimation(blink);
    cancelAnimation(hop);
    cancelAnimation(z);
    breathe.value = 0;
    blink.value = 1;
    hop.value = 0;
    z.value = 0;
    if (reduced || !active) return;
    const slow = mood === 'sleepy' ? 3600 : 2400;
    breathe.value = withRepeat(withTiming(1, { duration: slow, easing: Easing.inOut(Easing.sin) }), -1, true);
    if (mood === 'idle') {
      blink.value = withRepeat(withSequence(withDelay(3200, withTiming(0.1, { duration: 70 })), withTiming(1, { duration: 110 })), -1);
    }
    if (mood === 'cheer') {
      hop.value = withRepeat(withSequence(withSpring(1, { damping: 6, stiffness: 260 }), withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) })), 4);
    }
    if (mood === 'sleepy') z.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1);
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(blink);
      cancelAnimation(hop);
      cancelAnimation(z);
    };
  }, [mood, reduced, active, breathe, blink, hop, z]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -hop.value * size * 0.18 + size * 0.46 },
      { scaleY: 1 + breathe.value * 0.035 - hop.value * 0.04 },
      { scaleX: 1 - breathe.value * 0.02 + hop.value * 0.03 },
      { translateY: -size * 0.46 },
    ],
  }));
  const eyeProps = useAnimatedProps(() => ({ ry: 9 * blink.value }));
  // The z's float in their own view: SVG group transforms can't be animated natively.
  const zStyle = useAnimatedStyle(() => ({
    opacity: z.value < 0.15 ? z.value / 0.15 : 1 - (z.value - 0.15) / 0.85,
    transform: [{ translateX: (z.value * 8 * size) / 100 }, { translateY: (-z.value * 14 * size) / 100 }],
  }));

  const blue = t.brand.base;
  const dark = t.brand.dark;
  const eyeWhite = '#FFFFFF';
  const pupil = '#15171C';

  const label = mood === 'cheer' ? 'Adet companion, cheering' : mood === 'sleepy' ? 'Adet companion, dozing' : 'Adet companion';

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size }}>
      <Animated.View style={[{ width: size, height: size }, bodyStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* Shadow */}
          <Ellipse cx={50} cy={95} rx={24} ry={3.5} fill={t.colors.shadow} opacity={0.12} />
          {/* Arms: raised when cheering */}
          {mood === 'cheer' ? (
            <>
              <Path d="M20 58C12 50 10 42 12 34" stroke={blue} strokeWidth={8} strokeLinecap="round" fill="none" />
              <Path d="M80 58C88 50 90 42 88 34" stroke={blue} strokeWidth={8} strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <Path d="M19 66C14 70 13 75 15 79" stroke={dark} strokeWidth={7} strokeLinecap="round" fill="none" />
              <Path d="M81 66C86 70 87 75 85 79" stroke={dark} strokeWidth={7} strokeLinecap="round" fill="none" />
            </>
          )}
          <Path d={BODY} fill={blue} />
          <Path d={SHINE} stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={5} strokeLinecap="round" fill="none" />
          {/* Cheeks */}
          <Ellipse cx={29} cy={70} rx={6} ry={3.5} fill="#FF8FB1" opacity={0.55} />
          <Ellipse cx={71} cy={70} rx={6} ry={3.5} fill="#FF8FB1" opacity={0.55} />
          {/* Eyes */}
          {mood === 'idle' && (
            <>
              <AEllipse cx={38} cy={58} rx={7.5} fill={eyeWhite} animatedProps={eyeProps} />
              <AEllipse cx={62} cy={58} rx={7.5} fill={eyeWhite} animatedProps={eyeProps} />
              <Ellipse cx={39.5} cy={59.5} rx={3.6} ry={4.2} fill={pupil} />
              <Ellipse cx={63.5} cy={59.5} rx={3.6} ry={4.2} fill={pupil} />
            </>
          )}
          {mood === 'sleepy' && (
            <>
              <Path d="M31 60C35 64 41 64 45 60" stroke={pupil} strokeWidth={3} strokeLinecap="round" fill="none" />
              <Path d="M55 60C59 64 65 64 69 60" stroke={pupil} strokeWidth={3} strokeLinecap="round" fill="none" />
            </>
          )}
          {mood === 'cheer' && (
            <>
              <Path d="M31 61C34 55 42 55 45 61" stroke={pupil} strokeWidth={3.4} strokeLinecap="round" fill="none" />
              <Path d="M55 61C58 55 66 55 69 61" stroke={pupil} strokeWidth={3.4} strokeLinecap="round" fill="none" />
            </>
          )}
          {/* Mouth */}
          {mood === 'cheer' ? (
            <Path d="M43 71C45 77 55 77 57 71Z" fill={pupil} />
          ) : (
            <Path d={mood === 'sleepy' ? 'M47 73C49 74 51 74 53 73' : 'M45 71C48 74 52 74 55 71'} stroke={pupil} strokeWidth={2.6} strokeLinecap="round" fill="none" />
          )}
        </Svg>
      </Animated.View>
      {/* Drifting z's while dozing (drawn, not text) */}
      {mood === 'sleepy' && (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, zStyle]}>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Path d="M72 26h7l-7 8h7" stroke={t.colors.sub} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Path d="M82 14h5l-5 6h5" stroke={t.colors.sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}
