import React from 'react';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';

import { Glyph, GlyphName, IconButton } from '../components/Glyph';
import { StepSlider } from '../components/StepSlider';
import { SyncIndicator } from '../components/SyncIndicator';
import { BUDGET_MAX_MIN, BUDGET_MIN_MIN, BUDGET_STEP_MIN, PLAN_CAP_MAX } from '../domain/plan';
import { MAX_REMINDER_HOURS } from '../domain/reminder';
import { useStreak } from '../store/StreakStore';
import { useAuth } from '../sync/AuthProvider';
import { colors, radius, shadowCard } from '../theme/tokens';

/** Device settings and the account, opened from the gear on Today. */
export function SettingsSheet() {
  const { ui, actions } = useStreak();

  return (
    <Modal
      visible={ui.settingsOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={actions.closeSettings}
    >
      <View style={{ flex: 1, backgroundColor: colors.screen }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 8,
            zIndex: 10,
          }}
        >
          <Glyph name="gear" size={26} color={colors.ink} label="Settings" />
          <IconButton label="Done" name="done" size={20} color="#FFFFFF" bg="#0A84FF" diameter={36} onPress={actions.closeSettings} tipBelow />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12, paddingTop: 12 }}>
          <BudgetCard />
          <CapCard />
          <ReminderCard />
          <AccountCard />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Card({ glyph, label, children }: { glyph: GlyphName; label: string; children: React.ReactNode }) {
  return (
    <View
      style={[
        { backgroundColor: colors.card, borderRadius: radius.xl, padding: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
        shadowCard,
      ]}
    >
      <Glyph name={glyph} size={22} color={colors.subtext} label={label} />
      {children}
    </View>
  );
}

/** Daily time budget: clock, slider, minutes. */
function BudgetCard() {
  const { settings, config, actions } = useStreak();
  return (
    <Card glyph="clock" label="Daily time budget">
      <View style={{ flex: 1 }}>
        <StepSlider
          value={settings.budgetMin}
          min={BUDGET_MIN_MIN}
          max={BUDGET_MAX_MIN}
          step={BUDGET_STEP_MIN}
          accent={config.accent}
          label="Daily time budget, minutes"
          onChange={actions.setBudgetMin}
        />
      </View>
      <Text style={{ width: 36, textAlign: 'right', fontSize: 15, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>
        {settings.budgetMin}
      </Text>
    </Card>
  );
}

/** Habits per day: five dots, tap one to set the cap. */
function CapCard() {
  const { settings, config, actions } = useStreak();
  return (
    <Card glyph="dots" label="Habits per day">
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
        {Array.from({ length: PLAN_CAP_MAX }, (_, i) => {
          const n = i + 1;
          const on = n <= settings.planCap;
          return (
            <IconButton
              key={n}
              onPress={() => actions.setPlanCap(n)}
              hitSlop={6}
              label={`${n} ${n === 1 ? 'habit' : 'habits'} per day`}
              selected={n === settings.planCap}
              style={{ padding: 4 }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: on ? config.accent : 'transparent',
                  borderWidth: 2,
                  borderColor: on ? config.accent : colors.faint,
                }}
              />
            </IconButton>
          );
        })}
      </View>
      <Text style={{ width: 36, textAlign: 'right', fontSize: 15, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>
        {settings.planCap}
      </Text>
    </Card>
  );
}

/** "Still working?" reminder for a timer left running: bell, hours, − / +. */
function ReminderCard() {
  const { settings, actions } = useStreak();
  const hours = settings.reminderHours;
  const step = (delta: number) => actions.setReminderHours(Math.min(MAX_REMINDER_HOURS, Math.max(0, hours + delta)));

  return (
    <Card glyph="bell" label="Reminder for a long-running timer">
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconButton label="Sooner" name="minus" size={15} bg={colors.screen} diameter={32} disabled={hours <= 0} onPress={() => step(-1)} />
        <Text
          accessibilityLabel={hours > 0 ? `${hours} hours` : 'Off'}
          style={{ width: 34, textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] }}
        >
          {hours > 0 ? `${hours}h` : '–'}
        </Text>
        <IconButton label="Later" name="plus" size={15} bg={colors.screen} diameter={32} disabled={hours >= MAX_REMINDER_HOURS} onPress={() => step(1)} />
      </View>
    </Card>
  );
}

function AccountCard() {
  const { session, signOut } = useAuth();
  const { sync, clearLocalData } = useStreak();
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
        bg={colors.dangerSoft}
        diameter={38}
        disabled={busy}
        onPress={confirmSignOut}
      />
    </View>
  );
}
