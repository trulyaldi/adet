import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from '../theme/tokens';
import { Screen } from '../store/StreakStore';
import { GlyphName, IconButton } from './Glyph';

const TABS: { key: Screen; label: string; glyph: GlyphName }[] = [
  { key: 'today', label: 'Today', glyph: 'today' },
  { key: 'projects', label: 'Projects', glyph: 'target' },
  { key: 'stats', label: 'Stats', glyph: 'bars' },
];

interface TabBarProps {
  active: Screen;
  onChange(s: Screen): void;
}

/** Icon-only tabs; the active one sits on a filled pill, so it doesn't rely on color alone. */
export function TabBar({ active, onChange }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: 'row',
        paddingTop: 8,
        paddingHorizontal: 24,
        paddingBottom: Math.max(insets.bottom, 10),
      }}
    >
      {TABS.map((tab) => {
        const on = active === tab.key;
        return (
          <View key={tab.key} style={{ flex: 1, alignItems: 'center' }}>
            <IconButton
              label={tab.label}
              name={tab.glyph}
              size={23}
              selected={on}
              color={on ? colors.ink : colors.muted}
              bg={on ? colors.track : 'transparent'}
              onPress={() => onChange(tab.key)}
              style={{ width: 64, height: 38, borderRadius: radius.pill }}
            />
          </View>
        );
      })}
    </View>
  );
}
