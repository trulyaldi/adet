import React, { memo, useState } from 'react';
import { View } from 'react-native';

import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { dayLetters, FocusHours } from '../../domain/stats';
import { sayDur } from '../../domain/time';
import { useTheme } from '../../theme/ThemeProvider';
import { Press } from '../motion/Press';
import { StatsCard, TextNum } from './common';
import { Text } from '../Text';

const MARKS = [0, 6, 12, 18];

/** A cell's fill: brand blue from faint (little) to full (the busiest). */
function shade(v: number): number {
  return v <= 0 ? 0.08 : 0.18 + 0.82 * v;
}

/**
 * Best focus time over the last four weeks: a 24-hour strip whose cells
 * deepen with the time focused in each hour, the peak window marked above.
 * Tap to open the weekday × hour grid with a legend.
 */
export const FocusTime = memo(function FocusTime({ focus }: { focus: FocusHours }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [w, setW] = useState(0);
  const max = Math.max(1, ...focus.hours);
  const peak = focus.peak;
  const cell = w / 24;
  const peakLabel = peak ? `${peak.start}–${peak.end === 0 ? 24 : peak.end}` : '';
  // The peak may wrap past midnight: draw it as one or two runs.
  const runs: [number, number][] = !peak
    ? []
    : peak.end > peak.start
      ? [[peak.start, peak.end]]
      : ([[peak.start, 24], [0, peak.end]] as [number, number][]).filter(([a, b]) => b > a);
  const peakLen = peak ? (peak.end - peak.start + 24) % 24 || 24 : 0;
  const labelX = peak ? ((peak.start + peakLen / 2) % 24) * cell : 0;

  return (
    <StatsCard glyph="clock" label="Best focus time, last 4 weeks">
      <Press
        kind="card"
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={peak ? `Best focus time ${peak.start} to ${peak.end === 0 ? 24 : peak.end} hours, ${sayDur(peak.sec)} in the last 4 weeks. Show by weekday` : 'Focus time by hour'}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
      >
        {w > 0 && (
          <Svg width={w} height={62}>
            {runs.map(([a, b]) => (
              <Line key={a} x1={a * cell + 2} x2={b * cell - 2} y1={20} y2={20} stroke={colors.brand} strokeWidth={4} strokeLinecap="round" />
            ))}
            {peak && (
              <SvgText x={Math.min(w - 16, Math.max(16, labelX))} y={11} fontSize={12} fontWeight="800" fill={colors.ink} textAnchor="middle">
                {peakLabel}
              </SvgText>
            )}
            {focus.hours.map((s, h) => (
              <Rect key={h} x={h * cell + 1} y={28} width={cell - 2} height={20} rx={3} fill={colors.brand} opacity={shade(s / max)} />
            ))}
            {MARKS.map((m) => (
              <SvgText key={m} x={m * cell + 1} y={60} fontSize={10} fontWeight="700" fill={colors.muted}>
                {m}
              </SvgText>
            ))}
          </Svg>
        )}
      </Press>
      {open && <Grid focus={focus} />}
    </StatsCard>
  );
});

/** Weekday rows × 24 hours, with hour marks and a light → dark legend. */
function Grid({ focus }: { focus: FocusHours }) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const letters = dayLetters();
  const max = Math.max(1, ...focus.grid.flat());
  const left = 16;
  const cell = (w - left) / 24;
  const rowH = 16;
  return (
    <Animated.View entering={FadeIn.duration(180)} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessible accessibilityLabel="Focus time by weekday and hour" style={{ gap: 10 }}>
      {w > 0 && (
        <Svg width={w} height={7 * rowH + 16}>
          {focus.grid.map((row, d) => (
            <React.Fragment key={d}>
              <SvgText x={0} y={d * rowH + 11} fontSize={10} fontWeight="700" fill={colors.muted}>
                {letters[d]}
              </SvgText>
              {row.map((s, h) => (
                <Rect key={h} x={left + h * cell + 0.75} y={d * rowH + 1} width={cell - 1.5} height={rowH - 2} rx={2} fill={colors.brand} opacity={shade(s / max)} />
              ))}
            </React.Fragment>
          ))}
          {MARKS.map((m) => (
            <SvgText key={m} x={left + m * cell} y={7 * rowH + 13} fontSize={10} fontWeight="700" fill={colors.muted}>
              {m}
            </SvgText>
          ))}
        </Svg>
      )}
      <View accessible accessibilityLabel="Lighter is less time, darker is more" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }}>
        <TextNum style={{ fontSize: 11, color: colors.muted }}>0</TextNum>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <View key={v} style={{ width: 14, height: 10, borderRadius: 2, backgroundColor: colors.brand, opacity: shade(v) }} />
        ))}
        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.muted }}>{`${Math.max(1, Math.round(max / 3600))}h`}</Text>
      </View>
    </Animated.View>
  );
}
