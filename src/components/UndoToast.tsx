import React from 'react';
import { Text, View } from 'react-native';

import { useStreak } from '../store/StreakStore';
import { useTheme } from '../theme/ThemeProvider';
import { Glyph, IconButton } from './Glyph';

/**
 * "Session deleted · Undo", shown while a deleted session can still be
 * restored. The store clears it after UNDO_MS.
 */
export function UndoToast() {
  const { colors, radius, shadow } = useTheme();
  const { ui, actions } = useStreak();
  if (!ui.undo) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.ink,
        borderRadius: radius.md,
        paddingVertical: 12,
        paddingLeft: 16,
        paddingRight: 8,
      }}
    >
      <Glyph name="trash" size={18} color={colors.bg} bg={colors.ink} label="Session deleted" />
      <IconButton label="Undo" name="undo" size={20} color={colors.bg} diameter={34} onPress={actions.undoDelete} />
    </View>
  );
}

/** A brief message from the store (ui.toast), e.g. a timer that wasn't saved. */
export function MessageToast() {
  const { colors, radius, shadow } = useTheme();
  const { ui } = useStreak();
  if (!ui.toast) return null;

  return (
    <View style={{ backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.bg }}>{ui.toast}</Text>
    </View>
  );
}
