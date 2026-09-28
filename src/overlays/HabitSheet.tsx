import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Icon } from '../components/Icon';
import { CloseButton } from '../components/Glyph';
import { Sheet } from '../components/Sheet';
import { ICONS, ICON_KEYS } from '../domain/constants';
import { activeHabits, isArchived } from '../domain/projects';
import { fmtMin } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

export function HabitSheet() {
  const { data, ui, config, actions } = useStreak();
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

  return (
    <Sheet visible={!!sheet} onClose={actions.closeHabitSheet} maxHeightPct={0.78}>
      {sheet && (
        <View style={{ gap: 15, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>
              {isEdit ? 'Edit habit' : 'New habit'}
            </Text>
            <CloseButton onPress={actions.closeHabitSheet} />
          </View>

          {/* Name */}
          <View>
            <Label>Name</Label>
            <TextInput
              value={sheet.name}
              onChangeText={(t) => actions.patchHabitSheet({ name: t })}
              placeholder="e.g. LeetCode"
              placeholderTextColor="#A9ACB3"
              style={inputStyle}
            />
            {!!dup && (
              <Text style={{ fontSize: 12.5, color: colors.warn, marginTop: 7 }}>
                {dupArchivedIn
                  ? `"${dup.name}" already exists in the archived project "${dupArchivedIn.name}". Unarchive it from Projects to use it again.`
                  : `"${dup.name}" already exists — open it from Projects instead of creating a duplicate.`}
              </Text>
            )}
          </View>

          {/* Icon */}
          <View>
            <Label>Icon</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
              {ICON_KEYS.map((k) => {
                const on = sheet.icon === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => actions.patchHabitSheet({ icon: k })}
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
          </View>

          {/* Project */}
          <View>
            <Label>Project</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {data.projects.filter((p) => !isArchived(p) || p.id === sheet.projectId).map((p) => {
                const on = sheet.projectId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => actions.patchHabitSheet({ projectId: p.id })}
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
          </View>

          {/* Target. The habit's daily target is still stored and synced
              (older app versions show it) but no longer shown or edited. */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: colors.screen,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.subtext }}>
                Weekly target
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  marginTop: 8,
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Pressable
                  onPress={() =>
                    actions.patchHabitSheet({
                      weeklyTargetMin: Math.max(30, sheet.weeklyTargetMin - 30),
                    })
                  }
                  style={stepButtonStyle}
                >
                  <Text style={stepButtonTextStyle}>−</Text>
                </Pressable>
                <Text
                  style={{
                    fontWeight: '800',
                    color: colors.ink,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {fmtMin(sheet.weeklyTargetMin)}
                </Text>
                <Pressable
                  onPress={() =>
                    actions.patchHabitSheet({
                      weeklyTargetMin: Math.min(3000, sheet.weeklyTargetMin + 30),
                    })
                  }
                  style={stepButtonStyle}
                >
                  <Text style={stepButtonTextStyle}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Merge (edit only) */}
          {isEdit && (
            <View>
              <Label>Merge into another habit</Label>
              <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>
                All sessions move to the chosen habit. History is preserved.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {activeHabits(data)
                  .filter((h) => h.id !== sheet.id)
                  .map((h) => (
                    <Pressable
                      key={h.id}
                      onPress={() => actions.mergeHabit(sheet.id!, h.id)}
                      style={{ borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.screen }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>→ {h.name}</Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          )}

          {/* Save */}
          <Pressable
            disabled={!valid}
            onPress={actions.saveHabitSheet}
            style={{
              borderRadius: radius.lg,
              padding: 16,
              alignItems: 'center',
              backgroundColor: colors.ink,
              opacity: valid ? 1 : 0.4,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
              {isEdit ? 'Save changes' : 'Create habit'}
            </Text>
          </Pressable>

          {isEdit && (
            <Pressable onPress={() => actions.deleteHabit(sheet.id!)} style={{ padding: 4, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>
                Delete habit &amp; its history
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </Sheet>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtext, marginBottom: 8 }}>{children}</Text>
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

const stepButtonStyle = {
  width: 30,
  height: 30,
  borderRadius: 10,
  backgroundColor: colors.card,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const stepButtonTextStyle = {
  fontSize: 16,
  fontWeight: '600' as const,
  color: colors.ink,
};
