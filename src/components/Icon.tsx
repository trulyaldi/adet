import React from 'react';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme/tokens';

interface IconProps {
  path: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Renders a 24x24 stroke icon from an SVG path string. */
export function Icon({
  path,
  size = 22,
  color = colors.ink,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={path}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
