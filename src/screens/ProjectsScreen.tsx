import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Glyph, GlyphName, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { ArchivedCard, ProjectCard, selectProjects } from '../domain/engine';
import { useStreak } from '../store/StreakStore';
import { colors, radius, shadowCard } from '../theme/tokens';

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
      contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ flex: 1, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.ink }}>
          Projects
        </Text>
        <IconButton label="New project" name="plus" onPress={actions.openNewProject} bg={colors.card} diameter={36} size={18} />
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
        <View style={{ alignItems: 'center', paddingVertical: 36 }}>
          <Glyph name="target" size={30} color={colors.faint} label="No active projects" />
        </View>
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
          <IconButton
            label="Edit project"
            name="pencil"
            size={16}
            color={colors.faint}
            onPress={() => actions.openEditProject({ id: pc.projectId, name: pc.name, weeklyTarget: pc.weeklyTarget })}
            style={{ marginTop: 3 }}
          />
        </View>

        {/* This week: time against the target, then weeks in a row the target was met. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <Stat glyph="clock" value={pc.weekLabel} label="This week" />
          {pc.paceMet && <Glyph name="done" size={15} color="#1F8A3B" label="Weekly target met" />}
          <View style={{ flex: 1 }} />
          {pc.weekStreak > 0 && <Stat glyph="chain" value={String(pc.weekStreak)} label="Weeks in a row on target" />}
          <Glyph name={expanded ? 'chevronUp' : 'chevronDown'} size={16} color={colors.muted} />
        </View>
        <View style={{ marginTop: 9 }}>
          <ProgressBar pct={pc.weekPct} color={pc.barColor} />
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
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Glyph name="info" size={14} color={colors.subtext} />
              </View>
            </View>
            <View style={{ marginTop: 9 }}>
              <ProgressBar pct={pc.stagePct} color={colors.ink} track={colors.track2} />
            </View>
          </Pressable>

          {/* Lifetime and consistency */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <StatCell value={pc.lifetimeLabel} glyph="clock" label="Lifetime" />
            <StatCell value={pc.sessionsLabel} glyph="list" label="Sessions" />
            <StatCell value={pc.weekStreakLabel} glyph="chain" label="Weeks in a row on target" />
            <StatCell value={pc.trendLabel} glyph="bars" label="Versus last week" valueColor={pc.trendColor} />
          </View>
          {!!pc.startedLabel && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingHorizontal: 2 }}>
              <Glyph name="calendar" size={13} color={colors.muted} label="Started" />
              <Text style={{ fontSize: 12, color: colors.muted }}>{pc.startedLabel}</Text>
            </View>
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
                      <Text style={{ fontSize: 11.5, color: colors.subtext, marginTop: 5, fontVariant: ['tabular-nums'] }}>
                        {gh.shareLabel + ' · ' + gh.sub}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            ))}
            <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: 'flex-start' }}>
              <IconButton
                label="Add habit"
                name="plus"
                size={16}
                color={config.accent}
                bg={colors.track}
                diameter={32}
                onPress={() => actions.openNewHabit(pc.projectId)}
              />
            </View>
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
        accessibilityRole="button"
        accessibilityLabel="Archived projects"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}
      >
        <Glyph name="archive" size={17} color={colors.subtext} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.subtext }}>{items.length}</Text>
        <Glyph name={open ? 'chevronUp' : 'chevronDown'} size={15} color={colors.subtext} />
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
              <IconButton
                label="Unarchive"
                name="unarchive"
                size={18}
                color={config.accent}
                bg={colors.track}
                diameter={36}
                onPress={() => actions.unarchiveProject(a.projectId)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** A glyph and a number; the label is spoken, not shown. */
function Stat({ glyph, value, label }: { glyph: GlyphName; value: string; label: string }) {
  return (
    <View accessible accessibilityLabel={label + ', ' + value} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Glyph name={glyph} size={14} color={colors.subtext} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.subtext, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function StatCell({
  value,
  glyph,
  label,
  valueColor = colors.ink,
}: {
  value: string;
  glyph: GlyphName;
  /** Spoken only; the glyph stands in for it on screen. */
  label: string;
  valueColor?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={label + ', ' + value}
      style={{ flex: 1, backgroundColor: colors.soft, borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: 10, gap: 5 }}
    >
      <Glyph name={glyph} size={14} color={colors.subtext} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 15, fontWeight: '800', color: valueColor }}>{value}</Text>
    </View>
  );
}
