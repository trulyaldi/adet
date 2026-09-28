import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { RecapCard } from '../components/RecapCard';
import { SyncIndicator } from '../components/SyncIndicator';
import { selectToday } from '../domain/engine';
import { fmtClock } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { colors, radius, shadowCard } from '../theme/tokens';

const FLAME =
  'M12 21c3.9 0 6.5-2.4 6.5-6 0-2.5-1.4-4.7-3-6.5-.3 1-.8 1.9-1.7 2.5C13.6 8.6 13 5.5 10 3c.3 2.5-.7 4.4-2.1 6C6.6 10.6 5.5 12.4 5.5 15c0 3.6 2.6 6 6.5 6z';
const LEAF =
  'M20 4C10.5 5 5.5 10 5.5 19c9 0 14-5 14.5-15zM5.5 19C8 13.5 11.5 9.5 16.5 6.5';

export function TodayScreen() {
  const { data, now, config, actions } = useStreak();
  const model = selectToday(data, config, now);

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: 64, paddingHorizontal: 20, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.ink }}>
            Today
          </Text>
          <Text style={{ fontSize: 15, color: colors.subtext, marginTop: 3 }}>
            {model.todayDateLabel}
          </Text>
          <View style={{ marginTop: 6 }}>
            <SyncIndicator />
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.card,
            borderRadius: radius.pill,
            paddingVertical: 7,
            paddingHorizontal: 12,
          }}
        >
          <Icon path={FLAME} size={14} color={colors.ink} strokeWidth={2} />
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: colors.subtext }}>
            {model.streakLabel}
            {model.streakNote ? (
              <Text style={{ color: model.streakAtRisk ? colors.warn : colors.subtext }}>
                {' · ' + model.streakNote}
              </Text>
            ) : null}
          </Text>
        </View>
      </View>

      {/* Last week's recap, once per week */}
      <RecapCard />

      {/* This week across projects */}
      {model.summary && (
        <View style={[{ marginTop: 16, backgroundColor: colors.card, borderRadius: radius.xl, padding: 16 }, shadowCard]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.subtext, letterSpacing: 0.6 }}>THIS WEEK</Text>
            <Text style={{ flexShrink: 1, fontSize: 15, fontWeight: '800', color: colors.ink }}>{model.summary.weekLabel}</Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <ProgressBar pct={model.summary.pct} color={model.summary.allMet ? '#34C759' : colors.ink} />
          </View>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: model.summary.allMet || model.summary.todaySec === 0 ? '#1F8A3B' : colors.ink,
              marginTop: 9,
            }}
          >
            {model.summary.todayLabel}
          </Text>
        </View>
      )}

      {/* Project groups */}
      {model.groups.map((g) => (
        <View key={g.projectId} style={{ marginTop: 26 }}>
          <View style={[{ backgroundColor: colors.card, borderRadius: radius.xl, padding: 18 }, shadowCard]}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>
              {g.name}
            </Text>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.subtext, marginTop: 7 }}>
              {g.weekLabel}
            </Text>
            <View style={{ marginTop: 12 }}>
              <ProgressBar pct={g.weekPct} color={g.barColor} />
            </View>
            {!!g.paceLabel && (
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: g.paceMet ? '#1F8A3B' : colors.ink, marginTop: 9 }}>
                {g.paceLabel}
              </Text>
            )}
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, color: g.streakAtRisk ? colors.warn : colors.muted, fontWeight: g.streakAtRisk ? '600' : '400', marginTop: 4 }}
            >
              {g.consistencyLabel}
            </Text>
          </View>

          <View style={{ marginTop: 10, gap: 10 }}>
            {g.rows.map((r) => (
              <Pressable
                key={r.habitId}
                onPress={() => actions.startTimer(r.habitId)}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.card,
                    borderRadius: radius.lg,
                    borderWidth: 1.5,
                    borderColor: r.cardBorder,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 13,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                  shadowCard,
                ]}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: radius.md,
                    backgroundColor: r.tile,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon path={r.iconPath} size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Text
                      numberOfLines={1}
                      style={{ flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.ink }}
                    >
                      {r.name}
                    </Text>
                    {r.recommended && (
                      <Text
                        style={{
                          fontSize: 9.5,
                          fontWeight: '800',
                          color: config.accent,
                          backgroundColor: config.accent + '1C',
                          borderRadius: radius.pill,
                          paddingVertical: 2.5,
                          paddingHorizontal: 7,
                          overflow: 'hidden',
                        }}
                      >
                        UP NEXT
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 12.5, color: colors.subtext, marginTop: 4 }}>
                    {r.sub}
                  </Text>
                </View>
                <Pressable
                  onPress={() => (r.running ? actions.openTimer() : actions.startTimer(r.habitId))}
                  style={{
                    borderRadius: radius.pill,
                    paddingVertical: 9,
                    paddingHorizontal: 15,
                    backgroundColor: r.btnBg,
                  }}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: r.btnFg }}>
                    {r.btnLabelSec > 0 ? fmtClock(r.btnLabelSec) : r.btnLabel}
                  </Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {/* Empty state */}
      {model.noHabits && (
        <View style={{ alignItems: 'center', paddingVertical: 44, paddingHorizontal: 20 }}>
          <Icon path={LEAF} size={34} color={colors.muted} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.subtext, marginTop: 10, textAlign: 'center' }}>
            Start a project, then add habits to it
          </Text>
          <Pressable onPress={() => actions.setScreen('projects')}>
            <Text style={{ marginTop: 14, fontSize: 14, fontWeight: '700', color: config.accent }}>
              Go to Projects
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
