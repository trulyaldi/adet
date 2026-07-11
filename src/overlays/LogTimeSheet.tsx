import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Sheet } from '../components/Sheet';
import { DOWFULL } from '../domain/constants';
import { addDays, fmtMin, stepFor } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

const DAY_OFFSETS = [0, 1, 2];

export function LogTimeSheet() {
  const { data, ui, actions } = useStreak();
  const sheet = ui.logSheet;
  const valid = !!(sheet && sheet.habitId && sheet.minutes > 0);
  const durPct = sheet
    ? Math.min(100, Math.round((sheet.minutes / 240) * 100))
    : 0;

  return (
    <Sheet visible={!!sheet} onClose={actions.closeLogSheet} maxHeightPct={0.82}>
      {sheet && (
        <View style={{ gap: 15, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>Log time</Text>
            <CloseButton onPress={actions.closeLogSheet} />
          </View>

          {/* Habit */}
          <View>
            <Label>Habit</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {data.habits.map((h) => {
                const on = sheet.habitId === h.id;
                return (
                  <Chip
                    key={h.id}
                    label={h.name}
                    on={on}
                    onPress={() => actions.patchLogSheet({ habitId: h.id })}
                  />
                );
              })}
            </View>
          </View>

          {/* When */}
          <View>
            <Label>When</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DAY_OFFSETS.map((off) => {
                const label =
                  off === 0
                    ? 'Today'
                    : off === 1
                    ? 'Yesterday'
                    : DOWFULL[addDays(new Date(), -off).getDay()];
                return (
                  <Chip
                    key={off}
                    label={label}
                    on={sheet.dayOffset === off}
                    onPress={() => actions.patchLogSheet({ dayOffset: off })}
                  />
                );
              })}
            </View>
          </View>

          {/* Duration */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Label noMargin>Duration</Label>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
                {fmtMin(sheet.minutes)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <StepButton
                label="−"
                onPress={() =>
                  actions.patchLogSheet({
                    minutes: Math.max(5, sheet.minutes - stepFor(sheet.minutes)),
                  })
                }
              />
              <View style={{ flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' }}>
                <View style={{ width: `${durPct}%`, height: '100%', borderRadius: radius.pill, backgroundColor: colors.ink }} />
              </View>
              <StepButton
                label="+"
                onPress={() =>
                  actions.patchLogSheet({
                    minutes: Math.min(480, sheet.minutes + stepFor(sheet.minutes)),
                  })
                }
              />
            </View>
          </View>

          {/* Note */}
          <View>
            <Label>Note</Label>
            <TextInput
              value={sheet.note}
              onChangeText={(t) => actions.patchLogSheet({ note: t })}
              placeholder="Optional"
              placeholderTextColor="#A9ACB3"
              style={inputStyle}
            />
          </View>

          {/* Save */}
          <Pressable
            disabled={!valid}
            onPress={actions.saveLogSheet}
            style={{
              borderRadius: radius.lg,
              padding: 16,
              alignItems: 'center',
              backgroundColor: colors.ink,
              opacity: valid ? 1 : 0.4,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>Save session</Text>
          </Pressable>
        </View>
      )}
    </Sheet>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress(): void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: radius.pill,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: on ? colors.ink : colors.screen,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: on ? '#FFFFFF' : colors.ink }}>{label}</Text>
    </Pressable>
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

function Label({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtext, marginBottom: noMargin ? 0 : 8 }}>
      {children}
    </Text>
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
