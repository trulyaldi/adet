import React from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { CloseButton, Glyph, IconButton } from '../components/Glyph';
import { ProgressBar } from '../components/ProgressBar';
import { Sheet } from '../components/Sheet';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

export function ProjectSheet() {
  const { ui, actions } = useStreak();
  const sheet = ui.projectSheet;
  const isEdit = !!(sheet && sheet.id);
  const valid = !!(sheet && sheet.name.trim());
  const targetPct = sheet ? Math.min(100, Math.round((sheet.weeklyTarget / 40) * 100)) : 0;

  // Deleting is the one irreversible action here, so it's confirmed in words.
  const confirmDelete = (id: string, name: string) =>
    Alert.alert(`Delete ${name}?`, 'Its habits and all their history are removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => actions.deleteProject(id) },
    ]);

  return (
    <Sheet visible={!!sheet} onClose={actions.closeProjectSheet} maxHeightPct={0.8}>
      {sheet && (
        <View style={{ gap: 15, paddingTop: 12 }}>
          <View style={{ zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Glyph name={isEdit ? 'pencil' : 'plus'} size={22} color={colors.ink} label={isEdit ? 'Edit project' : 'New project'} />
            <CloseButton onPress={actions.closeProjectSheet} />
          </View>

          {/* Name */}
          <TextInput
            value={sheet.name}
            onChangeText={(t) => actions.patchProjectSheet({ name: t })}
            placeholder="e.g. Become ML Engineer"
            placeholderTextColor="#A9ACB3"
            accessibilityLabel="Project name"
            style={{
              width: '100%',
              backgroundColor: colors.screen,
              borderRadius: radius.md,
              paddingVertical: 15,
              paddingHorizontal: 16,
              fontSize: 16,
              color: colors.ink,
            }}
          />

          {/* Weekly target */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Glyph name="clock" size={18} color={colors.subtext} label="Weekly target" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] }}>
                {sheet.weeklyTarget}h
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconButton
                label="Less"
                name="minus"
                size={18}
                bg={colors.screen}
                style={{ width: 40, height: 40, borderRadius: 13 }}
                onPress={() => actions.patchProjectSheet({ weeklyTarget: Math.max(1, sheet.weeklyTarget - 1) })}
              />
              <View style={{ flex: 1 }}>
                <ProgressBar pct={targetPct} color={colors.ink} />
              </View>
              <IconButton
                label="More"
                name="plus"
                size={18}
                bg={colors.screen}
                style={{ width: 40, height: 40, borderRadius: 13 }}
                onPress={() => actions.patchProjectSheet({ weeklyTarget: Math.min(40, sheet.weeklyTarget + 1) })}
              />
            </View>
          </View>

          {/* Save */}
          <IconButton
            label={isEdit ? 'Save changes' : 'Create project'}
            name="done"
            size={24}
            color="#FFFFFF"
            bg={colors.ink}
            disabled={!valid}
            onPress={actions.saveProjectSheet}
            style={{ borderRadius: radius.lg, padding: 14 }}
          />

          {isEdit && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
              {/* Archiving hides it from Today and Projects; its history stays in Stats. */}
              <IconButton
                label="Archive project"
                name="archive"
                size={20}
                color={colors.ink}
                bg={colors.screen}
                diameter={44}
                onPress={() => actions.archiveProject(sheet.id!)}
              />
              <IconButton
                label="Delete project"
                name="trash"
                size={20}
                color={colors.danger}
                bg={colors.dangerSoft}
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
