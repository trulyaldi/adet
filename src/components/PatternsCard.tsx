import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { HEAT_SCALE } from '../domain/constants';
import { heatLevel, timeOfDay, Trends, weeklyTrends } from '../domain/insights';
import { dkey, fmtH, monday } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { colors, radius, shadowCard } from '../theme/tokens';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * When time is tracked, for all projects or one, over the last 12 weeks.
 * Computed from finished sessions only and recomputed when data or the week
 * changes, not on every tick.
 */
export function PatternsCard() {
  const { data, now } = useStreak();
  const [projectId, setProjectId] = useState<string | null>(null);
  // A project deleted (here or via sync) falls back to all projects.
  const scope = projectId !== null && data.projects.some((p) => p.id === projectId) ? projectId : null;
  const week = dkey(monday(new Date(now)));
  const tod = useMemo(() => timeOfDay(data, scope, now), [data, scope, week]);
  const trends = useMemo(() => weeklyTrends(data, scope, now), [data, scope, week]);

  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: radius.xxl, padding: 18, marginTop: 10 }, shadowCard]}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>Patterns</Text>
      <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>Last 12 weeks</Text>

      {/* Scope */}
      {data.projects.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8 }}>
          <Chip label="All" on={scope === null} onPress={() => setProjectId(null)} />
          {data.projects.map((p) => (
            <Chip key={p.id} label={p.name} on={scope === p.id} onPress={() => setProjectId(p.id)} />
          ))}
        </ScrollView>
      )}

      {/* Weekly trend */}
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 16 }}>Weekly hours</Text>
      {trends.enough ? <TrendChart trends={trends} /> : <Empty text="Trends appear after two weeks of tracking." />}

      {/* Time of day */}
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 16 }}>Time of day</Text>
      {tod.enough ? (
        <View style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', gap: 3, marginBottom: 4 }}>
            <View style={{ width: 16 }} />
            {tod.columns.map((c, i) => (
              <Text key={c.start} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600', color: colors.muted }}>
                {i % 2 === 0 || tod.columns.length <= 8 ? String(c.start) : ''}
              </Text>
            ))}
          </View>
          {tod.cells.map((row, d) => (
            <View key={d} style={{ flexDirection: 'row', gap: 3, marginTop: 3, alignItems: 'center' }}>
              <Text style={{ width: 16, fontSize: 10, fontWeight: '700', color: colors.muted }}>{DAY_LETTERS[d]}</Text>
              {row.map((sec, ci) => (
                <View
                  key={ci}
                  style={{ flex: 1, aspectRatio: 1, borderRadius: 5, backgroundColor: HEAT_SCALE[heatLevel(sec, tod.max)] }}
                />
              ))}
            </View>
          ))}
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>
            {tod.columns[0].end - tod.columns[0].start === 2 ? 'Hours of the day, in 2-hour blocks' : 'Hours of the day'}
          </Text>
          {tod.insight && (
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.ink, marginTop: 10 }}>{tod.insight}</Text>
          )}
        </View>
      ) : (
        <Empty text="Track a few more sessions to see your patterns." />
      )}
    </View>
  );
}

const CHART_H = 120;
const MET = '#34C759';

/** 12 weekly bars, oldest first; the current week is faded. With a target: a dashed line, and met weeks in green. */
function TrendChart({ trends }: { trends: Trends }) {
  const [width, setWidth] = useState(0);
  const n = trends.bars.length;
  const gap = 4;
  const barW = width > 0 ? (width - gap * (n - 1)) / n : 0;
  const y = (sec: number) => CHART_H - (trends.max > 0 ? (sec / trends.max) * (CHART_H - 4) : 0);
  const last = trends.bars[n - 1];
  const mid = trends.bars[Math.floor((n - 1) / 2)];

  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>
        {fmtH(trends.max)} peak{trends.targetSec !== null ? ' · dashed line is the ' + fmtH(trends.targetSec) + ' target' : ''}
      </Text>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: CHART_H }}>
        {width > 0 && (
          <Svg width={width} height={CHART_H}>
            {trends.bars.map((b, i) => {
              const top = y(b.sec);
              const h = Math.max(b.sec > 0 ? 2 : 0, CHART_H - top);
              return (
                <Rect
                  key={b.weekStart}
                  x={i * (barW + gap)}
                  y={CHART_H - h}
                  width={barW}
                  height={h}
                  rx={3}
                  fill={b.met ? MET : colors.ink}
                  opacity={b.current ? 0.4 : 1}
                />
              );
            })}
            {trends.targetSec !== null && (
              <Line
                x1={0}
                x2={width}
                y1={y(trends.targetSec)}
                y2={y(trends.targetSec)}
                stroke={colors.subtext}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}
            <Line x1={0} x2={width} y1={CHART_H - 0.5} y2={CHART_H - 0.5} stroke={colors.border} strokeWidth={1} />
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
        <Text style={{ fontSize: 10, color: colors.muted }}>{trends.bars[0].label}</Text>
        <Text style={{ fontSize: 10, color: colors.muted }}>{mid.label}</Text>
        <Text style={{ fontSize: 10, color: colors.muted }}>This week{last.sec > 0 ? ' · ' + fmtH(last.sec) : ''}</Text>
      </View>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress(): void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 13, backgroundColor: on ? colors.ink : colors.screen }}
    >
      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: on ? '#FFFFFF' : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: colors.soft, borderRadius: radius.md, paddingVertical: 18, paddingHorizontal: 14, marginTop: 10 }}>
      <Text style={{ textAlign: 'center', fontSize: 13, color: colors.subtext }}>{text}</Text>
    </View>
  );
}
