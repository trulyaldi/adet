import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme/tokens';
import { ADET_MARK, ADET_MARK_STROKE } from './glyphs';
import { useReducedMotion } from '../theme/useMotion';

interface DayRingProps {
  /** Planned habits (segments). */
  total: number;
  /** Planned habits done (filled segments). */
  done: number;
  /**
   * The day is finished (every planned habit done, or nothing was due): the
   * ring becomes the Adet check. Animated when it happens on screen; shown
   * as is when the screen opens on a finished day.
   */
  complete: boolean;
  /** The day the ring is for; a new day resets it. */
  day: string;
  size?: number;
  accent: string;
}

const STROKE = 10;
/** Gap between segments, in degrees. */
const GAP_DEG = 14;
/** The Adet mark's path length in its own units (measured), plus a little slack. */
const MARK_LEN = 212;
/** The mark's bounds in its 100x100 space (see AdetMark). */
const MARK_VIEWBOX = '10.9 18.3 78.2 65.3';
const MARK_ASPECT = 78.2 / 65.3;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function arc(c: number, r: number, fromDeg: number, toDeg: number): string {
  const p = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${c + r * Math.cos(rad)} ${c + r * Math.sin(rad)}`;
  };
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M${p(fromDeg)}A${r} ${r} 0 ${large} 1 ${p(toDeg)}`;
}

/**
 * Today's progress: one ring segment per planned habit, filled as each is
 * done. When the last one fills, the ring closes and turns into the Adet
 * check (the stroke draws in with a gentle scale; a plain fade with reduce
 * motion on).
 */
export function DayRing({ total, done, complete, day, size = 150, accent }: DayRingProps) {
  const reduced = useReducedMotion();
  // 0 = ring, 1 = check.
  const morph = useRef(new Animated.Value(complete ? 1 : 0)).current;
  const draw = useRef(new Animated.Value(complete ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(complete ? 1 : 0.86)).current;
  const shown = useRef({ day, complete });

  useEffect(() => {
    const prev = shown.current;
    shown.current = { day, complete };
    const snap = (v: number) => {
      morph.setValue(v);
      draw.setValue(v);
      pop.setValue(v ? 1 : 0.86);
    };
    // A new day, or the plan changed so it's no longer complete: back to the ring.
    if (!complete) return snap(0);
    // Opened on a finished day (or a new finished day): no replay.
    if (prev.complete || prev.day !== day) return snap(1);
    if (reduced) {
      draw.setValue(1);
      pop.setValue(1);
      Animated.timing(morph, { toValue: 1, duration: 280, useNativeDriver: false }).start();
      return;
    }
    snap(0);
    Animated.sequence([
      // Let the closing segment show first.
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(morph, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(draw, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
        Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: false }),
      ]),
    ]).start();
  }, [complete, day, reduced, morph, draw, pop]);

  const c = size / 2;
  const r = c - STROKE / 2 - 1;
  const n = Math.max(1, total);
  const seg = 360 / n;
  const filled = complete ? n : done;
  const markH = size * 0.5;
  const ringScale = morph.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] });

  return (
    <View
      accessible
      accessibilityLabel={complete ? 'Day complete' : `${done} of ${total} done today`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: morph.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ scale: ringScale }],
        }}
      >
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          {n === 1 ? (
            <Circle cx={c} cy={c} r={r} fill="none" stroke={filled >= 1 ? accent : colors.track2} strokeWidth={STROKE} />
          ) : (
            Array.from({ length: n }, (_, i) => (
              <Path
                key={i}
                d={arc(c, r, i * seg + GAP_DEG / 2, (i + 1) * seg - GAP_DEG / 2)}
                fill="none"
                stroke={i < filled ? accent : colors.track2}
                strokeWidth={STROKE}
                strokeLinecap="round"
              />
            ))
          )}
        </Svg>
        <Text style={{ fontSize: size * 0.2, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>
          {done}/{total}
        </Text>
      </Animated.View>

      <Animated.View style={{ opacity: morph, transform: [{ scale: pop }] }}>
        <Svg width={markH * MARK_ASPECT} height={markH} viewBox={MARK_VIEWBOX} fill="none">
          <AnimatedPath
            d={ADET_MARK}
            stroke={accent}
            strokeWidth={ADET_MARK_STROKE * 1.15}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${MARK_LEN} ${MARK_LEN}`}
            strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [MARK_LEN, 0] })}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
