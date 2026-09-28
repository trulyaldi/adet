import React from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '../components/Button';
import { FrequencyPicker } from '../components/FrequencyPicker';
import { CloseButton, Glyph, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { ICONS, ICON_KEYS } from '../domain/constants';
import { projectLook } from '../domain/look';
import { activeHabits, isArchived } from '../domain/projects';
import { fmtDur, stepFor } from '../domain/time';
import { useActions, useData, useUi } from '../store/StreakStore';
import { inputStyle } from '../theme/styles';
import { useTheme } from '../theme/ThemeProvider';

/** Longest usual session the stepper offers, in minutes. */
const MAX_TARGET_MIN = 240;

/**
 * A habit: name, icon, project, timed (a count-up toward a target) or
 * check-off, the usual session length as a target marker, and how often.
 */
export function HabitSheet() {
  const t = useTheme();
  const { colors, radius } = t;
  const data = useData();
  const actions = useActions();
  const sheet = useUi((u) => u.habitSheet);
  const isEdit = !!sheet?.id;
  const dup = sheet && !sheet.id ? data.habits.find((h) => h.name.trim().toLowerCase() === sheet.name.trim().toLowerCase()) : null;
  const valid = !!(sheet && sheet.name.trim() && !dup);
  const project = sheet ? data.projects.find((p) => p.id === sheet.projectId) : undefined;
  const sw = t.swatch(projectLook(project ?? { id: sheet?.projectId ?? '' }).color);

  const confirmDelete = (id: string, name: string) =>
    Alert.alert(`Delete ${name}?`, 'All of its history is removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => actions.deleteHabit(id) },
    ]);

  return (
    <Sheet visible={!!sheet} onClose={actions.closeHabitSheet} maxHeightPct={0.9}>
      {sheet && (
        <View style={{ gap: 16, paddingTop: 10 }}>
          <View style={{ zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={ICONS[sheet.icon] || ICONS.code} size={22} color={sw.on} />
            </View>
            <CloseButton onPress={actions.closeHabitSheet} />
          </View>

          <View>
            <TextInput
              value={sheet.name}
              onChangeText={(name) => actions.patchHabitSheet({ name })}
              placeholder="Habit"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Habit name"
              style={inputStyle(colors, radius)}
            />
            {!!dup && (
              <View accessible accessibilityLabel={`A habit called ${dup.name} already exists`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
                <Glyph name="info" size={15} color={colors.amber} />
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.amber }}>{dup.name}</Text>
              </View>
            )}
          </View>

          {/* Icon */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ICON_KEYS.map((k) => {
              const on = sheet.icon === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => actions.patchHabitSheet({ icon: k })}
                  accessibilityRole="button"
                  accessibilityLabel={`Icon ${k}`}
                  accessibilityState={{ selected: on }}
                  style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? sw.base : colors.well }}
                >
                  <Icon path={ICONS[k]} size={22} color={on ? sw.on : colors.ink} />
                </Pressable>
              );
            })}
          </View>

          {/* Project */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {data.projects
              .filter((p) => !isArchived(p) || p.id === sheet.projectId)
              .map((p) => {
                const on = sheet.projectId === p.id;
                const s = t.swatch(projectLook(p).color);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => actions.patchHabitSheet({ projectId: p.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`Project ${p.name}`}
                    accessibilityState={{ selected: on }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: on ? s.base : colors.well }}
                  >
                    {!on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.base }} />}
                    <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '800', color: on ? s.on : colors.ink, maxWidth: 160 }}>
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
          </View>

          {/* Timed or check-off */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['timed', 'check'] as const).map((k) => {
              const on = sheet.kind === k;
              return (
                <View key={k} style={{ flex: 1 }}>
                  <IconButton
                    label={k === 'timed' ? 'Timed habit, with a count-up timer' : 'Check-off habit, tap to complete'}
                    selected={on}
                    onPress={() => actions.patchHabitSheet({ kind: k })}
                    variant="chunky"
                    bg={on ? sw.base : colors.card}
                    edge={on ? sw.dark : colors.line}
                    style={{ height: 50, borderRadius: radius.md, borderWidth: on ? 0 : 2, borderColor: colors.line }}
                  >
                    <Glyph name={k === 'timed' ? 'clock' : 'done'} size={24} color={on ? sw.on : colors.sub} bg={on ? sw.base : colors.card} />
                  </IconButton>
                </View>
              );
            })}
          </View>

          {/* Usual session length: the target marker when it isn't planned */}
          {sheet.kind === 'timed' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.well, borderRadius: radius.lg, padding: 10 }}>
              <Glyph name="clock" size={20} color={colors.sub} label="Usual session length" />
              <View style={{ flex: 1 }} />
              <IconButton
                label="Shorter"
                name="minus"
                size={16}
                bg={colors.card}
                diameter={38}
                disabled={sheet.dailyTargetMin <= 5}
                onPress={() => actions.patchHabitSheet({ dailyTargetMin: Math.max(5, sheet.dailyTargetMin - stepFor(sheet.dailyTargetMin - 1)) })}
              />
              <Text style={{ minWidth: 64, textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{fmtDur(sheet.dailyTargetMin * 60)}</Text>
              <IconButton
                label="Longer"
                name="plus"
                size={16}
                bg={colors.card}
                diameter={38}
                disabled={sheet.dailyTargetMin >= MAX_TARGET_MIN}
                onPress={() => actions.patchHabitSheet({ dailyTargetMin: Math.min(MAX_TARGET_MIN, sheet.dailyTargetMin + stepFor(sheet.dailyTargetMin)) })}
              />
            </View>
          )}

          {/* How often */}
          <View style={{ backgroundColor: colors.well, borderRadius: radius.lg, padding: 12 }}>
            <FrequencyPicker value={sheet.frequency} accent={sw.base} onChange={(frequency) => actions.patchHabitSheet({ frequency })} />
          </View>

          {/* Merge (edit only): all sessions move to the chosen habit */}
          {isEdit && activeHabits(data).some((h) => h.id !== sheet.id) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Glyph name="merge" size={18} color={colors.sub} label="Merge into another habit" />
              {activeHabits(data)
                .filter((h) => h.id !== sheet.id)
                .map((h) => (
                  <Pressable
                    key={h.id}
                    onPress={() => actions.mergeHabit(sheet.id!, h.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Merge into ${h.name}`}
                    style={{ borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.well }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>{h.name}</Text>
                  </Pressable>
                ))}
            </View>
          )}

          <Button icon="done" label={isEdit ? 'Save changes' : 'Create habit'} swatch={sw} disabled={!valid} onPress={actions.saveHabitSheet} />

          {isEdit && (
            <View style={{ alignItems: 'center' }}>
              <IconButton label="Delete habit" name="trash" size={20} color={colors.danger} bg={colors.dangerBg} diameter={44} onPress={() => confirmDelete(sheet.id!, sheet.name.trim() || 'this habit')} />
            </View>
          )}
        </View>
      )}
    </Sheet>
  );
}
