import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { selectProjects } from '../domain/engine';
import { useStreak } from '../store/StreakStore';
import { colors, radius, shadowCard } from '../theme/tokens';

const PENCIL = 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z';

export function ProjectsScreen() {
  const { data, now, config, actions } = useStreak();
  const model = selectProjects(data, config, now);

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: 64, paddingHorizontal: 20, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.ink }}>
            Projects
          </Text>
          <Text style={{ fontSize: 15, color: colors.subtext, marginTop: 3 }}>{model.sub}</Text>
        </View>
        <Pressable
          onPress={actions.openNewProject}
          style={[
            {
              backgroundColor: colors.card,
              borderRadius: radius.pill,
              paddingVertical: 8,
              paddingHorizontal: 14,
            },
            shadowCard,
          ]}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>+ Project</Text>
        </Pressable>
      </View>

      {model.cards.map((pc) => (
        <View
          key={pc.projectId}
          style={[{ backgroundColor: colors.card, borderRadius: radius.xxl, padding: 18, marginTop: 16 }, shadowCard]}
        >
          {/* Title row */}
          <Pressable
            onPress={() => actions.openEditProject({ id: pc.projectId, name: pc.name, weeklyTarget: pc.weeklyTarget })}
            style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>{pc.name}</Text>
              <Text style={{ fontSize: 13, color: colors.subtext, marginTop: 3 }}>{pc.sub}</Text>
            </View>
            <View style={{ marginTop: 4 }}>
              <Icon path={PENCIL} size={16} color={colors.faint} strokeWidth={2} />
            </View>
          </Pressable>

          {/* Stage box */}
          <Pressable
            onPress={() => actions.openStageSheet(pc.projectId)}
            style={{ backgroundColor: colors.soft, borderRadius: radius.md, padding: 13, marginTop: 14 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>{pc.stageLabel}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted }}>{pc.nextStageLabel}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>{pc.stageHoursLabel}</Text>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: radius.pill,
                    backgroundColor: '#E7E8EC',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.subtext, fontStyle: 'italic' }}>i</Text>
                </View>
              </View>
            </View>
            <View style={{ marginTop: 9 }}>
              <ProgressBar pct={pc.stagePct} color={colors.ink} track={colors.track2} />
            </View>
          </Pressable>

          {/* Consistency grid */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <StatCell value={pc.streakLabel} label="Streak" />
            <StatCell value={pc.weekShort} label="This week" />
            <StatCell value={pc.trendLabel} label="vs last week" valueColor={pc.trendColor} />
          </View>
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: pc.paceMet ? '#1F8A3B' : colors.ink, marginTop: 8, paddingHorizontal: 2 }}>
            {pc.paceLabel}
          </Text>

          {/* Contribution ranking */}
          <View style={{ marginTop: 6 }}>
            {pc.habits.map((gh) => (
              <Pressable
                key={gh.habitId}
                onPress={() => {
                  const habit = data.habits.find((h) => h.id === gh.habitId);
                  if (habit) actions.openEditHabit(habit);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.hairline,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.sm,
                    backgroundColor: gh.tile,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon path={gh.iconPath} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.ink }}>
                      {gh.name}
                    </Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.ink }}>{gh.sharePct}</Text>
                  </View>
                  <View style={{ marginTop: 6 }}>
                    <ProgressBar pct={gh.shareBarW} color={gh.tile} height={5} />
                  </View>
                  <Text style={{ fontSize: 11.5, color: colors.subtext, marginTop: 5 }}>{gh.sub}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable onPress={() => actions.openNewHabit(pc.projectId)} style={{ paddingTop: 12, paddingBottom: 4 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: config.accent }}>+ Add habit</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function StatCell({
  value,
  label,
  valueColor = colors.ink,
}: {
  value: string;
  label: string;
  valueColor?: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.soft, borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: 12 }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: valueColor }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.subtext, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
