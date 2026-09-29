// A pixel button: presses down one pixel. Disabled is simply dimmed, never
// scolding. Always labelled for VoiceOver; tap target at least 44 pt.

import React, { useState } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';

import { PanelTone, PixelPanel } from './PixelPanel';
import { PixelText } from './PixelText';
import { QUI, useUiUnit } from './theme';

export function PixelButton({
  label,
  accessibilityLabel,
  onPress,
  tone = 'gold',
  disabled,
  icon,
  style,
  small,
}: {
  label?: string;
  accessibilityLabel: string;
  onPress(): void;
  tone?: PanelTone;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const u = useUiUnit();
  const [down, setDown] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      style={[{ minHeight: 44, minWidth: 44, justifyContent: 'center', opacity: disabled ? 0.45 : 1 }, style]}
    >
      <View style={{ transform: [{ translateY: down ? u : 0 }], paddingBottom: down ? 0 : u }}>
        <PixelPanel tone={tone} pressed={down} padding={small ? 1 : 2} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 * u }}>
          {icon}
          {label ? (
            <PixelText size={small ? 'sm' : 'md'} bold color={tone === 'night' || tone === 'wood' ? QUI.white : QUI.ink}>
              {label}
            </PixelText>
          ) : null}
        </PixelPanel>
      </View>
    </Pressable>
  );
}
