// Design tokens for both themes. Components read them through useTheme(),
// never as static imports, so the app follows the system light/dark setting.

import { BRAND, INK, PROJECT_COLORS, ProjectColor, resolveSwatch, Swatch, SWATCHES } from './palette';

export interface Colors {
  /** Screen background. */
  bg: string;
  card: string;
  /** Inputs, chips and wells on a card. */
  well: string;
  ink: string;
  /** Secondary text (AA on card and bg). */
  sub: string;
  /** Tertiary marks: disabled icons, placeholders, idle tracks' ink. */
  muted: string;
  line: string;
  track: string;
  brand: string;
  brandDark: string;
  brandLight: string;
  /** Text and icons on brand. */
  onBrand: string;
  /** A calm heads-up (targets over capacity), never a failure. */
  amber: string;
  amberBg: string;
  /** Destructive actions only (delete, sign out), never progress. */
  danger: string;
  dangerBg: string;
  scrim: string;
  shadow: string;
}

const light: Colors = {
  bg: '#F3F5F9',
  card: '#FFFFFF',
  well: '#EEF1F6',
  ink: INK,
  sub: '#5B616D',
  muted: '#9AA0AB',
  line: '#E4E7ED',
  track: '#E6E9F0',
  brand: BRAND.base,
  brandDark: BRAND.dark,
  brandLight: BRAND.light,
  onBrand: '#FFFFFF',
  amber: '#9A5B00',
  amberBg: '#FFF1D9',
  danger: '#C8352B',
  dangerBg: '#FDECEA',
  scrim: 'rgba(12,14,18,0.42)',
  shadow: '#15171C',
};

const dark: Colors = {
  bg: '#0E1014',
  card: '#1A1D23',
  well: '#242832',
  ink: '#F2F3F6',
  sub: '#A9AFBB',
  muted: '#6C7380',
  line: '#2A2E37',
  track: '#2C313B',
  brand: '#2E8BFF',
  brandDark: '#155FC0',
  brandLight: '#16263C',
  onBrand: '#FFFFFF',
  amber: '#FFC266',
  amberBg: '#3A2A10',
  danger: '#FF7B72',
  dangerBg: '#3A1B19',
  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
};

export const space = { xxs: 4, xs: 6, sm: 10, md: 14, lg: 18, xl: 24, xxl: 32 };

export const radius = { sm: 10, md: 14, lg: 18, xl: 22, xxl: 28, pill: 999 };

/** Height of a tactile button's bottom edge. */
export const EDGE = 4;

export const type = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '800' as const },
  body: { fontSize: 15.5, fontWeight: '700' as const },
  small: { fontSize: 13, fontWeight: '700' as const },
  caption: { fontSize: 11.5, fontWeight: '700' as const },
  /** Numbers never jiggle as they change. */
  num: { fontVariant: ['tabular-nums' as const] },
};

export interface Theme {
  dark: boolean;
  colors: Colors;
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  /** A project color resolved for this theme. */
  swatch(key: ProjectColor): Swatch;
  brand: Swatch;
  shadow: { shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number }; elevation: number };
}

export function makeTheme(isDark: boolean): Theme {
  const colors = isDark ? dark : light;
  const swatches = {} as Record<ProjectColor, Swatch>;
  for (const k of PROJECT_COLORS) swatches[k] = resolveSwatch(SWATCHES[k], isDark, colors.card);
  const brand = resolveSwatch({ ...BRAND, base: colors.brand, dark: colors.brandDark }, isDark, colors.card);
  return {
    dark: isDark,
    colors,
    space,
    radius,
    type,
    swatch: (k) => swatches[k] ?? swatches.indigo,
    brand,
    shadow: {
      shadowColor: colors.shadow,
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
  };
}

export const LIGHT_THEME = makeTheme(false);
export const DARK_THEME = makeTheme(true);
