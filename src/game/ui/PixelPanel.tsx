// A pixel panel: stepped corners, a one-pixel ink border and a light bevel,
// on whole UI pixels (a 9-slice look built from views, so it's crisp at any
// size and needs no image).

import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { QUI, useUiUnit } from './theme';

export type PanelTone = 'parchment' | 'wood' | 'night' | 'gold';

const TONES: Record<PanelTone, { fill: string; light: string; dark: string }> = {
  parchment: { fill: QUI.parchment, light: QUI.white, dark: QUI.parchmentDark },
  wood: { fill: QUI.wood, light: QUI.woodLight, dark: QUI.woodDark },
  night: { fill: QUI.night, light: QUI.nightLight, dark: '#100e1e' },
  gold: { fill: QUI.gold, light: QUI.goldLight, dark: QUI.goldDark },
};

/** The stepped-corner shape: two overlapping rects, `inset` UI pixels in. */
function Shape({ u, inset, color, cut = 1 }: { u: number; inset: number; color: string; cut?: number }) {
  const i = inset * u;
  const c = cut * u;
  return (
    <>
      <View style={{ position: 'absolute', left: i + c, right: i + c, top: i, bottom: i, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: i, right: i, top: i + c, bottom: i + c, backgroundColor: color }} />
    </>
  );
}

export function PixelPanel({
  tone = 'parchment',
  style,
  children,
  padding = 3,
  pressed = false,
}: {
  tone?: PanelTone;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Inner padding in UI pixels. */
  padding?: number;
  /** Pressed: the bevel flips (buttons). */
  pressed?: boolean;
}) {
  const u = useUiUnit();
  const t = TONES[tone];
  return (
    <View style={[{ padding: (padding + 2) * u }, style]}>
      <Shape u={u} inset={0} color={QUI.ink} />
      <Shape u={u} inset={1} color={pressed ? t.dark : t.light} cut={0} />
      <View style={{ position: 'absolute', left: 2 * u, right: u, top: 2 * u, bottom: u, backgroundColor: pressed ? t.light : t.dark }} />
      <View style={{ position: 'absolute', left: 2 * u, right: 2 * u, top: 2 * u, bottom: 2 * u, backgroundColor: t.fill }} />
      {children}
    </View>
  );
}
