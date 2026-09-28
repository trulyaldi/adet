import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';

// The Adet checkmark (the #adet path from adet-logo.html, 100x100 space).
const MARK =
  'M42.6 75.7C43 75.1 44.2 73.4 44.9 72.3C45.6 71.1 46.3 69.9 46.9 68.7C47.4 67.5 48 66.2 48.4 65C48.9 63.8 49.3 62.5 49.6 61.3C49.9 60 50.2 58.8 50.4 57.5C50.6 56.3 50.8 55 50.8 53.8C50.9 52.6 50.9 51.4 50.9 50.2C50.8 49 50.7 47.9 50.5 46.7C50.3 45.6 50.1 44.5 49.8 43.4C49.5 42.3 49.2 41.3 48.8 40.3C48.4 39.3 48 38.3 47.5 37.4C47 36.5 46.5 35.7 45.9 34.8C45.3 34 44.7 33.3 44 32.6C43.4 31.8 42.7 31.2 42 30.6C41.3 30 40.5 29.5 39.8 29C39 28.5 38.2 28.1 37.4 27.8C36.7 27.4 35.8 27.1 35 26.9C34.2 26.7 33.4 26.5 32.6 26.4C31.8 26.3 30.9 26.3 30.1 26.4C29.3 26.4 28.5 26.5 27.7 26.7C26.9 26.8 26.2 27.1 25.4 27.4C24.7 27.6 23.9 28 23.3 28.4C22.6 28.8 21.9 29.3 21.3 29.8C20.6 30.3 20 30.9 19.5 31.5C18.9 32.1 18.4 32.8 18 33.5C17.5 34.3 17.1 35 16.7 35.8C16.4 36.6 16.1 37.5 15.8 38.3C15.6 39.2 15.4 40.1 15.2 41C15.1 42 15 42.9 15 43.9C15 44.9 15 45.9 15.1 46.9C15.3 47.9 15.4 48.9 15.7 49.9C15.9 51 16.2 52 16.6 53C17 54 17.4 55.1 17.9 56.1C18.4 57.1 19 58.1 19.6 59.1C20.2 60 20.9 61 21.6 61.9C22.4 62.9 23.2 63.8 24.1 64.7L36.9 77.6A6.6 6.6 0 0 0 47 76.7L85 22.4';

// Cropped to the stroked mark's bounds, so `height` is the mark's own height.
const VIEW_BOX = '10.9 18.3 78.2 65.3';
const ASPECT = 78.2 / 65.3;

interface AdetMarkProps {
  height: number;
  /** Defaults to the theme's ink (dark on light, light on dark). */
  color?: string;
}

/** The standalone Adet mark. */
export function AdetMark({ height, color }: AdetMarkProps) {
  const { colors } = useTheme();
  return (
    <Svg width={height * ASPECT} height={height} viewBox={VIEW_BOX} fill="none">
      <Path
        d={MARK}
        stroke={color ?? colors.ink}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The logo lockup: the mark and the name. */
export function AdetLockup({ height = 28 }: { height?: number }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Adet" style={{ flexDirection: 'row', alignItems: 'center', gap: height * 0.28 }}>
      <AdetMark height={height} color={colors.brand} />
      <Text style={{ fontSize: height * 1.02, fontWeight: '800', letterSpacing: -0.6, color: colors.ink }}>Adet</Text>
    </View>
  );
}
