// Layout tiers for the desktop web build. Pure (no react-native import) so
// node tests can load it; the hook is in useLayout.ts, like motion.ts/useMotion.ts.
//
// Desktop = the web build on a window at least DESKTOP_MIN wide. Native never
// is, whatever its width (an iPad reports 1024+ points). Everything below
// DESKTOP_MIN, and every native build, keeps the phone layout untouched.

/** Off only for an explicit false-like value; unset or anything else is on. */
export function desktopEnabledFrom(raw: string | undefined): boolean {
  return !/^(0|false|off|no)$/i.test((raw ?? '').trim());
}

/** The kill switch: EXPO_PUBLIC_DESKTOP=false keeps the phone layout everywhere. (Static access: Expo inlines it.) */
export const DESKTOP_ENABLED = desktopEnabledFrom(process.env.EXPO_PUBLIC_DESKTOP);

export type Tier = 'phone' | 'desktop' | 'wide';

export const DESKTOP_MIN = 1024;
export const WIDE_MIN = 1600;
/** Window width from which a right rail sits beside the main pane; narrower, it stacks below. */
export const RAIL_MIN = 1280;

export const SIDEBAR_W = 240;
export const RAIL_W = 360;
export const GUTTER = 32;

export interface Layout {
  tier: Tier;
  /** True for 'desktop' and 'wide'. */
  isDesktop: boolean;
  width: number;
  height: number;
  sidebarW: number;
  railW: number;
  gutter: number;
}

/** The layout for a window `width` (and `height`) on `platform` (Platform.OS). */
export function layoutFor(width: number, platform: string, height = 0, enabled = DESKTOP_ENABLED): Layout {
  const desktop = enabled && platform === 'web' && width >= DESKTOP_MIN;
  const tier: Tier = !desktop ? 'phone' : width >= WIDE_MIN ? 'wide' : 'desktop';
  return { tier, isDesktop: desktop, width, height, sidebarW: SIDEBAR_W, railW: RAIL_W, gutter: GUTTER };
}

export const GRID_COLUMNS = 12;

/** A column span: one number for every tier, or a number per desktop tier (`wide` falls back to `desktop`). */
export type Span = number | { desktop?: number; wide?: number };

/** The whole number of columns (1..12) `span` takes on `tier`; phone is always the full row. */
export function colSpan(span: Span, tier: Tier): number {
  if (tier === 'phone') return GRID_COLUMNS;
  const raw = typeof span === 'number' ? span : tier === 'wide' ? (span.wide ?? span.desktop) : span.desktop;
  if (raw === undefined || !Number.isFinite(raw)) return GRID_COLUMNS;
  return Math.min(GRID_COLUMNS, Math.max(1, Math.round(raw)));
}
