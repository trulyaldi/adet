import React from 'react';
import { Text, View } from 'react-native';

import { useStreak } from '../store/StreakStore';
import { colors } from '../theme/tokens';

/** Small dot + label: synced, syncing, or offline with the pending count. */
export function SyncIndicator() {
  const { sync } = useStreak();
  const dot = sync.state === 'synced' ? colors.green : sync.state === 'syncing' ? colors.muted : colors.warn;
  const label =
    sync.state === 'synced'
      ? 'Synced'
      : sync.state === 'syncing'
        ? 'Syncing…'
        : sync.pending
          ? `Offline · ${sync.pending} pending`
          : 'Offline';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted }}>{label}</Text>
    </View>
  );
}
