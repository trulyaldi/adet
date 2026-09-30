import React from 'react';
import { View } from 'react-native';

import { useSyncStatus } from '../store/StreakStore';
import { useTheme } from '../theme/ThemeProvider';
import { Glyph, useTip } from './Glyph';
import { Text } from './Text';

/** A cloud glyph: ticked when synced, dotted while syncing, struck through offline (with the pending count). */
export function SyncIndicator() {
  const { colors, radius, shadow } = useTheme();
  const sync = useSyncStatus();
  const label =
    sync.state === 'synced'
      ? 'Synced'
      : sync.state === 'syncing'
        ? 'Syncing'
        : sync.pending
          ? `Offline, ${sync.pending} pending`
          : 'Offline';
  const { show, tip } = useTip(label, true);
  return (
    <View style={{ position: 'relative' }}>
      <View
        accessible
        accessibilityLabel={label}
        onTouchEnd={show}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
      >
        <Glyph
          name={sync.state === 'synced' ? 'cloud' : sync.state === 'syncing' ? 'cloudSync' : 'cloudOff'}
          size={16}
          color={colors.muted}
        />
        {sync.state === 'offline' && sync.pending > 0 && (
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, fontVariant: ['tabular-nums'] }}>{sync.pending}</Text>
        )}
      </View>
      {tip}
    </View>
  );
}
