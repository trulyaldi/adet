import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { DateTimeField } from '../components/DateTimeField';
import { Sheet } from '../components/Sheet';
import { checkSessionTimes } from '../domain/sessions';
import { fmtHM } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

export function EditSessionSheet() {
  const { data, ui, now, actions } = useStreak();
  const sheet = ui.sessionSheet;
  // Validate live so problems show while picking, not only on save.
  const check = sheet ? checkSessionTimes(sheet.start, sheet.end, now) : null;
  const error = sheet?.error ?? (check && !check.ok ? check.error : null);
  const confirming = !!(sheet?.confirmLong && check?.ok);
  // Picker cap: end of today, stable all day (a per-second value would re-render
  // the open native picker). checkSessionTimes rejects the rest of today's future.
  const today = new Date(now);
  const pickerMax = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime() - 1;

  return (
    <Sheet visible={!!sheet} onClose={actions.closeSessionSheet} maxHeightPct={0.86}>
      {sheet && (
        <View style={{ gap: 15, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>Edit session</Text>
            <CloseButton onPress={actions.closeSessionSheet} />
          </View>

          {/* Habit */}
          <View>
            <Label>Habit</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {data.habits.map((h) => (
                <Chip
                  key={h.id}
                  label={h.name}
                  on={sheet.habitId === h.id}
                  onPress={() => actions.patchSessionSheet({ habitId: h.id })}
                />
              ))}
            </View>
          </View>

          {/* Times */}
          <View style={{ gap: 10 }}>
            <DateTimeField
              label="Start"
              value={sheet.start}
              max={pickerMax}
              onChange={(start) => actions.patchSessionSheet({ start })}
            />
            <DateTimeField
              label="End"
              value={sheet.end}
              max={pickerMax}
              onChange={(end) => actions.patchSessionSheet({ end })}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Label noMargin>Duration</Label>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
                {check?.ok ? fmtHM(check.duration) : '—'}
              </Text>
            </View>
          </View>

          {error && <Text style={{ fontSize: 13, fontWeight: '600', color: colors.danger }}>{error}</Text>}
          {confirming && check?.ok && (
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtext }}>
              {`That's ${fmtHM(check.duration)}, longer than 8 hours. Save it anyway?`}
            </Text>
          )}

          {/* Note */}
          <View>
            <Label>Note</Label>
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
            disabled={!!error}
            onPress={actions.saveSessionSheet}
            style={{
              borderRadius: radius.lg,
              padding: 16,
              alignItems: 'center',
              backgroundColor: colors.ink,
              opacity: error ? 0.4 : 1,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
              {confirming && check?.ok ? `Yes, save ${fmtHM(check.duration)}` : 'Save changes'}
            </Text>
          </Pressable>

          <Pressable onPress={() => actions.deleteSession(sheet.id)} style={{ padding: 4, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>Delete session</Text>
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
