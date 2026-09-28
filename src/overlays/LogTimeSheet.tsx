import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { DateTimeField } from '../components/DateTimeField';
import { CloseButton } from '../components/Glyph';
import { Sheet } from '../components/Sheet';
import { activeHabits } from '../domain/projects';
import { checkSessionTimes, fitManualStart, SESSION_MAX_SEC } from '../domain/sessions';
import { fmtHM, fmtMin, stepFor } from '../domain/time';
import { logSheetEnd, useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

const MAX_MIN = SESSION_MAX_SEC / 60;

export function LogTimeSheet() {
  const { data, ui, now, actions } = useStreak();
  const sheet = ui.logSheet;
  // Validate live so problems show while picking, not only on save.
  const check = sheet ? checkSessionTimes(sheet.start, logSheetEnd(sheet), now) : null;
  const error = sheet?.error ?? (check && !check.ok ? check.error : null);
  const confirming = !!(sheet?.confirmLong && check?.ok);
  const valid = !!(sheet && sheet.habitId && !error);
  // Picker cap: end of today, stable all day (a per-second value would re-render
  // the open native picker). checkSessionTimes rejects the rest of today's future.
  const today = new Date(now);
  const pickerMax = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime() - 1;
  const durPct = sheet ? Math.min(100, Math.round((sheet.minutes / 240) * 100)) : 0;

  // Growing the duration past now moves the start earlier instead of erroring.
  const setMinutes = (minutes: number) => {
    if (sheet) actions.patchLogSheet({ minutes, start: fitManualStart(sheet.start, minutes, Date.now()) });
  };

  const setMode = (mode: 'duration' | 'end') => {
    if (!sheet || sheet.mode === mode) return;
    if (mode === 'end') {
      actions.patchLogSheet({ mode, end: logSheetEnd(sheet) });
    } else {
      const m = Math.round((sheet.end - sheet.start) / 60000);
      actions.patchLogSheet({ mode, minutes: m > 0 ? Math.min(MAX_MIN, m) : 30 });
    }
  };

  return (
    <Sheet visible={!!sheet} onClose={actions.closeLogSheet} maxHeightPct={0.9}>
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
              {activeHabits(data).map((h) => (
                <Chip
                  key={h.id}
                  label={h.name}
                  on={sheet.habitId === h.id}
                  onPress={() => actions.patchLogSheet({ habitId: h.id })}
                />
              ))}
            </View>
          </View>

          {/* Start */}
          <DateTimeField
            label="Start"
            value={sheet.start}
            max={pickerMax}
            onChange={(start) => actions.patchLogSheet({ start })}
          />

          {/* Length: duration or end time */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label="Duration" on={sheet.mode === 'duration'} onPress={() => setMode('duration')} />
              <Chip label="End time" on={sheet.mode === 'end'} onPress={() => setMode('end')} />
            </View>
            {sheet.mode === 'duration' ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Label noMargin>Duration</Label>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{fmtMin(sheet.minutes)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <StepButton
                    label="−"
                    onPress={() => setMinutes(Math.max(5, sheet.minutes - stepFor(sheet.minutes)))}
                  />
                  <View style={{ flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' }}>
                    <View style={{ width: `${durPct}%`, height: '100%', borderRadius: radius.pill, backgroundColor: colors.ink }} />
                  </View>
                  <StepButton
                    label="+"
                    onPress={() => setMinutes(Math.min(MAX_MIN, sheet.minutes + stepFor(sheet.minutes)))}
                  />
                </View>
              </View>
            ) : (
              <>
                <DateTimeField
                  label="End"
                  value={sheet.end}
                  max={pickerMax}
                  onChange={(end) => actions.patchLogSheet({ end })}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Label noMargin>Duration</Label>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
                    {check?.ok ? fmtHM(check.duration) : '—'}
                  </Text>
                </View>
              </>
            )}
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
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
              {confirming && check?.ok ? `Yes, save ${fmtHM(check.duration)}` : 'Save session'}
            </Text>
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


const inputStyle = {
  width: '100%' as const,
  backgroundColor: colors.screen,
  borderRadius: radius.md,
  paddingVertical: 15,
  paddingHorizontal: 16,
  fontSize: 16,
  color: colors.ink,
};
