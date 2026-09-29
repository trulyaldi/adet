// Text in the pixel font, at sizes on the font's grid so strokes stay even.

import React from 'react';
import { StyleProp, Text, TextProps, TextStyle } from 'react-native';

import { PIXEL_FONT, PIXEL_FONT_BOLD, TINY_FONT } from '../assets/fonts';
import { QUI } from './theme';

export type PixelSize = 'tiny' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

const SIZES: Record<PixelSize, number> = { tiny: 10, sm: 14, md: 16, lg: 20, xl: 28, hero: 44 };

export function PixelText({
  size = 'md',
  color = QUI.ink,
  bold,
  style,
  children,
  ...rest
}: TextProps & { size?: PixelSize; color?: string; bold?: boolean; style?: StyleProp<TextStyle> }) {
  const fontFamily = size === 'tiny' ? TINY_FONT : bold ? PIXEL_FONT_BOLD : PIXEL_FONT;
  return (
    <Text
      {...rest}
      // The pixel font is readable, but Dynamic Type would break its grid: cap it.
      maxFontSizeMultiplier={1.3}
      style={[{ fontFamily, fontSize: SIZES[size], lineHeight: Math.round(SIZES[size] * 1.3), color }, style]}
    >
      {children}
    </Text>
  );
}
