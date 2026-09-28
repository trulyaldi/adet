import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { ArchivedCard, ProjectCard, selectProjects } from '../domain/engine';
import { useStreak } from '../store/StreakStore';
import { colors, radius, shadowCard } from '../theme/tokens';

const PENCIL = 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z';
const CHEVRON_DOWN = 'M6 9l6 6 6-6';
const CHEVRON_UP = 'M6 15l6-6 6 6';

export function ProjectsScreen() {
  const { data, now, config, actions } = useStreak();
  const model = selectProjects(data, config, now);
  // Cards start collapsed each time the screen opens.
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
        <ProjectCardView
          key={pc.projectId}
          pc={pc}
          expanded={expanded.has(pc.projectId)}
          onToggle={() => toggle(pc.projectId)}
        />
      ))}

      {model.cards.length === 0 && (
        <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 14, paddingVertical: 36 }}>
          {model.archived.length ? 'No active projects' : 'No projects yet'}
        </Text>
      )}

      {model.archived.length > 0 && <ArchivedSection items={model.archived} />}
    </ScrollView>
  );
}

/** Collapsed: week progress, pace and streak. Tap to expand the details and habits. */
function ProjectCardView({ pc, expanded, onToggle }: { pc: ProjectCard; expanded: boolean; onToggle(): void }) {
  const { data, config, actions } = useStreak();

  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: radius.xxl, marginTop: 16 }, shadowCard]}>
      <Pressable onPress={onToggle} accessibilityState={{ expanded }} style={{ padding: 18, paddingBottom: expanded ? 4 : 18 }}>
        {/* Title row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.ink }}>{pc.name}</Text>
          <Pressable
            onPress={() => actions.openEditProject({ id: pc.projectId, name: pc.name, weeklyTarget: pc.weeklyTarget })}
            hitSlop={10}
            accessibilityLabel="Edit project"
            style={{ marginTop: 3 }}
          >
            <Icon path={PENCIL} size={16} color={colors.faint} strokeWidth={2} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
          <Text style={{ flexShrink: 1, fontSize: 13, fontWeight: '700', color: colors.subtext }}>{pc.weekLabel}</Text>
          {!!pc.streakLabel && (
            <Text
              style={{
                fontSize: 12,
                fontWeight: pc.streakAtRisk ? '600' : '500',
                color: pc.streakAtRisk ? colors.warn : colors.muted,
              }}
            >
              {pc.streakLabel}
            </Text>
          )}
        </View>
        <View style={{ marginTop: 9 }}>
          <ProgressBar pct={pc.weekPct} color={pc.barColor} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: pc.paceMet ? '#1F8A3B' : colors.ink }}>
            {pc.paceLabel}
          </Text>
          <Icon path={expanded ? CHEVRON_UP : CHEVRON_DOWN} size={16} color={colors.muted} strokeWidth={2} />
        </View>
      </Pressable>

      {expanded && (
        <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
          {/* Level */}
          <Pressable
            onPress={() => actions.openStageSheet(pc.projectId)}
            style={{ backgroundColor: colors.soft, borderRadius: radius.md, padding: 13, marginTop: 10 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 7 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>{pc.stageLabel}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted }}>{pc.nextStageLabel}</Text>
              </View>
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
            <View style={{ marginTop: 9 }}>
              <ProgressBar pct={pc.stagePct} color={colors.ink} track={colors.track2} />
            </View>
          </Pressable>

          {/* Lifetime and consistency */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <StatCell value={pc.lifetimeLabel} label="Lifetime" />
            <StatCell value={pc.sessionsLabel} label="Sessions" />
            <StatCell value={pc.weekStreakLabel} label="Target wks" />
            <StatCell value={pc.trendLabel} label="vs last week" valueColor={pc.trendColor} />
          </View>
          {!!pc.startedLabel && (
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 8, paddingHorizontal: 2 }}>{pc.startedLabel}</Text>
          )}

          {/* Habits */}
          <View style={{ marginTop: 4 }}>
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
                  <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>
                    {gh.name}
                  </Text>
                  {!!gh.shareLabel && (
                    <>
                      <View style={{ marginTop: 6 }}>
                        <ProgressBar pct={Math.max(2, gh.shareBarW)} color={gh.tile} height={5} />
                      </View>
                      <Text style={{ fontSize: 11.5, color: colors.subtext, marginTop: 5 }}>
                        {gh.shareLabel + ' · ' + gh.sub}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            ))}
            <Pressable onPress={() => actions.openNewHabit(pc.projectId)} style={{ paddingTop: 12, paddingBottom: 4 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: config.accent }}>+ Add habit</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

/** Archived projects, collapsed by default; each can be unarchived. */
function ArchivedSection({ items }: { items: ArchivedCard[] }) {
  const { config, actions } = useStreak();
  const [open, setOpen] = React.useState(false);

  return (
    <View style={{ marginTop: 22 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.subtext }}>Archived ({items.length})</Text>
        <Icon path={open ? CHEVRON_UP : CHEVRON_DOWN} size={15} color={colors.subtext} strokeWidth={2} />
      </Pressable>
      {open && (
        <View style={[{ backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: 16, marginTop: 6 }, shadowCard]}>
          {items.map((a, i) => (
            <View
              key={a.projectId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 13,
                borderBottomWidth: i === items.length - 1 ? 0 : 1,
                borderBottomColor: colors.hairline,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{a.name}</Text>
                <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{a.sub}</Text>
              </View>
              <Pressable
                onPress={() => actions.unarchiveProject(a.projectId)}
                hitSlop={6}
                style={{ borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 13, backgroundColor: colors.track }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: config.accent }}>Unarchive</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function StatCell({
  value,
  label,
  valueColor = colors.ink,
  labelColor = colors.subtext,
}: {
  value: string;
  label: string;
  valueColor?: string;
  labelColor?: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.soft, borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: 10 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 15, fontWeight: '800', color: valueColor }}>{value}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 11, color: labelColor, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
