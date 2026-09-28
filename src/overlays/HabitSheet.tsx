import React from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { FrequencyPicker } from '../components/FrequencyPicker';
import { CloseButton, Glyph, GlyphName, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { ICONS, ICON_KEYS } from '../domain/constants';
import { clampMinMin } from '../domain/frequency';
import { activeHabits, isArchived } from '../domain/projects';
import { stepFor } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

/** Longest full session the stepper offers, in minutes. */
const MAX_FULL_MIN = 240;

/** Minimum steps: single minutes up to 5, then like the full length. */
function minStep(m: number, dir: 1 | -1): number {
  if (dir < 0) return m <= 5 ? 1 : stepFor(m - 1);
  return m < 5 ? 1 : stepFor(m);
}

export function HabitSheet() {
  const { data, ui, config, actions, settings } = useStreak();
  const sheet = ui.habitSheet;
  const isEdit = !!(sheet && sheet.id);

  const dup =
    sheet && !sheet.id
      ? data.habits.find(
          (h) => h.name.trim().toLowerCase() === sheet.name.trim().toLowerCase()
        )
      : null;
  const valid = !!(sheet && sheet.name.trim() && !dup);
  // Archived projects' habits aren't listed in Projects, so say where it is.
  const dupProject = dup ? data.projects.find((p) => p.id === dup.projectId) : undefined;
  const dupArchivedIn = dupProject && isArchived(dupProject) ? dupProject : null;

  // Deleting is irreversible, so it's confirmed in words.
  const confirmDelete = (id: string, name: string) =>
    Alert.alert(`Delete ${name}?`, 'All of its history is removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => actions.deleteHabit(id) },
    ]);

  return (
    <Sheet visible={!!sheet} onClose={actions.closeHabitSheet} maxHeightPct={0.86}>
      {sheet && (
        <View style={{ gap: 16, paddingTop: 12 }}>
          <View style={{ zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Glyph name={isEdit ? 'pencil' : 'plus'} size={22} color={colors.ink} label={isEdit ? 'Edit habit' : 'New habit'} />
            <CloseButton onPress={actions.closeHabitSheet} />
          </View>

          {/* Name */}
          <View>
            <TextInput
              value={sheet.name}
              onChangeText={(t) => actions.patchHabitSheet({ name: t })}
              placeholder="e.g. LeetCode"
              placeholderTextColor="#A9ACB3"
              accessibilityLabel="Habit name"
              style={inputStyle}
            />
            {!!dup && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
                <Glyph name={dupArchivedIn ? 'archive' : 'info'} size={15} color={colors.warn} />
                <Text style={{ flex: 1, fontSize: 12.5, color: colors.warn }}>
                  {dupArchivedIn ? `${dup.name} · ${dupArchivedIn.name}` : dup.name}
                </Text>
              </View>
            )}
          </View>

          {/* Icon */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {ICON_KEYS.map((k) => {
              const on = sheet.icon === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => actions.patchHabitSheet({ icon: k })}
                  accessibilityRole="button"
                  accessibilityLabel={`Icon: ${k}`}
                  accessibilityState={{ selected: on }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    backgroundColor: colors.screen,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: on ? config.accent : 'transparent',
                  }}
                >
                  <Icon path={ICONS[k]} size={22} />
                </Pressable>
              );
            })}
          </View>

          {/* Project */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {data.projects.filter((p) => !isArchived(p) || p.id === sheet.projectId).map((p) => {
              const on = sheet.projectId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => actions.patchHabitSheet({ projectId: p.id })}
                  accessibilityState={{ selected: on }}
                  style={{
                    borderRadius: radius.pill,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    backgroundColor: on ? colors.ink : colors.screen,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: on ? '#FFFFFF' : colors.ink }}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* How often */}
          <View style={{ backgroundColor: colors.screen, borderRadius: radius.md, padding: 12 }}>
            <FrequencyPicker
              value={sheet.frequency}
              accent={config.accent}
              onChange={(frequency) => actions.patchHabitSheet({ frequency })}
            />
          </View>

          {/* Full and minimum session lengths */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DurationStepper
              glyph="full"
              label="Full session, minutes"
              value={sheet.dailyTargetMin}
              // A full session longer than the daily budget is never planned; amber says so.
              over={sheet.dailyTargetMin > settings.budgetMin}
              canDown={sheet.dailyTargetMin > 5}
              canUp={sheet.dailyTargetMin < MAX_FULL_MIN}
              onStep={(dir) => {
                const full = Math.min(
                  MAX_FULL_MIN,
                  Math.max(5, sheet.dailyTargetMin + dir * stepFor(dir > 0 ? sheet.dailyTargetMin : sheet.dailyTargetMin - 1))
                );
                actions.patchHabitSheet({ dailyTargetMin: full, minTargetMin: clampMinMin(sheet.minTargetMin, full) });
              }}
            />
            <DurationStepper
              glyph="min"
              label="Minimum session, minutes"
              value={sheet.minTargetMin}
              canDown={sheet.minTargetMin > 1}
              canUp={sheet.minTargetMin < sheet.dailyTargetMin}
              onStep={(dir) =>
                actions.patchHabitSheet({
                  minTargetMin: clampMinMin(sheet.minTargetMin + dir * minStep(sheet.minTargetMin, dir), sheet.dailyTargetMin),
                })
              }
            />
          </View>

          {/* Merge (edit only): all sessions move to the chosen habit */}
          {isEdit && activeHabits(data).some((h) => h.id !== sheet.id) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Glyph name="merge" size={18} color={colors.subtext} label="Merge into" />
              {activeHabits(data)
                .filter((h) => h.id !== sheet.id)
                .map((h) => (
                  <Pressable
                    key={h.id}
                    onPress={() => actions.mergeHabit(sheet.id!, h.id)}
                    accessibilityLabel={`Merge into ${h.name}`}
                    style={{ borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.screen }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{h.name}</Text>
                  </Pressable>
                ))}
            </View>
          )}

          {/* Save */}
          <IconButton
            label={isEdit ? 'Save changes' : 'Create habit'}
            name="done"
            size={24}
            color="#FFFFFF"
            bg={colors.ink}
            disabled={!valid}
            onPress={actions.saveHabitSheet}
            style={{ borderRadius: radius.lg, padding: 14 }}
          />

          {isEdit && (
            <View style={{ alignItems: 'center' }}>
              <IconButton
                label="Delete habit"
                name="trash"
                size={20}
                color={colors.danger}
                bg={colors.dangerSoft}
                diameter={44}
                onPress={() => confirmDelete(sheet.id!, sheet.name.trim() || 'this habit')}
              />
            </View>
          )}
        </View>
      )}
    </Sheet>
  );
}

/** A circle glyph (full or half) over a minutes value with − / + steps. */
function DurationStepper({
  glyph,
  label,
  value,
  over,
  canDown,
  canUp,
  onStep,
}: {
  glyph: GlyphName;
  label: string;
  value: number;
  over?: boolean;
  canDown: boolean;
  canUp: boolean;
  onStep(dir: 1 | -1): void;
}) {
  const tone = over ? colors.warn : colors.ink;
  return (
    <View style={{ flex: 1, backgroundColor: colors.screen, borderRadius: 14, padding: 12, gap: 8 }}>
      <Glyph name={glyph} size={20} color={tone} label={label} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton label="Shorter" name="minus" size={15} bg={colors.card} diameter={30} disabled={!canDown} onPress={() => onStep(-1)} />
        <Text accessibilityLabel={`${label}: ${value}`} style={{ fontSize: 17, fontWeight: '800', color: tone, fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
        <IconButton label="Longer" name="plus" size={15} bg={colors.card} diameter={30} disabled={!canUp} onPress={() => onStep(1)} />
      </View>
    </View>
  );
}

const inputStyle = {
  width: '100%' as const,
  backgroundColor: colors.screen,
  borderRadius: radius.md,
  paddingVertical: 15,
  paddingHorizontal: 16,
  fontSize: 16,
  color: colors.ink,
};
