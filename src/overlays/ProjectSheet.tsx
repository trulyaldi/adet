import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

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

  return (
    <Sheet visible={!!sheet} onClose={actions.closeProjectSheet} maxHeightPct={0.8}>
      {sheet && (
        <View style={{ gap: 15, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>
              {isEdit ? 'Edit project' : 'New project'}
            </Text>
            <Pressable
              onPress={actions.closeProjectSheet}
              style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 14, color: colors.subtext }}>✕</Text>
            </Pressable>
          </View>

          {/* Name */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtext, marginBottom: 8 }}>Name</Text>
            <TextInput
              value={sheet.name}
              onChangeText={(t) => actions.patchProjectSheet({ name: t })}
              placeholder="e.g. Become ML Engineer"
              placeholderTextColor="#A9ACB3"
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
          </View>

          {/* Weekly target */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtext }}>Weekly target</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{sheet.weeklyTarget}h / week</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Stepper
                label="−"
                onPress={() => actions.patchProjectSheet({ weeklyTarget: Math.max(1, sheet.weeklyTarget - 1) })}
              />
              <View style={{ flex: 1 }}>
                <ProgressBar pct={targetPct} color={colors.ink} />
              </View>
              <Stepper
                label="+"
                onPress={() => actions.patchProjectSheet({ weeklyTarget: Math.min(40, sheet.weeklyTarget + 1) })}
              />
            </View>
          </View>

          {/* Save */}
          <Pressable
            disabled={!valid}
            onPress={actions.saveProjectSheet}
            style={{ borderRadius: radius.lg, padding: 16, alignItems: 'center', backgroundColor: colors.ink, opacity: valid ? 1 : 0.4 }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
              {isEdit ? 'Save changes' : 'Create project'}
            </Text>
          </Pressable>

          {isEdit && (
            <Pressable
              onPress={() => actions.archiveProject(sheet.id!)}
              style={{ borderRadius: radius.lg, padding: 14, alignItems: 'center', backgroundColor: colors.screen }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>Archive project</Text>
              <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 3, textAlign: 'center' }}>
                Hides it from Today and Projects. Its history stays in Stats.
              </Text>
            </Pressable>
          )}

          {isEdit && (
            <Pressable onPress={() => actions.deleteProject(sheet.id!)} style={{ padding: 4, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>
                Delete project, its habits &amp; history
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </Sheet>
  );
}

function Stepper({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.screen, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: 20, fontWeight: '600', color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}
