import React from 'react';
import { View } from 'react-native';

import { CloseButton, Glyph, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { Press } from '../components/motion/Press';
import { Sheet } from '../components/Sheet';
import { ICONS } from '../domain/constants';
import { projectLook } from '../domain/look';
import { isCheck } from '../domain/marks';
import { bindTimerQuest, dropTimerQuest } from '../game/state/timerQuest';
import { activeProjects, projectWeekSec } from '../domain/projects';
import { useActions, useData, useStoreNow, useUi } from '../store/StreakStore';
import { MODAL_GAP_MS } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../components/Text';

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
  const close = () => {
    dropTimerQuest();
    actions.closeStartSheet();
  };
  const start = (habitId: string) => {
    const h = data.habits.find((x) => x.id === habitId);
    if (!h) return;
    actions.closeStartSheet();
    // A quest picked on the Realm screen goes with the timer it starts (a check has no session).
    if (isCheck(h)) {
      dropTimerQuest();
      actions.toggleCheck(h.id);
    } else {
      bindTimerQuest(h.id);
      setTimeout(() => actions.startTimer(h.id), MODAL_GAP_MS); // focus opens once the sheet is gone
    }
  };

  return (
    <Sheet visible={open} onClose={close} maxHeightPct={0.85}>
      <View style={{ gap: 12, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <Glyph name="play" size={22} color={colors.ink} label="Start something" />
          <CloseButton onPress={close} />
        </View>
        {projects.map((p) => {
          const look = projectLook(p);
          const sw = t.swatch(look.color);
          const habits = data.habits.filter((h) => h.projectId === p.id);
          const first = habits.find((h) => !isCheck(h)) ?? habits[0];
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
