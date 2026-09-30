// Text in the pixel font (Tiny5). Sizes sit near its 8-unit grid; `tiny` is
// the smallest used anywhere and stays at 12 so digits never blur together.

import React from 'react';
import { StyleProp, Text, TextProps, TextStyle } from 'react-native';

import { PIXEL_FONT, PIXEL_TEXT } from '../assets/fonts';
import { QUI } from './theme';

export type PixelSize = 'tiny' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

export const PIXEL_SIZES: Record<PixelSize, number> = { tiny: 12, sm: 14, md: 16, lg: 20, xl: 28, hero: 48 };

export function PixelText({
  size = 'md',
  color = QUI.ink,
  // Tiny5 has one weight: bold pixel text uses the same face.
  bold: _bold,
  style,
  children,
  ...rest
}: TextProps & { size?: PixelSize; color?: string; bold?: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      {...rest}
      // The pixel font is readable, but Dynamic Type would break its grid: cap it.
      maxFontSizeMultiplier={1.3}
      style={[PIXEL_TEXT, { fontFamily: PIXEL_FONT, fontSize: PIXEL_SIZES[size], lineHeight: Math.round(PIXEL_SIZES[size] * 1.3), color }, style]}
    >
      {children}
    </Text>
  );
}
