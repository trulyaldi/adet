import React from 'react';
import { Text, View } from 'react-native';

import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';
import { Glyph, IconButton } from './Glyph';

/**
 * "Session deleted · Undo", shown while a deleted session can still be
 * restored. The store clears it after UNDO_MS.
 */
export function UndoToast() {
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
      <Glyph name="trash" size={18} color="#FFFFFF" bg={colors.ink} label="Session deleted" />
      <IconButton label="Undo" name="undo" size={20} color="#FFFFFF" diameter={34} onPress={actions.undoDelete} />
    </View>
  );
}

/** A brief message from the store (ui.toast), e.g. a timer that wasn't saved. */
export function MessageToast() {
  const { ui } = useStreak();
  if (!ui.toast) return null;

  return (
    <View style={{ backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>{ui.toast}</Text>
    </View>
  );
}
