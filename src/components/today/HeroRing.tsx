import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { fmtDur, sayDur } from '../../domain/time';
import { springs, timings } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';
import { ADET_MARK, ADET_MARK_STROKE } from '../glyphs';

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

export interface HeroSegment {
  key: string;
  color: string;
  track: string;
  /** 0..1 progress toward the habit's share (1 when done). */
  frac: number;
}

interface HeroRingProps {
  segments: HeroSegment[];
  trackedSec: number;
  capacitySec: number;
  /**
   * Every planned habit is done. Only then does the ring close into the Adet
   * check; it never shows before (and never for an empty plan).
   */
  complete: boolean;
  day: string;
  size?: number;
  /** Called once the check has drawn itself in after completing on screen. */
  onCheckDrawn?(): void;
}

const SEG = 14;
const CAP = 4;
const GAP_DEG = 10;
const MARK_LEN = 212;
const MARK_VIEWBOX = '10.9 18.3 78.2 65.3';
const MARK_ASPECT = 78.2 / 65.3;

function arcPath(c: number, r: number, from: number, to: number): string {
  const pt = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(c + r * Math.cos(rad)).toFixed(2)} ${(c + r * Math.sin(rad)).toFixed(2)}`;
  };
  return `M${pt(from)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${pt(to)}`;
}

function Segment({ d, len, color, frac, width }: { d: string; len: number; color: string; frac: number; width: number }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(frac);
  useEffect(() => {
    v.value = reduced ? withTiming(frac, timings.fade) : withSpring(frac, springs.progress);
  }, [frac, reduced, v]);
  const props = useAnimatedProps(() => ({
    strokeDashoffset: len * (1 - Math.max(0, Math.min(1, v.value))),
    strokeOpacity: v.value > 0.004 ? 1 : 0,
  }));
  return <APath d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${len} ${len}`} animatedProps={props} />;
}

/**
 * The day at a glance: one ring segment per planned habit in its project's
 * color, filling toward its share, with today's total time in the middle and
 * a thin capacity arc around the outside (a lighter second lap past it).
 */
export function HeroRing({ segments, trackedSec, capacitySec, complete, day, size = 220, onCheckDrawn }: HeroRingProps) {
  const t = useTheme();
  const { colors } = t;
  const reduced = useReducedMotion();
  const c = size / 2;
  const rCap = c - CAP / 2 - 1;
  const rSeg = rCap - CAP / 2 - 8 - SEG / 2;
  const n = Math.max(1, segments.length);
  const seg = 360 / n;
  const gap = n === 1 ? 0 : GAP_DEG;

  // 0 = ring, 1 = check.
  const morph = useSharedValue(complete ? 1 : 0);
  const draw = useSharedValue(complete ? 1 : 0);
  const shown = useRef({ day, complete });
  useEffect(() => {
    const prev = shown.current;
    shown.current = { day, complete };
    if (!complete) {
      morph.value = withTiming(0, timings.fade);
      draw.value = 0;
      return;
    }
    // Opened on a finished day: no replay.
    if (prev.complete && prev.day === day) return;
    if (prev.day !== day) {
      morph.value = 1;
      draw.value = 1;
      return;
    }
    if (reduced) {
      draw.value = 1;
      morph.value = withTiming(1, timings.fade);
      return;
    }
    // Let the closing segment fill first, then the ring gives way to the mark drawing itself.
    morph.value = withDelay(450, withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }));
    draw.value = withDelay(520, withTiming(1, timings.draw));
    if (onCheckDrawn) setTimeout(onCheckDrawn, 1250);
  }, [complete, day, reduced, morph, draw, onCheckDrawn]);

  const ringStyle = useAnimatedStyle(() => ({ opacity: 1 - morph.value, transform: [{ scale: 1 - morph.value * 0.15 }] }));
  const markStyle = useAnimatedStyle(() => ({ opacity: morph.value, transform: [{ scale: 0.7 + morph.value * 0.3 }] }));
  const markProps = useAnimatedProps(() => ({ strokeDashoffset: MARK_LEN * (1 - draw.value) }));

  // Capacity arc: today's time against today's capacity.
  const capCirc = 2 * Math.PI * rCap;
  const capFrac = capacitySec > 0 ? trackedSec / capacitySec : trackedSec > 0 ? 1 : 0;
  const cap = useSharedValue(capFrac);
  useEffect(() => {
    cap.value = reduced ? withTiming(capFrac, timings.fade) : withSpring(capFrac, springs.progress);
  }, [capFrac, reduced, cap]);
  const lap1 = useAnimatedProps(() => ({ strokeDashoffset: capCirc * (1 - Math.max(0, Math.min(1, cap.value))) }));
  const lap2 = useAnimatedProps(() => ({ strokeDashoffset: capCirc * (1 - Math.max(0, Math.min(1, cap.value - 1))) }));

  // Time added in a jump (a saved session, a quick log) counts up into the
  // total and the ring gives a little pulse.
  const shownSec = useCountUp(trackedSec, reduced);
  const pulse = useSharedValue(1);
  const lastSec = useRef(trackedSec);
  useEffect(() => {
    if (trackedSec - lastSec.current >= 60 && !reduced) {
      pulse.value = withSequence(withSpring(1.06, springs.bounce), withSpring(1, springs.appear));
    }
    lastSec.current = trackedSec;
  }, [trackedSec, reduced, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const markH = size * 0.42;
  const doneCount = segments.filter((s) => s.frac >= 1).length;

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        complete
          ? `Day complete, ${sayDur(trackedSec)}`
          : `${sayDur(trackedSec)} today, ${doneCount} of ${segments.length} done`
      }
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, pulseStyle]}
    >
      <Animated.View style={[{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }, ringStyle]}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          {/* Capacity */}
          <G rotation={-90} origin={`${c}, ${c}`}>
            <Circle cx={c} cy={c} r={rCap} fill="none" stroke={colors.track} strokeWidth={CAP} />
            <ACircle cx={c} cy={c} r={rCap} fill="none" stroke={colors.brand} strokeWidth={CAP} strokeLinecap="round" strokeDasharray={`${capCirc} ${capCirc}`} animatedProps={lap1} />
            <ACircle cx={c} cy={c} r={rCap} fill="none" stroke={t.brand.bonus} strokeWidth={CAP} strokeLinecap="round" strokeDasharray={`${capCirc} ${capCirc}`} animatedProps={lap2} />
          </G>
          {/* Planned habits */}
          {segments.map((s, i) => {
            const from = i * seg + gap / 2;
            const to = n === 1 ? 359.9 : (i + 1) * seg - gap / 2;
            const d = arcPath(c, rSeg, from, to);
            const len = (Math.PI * rSeg * (to - from)) / 180;
            return (
              <G key={s.key}>
                <Path d={d} fill="none" stroke={s.track} strokeWidth={SEG} strokeLinecap="round" />
                <Segment d={d} len={len} color={s.color} frac={s.frac} width={SEG} />
              </G>
            );
          })}
          {!segments.length && <Circle cx={c} cy={c} r={rSeg} fill="none" stroke={colors.track} strokeWidth={SEG} />}
        </Svg>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontSize: size * 0.17, fontWeight: '800', letterSpacing: -0.5, color: colors.ink, fontVariant: ['tabular-nums'], maxWidth: rSeg * 1.5 }}
        >
          {fmtDur(shownSec)}
        </Text>
      </Animated.View>

      {complete && (
        <Animated.View style={markStyle}>
          <Svg width={markH * MARK_ASPECT} height={markH} viewBox={MARK_VIEWBOX} fill="none">
            <APath
              d={ADET_MARK}
              stroke={colors.brand}
              strokeWidth={ADET_MARK_STROKE * 1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${MARK_LEN} ${MARK_LEN}`}
              animatedProps={markProps}
            />
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** A number that counts up to jumps over ~0.7s (JS-side; it's a few frames of text). */
function useCountUp(value: number, reduced: boolean): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reduced || value - start < 60) {
      setShown(value);
      return;
    }
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / 700);
      const e = 1 - (1 - k) ** 3;
      setShown(start + (value - start) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return shown;
}
