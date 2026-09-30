import React from 'react';
import { View } from 'react-native';

import { DateTimeField } from '../components/DateTimeField';
import { CloseButton, Glyph, IconButton } from '../components/Glyph';
import { Press } from '../components/motion/Press';
import { Sheet } from '../components/Sheet';
import { activeHabits } from '../domain/projects';
import { checkSessionTimes, fitManualStart, SESSION_MAX_SEC } from '../domain/sessions';
import { fmtHM, fmtMin, stepFor } from '../domain/time';
import { logSheetEnd, useActions, useData, useStoreNow, useUi } from '../store/StreakStore';
import { inputStyle } from '../theme/styles';
import { useTheme } from '../theme/ThemeProvider';
import { Text, TextInput } from '../components/Text';

const MAX_MIN = SESSION_MAX_SEC / 60;

export function LogTimeSheet() {
  const { colors, radius, shadow } = useTheme();
  const data = useData();
  const now = useStoreNow();
  const actions = useActions();
  const sheet = useUi((u) => u.logSheet);
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
            <View style={{ zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Glyph name="plus" size={20} color={colors.ink} label="Log time" />
              <Glyph name="clock" size={22} color={colors.ink} />
            </View>
            <CloseButton onPress={actions.closeLogSheet} />
          </View>

          {/* Habit */}
          <View>
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
              <Chip label="End" on={sheet.mode === 'end'} onPress={() => setMode('end')} />
            </View>
            {sheet.mode === 'duration' ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Glyph name="clock" size={17} color={colors.sub} label="Duration" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{fmtMin(sheet.minutes)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <StepButton
                    label="Shorter"
                    glyph="minus"
                    onPress={() => setMinutes(Math.max(5, sheet.minutes - stepFor(sheet.minutes)))}
                  />
                  <View style={{ flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' }}>
                    <View style={{ width: `${durPct}%`, height: '100%', borderRadius: radius.pill, backgroundColor: colors.brand }} />
                  </View>
                  <StepButton
                    label="Longer"
                    glyph="plus"
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
                  <Glyph name="clock" size={17} color={colors.sub} label="Duration" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
                    {check?.ok ? fmtHM(check.duration) : '—'}
                  </Text>
                </View>
              </>
            )}
          </View>

          {error && <Text style={{ fontSize: 13, fontWeight: '600', color: colors.amber }}>{error}</Text>}
          {confirming && check?.ok && (
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.sub }}>
              {`That's ${fmtHM(check.duration)}, longer than 8 hours. Save it anyway?`}
            </Text>
          )}

          {/* Note */}
          <TextInput
            value={sheet.note}
            onChangeText={(t) => actions.patchLogSheet({ note: t })}
            placeholder="Note"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Note, optional"
            style={inputStyle(colors, radius)}
          />

          {/* Save; a session over 8 hours asks to be confirmed in words */}
          {confirming && check?.ok ? (
            <Press
              kind="button"
              onPress={actions.saveLogSheet}
              style={{ borderRadius: radius.lg, padding: 16, alignItems: 'center', backgroundColor: colors.brand }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.onBrand }}>{`Yes, save ${fmtHM(check.duration)}`}</Text>
            </Press>
          ) : (
            <IconButton
              label="Save session"
              name="done"
              size={24}
              color={colors.onBrand}
              bg={colors.brand}
              disabled={!valid}
              onPress={actions.saveLogSheet}
              style={{ borderRadius: radius.lg, padding: 14 }}
            />
          )}
        </View>
      )}
    </Sheet>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress(): void }) {
  const { colors, radius, shadow } = useTheme();
  return (
    <Press
      kind="icon"
      onPress={onPress}
      style={{
        borderRadius: radius.pill,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: on ? colors.brand : colors.well,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: on ? colors.onBrand : colors.ink }}>{label}</Text>
    </Press>
  );
}

function StepButton({ label, glyph, onPress }: { label: string; glyph: 'minus' | 'plus'; onPress(): void }) {
  const { colors, radius, shadow } = useTheme();
  return <IconButton label={label} name={glyph} size={18} bg={colors.well} onPress={onPress} style={{ width: 40, height: 40, borderRadius: 13 }} />;
}
