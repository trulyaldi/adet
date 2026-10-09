import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { WORDS } from '../../domain/words';
import { feedback } from '../../feedback/feedback';
import { Screen } from '../../store/StreakStore';
import { useTheme } from '../../theme/ThemeProvider';
import { useLayout } from '../../theme/useLayout';
import { AdetLockup } from '../AdetMark';
import { Glyph, GlyphName } from '../Glyph';
import { Press } from '../motion/Press';
import { QuestBadge } from '../QuestBadge';
import { SyncIndicator } from '../SyncIndicator';
import { TABS, useQuestTab } from '../TabBar';
import { Text } from '../Text';
import { DesktopFillContext } from './fill';
import { useDesktopPage } from './webPage';

/** Width of the phone-shaped column a screen sits in until it opts out with useDesktopFill(). */
export const PHONE_COLUMN_W = 480;

/** The name shown for a destination: the game word (a tab's label is the spoken form, "Almanac, stats"). */
function shownName(tab: (typeof TABS)[number]): string {
  return tab.key === 'stats' ? WORDS.stats.game : tab.label;
}

const TOAST_MAX_W = 480;
const TOAST_BOTTOM = 16;

/**
 * The desktop frame: a left sidebar with the app's destinations, the main area
 * to its right, and the toasts at the bottom of that area. Overlays and hosts
 * stay mounted by the caller, outside the shell.
 */
export function DesktopShell({
  active,
  onChange,
  onOpenSettings,
  toasts,
  children,
}: {
  active: Screen;
  onChange(s: Screen): void;
  onOpenSettings(): void;
  toasts?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const { gutter } = useLayout();
  const [fill, setFill] = useState(false);
  const setFillStable = useCallback((f: boolean) => setFill(f), []);
  const current = TABS.find((t) => t.key === active);
  useDesktopPage(current ? `${shownName(current)} · Adet` : 'Adet');

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
      <Sidebar active={active} onChange={onChange} onOpenSettings={onOpenSettings} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <DesktopFillContext.Provider value={setFillStable}>
          <View style={fill ? { flex: 1 } : { flex: 1, width: '100%', maxWidth: PHONE_COLUMN_W, alignSelf: 'center' }}>{children}</View>
        </DesktopFillContext.Provider>
        {toasts != null && (
          <View style={{ position: 'absolute', left: gutter, right: gutter, bottom: TOAST_BOTTOM, alignItems: 'center', pointerEvents: 'box-none' }}>
            <View style={{ width: '100%', maxWidth: TOAST_MAX_W, gap: 8 }}>{toasts}</View>
          </View>
        )}
      </View>
    </View>
  );
}

function Sidebar({ active, onChange, onOpenSettings }: { active: Screen; onChange(s: Screen): void; onOpenSettings(): void }) {
  const { colors } = useTheme();
  const { sidebarW, gutter } = useLayout();
  const quest = useQuestTab();
  return (
    <View
      style={{
        width: sidebarW,
        backgroundColor: colors.card,
        borderRightWidth: 1,
        borderRightColor: colors.line,
        paddingTop: gutter,
        paddingBottom: 16,
        paddingHorizontal: 16,
        // Chrome isn't text to select. (react-native-web honors userSelect on a View; RN's ViewStyle type omits it.)
        ...({ userSelect: 'none' } as object),
      }}
    >
      <View style={{ paddingHorizontal: 8, paddingBottom: gutter }}>
        <AdetLockup height={26} />
      </View>
      <View accessibilityRole="tablist" style={{ gap: 4 }}>
        {TABS.map((tab) =>
          tab.key === 'quest' ? (
            <NavItem key={tab.key} label={quest.label} text={shownName(tab)} glyph="quest" on={active === tab.key} badge={quest.badge} onPress={() => onChange(tab.key)} />
          ) : (
            <NavItem key={tab.key} label={tab.label} text={shownName(tab)} glyph={tab.glyph} on={active === tab.key} onPress={() => onChange(tab.key)} />
          ),
        )}
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ gap: 4 }}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SyncIndicator />
        </View>
        <NavItem label="Settings" text="Settings" glyph="gear" role="button" onPress={onOpenSettings} />
      </View>
    </View>
  );
}

function NavItem({
  label,
  text,
  glyph,
  on = false,
  badge = false,
  role = 'tab',
  onPress,
}: {
  /** What a screen reader says (may add "a chest is waiting"). */
  label: string;
  /** What shows. */
  text: string;
  glyph: GlyphName;
  on?: boolean;
  badge?: boolean;
  role?: 'tab' | 'button';
  onPress(): void;
}) {
  const { colors, radius } = useTheme();
  const color = on ? colors.brand : colors.sub;
  return (
    <Press
      kind="card"
      onPress={() => {
        // Navigation: the tap sound, no haptic.
        if (!on) feedback('tap', { haptic: false });
        onPress();
      }}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'tab' ? { selected: on } : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        height: 44,
        paddingHorizontal: 12,
        borderRadius: radius.pill,
        backgroundColor: on ? colors.brandLight : 'transparent',
      }}
    >
      <View>
        <Glyph name={glyph} size={25} color={color} bg={on ? colors.brandLight : colors.card} />
        {badge && <QuestBadge style={{ top: -3, right: -5 }} />}
      </View>
      <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: '700', color }}>
        {text}
      </Text>
    </Press>
  );
}
