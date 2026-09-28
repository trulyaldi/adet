import React from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { CompletionMark } from '../components/CompletionMark';
import { Glyph, GlyphName, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { PatternsCard } from '../components/PatternsCard';
import { ProgressBar } from '../components/ProgressBar';
import { selectStats } from '../domain/engine';
import { lastCompletedWeekStart, pastRecaps } from '../domain/recap';
import { fmtH } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { usePlanStreak } from '../store/usePlanStreak';
import { colors, radius, shadowCard } from '../theme/tokens';

export function StatsScreen() {
  const { data, ui, now, config, actions } = useStreak();
  const model = selectStats(data, config, now, { heatSel: ui.heatSel });
  const streak = usePlanStreak();

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.ink }}>Stats</Text>

      <Segmented
        options={[
          { key: 'overview', label: 'Overview', glyph: 'bars' },
          { key: 'history', label: 'History', glyph: 'list' },
        ]}
        value={ui.statsView}
        onChange={actions.setStatsView}
      />

      {ui.statsView === 'overview' ? (
        <>
          <LifetimeHero lifetimeLabel={model.lifetimeLabel} lifetimeSub={model.lifetimeSub} />

          {/* Period stats 2x2 */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            <PeriodTile
              value={model.weekHours}
              label="This week"
              iconBg="#D8EAF9"
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Circle cx={12} cy={12} r={9} stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M12 7v5l3 2" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
            />
            <PeriodTile
              value={model.monthHours}
              label="This month"
              iconBg="#E4E0F7"
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Rect x={4} y={5} width={16} height={16} rx={2} stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M4 9h16 M8 3v3 M16 3v3" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
            />
            <PeriodTile
              value={model.avgDaily}
              label="Avg per day"
              iconBg="#D9F2E3"
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M4 20h16 M7 20v-5 M12 20V9 M17 20v-8" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
            />
            <PeriodTile
              value={streak.longest + 'd'}
              label="Longest streak"
              iconBg="#FDE4D5"
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 21c3.9 0 6.5-2.4 6.5-6 0-2.5-1.4-4.7-3-6.5-.3 1-.8 1.9-1.7 2.5C13.6 8.6 13 5.5 10 3c.3 2.5-.7 4.4-2.1 6C6.6 10.6 5.5 12.4 5.5 15c0 3.6 2.6 6 6.5 6z"
                    stroke={colors.ink}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              }
            />
          </View>

          {/* Insights */}
          {model.hasInsights && (
            <View
              style={[
                { backgroundColor: colors.card, borderRadius: radius.xxl, paddingVertical: 16, paddingHorizontal: 18, marginTop: 10 },
                shadowCard,
              ]}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>Insights</Text>
              <View style={{ gap: 11, marginTop: 12 }}>
                {model.insights.map((ins, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 9,
                        backgroundColor: ins.bg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon path={ins.iconPath} size={14} strokeWidth={2} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, color: '#3A3D42', lineHeight: 19 }}>{ins.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Time by project; with one project it would just repeat the lifetime total */}
          {model.projDist.length >= 2 && (
            <View
              style={[
                { backgroundColor: colors.card, borderRadius: radius.xxl, paddingHorizontal: 18, paddingBottom: 14, marginTop: 10 },
                shadowCard,
              ]}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, paddingTop: 14, paddingBottom: 6 }}>
                Time by project
              </Text>
              {model.projDist.map((pd) => (
                <View key={pd.name} style={{ paddingVertical: 9 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.ink }}>
                      {pd.name}
                    </Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.subtext }}>{pd.label}</Text>
                  </View>
                  <View style={{ marginTop: 7 }}>
                    <ProgressBar pct={pd.barW} color={colors.ink} />
                  </View>
                </View>
              ))}
            </View>
          )}

          <PatternsCard />
        </>
      ) : (
        <>
          <PastWeeksCard />
          {/* Activity heatmap */}
          <View style={[{ backgroundColor: colors.card, borderRadius: radius.xxl, padding: 18, marginTop: 10 }, shadowCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <Pressable onPress={actions.openHeatSheet} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>Activity map</Text>
                  <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{model.heatRangeLabel}</Text>
                </View>
                <Icon path="M9 6l6 6-6 6" size={18} color={colors.muted} />
              </Pressable>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 11, color: colors.muted, marginRight: 3 }}>Less</Text>
                  {model.legendCells.map((c, i) => (
                    <View
                      key={i}
                      style={{ width: 11, height: 11, borderRadius: 3.5, backgroundColor: c, borderWidth: 1, borderColor: 'rgba(23,24,26,0.06)' }}
                    />
                  ))}
                  <Text style={{ fontSize: 11, color: colors.muted, marginLeft: 3 }}>More</Text>
                </View>
              </View>
            </View>

            {/* Day-of-week header */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ width: 34 }} />
              {model.dayHeads.map((t, i) => (
                <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.muted }}>
                  {t}
                </Text>
              ))}
            </View>

            {/* Weeks */}
            {model.heatRows.map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <Text style={{ width: 34, fontSize: 10, fontWeight: '700', color: colors.muted, textAlign: 'right', paddingRight: 2 }}>
                  {row.monthLabel}
                </Text>
                {row.cells.map((cell, ci) => (
                  <Pressable
                    key={ci}
                    disabled={!cell.key}
                    accessibilityRole="button"
                    accessibilityLabel={cell.key ?? undefined}
                    onPress={() => cell.key && actions.pickHeat(cell.key)}
                    style={{
                      flex: 1,
                      aspectRatio: 1,
                      borderRadius: 8,
                      backgroundColor: cell.color,
                      borderWidth: cell.selected ? 2 : 1,
                      borderColor: cell.selected ? config.accent : cell.bcolor,
                    }}
                  />
                ))}
              </View>
            ))}

            {/* See full history */}
            {model.heatCanToggle && (
              <Pressable
                onPress={actions.openHeatSheet}
                style={{
                  marginTop: 16,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.screen,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{model.heatOpenLabel}</Text>
              </Pressable>
            )}
          </View>

          {/* Recent sessions */}
          <View style={[{ backgroundColor: colors.card, borderRadius: radius.xxl, paddingHorizontal: 18, marginTop: 10 }, shadowCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 4 }}>
              <Glyph name="list" size={20} color={colors.ink} label="Recent sessions" />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <IconButton label="Log time" name="plus" size={17} color={config.accent} bg={colors.track} diameter={32} onPress={actions.openLogSheet} />
                {model.historyHasRows &&
                  (ui.clearArmed ? (
                    <>
                      <IconButton label="Keep the list" name="close" size={15} color={colors.subtext} bg={colors.track} diameter={32} onPress={actions.cancelClear} />
                      <IconButton label="Clear the list (sessions are kept)" name="done" size={17} color="#FFFFFF" bg={colors.ink} diameter={32} onPress={actions.confirmClear} />
                    </>
                  ) : (
                    <IconButton label="Clear the list" name="trash" size={17} color={colors.subtext} bg={colors.track} diameter={32} onPress={actions.armClear} />
                  ))}
              </View>
            </View>

            {!model.historyHasRows && (
              <View style={{ alignItems: 'center', paddingVertical: 26 }}>
                <Glyph name="list" size={26} color={colors.faint} label="No sessions yet" />
              </View>
            )}

            {model.historyDays.map((day) => (
              <View key={day.key}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtext, letterSpacing: 0.4, paddingTop: 12, paddingBottom: 2 }}>
                  {day.label}
                </Text>
                {day.rows.map((hr, i) => (
                  <Pressable
                    key={hr.id}
                    onPress={() => actions.openSessionSheet(hr.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 11,
                      paddingVertical: 10,
                      borderBottomWidth: i === day.rows.length - 1 ? 0 : 1,
                      borderBottomColor: colors.hairline,
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: hr.tile, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon path={hr.iconPath} size={18} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{hr.name}</Text>
                      <Text style={{ fontSize: 12.5, color: colors.subtext, marginTop: 1, fontVariant: ['tabular-nums'] }}>{hr.sub}</Text>
                      {hr.note ? (
                        <Text numberOfLines={2} style={{ fontSize: 12, fontStyle: 'italic', color: colors.muted, marginTop: 2 }}>{hr.note}</Text>
                      ) : null}
                    </View>
                    <CompletionMark mark={hr.mark} bonus={hr.bonus} />
                    <Icon path="M9 6l6 6-6 6" size={16} color={colors.faint} />
                  </Pressable>
                ))}
              </View>
            ))}
            <View style={{ height: 8 }} />
          </View>

        </>
      )}
    </ScrollView>
  );
}

/** Recent finished weeks with tracked time; each opens its recap. */
function PastWeeksCard() {
  const { data, now, actions } = useStreak();
  const lastWeek = lastCompletedWeekStart(now);
  // Recompute when data or the week changes, not every tick.
  const recaps = React.useMemo(() => pastRecaps(data, now, 4), [data, lastWeek]);
  if (!recaps.length) return null;

  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: radius.xxl, paddingHorizontal: 18, marginTop: 10 }, shadowCard]}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, paddingTop: 14, paddingBottom: 4 }}>Past weeks</Text>
      {recaps.map((r, i) => (
        <Pressable
          key={r.weekStart}
          onPress={() => actions.openRecap(r.weekStart)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 12,
            borderBottomWidth: i === recaps.length - 1 ? 0 : 1,
            borderBottomColor: colors.hairline,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{r.rangeLabel}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 }}>
              {r.targetCount > 0 && (
                <View
                  accessible
                  accessibilityLabel={`${r.hitCount} of ${r.targetCount} targets met`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Glyph name="done" size={12} color={colors.subtext} />
                  <Text style={{ fontSize: 12, color: colors.subtext, fontVariant: ['tabular-nums'] }}>{`${r.hitCount}/${r.targetCount}`}</Text>
                </View>
              )}
              <View accessible accessibilityLabel={`${r.sessions} sessions`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Glyph name="list" size={12} color={colors.subtext} />
                <Text style={{ fontSize: 12, color: colors.subtext, fontVariant: ['tabular-nums'] }}>{r.sessions}</Text>
              </View>
            </View>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{fmtH(r.totalSec)}</Text>
          <Glyph name="chevronRight" size={16} color={colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}

function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string; glyph: GlyphName }[];
  value: K;
  onChange(key: K): void;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.track2, borderRadius: 11, padding: 2, marginTop: 16 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            style={[
              { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9, backgroundColor: on ? colors.card : 'transparent' },
              on ? shadowCard : null,
            ]}
          >
            <Glyph name={o.glyph} size={18} color={on ? colors.ink : colors.subtext} />
          </Pressable>
        );
      })}
    </View>
  );
}

function LifetimeHero({ lifetimeLabel, lifetimeSub }: { lifetimeLabel: string; lifetimeSub: string }) {
  const gloss = React.useRef(new Animated.Value(0)).current;
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return undefined;

    gloss.setValue(0);
    const loop = Animated.loop(
      Animated.timing(gloss, {
        toValue: 1,
        duration: 3600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [gloss, size.height, size.width]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const hasSize = size.width > 0 && size.height > 0;
  const bandWidth = size.width * 0.45;
  const bandHeight = size.height * 1.4;
  const translateX = gloss.interpolate({
    inputRange: [0, 1],
    outputRange: [-bandWidth, size.width],
  });

  return (
    <View
      onLayout={onLayout}
      style={{ backgroundColor: colors.ink, borderRadius: radius.xxl, padding: 20, marginTop: 18, overflow: 'hidden' }}
    >
      {hasSize && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -size.height * 0.2,
            left: 0,
            width: bandWidth,
            height: bandHeight,
            transform: [{ translateX }, { skewX: '-18deg' }],
          }}
        >
          <Svg width="100%" height="100%" viewBox={`0 0 ${bandWidth} ${bandHeight}`} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="lifetimeGloss" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.14} />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={bandWidth} height={bandHeight} fill="url(#lifetimeGloss)" />
          </Svg>
        </Animated.View>
      )}
      <View style={{ position: 'relative', zIndex: 1 }}>
        <Glyph name="clock" size={18} color="rgba(255,255,255,0.55)" bg={colors.ink} label="Lifetime" />
        <Text style={{ fontSize: 40, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, marginTop: 4 }}>
          {lifetimeLabel}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
          <Glyph name="calendar" size={13} color="rgba(255,255,255,0.65)" bg={colors.ink} label="Since" />
          <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)' }}>{lifetimeSub}</Text>
        </View>
      </View>
    </View>
  );
}

function PeriodTile({ value, label, icon, iconBg }: { value: string; label: string; icon: React.ReactNode; iconBg: string }) {
  return (
    <View
      style={[
        { width: '48%', backgroundColor: colors.card, borderRadius: radius.xl, paddingVertical: 15, paddingHorizontal: 16, gap: 12 },
        shadowCard,
      ]}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.sm,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'], lineHeight: 24 }}>
          {value}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#8A8F98', marginTop: 5 }}>{label}</Text>
      </View>
    </View>
  );
}
