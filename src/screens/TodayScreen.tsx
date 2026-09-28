import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { RecapCard } from '../components/RecapCard';
import { SyncIndicator } from '../components/SyncIndicator';
import { selectToday, TodayRow } from '../domain/engine';
import { fmtClock } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { useStopTimer } from '../store/useStopTimer';
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

      {/* One card per project: week progress and pace, then its habits */}
      {model.groups.map((g) => (
        <View
          key={g.projectId}
          style={[{ marginTop: 16, backgroundColor: colors.card, borderRadius: radius.xl, paddingTop: 16, paddingBottom: 6 }, shadowCard]}
        >
          <View style={{ paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <Text numberOfLines={2} style={{ flex: 1, fontSize: 16, fontWeight: '800', color: colors.ink }}>
                {g.name}
              </Text>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.subtext }}>{g.weekLabel}</Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <ProgressBar pct={g.weekPct} color={g.barColor} />
            </View>
            {(!!g.paceLabel || !!g.streakLabel) && (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: g.paceMet ? '#1F8A3B' : colors.ink }}>
                  {g.paceLabel}
                </Text>
                {!!g.streakLabel && (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: g.streakAtRisk ? '600' : '500',
                      color: g.streakAtRisk ? colors.warn : colors.muted,
                    }}
                  >
                    {g.streakLabel}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={{ marginTop: 10 }}>
            {g.rows.map((r) => (
              <HabitRow key={r.habitId} row={r} />
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

const PAUSE = 'M9 6v12M15 6v12';
const PLAY = 'M8 5.5v13l10-6.5z';
const STOP = 'M7 7h10v10H7z';

/** A habit inside its project card: tap to start (or open the running timer). */
function HabitRow({ row: r }: { row: TodayRow }) {
  const { config, actions } = useStreak();
  const stop = useStopTimer();
  const highlight = r.running ? config.accent + '12' : r.recommended ? config.accent + '0A' : 'transparent';

  return (
    <Pressable
      onPress={() => (r.running ? actions.openTimer() : actions.startTimer(r.habitId))}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.soft : highlight,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        paddingVertical: 12,
        paddingHorizontal: 16,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: r.tile, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon path={r.iconPath} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {r.recommended && (
              <View
                accessibilityLabel="Up next"
                style={{ width: 7, height: 7, borderRadius: radius.pill, backgroundColor: config.accent }}
              />
            )}
            <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink }}>
              {r.name}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 12.5,
              marginTop: 2,
              color: r.running ? (r.paused ? '#C77800' : config.accent) : colors.subtext,
              fontWeight: r.running ? '700' : '400',
            }}
          >
            {r.recommended && !r.running ? 'Up next · ' + r.sub : r.sub}
          </Text>
        </View>
        {!r.running && (
          <Pressable
            onPress={() => actions.startTimer(r.habitId)}
            hitSlop={6}
            style={{
              borderRadius: radius.pill,
              paddingVertical: 9,
              paddingHorizontal: 16,
              backgroundColor: r.recommended ? config.accent : colors.track,
            }}
          >
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: r.recommended ? '#FFFFFF' : config.accent }}>
              {r.btnLabel}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Running timer: elapsed time and controls stay on the row */}
      {r.running && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingLeft: 52 }}>
          <Text
            style={{
              flex: 1,
              fontSize: 22,
              fontWeight: '800',
              color: r.paused ? colors.subtext : colors.ink,
              fontVariant: ['tabular-nums'],
            }}
          >
            {fmtClock(r.elapsedSec)}
          </Text>
          <ControlButton
            label={r.paused ? 'Resume' : 'Pause'}
            icon={r.paused ? PLAY : PAUSE}
            onPress={actions.togglePause}
            bg={colors.card}
            fg={colors.ink}
          />
          <ControlButton label="Stop" icon={STOP} onPress={stop} bg={colors.dangerSoft} fg={colors.danger} />
        </View>
      )}
    </Pressable>
  );
}

function ControlButton({ label, icon, onPress, bg, fg }: { label: string; icon: string; onPress(): void; bg: string; fg: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: radius.pill,
        paddingVertical: 8,
        paddingHorizontal: 13,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Icon path={icon} size={13} color={fg} strokeWidth={2.4} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: fg }}>{label}</Text>
    </Pressable>
  );
}
