import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { selectStats } from '../domain/engine';
import { useStreak } from '../store/StreakStore';
import { colors, radius, shadowCard } from '../theme/tokens';

export function StatsScreen() {
  const { data, ui, now, config, actions } = useStreak();
  const model = selectStats(data, config, now, { heatSel: ui.heatSel });

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: 64, paddingHorizontal: 20, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.ink }}>Stats</Text>
      <Text style={{ fontSize: 15, color: colors.subtext, marginTop: 3 }}>{model.sub}</Text>

      {/* Lifetime hero */}
      <View style={{ backgroundColor: colors.ink, borderRadius: radius.xxl, padding: 20, marginTop: 18 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 1 }}>
          LIFETIME
        </Text>
        <Text style={{ fontSize: 40, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, marginTop: 4 }}>
          {model.lifetimeLabel}
        </Text>
        <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', marginTop: 8 }}>{model.lifetimeSub}</Text>
      </View>

      {/* Period stats 2x2 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
        <PeriodTile value={model.weekHours} label="This week" />
        <PeriodTile value={model.monthHours} label="This month" />
        <PeriodTile value={model.avgDaily} label="Avg per day" />
        <PeriodTile value={model.recStreak} label="Longest streak" />
      </View>

      {/* Most active habit */}
      {model.hasTopHabit && (
        <View
          style={[
            {
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: 14,
              paddingHorizontal: 16,
              marginTop: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            },
            shadowCard,
          ]}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              backgroundColor: model.topHabitTile,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon path={model.topHabitIcon} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{model.topHabitName}</Text>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>Most active habit</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>{model.topHabitHours}</Text>
        </View>
      )}

      {/* Insights */}
      {model.hasInsights && (
        <View style={[{ backgroundColor: colors.card, borderRadius: radius.xxl, padding: 16, marginTop: 10, gap: 12 }, shadowCard]}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>Insights</Text>
          {model.insights.map((ins, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: ins.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon path={ins.iconPath} size={19} />
              </View>
              <Text style={{ flex: 1, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>{ins.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Time by project */}
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

      {/* Activity heatmap */}
      <View style={[{ backgroundColor: colors.card, borderRadius: radius.xxl, padding: 18, marginTop: 10 }, shadowCard]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>Activity map</Text>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{model.heatRangeLabel}</Text>
          </View>
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
            <Text style={{ fontSize: 11, color: colors.muted }}>time per day</Text>
          </View>
        </View>

        {/* Day-of-week header */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ width: 30 }} />
          {model.dayHeads.map((t, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.muted }}>
              {t}
            </Text>
          ))}
        </View>

        {/* Weeks */}
        {model.heatRows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <Text style={{ width: 30, fontSize: 10, fontWeight: '700', color: colors.muted, textAlign: 'right', paddingRight: 2 }}>
              {row.monthLabel}
            </Text>
            {row.cells.map((cell, ci) => (
              <Pressable
                key={ci}
                disabled={!cell.key}
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
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>Recent sessions</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Pressable onPress={actions.openLogSheet}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: config.accent }}>+ Log</Text>
            </Pressable>
            {model.historyHasRows &&
              (ui.clearArmed ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Pressable onPress={actions.cancelClear}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.subtext }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={actions.confirmClear}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>Clear all</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={actions.armClear}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0A84FF' }}>Clear</Text>
                </Pressable>
              ))}
          </View>
        </View>

        {!model.historyHasRows && (
          <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 14, paddingVertical: 26 }}>
            No sessions yet
          </Text>
        )}

        {model.historyRows.map((hr) => (
          <Pressable
            key={hr.id}
            onPress={() =>
              actions.openSessionSheet({
                id: hr.id,
                minutes: hr.editMinutes,
                note: hr.editNote,
                meta: hr.editMeta,
              })
            }
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 11,
              paddingVertical: 11,
              borderBottomWidth: 1,
              borderBottomColor: colors.hairline,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: hr.tile, alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={hr.iconPath} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{hr.name}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: colors.subtext, marginTop: 1 }}>{hr.sub}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{hr.timeLabel}</Text>
          </Pressable>
        ))}
        <View style={{ height: 8 }} />
      </View>
    </ScrollView>
  );
}

function PeriodTile({ value, label }: { value: string; label: string }) {
  return (
    <View
      style={[
        { width: '48%', backgroundColor: colors.card, borderRadius: radius.xl, paddingVertical: 14, paddingHorizontal: 16 },
        shadowCard,
      ]}
    >
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>{value}</Text>
      <Text style={{ fontSize: 11.5, color: colors.subtext, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
