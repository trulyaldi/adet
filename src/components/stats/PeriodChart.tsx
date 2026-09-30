import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, SharedValue, useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { chartOf } from '../../domain/selectors';
import { Chart, ChartBar, Period } from '../../domain/stats';
import { fmtDur, fmtH, sayDur } from '../../domain/time';
import { useData, useStoreNow } from '../../store/StreakStore';
import { springs } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';
import { IconButton } from '../Glyph';
import { Icon } from '../Icon';
import { Character } from '../character/Character';
import { Press } from '../motion/Press';
import { ProjectInfo, StatsCard, TextNum } from './common';

const ARect = Animated.createAnimatedComponent(Rect);

const H = 140;
const TOP = 8;
const PERIODS: { key: Period; short: string; label: string }[] = [
  { key: 'week', short: 'W', label: 'Week' },
  { key: 'month', short: 'M', label: 'Month' },
  { key: 'year', short: 'Y', label: 'Year' },
];

/**
 * Time per day (week), per week (month) or per month (year), stacked by
 * project color, with a dashed capacity mark per bar. Swipe or use the
 * chevrons to move between periods; tap a bar for its breakdown.
 * With little data yet, your character waves beside whatever bars exist.
 */
export const PeriodChart = memo(function PeriodChart({ info, lowData }: { info: Map<string, ProjectInfo>; lowData: boolean }) {
  const { colors } = useTheme();
  const data = useData();
  const now = useStoreNow();
  const [period, setPeriod] = useState<Period>('week');
  const [offset, setOffset] = useState(0);
  const c = chartOf(data, now, period, offset);

  // Selection resets to the default bar whenever the period changes.
  const viewKey = `${period}:${offset}`;
  const [sel, setSel] = useState<{ key: string; index: number | null }>({ key: viewKey, index: c.defaultIndex });
  const selected = sel.key === viewKey ? sel.index : c.defaultIndex;
  const select = useCallback((i: number) => setSel((s) => ({ key: viewKey, index: (s.key === viewKey ? s.index : c.defaultIndex) === i ? null : i })), [viewKey, c.defaultIndex]);

  const older = useCallback(() => c.hasEarlier && setOffset((o) => o + 1), [c.hasEarlier]);
  const newer = useCallback(() => setOffset((o) => Math.max(0, o - 1)), []);
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onEnd((e) => {
          if (e.translationX > 50) scheduleOnRN(older);
          else if (e.translationX < -50) scheduleOnRN(newer);
        }),
    [older, newer]
  );

  const controls = lowData ? (
    <Character mood="waving" size={56} decorative />
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
      <IconButton label="Earlier" name="chevronLeft" size={16} color={colors.sub} bg={colors.well} diameter={28} disabled={!c.hasEarlier} onPress={older} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1, minWidth: 64, textAlign: 'center', fontSize: 13, fontWeight: '800', color: colors.ink }}>
        {c.range}
      </Text>
      <IconButton label="Later" name="chevronRight" size={16} color={colors.sub} bg={colors.well} diameter={28} disabled={offset === 0} onPress={newer} />
      <Toggle
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setOffset(0);
        }}
      />
    </View>
  );

  const bar = selected !== null ? c.bars[selected] : undefined;
  return (
    <StatsCard glyph="stats" label={period === 'week' ? 'Time per day' : period === 'month' ? 'Time per week' : 'Time per month'} right={controls}>
      <GestureDetector gesture={swipe}>
        <View>
          <Bars chart={c} selected={selected} onSelect={select} info={info} />
        </View>
      </GestureDetector>
      {bar && <Detail bar={bar} info={info} onClose={() => select(selected!)} />}
    </StatsCard>
  );
});

function Toggle({ value, onChange }: { value: Period; onChange(p: Period): void }) {
  const { colors, radius } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors.well, borderRadius: radius.pill, padding: 2, marginLeft: 4 }}>
      {PERIODS.map((p) => {
        const on = p.key === value;
        return (
          <Press
            kind="icon"
            key={p.key}
            onPress={() => onChange(p.key)}
            accessibilityRole="tab"
            accessibilityLabel={p.label}
            accessibilityState={{ selected: on }}
            style={{ width: 28, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.card : 'transparent' }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: on ? colors.ink : colors.sub }}>{p.short}</Text>
          </Press>
        );
      })}
    </View>
  );
}

/** The bars: they grow from zero (critically damped) each time the period changes; a fade with reduce motion. */
const Bars = memo(function Bars({ chart, selected, onSelect, info }: { chart: Chart; selected: number | null; onSelect(i: number): void; info: Map<string, ProjectInfo> }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const grow = useSharedValue(reduced ? 1 : 0);
  const viewKey = `${chart.period}:${chart.offset}`;
  useEffect(() => {
    if (reduced) {
      grow.value = 1;
      return;
    }
    grow.value = 0;
    grow.value = withSpring(1, springs.progress);
  }, [viewKey, reduced, grow]);

  const slot = w / Math.max(1, chart.bars.length);
  const scale = (H - TOP) / chart.maxSec;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <TextNum style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }} accessibilityLabel={`Scale up to ${sayDur(chart.maxSec)}`}>
        {fmtH(chart.maxSec)}
      </TextNum>
      {w > 0 && (
        <Animated.View key={viewKey} entering={reduced ? FadeIn.duration(200) : undefined} style={{ flexDirection: 'row' }}>
          {chart.bars.map((b, i) => (
            <Column key={b.key} bar={b} index={i} width={slot} scale={scale} line={chart.line !== 'none'} selected={selected === i} grow={grow} onSelect={onSelect} info={info} />
          ))}
        </Animated.View>
      )}
    </View>
  );
});

const Column = memo(function Column({
  bar,
  index,
  width,
  scale,
  line,
  selected,
  grow,
  onSelect,
  info,
}: {
  bar: ChartBar;
  index: number;
  width: number;
  scale: number;
  line: boolean;
  selected: boolean;
  grow: SharedValue<number>;
  onSelect(i: number): void;
  info: Map<string, ProjectInfo>;
}) {
  const t = useTheme();
  const { colors } = t;
  const bw = Math.min(26, width * 0.62);
  const x = (width - bw) / 2;
  const r = Math.min(6, bw / 2);
  // Biggest slice at the bottom; the top slice is drawn first (rounded, reaching down under the others).
  let cum = 0;
  const parts = bar.parts.map((p) => {
    const from = cum;
    cum += p.sec;
    return { ...p, from, color: t.swatch(info.get(p.projectId)?.look.color ?? 'indigo').base };
  });
  const lineY = H - bar.lineSec * scale;
  const spoken = `${bar.title}, ${bar.totalSec > 0 ? sayDur(bar.totalSec) : 'nothing logged'}`;
  return (
    <Press kind="button" onPress={() => onSelect(index)} accessibilityRole="button" accessibilityLabel={spoken} accessibilityState={{ selected }} style={{ width, alignItems: 'center' }}>
      <Svg width={width} height={H}>
        {selected && <Rect x={1.5} y={0} width={width - 3} height={H} rx={9} fill={colors.well} />}
        {bar.current && !selected && <Rect x={x - 3} y={0} width={bw + 6} height={H} rx={9} fill={colors.well} opacity={0.5} />}
        {parts.length === 0 && <Circle cx={width / 2} cy={H - 3} r={2.5} fill={colors.track} />}
        {[...parts].reverse().map((p, k) => (
          <Slice key={p.projectId} x={x} w={bw} r={k === 0 ? r : 0} from={p.from} sec={p.sec} scale={scale} color={p.color} grow={grow} />
        ))}
        {line && bar.lineSec > 0 && lineY > 0 && (
          <Line x1={width * 0.1} x2={width * 0.9} y1={lineY} y2={lineY} stroke={colors.sub} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.75} />
        )}
      </Svg>
      <Text style={{ marginTop: 5, fontSize: 11, fontWeight: bar.current || selected ? '800' : '700', color: bar.current ? colors.brand : selected ? colors.ink : colors.muted }}>{bar.label}</Text>
    </Press>
  );
});

/** One project's slice of a bar. The top slice (r > 0) is rounded and reaches r further down, under the slices below. */
function Slice({ x, w, r, from, sec, scale, color, grow }: { x: number; w: number; r: number; from: number; sec: number; scale: number; color: string; grow: SharedValue<number> }) {
  const props = useAnimatedProps(() => {
    const g = grow.value;
    const top = H - (from + sec) * scale * g;
    const h = sec * scale * g;
    // The extra r (under the slices below) only while there's something to show.
    return { y: top, height: h > 0.5 ? h + r : 0 };
  });
  return <ARect x={x} width={w} rx={r} fill={color} animatedProps={props} />;
}

/** The selected bar: its date, total, and time per project (most first), each with its color, icon and name. */
function Detail({ bar, info, onClose }: { bar: ChartBar; info: Map<string, ProjectInfo>; onClose(): void }) {
  const t = useTheme();
  const { colors, radius } = t;
  return (
    <Press kind="card" onPress={onClose} accessibilityRole="button" accessibilityLabel={`${bar.title}, ${sayDur(bar.totalSec)}. Close`} style={{ backgroundColor: colors.well, borderRadius: radius.lg, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.sub }}>{bar.title}</Text>
        <TextNum style={{ fontSize: 17 }}>{fmtDur(bar.totalSec)}</TextNum>
      </View>
      {bar.parts.map((p) => {
        const pi = info.get(p.projectId);
        const sw = t.swatch(pi?.look.color ?? 'indigo');
        return (
          <View key={p.projectId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
              {pi && <Icon path={pi.iconPath} size={13} color={sw.on} />}
            </View>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink }}>
              {pi?.name ?? ''}
            </Text>
            <TextNum style={{ fontSize: 14 }}>{fmtDur(p.sec)}</TextNum>
          </View>
        );
      })}
    </Press>
  );
}
