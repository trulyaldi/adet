import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { feedback } from '../feedback/feedback';
import { Swatch } from '../theme/palette';
import { useTheme } from '../theme/ThemeProvider';
import { EDGE } from '../theme/theme';
import { Glyph, GlyphName } from './Glyph';
import { usePressMotion } from './motion/Press';

interface ButtonProps {
  onPress(): void;
  /** Visible text; leave out for an icon-only button (then `label` is required). */
  title?: string;
  /** Spoken label; defaults to the title. */
  label?: string;
  icon?: GlyphName;
  /**
   * `primary`: filled in the brand (or the given swatch) with a darker edge.
   * `secondary`: a card-colored face with a soft edge.
   */
  variant?: 'primary' | 'secondary';
  /** A project color for primary buttons (defaults to brand blue). */
  swatch?: Swatch;
  size?: 'md' | 'lg';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Skip the tap sound/haptic (the action plays its own). */
  quiet?: boolean;
  /** False for plain navigation (e.g. "Next"): the tap sound plays, no haptic. */
  haptic?: boolean;
}

/**
 * The chunky Adet button: rounded, bold, with a darker bottom edge that the
 * face sinks into on press (the shared press motion, no scale).
 */
export function Button({ onPress, title, label, icon, variant = 'primary', swatch, size = 'lg', disabled, style, quiet, haptic = true }: ButtonProps) {
  const t = useTheme();
  const { colors, radius } = t;
  const press = usePressMotion('button', { disabled, edge: true });
  const s = swatch ?? t.brand;
  const primary = variant === 'primary';
  const face = disabled ? colors.track : primary ? s.base : colors.card;
  const edge = disabled ? colors.track : primary ? s.dark : colors.line;
  const ink = disabled ? colors.muted : primary ? s.on : colors.ink;
  const h = size === 'lg' ? 54 : 44;

  return (
    <Pressable
      onPress={() => {
        if (!quiet) feedback('tap', { haptic });
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled: !!disabled }}
      style={[{ paddingBottom: EDGE }, style]}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, top: EDGE, bottom: 0, borderRadius: radius.lg, backgroundColor: edge }} />
      <Animated.View
        style={[
          {
            height: h,
            borderRadius: radius.lg,
            backgroundColor: face,
            borderWidth: primary ? 0 : 2,
            borderColor: colors.line,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: 18,
          },
          press.style,
        ]}
      >
        {icon && <Glyph name={icon} size={size === 'lg' ? 24 : 20} color={ink} bg={face} />}
        {!!title && (
          <Text numberOfLines={1} style={{ fontSize: size === 'lg' ? 17 : 15, fontWeight: '800', color: ink, letterSpacing: 0.2 }}>
            {title}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
