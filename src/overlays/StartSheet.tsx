import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { CloseButton, Glyph, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { Sheet } from '../components/Sheet';
import { ICONS } from '../domain/constants';
import { projectLook } from '../domain/look';
import { isCheck } from '../domain/marks';
import { activeProjects, projectWeekSec } from '../domain/projects';
import { useStreak } from '../store/StreakStore';
import { MODAL_GAP_MS } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Start anything, planned or not: every project with its habits. Tap a
 * project to start its first habit, or a habit to start (or check) it.
 */
export function StartSheet() {
  const t = useTheme();
  const { colors, radius } = t;
  const { data, ui, now, actions } = useStreak();
  const projects = activeProjects(data);
  const weekSec = (pid: string) => projectWeekSec(data, pid, now);
  const start = (habitId: string) => {
    const h = data.habits.find((x) => x.id === habitId);
    if (!h) return;
    actions.closeStartSheet();
    if (isCheck(h)) actions.toggleCheck(h.id);
    else setTimeout(() => actions.startTimer(h.id), MODAL_GAP_MS); // focus opens once the sheet is gone
  };

  return (
    <Sheet visible={ui.startSheet} onClose={actions.closeStartSheet} maxHeightPct={0.85}>
      <View style={{ gap: 12, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <Glyph name="play" size={22} color={colors.ink} label="Start something" />
          <CloseButton onPress={actions.closeStartSheet} />
        </View>
        {projects.map((p) => {
          const look = projectLook(p);
          const sw = t.swatch(look.color);
          const habits = data.habits.filter((h) => h.projectId === p.id);
          const first = habits.find((h) => !isCheck(h)) ?? habits[0];
          return (
            <View key={p.id} style={{ backgroundColor: sw.light, borderRadius: radius.xl, padding: 12, gap: 10 }}>
              <Pressable
                disabled={!first}
                onPress={() => first && start(first.id)}
                accessibilityRole="button"
                accessibilityLabel={first ? `Start ${p.name}` : p.name}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 })}
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
              </Pressable>
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
                actions.closeStartSheet();
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
