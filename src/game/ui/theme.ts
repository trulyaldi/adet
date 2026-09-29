// The Quest world's own UI palette (parchment, wood, ink, gold) and the UI
// pixel unit: pixel UI is drawn on a grid of whole "pixels" like the world.

import { useWindowDimensions } from 'react-native';

import { pixelScale } from '../render/grid';

export const QUI = {
  ink: '#1c1a24',
  parchment: '#f3e6c4',
  parchmentDark: '#dcc59a',
  parchmentShade: '#b89a70',
  wood: '#74502f',
  woodDark: '#4a3024',
  woodLight: '#a07a4a',
  gold: '#d9a53a',
  goldLight: '#f7da7a',
  goldDark: '#9a6a1a',
  red: '#b83a44',
  green: '#4a8a4e',
  greenLight: '#86c070',
  blue: '#3a6aa8',
  night: '#1b1830',
  nightLight: '#2e2a4a',
  white: '#fbf7ec',
  muted: '#8a7c66',
  hpBack: '#3a2a2e',
  hp: '#e0504a',
  hpLight: '#ff8a7a',
  hpGhost: '#f7d77a',
  xp: '#5fa8e8',
  xpLight: '#b8e0ff',
};

/** One UI pixel in points: the world's scale, a notch smaller so panels stay compact. */
export function useUiUnit(): number {
  const { width } = useWindowDimensions();
  return Math.max(2, pixelScale(width) - 1);
}
