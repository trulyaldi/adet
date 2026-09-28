import React from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '../components/Button';
import { CloseButton, Glyph, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { ScenePreview } from '../components/ScenePreview';
import { Sheet } from '../components/Sheet';
import { ICONS } from '../domain/constants';
import { PROJECT_COLORS, PROJECT_ICONS, SCENES } from '../domain/look';
import { isCheck } from '../domain/marks';
import { fmtDur } from '../domain/time';
import { SceneKind } from '../domain/types';
import { useActions, useData, useUi } from '../store/StreakStore';
import { inputStyle } from '../theme/styles';
import { useTheme } from '../theme/ThemeProvider';

const SCENE_NAMES: Record<SceneKind, string> = { plant: 'Growing plant', orbit: 'Orbit', fill: 'Fill', constellation: 'Constellation' };
const MAX_TARGET_H = 60;

/** Swap one sheet for another: iOS shows one modal at a time, so wait for this one to go. */
const SHEET_SWAP_MS = 380;

/**
 * Edit a project: name, color, icon, focus scene (live previews), weekly
 * target, and its habits. Archive or delete at the bottom.
 */
export function ProjectSheet() {
  const t = useTheme();
  const { colors, radius } = t;
  const data = useData();
  const actions = useActions();
  const sheet = useUi((u) => u.projectSheet);
  const isEdit = !!sheet?.id;
  const valid = !!sheet?.name.trim();
  const sw = sheet ? t.swatch(sheet.color) : t.brand;
  const habits = sheet?.id ? data.habits.filter((h) => h.projectId === sheet.id) : [];

  const confirmDelete = (id: string, name: string) =>
    Alert.alert(`Delete ${name}?`, 'Its habits and all their history are removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => actions.deleteProject(id) },
    ]);
  const thenOpen = (fn: () => void) => {
    actions.closeProjectSheet();
    setTimeout(fn, SHEET_SWAP_MS);
  };

  return (
    <Sheet visible={!!sheet} onClose={actions.closeProjectSheet} maxHeightPct={0.92}>
      {sheet && (
        <View style={{ gap: 18, paddingTop: 10 }}>
          <View style={{ zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={ICONS[sheet.icon]} size={22} color={sw.on} />
            </View>
            <CloseButton onPress={actions.closeProjectSheet} />
          </View>

          <TextInput
            value={sheet.name}
            onChangeText={(name) => actions.patchProjectSheet({ name })}
            placeholder="Project"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Project name"
            style={inputStyle(colors, radius)}
          />

          {/* Color */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Glyph name="palette" size={20} color={colors.sub} label="Color" />
            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PROJECT_COLORS.map((c) => {
                const on = sheet.color === c;
                const s = t.swatch(c);
                return (
                  <Pressable
                    key={c}
                    onPress={() => actions.patchProjectSheet({ color: c })}
                    accessibilityRole="button"
                    accessibilityLabel={`Color ${c}`}
                    accessibilityState={{ selected: on }}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: s.base, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 3 : 0, borderColor: colors.ink }}
                  >
                    {on && <Glyph name="done" size={16} color={s.on} bg={s.base} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Icon */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PROJECT_ICONS.map((k) => {
              const on = sheet.icon === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => actions.patchProjectSheet({ icon: k })}
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

          {/* Scene */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {SCENES.map((k) => {
              const on = sheet.scene === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => actions.patchProjectSheet({ scene: k })}
                  accessibilityRole="button"
                  accessibilityLabel={`Focus scene: ${SCENE_NAMES[k]}`}
                  accessibilityState={{ selected: on }}
                  style={{ borderRadius: 19, borderWidth: 3, borderColor: on ? sw.base : 'transparent', padding: 1 }}
                >
                  <ScenePreview kind={k} swatch={sw} width={72} height={96} />
                  {on && (
                    <View style={{ position: 'absolute', right: 5, top: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
                      <Glyph name="done" size={12} color={sw.on} bg={sw.base} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Weekly target */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.well, borderRadius: radius.lg, padding: 10 }}>
            <Glyph name="calendar" size={20} color={colors.sub} label="Weekly target" />
            <View style={{ flex: 1 }} />
            <IconButton label="Less" name="minus" size={16} bg={colors.card} diameter={38} disabled={sheet.weeklyTarget <= 0.5} onPress={() => actions.patchProjectSheet({ weeklyTarget: Math.max(0.5, sheet.weeklyTarget - 0.5) })} />
            <Text accessibilityLabel={`Weekly target ${sheet.weeklyTarget} hours`} style={{ minWidth: 64, textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>
              {fmtDur(sheet.weeklyTarget * 3600)}
            </Text>
            <IconButton label="More" name="plus" size={16} bg={colors.card} diameter={38} disabled={sheet.weeklyTarget >= MAX_TARGET_H} onPress={() => actions.patchProjectSheet({ weeklyTarget: Math.min(MAX_TARGET_H, sheet.weeklyTarget + 0.5) })} />
          </View>

          {/* Habits */}
          {isEdit && (
            <View style={{ gap: 8 }}>
              {habits.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => thenOpen(() => actions.openEditHabitById(h.id))}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${h.name}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.well, borderRadius: radius.md, padding: 12 }}
                >
                  <Icon path={ICONS[h.icon] || ICONS.code} size={20} color={colors.ink} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.ink }}>
                    {h.name}
                  </Text>
                  <Glyph name={isCheck(h) ? 'done' : 'clock'} size={16} color={colors.sub} bg={colors.well} label={isCheck(h) ? 'Check-off' : 'Timed'} />
                  {!isCheck(h) && <Text style={{ fontSize: 13, fontWeight: '800', color: colors.sub, fontVariant: ['tabular-nums'] }}>{fmtDur(h.dailyTargetMin * 60)}</Text>}
                  <Glyph name="chevronRight" size={16} color={colors.muted} bg={colors.well} />
                </Pressable>
              ))}
              <View style={{ alignItems: 'flex-start' }}>
                <IconButton label="Add a habit" name="plus" size={18} color={colors.sub} bg={colors.well} diameter={40} onPress={() => thenOpen(() => actions.openNewHabit(sheet.id!))} />
              </View>
            </View>
          )}

          <Button icon="done" label={isEdit ? 'Save changes' : 'Create project'} swatch={sw} disabled={!valid} onPress={actions.saveProjectSheet} />

          {isEdit && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
              <IconButton label="Archive project" name="archive" size={20} color={colors.ink} bg={colors.well} diameter={44} onPress={() => actions.archiveProject(sheet.id!)} />
              <IconButton
                label="Delete project"
                name="trash"
                size={20}
                color={colors.danger}
                bg={colors.dangerBg}
                diameter={44}
                onPress={() => confirmDelete(sheet.id!, sheet.name.trim() || 'this project')}
              />
            </View>
          )}
        </View>
      )}
    </Sheet>
  );
}
