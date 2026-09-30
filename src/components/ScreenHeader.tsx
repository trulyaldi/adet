import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

/**
 * The one header style every tab uses: a title (or the Adet lockup on
 * Today) on the left, round icon buttons on the right.
 */
export function ScreenHeader({ title, titleLabel, left, right }: { title?: string; /** What VoiceOver says for the title, when it differs. */ titleLabel?: string; left?: React.ReactNode; right?: React.ReactNode }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 44, zIndex: 10 }}>
      {left ?? (
        <Text accessibilityRole="header" accessibilityLabel={titleLabel} numberOfLines={1} style={[type.title, { flexShrink: 1, color: colors.ink }]}>
          {title}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{right}</View>
    </View>
  );
}
