import React, { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThisWeek } from '../../domain/stats';
import { fmtDur, fmtH, sayDur } from '../../domain/time';
import { springs, timings } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';
import { ScreenIlmek } from '../ilmek/ScreenIlmek';
import { Press } from '../motion/Press';
import { arcPath, ProjectInfo, TextNum, TrendMark } from './common';

const APath = Animated.createAnimatedComponent(Path);

const SIZE = 132;
const STROKE = 14;
const GAP_DEG = 2.5;

/**
 * This week at a glance: a ring toward the combined weekly target, segmented
 * by project color, with the total inside; the change against this time last
 * week; a dot per day with time; and Ilmek. Tap to jump to the daily chart.
 */
export const WeekHero = memo(function WeekHero({ week, info, onPress }: { week: ThisWeek; info: Map<string, ProjectInfo>; onPress(): void }) {
  const t = useTheme();
  const { colors } = t;
  const c = SIZE / 2;
  const r = c - STROKE / 2 - 1;
  // The full circle is the target (or the week's total when nothing has a target, or it's passed).
  const full = Math.max(week.targetSec, week.totalSec, 1);
  let at = 0;
  const segs = week.slices.map((s) => {
    const from = (at / full) * 360;
    at += s.sec;
    const to = (at / full) * 360;
    return { id: s.projectId, from, to, color: t.swatch(info.get(s.projectId)?.look.color ?? 'indigo').base };
  });
  const pct = week.targetSec > 0 ? Math.round((week.totalSec / week.targetSec) * 100) : null;
  const label = `This week, ${sayDur(week.totalSec)}${pct !== null ? `, ${pct}% of ${fmtH(week.targetSec)} target` : ''}. Show the daily chart`;

  return (
    <Press kind="hero" onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[{ backgroundColor: colors.card, borderRadius: t.radius.xxl, padding: 16 }, t.shadow]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
            <Circle cx={c} cy={c} r={r} fill="none" stroke={colors.track} strokeWidth={STROKE} />
            {segs.map((s, i) => (
              <Segment key={s.id} d={arcPath(c, c, r, s.from, Math.min(359.9, Math.max(s.from + 0.5, s.to - (segs.length > 1 ? GAP_DEG : 0))))} len={(Math.PI * r * Math.max(0.5, s.to - s.from)) / 180} color={s.color} order={i} />
            ))}
          </Svg>
          <TextNum numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 22, letterSpacing: -0.5, maxWidth: r * 1.45 }}>
            {fmtDur(week.totalSec)}
          </TextNum>
          {week.targetSec > 0 && <TextNum style={{ fontSize: 12.5, color: colors.sub }}>{`/ ${fmtH(week.targetSec)}`}</TextNum>}
        </View>

        <View style={{ flex: 1, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TrendMark trend={week.trend} deltaSec={week.totalSec - week.lastWeekSec} size={17} />
            <ScreenIlmek state={week.mood} size={64} decorative />
          </View>
          <DayDots dots={week.dots} />
        </View>
      </View>
    </Press>
  );
});

/** One ring segment, drawing itself in once (a fade with reduce motion). */
function Segment({ d, len, color, order }: { d: string; len: number; color: string; order: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  const o = useSharedValue(reduced ? 0 : 1);
  useEffect(() => {
    if (reduced) o.value = withTiming(1, timings.fade);
    else p.value = withSpring(1, springs.progress);
  }, [reduced, p, o, order]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value), strokeOpacity: o.value }));
  return <APath d={d} fill="none" stroke={color} strokeWidth={STROKE} strokeDasharray={`${len} ${len}`} animatedProps={props} />;
}

/** M–S: filled for days with time, outlined without (never a failure mark), today ringed. */
function DayDots({ dots }: { dots: ThisWeek['dots'] }) {
  const { colors } = useTheme();
  const logged = dots.filter((d) => d.logged).length;
  return (
    <View accessible accessibilityLabel={`Time logged on ${logged} of 7 days this week`} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {dots.map((d) => (
        <View key={d.day} style={{ alignItems: 'center', gap: 5 }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: d.today ? 2 : 0,
              borderColor: colors.brand,
            }}
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: d.logged ? colors.brand : 'transparent',
                borderWidth: d.logged ? 0 : 1.5,
                borderColor: colors.track,
                opacity: d.future ? 0.6 : 1,
              }}
            />
          </View>
          <TextNum style={{ fontSize: 11, color: d.today ? colors.ink : colors.muted }}>{d.letter}</TextNum>
        </View>
      ))}
    </View>
  );
}
