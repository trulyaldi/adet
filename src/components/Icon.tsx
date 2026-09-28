import React from 'react';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';
import { GLYPH_STROKE } from './glyphs';

interface IconProps {
  path: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Renders a 24x24 stroke icon from an SVG path string (habit icons); weight matches the glyph set. */
export function Icon({ path, size = 22, color, strokeWidth = GLYPH_STROKE }: IconProps) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={path} stroke={color ?? colors.ink} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
