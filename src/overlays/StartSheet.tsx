import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { CloseButton, Glyph, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { Press } from '../components/motion/Press';
import { Sheet } from '../components/Sheet';
import { Text, TextInput } from '../components/Text';
import { useQuestStarted } from '../data/itemsRepo';
import { useWorldWrites } from '../data/worldRepo';
import { ICONS } from '../domain/constants';
import { projectLook } from '../domain/look';
import { isCheck } from '../domain/marks';
import { activeProjects, projectWeekSec } from '../domain/projects';
import { liveWorld } from '../domain/world/select';
import { QUEST_TITLE_MAX } from '../domain/world/types';
import { PROJECT_REALMS } from '../game/enabled';
import { chipsFor, firstTimedHabit, placedRealmOf, planStart } from '../game/state/startFlow';
import { bindTimerQuest, dropTimerQuest, pendingTimerQuest, setTimerQuest } from '../game/state/timerQuest';
import { useActions, useData, useStoreNow, useSyncStatus, useUi } from '../store/StreakStore';
import { useQuestTables } from '../sync/questTables';
import { inputStyle } from '../theme/styles';
import { MODAL_GAP_MS } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Start anything, planned or not: every project with its habits. Tap a
 * project to start its first habit, or a habit to start (or check) it.
 */
export function StartSheet() {
  const t = useTheme();
  const { colors, radius } = t;
  const data = useData();
  const open = useUi((u) => u.startSheet);
  const now = useStoreNow();
  const actions = useActions();
  const projects = activeProjects(data);
  const weekSec = (pid: string) => projectWeekSec(data, pid, now);

  // Projects as Realms: a typed objective and open-quest chips, only where a project has a realm on the map.
  const world = useWorld(open);
  const writes = useWorldWrites();
  const [objective, setObjective] = useState('');
  // A quest the Realm screen picked is the chosen objective (read as the sheet opens; module state doesn't re-render).
  const pendingId = world ? pendingTimerQuest() : null;
  const pendingTitle = pendingId ? world?.quests.find((q) => q.id === pendingId)?.title ?? null : null;
  const habitsOf = (pid: string) => data.habits.filter((h) => h.projectId === pid);
  const canType = !!world && projects.some((p) => placedRealmOf(world, p.id) && firstTimedHabit(habitsOf(p.id)));

  const close = () => {
    dropTimerQuest();
    setObjective('');
    actions.closeStartSheet();
  };
  const start = (habitId: string, chipQuestId: string | null = null) => {
    const h = data.habits.find((x) => x.id === habitId);
    if (!h) return;
    actions.closeStartSheet();
    setObjective('');
    // A quest goes with the timer it starts (a check has no session, so no quest is made or bound).
    const plan = planStart({
      check: isCheck(h),
      pending: pendingTimerQuest(),
      chipQuestId: world ? chipQuestId : null,
      objective: world ? objective : '',
      realmId: world ? placedRealmOf(world, h.projectId)?.id ?? null : null,
    });
    if (isCheck(h)) {
      dropTimerQuest();
      actions.toggleCheck(h.id);
      return;
    }
    if (plan.kind === 'create') {
      const id = writes.addQuest(plan.realmId, plan.title); // null: not written, so a free session
      if (id) setTimerQuest(id);
    } else if (plan.kind === 'bind') {
      setTimerQuest(plan.questId);
    }
    bindTimerQuest(h.id);
    setTimeout(() => actions.startTimer(h.id), MODAL_GAP_MS); // focus opens once the sheet is gone
  };

  return (
    <Sheet visible={open} onClose={close} maxHeightPct={0.85}>
      <View style={{ gap: 12, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <Glyph name="play" size={22} color={colors.ink} label="Start something" />
          <CloseButton onPress={close} />
        </View>
        {(canType || !!pendingId) && (
          <TextInput
            value={pendingTitle ?? objective}
            onChangeText={setObjective}
            editable={!pendingId}
            maxLength={QUEST_TITLE_MAX}
            placeholder="Objective"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            accessibilityLabel={pendingId ? 'Objective, chosen' : 'Objective for this session, optional'}
            style={[inputStyle(colors, radius), pendingId ? { opacity: 0.6 } : null]}
          />
        )}
        {projects.map((p) => {
          const look = projectLook(p);
          const sw = t.swatch(look.color);
          const habits = habitsOf(p.id);
          const first = habits.find((h) => !isCheck(h)) ?? habits[0];
          const timed = firstTimedHabit(habits);
          const chips = world && timed && !pendingId ? chipsFor(world, p.id, habits) : [];
          return (
            <View key={p.id} style={{ backgroundColor: sw.light, borderRadius: radius.xl, padding: 12, gap: 10 }}>
              <Press
                kind="card"
                disabled={!first}
                onPress={() => first && start(first.id)}
                accessibilityRole="button"
                accessibilityLabel={first ? `Start ${p.name}` : p.name}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={ICONS[look.icon]} size={22} color={sw.on} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>
                    {p.name}
                  </Text>
                  <AnimatedBar value={p.weeklyTarget > 0 ? weekSec(p.id) / (p.weeklyTarget * 3600) : 0} color={sw.base} track={t.dark ? colors.track : '#FFFFFF'} height={8} />
                </View>
                {first && <Glyph name="play" size={20} color={t.dark ? sw.base : sw.dark} bg={sw.light} />}
              </Press>
              {habits.length > 1 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {habits.map((h) => (
                    <IconButton
                      key={h.id}
                      label={isCheck(h) ? `Check off ${h.name}` : `Start ${h.name}`}
                      onPress={() => start(h.id)}
                      bg={colors.card}
                      style={{ flexDirection: 'row', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill }}
                    >
                      <Icon path={ICONS[h.icon] || ICONS.code} size={16} color={t.dark ? sw.base : sw.dark} />
                      <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '800', color: colors.ink, maxWidth: 150 }}>
                        {h.name}
                      </Text>
                    </IconButton>
                  ))}
                </View>
              )}
              {chips.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {chips.map((q) => (
                    <IconButton
                      key={q.id}
                      label={`Start ${p.name}: ${q.title}`}
                      quiet
                      onPress={() => timed && start(timed.id, q.id)}
                      bg={colors.card}
                      style={{ flexDirection: 'row', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill }}
                    >
                      <Icon path={ICONS.target} size={16} color={t.dark ? sw.base : sw.dark} />
                      <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '800', color: colors.ink, maxWidth: 150 }}>
                        {q.title}
                      </Text>
                    </IconButton>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        {!projects.length && (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <IconButton
              label="Add a project"
              name="plus"
              size={22}
              color={colors.onBrand}
              bg={colors.brand}
              edge={colors.brandDark}
              variant="chunky"
              diameter={52}
              onPress={() => {
                close();
                actions.setScreen('projects');
                setTimeout(actions.openNewProject, MODAL_GAP_MS);
              }}
            />
          </View>
        )}
      </View>
    </Sheet>
  );
}

/**
 * The world as the sheet needs it, or null when Projects as Realms is off, the
 * sheet is closed, the journey hasn't started or the quest tables aren't
 * ready (nothing can be written then). Project-aware once sync has settled.
 */
function useWorld(open: boolean) {
  const data = useData();
  const { settled } = useSyncStatus();
  const started = useQuestStarted();
  const tables = useQuestTables();
  const on = PROJECT_REALMS && open && started && tables === 'available';
  return useMemo(() => (on ? liveWorld(data.items, settled ? data.projects : undefined) : null), [on, data.items, data.projects, settled]);
}
