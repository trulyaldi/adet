import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

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
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>Session deleted</Text>
      <Pressable onPress={actions.undoDelete} hitSlop={8} style={{ paddingVertical: 4, paddingHorizontal: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>Undo</Text>
      </Pressable>
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
