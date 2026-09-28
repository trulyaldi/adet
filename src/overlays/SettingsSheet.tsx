import React from 'react';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph, GlyphName, IconButton } from '../components/Glyph';
import { SyncIndicator } from '../components/SyncIndicator';
import { CAPACITY_MAX_MIN, CAPACITY_STEP_MIN, weekCapacityMin } from '../domain/capacity';
import { DOWS } from '../domain/constants';
import { MAX_REMINDER_HOURS } from '../domain/reminder';
import { fmtDur, sayDur } from '../domain/time';
import { feedback } from '../feedback/feedback';
import { Appearance, MotionPref, useDevicePrefs } from '../store/devicePrefs';
import { useActions, useClearLocalData, useData, useSettings, useSyncStatus, useUi } from '../store/StreakStore';
import { useAuth } from '../sync/AuthProvider';
import { useTheme } from '../theme/ThemeProvider';

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Device and planning settings and the account, opened from the gear on Today. */
export function SettingsSheet() {
  const { colors } = useTheme();
  const open = useUi((u) => u.settingsOpen);
  const actions = useActions();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={actions.closeSettings}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8, zIndex: 10 }}>
          <Glyph name="gear" size={28} color={colors.ink} label="Settings" />
          <IconButton label="Done" name="done" size={20} color={colors.onBrand} bg={colors.brand} edge={colors.brandDark} variant="chunky" diameter={42} onPress={actions.closeSettings} tipBelow />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, gap: 12, paddingTop: 8 }}>
          <FeelCard />
          <CapacityCard />
          <DailyPromptCard />
          <WeekStartCard />
          <AppearanceCard />
          <MotionCard />
          <ReminderCard />
          <AccountCard />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Card({ children, row = true }: { children: React.ReactNode; row?: boolean }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.colors.card, borderRadius: t.radius.xl, padding: 14, flexDirection: row ? 'row' : 'column', alignItems: row ? 'center' : 'stretch', gap: 12 }, t.shadow]}>
      {children}
    </View>
  );
}

/** Sound and haptics: two toggles. */
function FeelCard() {
  const { prefs, setPrefs } = useDevicePrefs();
  return (
    <Card>
      <Toggle
        on={prefs.sound}
        glyphOn="soundOn"
        glyphOff="soundOff"
        label="Sounds"
        onChange={(sound) => {
          setPrefs({ sound });
          if (sound) feedback('tap');
        }}
      />
      <Toggle
        on={prefs.haptics}
        glyphOn="haptic"
        glyphOff="haptic"
        label="Haptics"
        onChange={(haptics) => {
          setPrefs({ haptics });
          if (haptics) feedback('tap');
        }}
      />
    </Card>
  );
}

/** An on/off tile: filled in brand with a filled pill when on, outlined when off (shape and fill, not only color). */
export function Toggle({ on, glyphOn, glyphOff, label, onChange }: { on: boolean; glyphOn: GlyphName; glyphOff: GlyphName; label: string; onChange(v: boolean): void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <IconButton
        label={label}
        selected={on}
        variant="chunky"
        bg={on ? t.colors.brand : t.colors.card}
        edge={on ? t.colors.brandDark : t.colors.line}
        onPress={() => onChange(!on)}
        quiet
        style={{ height: 52, borderRadius: t.radius.lg, borderWidth: on ? 0 : 2, borderColor: t.colors.line }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Glyph name={on ? glyphOn : glyphOff} size={22} color={on ? t.colors.onBrand : t.colors.sub} bg={on ? t.colors.brand : t.colors.card} />
          <View style={{ width: 22, height: 12, borderRadius: 6, borderWidth: 2, borderColor: on ? t.colors.onBrand : t.colors.sub, backgroundColor: on ? t.colors.onBrand : 'transparent' }} />
        </View>
      </IconButton>
    </View>
  );
}

/** Capacity per weekday: seven small steppers, the week's total above. */
function CapacityCard() {
  const { colors, radius } = useTheme();
  const data = useData();
  const actions = useActions();
  const cap = data.prefs.capacityMin;
  return (
    <Card row={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Glyph name="clock" size={22} color={colors.sub} label="Planned time per weekday" />
        <View style={{ flex: 1 }} />
        <Glyph name="week" size={16} color={colors.muted} />
        <Text accessibilityLabel={`${sayDur(weekCapacityMin(data.prefs) * 60)} a week`} style={{ fontSize: 15, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>
          {fmtDur(weekCapacityMin(data.prefs) * 60)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {cap.map((m, i) => (
          <View key={i} style={{ alignItems: 'center', gap: 6, width: 40 }}>
            <IconButton label={`More on ${WEEKDAY_NAMES[i]}`} name="plus" size={14} bg={colors.well} diameter={32} disabled={m >= CAPACITY_MAX_MIN} onPress={() => actions.setCapacity(i, m + CAPACITY_STEP_MIN)} />
            <View accessible accessibilityLabel={`${WEEKDAY_NAMES[i]}, ${sayDur(m * 60)}`} style={{ alignItems: 'center', backgroundColor: colors.brandLight, borderRadius: radius.sm, paddingVertical: 6, width: 42 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.sub }}>{DOWS[i][0]}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 13, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>
                {fmtDur(m * 60)}
              </Text>
            </View>
            <IconButton label={`Less on ${WEEKDAY_NAMES[i]}`} name="minus" size={14} bg={colors.well} diameter={32} disabled={m <= 0} onPress={() => actions.setCapacity(i, m - CAPACITY_STEP_MIN)} />
          </View>
        ))}
      </View>
    </Card>
  );
}

function DailyPromptCard() {
  const { colors } = useTheme();
  const settings = useSettings();
  const actions = useActions();
  return (
    <Card>
      <Glyph name="capNormal" size={22} color={colors.sub} label="Ask light, normal or heavy each morning" />
      <View style={{ flex: 1 }} />
      <View style={{ width: 150 }}>
        <Toggle on={settings.dailyPrompt} glyphOn="capHeavy" glyphOff="capLight" label="Ask how much time each day" onChange={actions.setDailyPrompt} />
      </View>
    </Card>
  );
}

/** A row of mutually exclusive icon options (a filled pill marks the chosen one). */
function Choice<K extends string>({ glyph, label, value, options, onChange }: { glyph: GlyphName; label: string; value: K; options: { key: K; glyph?: GlyphName; text?: string; label: string }[]; onChange(k: K): void }) {
  const { colors, radius } = useTheme();
  return (
    <Card>
      <Glyph name={glyph} size={22} color={colors.sub} label={label} />
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        {options.map((o) => {
          const on = o.key === value;
          return (
            <IconButton
              key={o.key}
              label={o.label}
              selected={on}
              onPress={() => onChange(o.key)}
              bg={on ? colors.brand : colors.well}
              style={{ width: 52, height: 42, borderRadius: radius.md }}
            >
              {o.glyph ? (
                <Glyph name={o.glyph} size={20} color={on ? colors.onBrand : colors.sub} bg={on ? colors.brand : colors.well} />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '800', color: on ? colors.onBrand : colors.sub }}>{o.text}</Text>
              )}
            </IconButton>
          );
        })}
      </View>
    </Card>
  );
}

function WeekStartCard() {
  const data = useData();
  const actions = useActions();
  return (
    <Choice
      glyph="weekStart"
      label="Week starts on"
      value={String(data.prefs.weekStart) as '0' | '1'}
      options={[
        { key: '1', text: 'M', label: 'Week starts on Monday' },
        { key: '0', text: 'S', label: 'Week starts on Sunday' },
      ]}
      onChange={(k) => actions.setWeekStart(k === '0' ? 0 : 1)}
    />
  );
}

function AppearanceCard() {
  const { prefs, setPrefs } = useDevicePrefs();
  return (
    <Choice<Appearance>
      glyph="contrast"
      label="Appearance"
      value={prefs.appearance}
      options={[
        { key: 'system', glyph: 'haptic', label: 'Match the system' },
        { key: 'light', glyph: 'dim', label: 'Light' },
        { key: 'dark', glyph: 'moon', label: 'Dark' },
      ]}
      onChange={(appearance) => setPrefs({ appearance })}
    />
  );
}

function MotionCard() {
  const { prefs, setPrefs } = useDevicePrefs();
  return (
    <Choice<MotionPref>
      glyph="motion"
      label="Motion"
      value={prefs.motion}
      options={[
        { key: 'system', glyph: 'haptic', label: 'Motion: match the system Reduce Motion setting' },
        { key: 'reduce', glyph: 'pause', label: 'Reduce motion' },
        { key: 'full', glyph: 'play', label: 'Full motion' },
      ]}
      onChange={(motion) => setPrefs({ motion })}
    />
  );
}

/** "Still working?" reminder for a timer left running: bell, hours, − / +. */
function ReminderCard() {
  const { colors } = useTheme();
  const settings = useSettings();
  const actions = useActions();
  const hours = settings.reminderHours;
  const step = (delta: number) => actions.setReminderHours(Math.min(MAX_REMINDER_HOURS, Math.max(0, hours + delta)));
  return (
    <Card>
      <Glyph name="bell" size={22} color={colors.sub} label="Reminder for a long-running timer" />
      <View style={{ flex: 1 }} />
      <IconButton label="Sooner" name="minus" size={15} bg={colors.well} diameter={34} disabled={hours <= 0} onPress={() => step(-1)} />
      <Text accessibilityLabel={hours > 0 ? `${hours} hours` : 'Off'} style={{ width: 36, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>
        {hours > 0 ? `${hours}h` : '–'}
      </Text>
      <IconButton label="Later" name="plus" size={15} bg={colors.well} diameter={34} disabled={hours >= MAX_REMINDER_HOURS} onPress={() => step(1)} />
    </Card>
  );
}

function AccountCard() {
  const { colors, radius, shadow: shadowCard } = useTheme();
  const { session, signOut } = useAuth();
  const sync = useSyncStatus();
  const clearLocalData = useClearLocalData();
  const [busy, setBusy] = React.useState(false);

  // Signing out wipes this device, so it's confirmed in words.
  const confirmSignOut = () => {
    const unsynced = sync.pending;
    Alert.alert(
      'Sign out?',
      unsynced
        ? `${unsynced} change${unsynced === 1 ? " hasn't" : "s haven't"} synced yet and will be lost. Your data will be removed from this device.`
        : "Your data is synced and will be removed from this device. You'll need to sign in again to see it.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: unsynced ? 'Sign out anyway' : 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await clearLocalData();
              await signOut();
            } catch (e) {
              setBusy(false);
              Alert.alert('Could not sign out', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        { backgroundColor: colors.card, borderRadius: radius.xl, padding: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
        shadowCard,
      ]}
    >
      <SyncIndicator />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        accessibilityLabel={`Signed in as ${session?.user.email ?? 'unknown account'}`}
        style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.ink }}
      >
        {session?.user.email ?? '—'}
      </Text>
      <IconButton
        label="Sign out"
        name="signOut"
        size={19}
        color={colors.danger}
        bg={colors.dangerBg}
        diameter={38}
        disabled={busy}
        onPress={confirmSignOut}
      />
    </View>
  );
}
