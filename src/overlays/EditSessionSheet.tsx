import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Sheet } from '../components/Sheet';
import { fmtMin, stepFor } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

export function EditSessionSheet() {
  const { ui, actions } = useStreak();
  const sheet = ui.sessionSheet;
  const durPct = sheet
    ? Math.min(100, Math.round((sheet.minutes / 240) * 100))
    : 0;

  return (
    <Sheet visible={!!sheet} onClose={actions.closeSessionSheet} maxHeightPct={0.72}>
      {sheet && (
        <View style={{ gap: 15, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>Edit session</Text>
              <Text style={{ fontSize: 13, color: colors.subtext, marginTop: 2 }}>{sheet.meta}</Text>
            </View>
            <CloseButton onPress={actions.closeSessionSheet} />
          </View>

          {/* Duration */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtext }}>Duration</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
                {fmtMin(sheet.minutes)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <StepButton
                label="−"
                onPress={() =>
                  actions.patchSessionSheet({
                    minutes: Math.max(1, sheet.minutes - stepFor(sheet.minutes)),
                  })
                }
              />
              <View style={{ flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' }}>
                <View style={{ width: `${durPct}%`, height: '100%', borderRadius: radius.pill, backgroundColor: colors.ink }} />
              </View>
              <StepButton
                label="+"
                onPress={() =>
                  actions.patchSessionSheet({
                    minutes: Math.min(480, sheet.minutes + stepFor(sheet.minutes)),
                  })
                }
              />
            </View>
          </View>

          {/* Note */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtext, marginBottom: 8 }}>Note</Text>
            <TextInput
              value={sheet.note}
              onChangeText={(t) => actions.patchSessionSheet({ note: t })}
              placeholder="Optional"
              placeholderTextColor="#A9ACB3"
              style={inputStyle}
            />
          </View>

          {/* Save */}
          <Pressable
            onPress={actions.saveSessionSheet}
            style={{
              borderRadius: radius.lg,
              padding: 16,
              alignItems: 'center',
              backgroundColor: colors.ink,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>Save changes</Text>
          </Pressable>

          <Pressable onPress={() => actions.deleteSession(sheet.id)} style={{ padding: 4, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>Delete session</Text>
          </Pressable>
        </View>
      )}
    </Sheet>
  );
}

function StepButton({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        borderRadius: 13,
        backgroundColor: colors.screen,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '600', color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}

function CloseButton({ onPress }: { onPress(): void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: 14, color: colors.subtext }}>✕</Text>
    </Pressable>
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
