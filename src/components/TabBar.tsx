import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/tokens';
import { Screen } from '../store/StreakStore';
import { Icon } from './Icon';

const TAB_ICONS: Record<Screen, string> = {
  today:
    'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11zM8 2.5V5M16 2.5V5M4 8.5h16M9 13.5l2 2 4-4',
  projects:
    'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 12m-1.2 0a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0',
  stats: 'M5 20V12M12 20V4M19 20v-6',
};

const TABS: { key: Screen; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'projects', label: 'Projects' },
  { key: 'stats', label: 'Stats' },
];

interface TabBarProps {
  active: Screen;
  onChange(s: Screen): void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: 'row',
        paddingTop: 10,
        paddingHorizontal: 24,
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      {TABS.map((tab) => {
        const on = active === tab.key;
        const fg = on ? colors.ink : colors.muted;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={{ flex: 1, alignItems: 'center', gap: 4 }}
          >
            <Icon path={TAB_ICONS[tab.key]} size={22} color={fg} strokeWidth={1.9} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: fg }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
