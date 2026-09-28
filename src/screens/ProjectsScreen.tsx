import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CapacityIndicator } from '../components/CapacityIndicator';
import { ScreenIlmek } from '../components/ilmek/ScreenIlmek';
import { Glyph, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { Appear, useLayoutMotion } from '../components/motion/Appear';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { QuickAdd } from '../components/QuickAdd';
import { ScreenHeader } from '../components/ScreenHeader';
import { ICONS } from '../domain/constants';
import { ProjectView, sessionWhen } from '../domain/projectsView';
import { projectsViewOf } from '../domain/selectors';
import { fmtDur, sayDur } from '../domain/time';
import { useActions, useData, useSettings, useStoreNow } from '../store/StreakStore';
import { useTheme } from '../theme/ThemeProvider';

export function ProjectsScreen() {
  const { colors } = useTheme();
  const data = useData();
  const now = useStoreNow();
  const settings = useSettings();
  const actions = useActions();
  const model = projectsViewOf(data, now);
  const [open, setOpen] = useState<string | null>(null);
  const showCheck = model.check.over && settings.targetCheckDismissed !== model.check.signature;

  return (
    <ScrollView contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        title="Projects"
        right={
          <IconButton
            label="New project"
            name="plus"
            size={22}
            color={colors.onBrand}
            bg={colors.brand}
            edge={colors.brandDark}
            variant="chunky"
            diameter={44}
            onPress={actions.openNewProject}
            tipBelow
          />
        }
      />

      {showCheck && <CapacityIndicator check={model.check} onPress={actions.openCapacityFix} />}

      <View style={{ gap: 14, marginTop: 14 }}>
        {model.cards.map((pc, i) => (
          <Appear key={pc.projectId} index={i}>
            <ProjectCard pc={pc} expanded={open === pc.projectId} onToggle={() => setOpen((o) => (o === pc.projectId ? null : pc.projectId))} />
          </Appear>
        ))}
      </View>

      {model.cards.length === 0 && (
        <View accessible accessibilityLabel="No projects yet" style={{ alignItems: 'center', paddingVertical: 40 }}>
          <ScreenIlmek state="relaxed" size={120} decorative />
        </View>
      )}

      {model.archived.length > 0 && <Archived items={model.archived} />}
    </ScrollView>
  );
}

/**
 * A project at a glance: color tile and icon, name, a thick bar of this
 * week's time toward the weekly target, and "4h 20m / 10h" with a week
 * badge. A met target gets a check and a soft glow for the rest of the week.
 * Tap to expand (habits, quick logs, this week's sessions); long-press, or
 * the edit button inside, to edit.
 */
function ProjectCard({ pc, expanded, onToggle }: { pc: ProjectView; expanded: boolean; onToggle(): void }) {
  const t = useTheme();
  const { colors, radius } = t;
  const actions = useActions();
  const layout = useLayoutMotion();
  const sw = t.swatch(pc.look.color);
  const ink = t.dark ? sw.base : sw.dark;

  return (
    <Animated.View
      layout={layout}
      style={[
        { backgroundColor: colors.card, borderRadius: radius.xxl, overflow: 'visible' },
        t.shadow,
        pc.reached ? { shadowColor: sw.base, shadowOpacity: t.dark ? 0.55 : 0.35, shadowRadius: 14, borderWidth: 2, borderColor: sw.light } : null,
      ]}
    >
      <Pressable
        onPress={onToggle}
        onLongPress={() => actions.openEditProject(pc.projectId)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${pc.name}, ${sayDur(pc.weekSec)} of ${pc.weeklyTargetH} hours this week${pc.reached ? ', weekly target reached' : ''}`}
        accessibilityHint="Long-press to edit"
        style={{ padding: 16, gap: 12 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={ICONS[pc.look.icon]} size={24} color={sw.on} />
          </View>
          <Text numberOfLines={2} style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.ink }}>
            {pc.name}
          </Text>
          {pc.reached && (
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
              <Glyph name="done" size={18} color={sw.on} bg={sw.base} label="Weekly target reached" />
            </View>
          )}
          <Glyph name={expanded ? 'chevronUp' : 'chevronDown'} size={18} color={colors.muted} />
        </View>
        <AnimatedBar value={pc.frac} color={sw.base} track={sw.light} height={14} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: sw.light, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 8 }}>
            <Glyph name="calendar" size={13} color={ink} bg={sw.light} label="This week" />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>
            {fmtDur(pc.weekSec)} <Text style={{ color: colors.sub }}>/ {fmtDur(pc.weeklyTargetH * 3600)}</Text>
          </Text>
        </View>
      </Pressable>

      {expanded && (
        <Appear style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
          {pc.habits.map((h) => (
            <View key={h.habitId} style={{ backgroundColor: sw.light, borderRadius: radius.lg, padding: 12, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon path={h.iconPath} size={20} color={ink} />
                <Pressable onPress={() => actions.openEditHabitById(h.habitId)} accessibilityRole="button" accessibilityLabel={`Edit ${h.name}`} style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>
                    {h.name}
                  </Text>
                </Pressable>
                {h.weekSec > 0 && <Text style={{ fontSize: 13, fontWeight: '800', color: ink, fontVariant: ['tabular-nums'] }}>{fmtDur(h.weekSec)}</Text>}
                <IconButton
                  label={h.kind === 'check' ? `Check off ${h.name}` : `Start ${h.name}`}
                  name={h.kind === 'check' ? 'done' : 'play'}
                  size={18}
                  color={sw.on}
                  bg={sw.base}
                  edge={sw.dark}
                  variant="chunky"
                  diameter={38}
                  onPress={() => (h.kind === 'check' ? actions.toggleCheck(h.habitId) : actions.startTimer(h.habitId))}
                />
              </View>
              {h.kind === 'timed' && <QuickAdd name={h.name} swatch={sw} onAdd={(m) => actions.quickLog(h.habitId, m)} onCustom={() => actions.openLogSheet(h.habitId)} />}
            </View>
          ))}

          {pc.sessions.length > 0 && (
            <View style={{ gap: 2 }}>
              <Glyph name="list" size={18} color={colors.sub} label="This week's sessions" />
              {pc.sessions.slice(0, 8).map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => actions.openSessionSheet(s.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.habitName}, ${sessionWhen(s.start)}, ${sayDur(s.duration)}. Edit`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.manual ? 'transparent' : sw.base, borderWidth: 2, borderColor: sw.base }} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink }}>
                    {s.habitName}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub, fontVariant: ['tabular-nums'] }}>{sessionWhen(s.start)}</Text>
                  <Text style={{ width: 56, textAlign: 'right', fontSize: 14, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{fmtDur(s.duration)}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
            <IconButton label={`Add a habit to ${pc.name}`} name="plus" size={18} color={colors.sub} bg={colors.well} diameter={40} onPress={() => actions.openNewHabit(pc.projectId)} />
            <IconButton label={`Levels for ${pc.name}`} name="badge" size={18} color={colors.sub} bg={colors.well} diameter={40} onPress={() => actions.openStageSheet(pc.projectId)} />
            <IconButton label={`Edit ${pc.name}`} name="edit" size={18} color={colors.sub} bg={colors.well} diameter={40} onPress={() => actions.openEditProject(pc.projectId)} />
          </View>
        </Appear>
      )}
    </Animated.View>
  );
}

function Archived({ items }: { items: { projectId: string; name: string; lifetimeSec: number; look: ProjectView['look'] }[] }) {
  const t = useTheme();
  const { colors, radius } = t;
  const actions = useActions();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: 24 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`Archived projects, ${items.length}`}
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}
      >
        <Glyph name="archive" size={18} color={colors.sub} />
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.sub }}>{items.length}</Text>
        <Glyph name={open ? 'chevronUp' : 'chevronDown'} size={16} color={colors.sub} />
      </Pressable>
      {open &&
        items.map((a) => {
          const sw = t.swatch(a.look.color);
          return (
            <View key={a.projectId} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius.lg, padding: 12, marginTop: 8 }, t.shadow]}>
              <View style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: sw.light, alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={ICONS[a.look.icon]} size={16} color={t.dark ? sw.base : sw.dark} />
              </View>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.ink }}>
                {a.name}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub, fontVariant: ['tabular-nums'] }}>{fmtDur(a.lifetimeSec)}</Text>
              <IconButton label={`Unarchive ${a.name}`} name="unarchive" size={18} color={colors.brand} bg={colors.well} diameter={38} onPress={() => actions.unarchiveProject(a.projectId)} />
            </View>
          );
        })}
    </View>
  );
}
