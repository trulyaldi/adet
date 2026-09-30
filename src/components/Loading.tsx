import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AdetMark } from './AdetMark';
import { PixelDots } from './PixelDots';

/** The loading screen: the Adet mark over pixel dots stepping in turn (still with reduce motion). */
export function Loading() {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel="Loading" style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <AdetMark height={48} color={colors.brand} />
      <PixelDots />
    </View>
  );
}
