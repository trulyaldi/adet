import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { DateTimeField } from '../components/DateTimeField';
import { CloseButton, Glyph, IconButton } from '../components/Glyph';
import { Sheet } from '../components/Sheet';
import { activeHabits } from '../domain/projects';
import { checkSessionTimes } from '../domain/sessions';
import { fmtHM } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { inputStyle } from '../theme/styles';
import { useTheme } from '../theme/ThemeProvider';

export function EditSessionSheet() {
  const { colors, radius, shadow } = useTheme();
  const { data, ui, now, actions } = useStreak();
  const sheet = ui.sessionSheet;
  // Validate live so problems show while picking, not only on save.
  const check = sheet ? checkSessionTimes(sheet.start, sheet.end, now, { existing: true }) : null;
  const error = sheet?.error ?? (check && !check.ok ? check.error : null);
  const confirming = !!(sheet?.confirmLong && check?.ok);
  const live = new Set(activeHabits(data).map((h) => h.id));
  // Picker cap: end of today, stable all day (a per-second value would re-render
  // the open native picker). checkSessionTimes rejects the rest of today's future.
  const today = new Date(now);
  const pickerMax = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime() - 1;

  return (
    <Sheet visible={!!sheet} onClose={actions.closeSessionSheet} maxHeightPct={0.86}>
      {sheet && (
        <View style={{ gap: 15, paddingTop: 12 }}>
          <View style={{ zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Glyph name="pencil" size={22} color={colors.ink} label="Edit session" />
            <CloseButton onPress={actions.closeSessionSheet} />
          </View>

          {/* Habit */}
          <View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {/* Archived projects' habits aren't offered, except the session's own. */}
              {data.habits.filter((h) => h.id === sheet.habitId || live.has(h.id)).map((h) => (
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
              <Glyph name="clock" size={17} color={colors.sub} label="Duration" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
                {check?.ok ? fmtHM(check.duration) : '—'}
              </Text>
            </View>
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
            onChangeText={(t) => actions.patchSessionSheet({ note: t })}
            placeholder="Note"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Note, optional"
            style={inputStyle(colors, radius)}
          />

          {/* Save; a session over 8 hours asks to be confirmed in words */}
          {confirming && check?.ok ? (
            <Pressable
              onPress={actions.saveSessionSheet}
              style={{ borderRadius: radius.lg, padding: 16, alignItems: 'center', backgroundColor: colors.brand }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.onBrand }}>{`Yes, save ${fmtHM(check.duration)}`}</Text>
            </Pressable>
          ) : (
            <IconButton
              label="Save changes"
              name="done"
              size={24}
              color={colors.onBrand}
              bg={colors.brand}
              disabled={!!error}
              onPress={actions.saveSessionSheet}
              style={{ borderRadius: radius.lg, padding: 14 }}
            />
          )}

          {/* Deleting can be undone from the toast, so it isn't confirmed first. */}
          <View style={{ alignItems: 'center' }}>
            <IconButton
              label="Delete session"
              name="trash"
              size={20}
              color={colors.danger}
              bg={colors.dangerBg}
              diameter={44}
              onPress={() => actions.deleteSession(sheet.id)}
            />
          </View>
        </View>
      )}
    </Sheet>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress(): void }) {
  const { colors, radius, shadow } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: radius.pill,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: on ? colors.brand : colors.well,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: on ? colors.onBrand : colors.ink }}>{label}</Text>
    </Pressable>
  );
}
