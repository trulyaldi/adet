import React from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { SyncIndicator } from '../components/SyncIndicator';
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
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>Settings</Text>
          <Pressable onPress={actions.closeSettings} hitSlop={10}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0A84FF' }}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <SectionLabel>Timer</SectionLabel>
          <ReminderCard />
          <SectionLabel>Account</SectionLabel>
          <AccountCard />
        </ScrollView>
      </View>
    </Modal>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtext, letterSpacing: 0.5, marginTop: 18, marginBottom: 8 }}>
      {children.toUpperCase()}
    </Text>
  );
}

function ReminderCard() {
  const { settings, actions } = useStreak();
  const hours = settings.reminderHours;
  const step = (delta: number) => actions.setReminderHours(Math.min(MAX_REMINDER_HOURS, Math.max(0, hours + delta)));

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          padding: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        shadowCard,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>Long-timer reminder</Text>
        <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>
          Asks if a timer is still running after this long
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <StepPill label="−" disabled={hours <= 0} onPress={() => step(-1)} />
        <Text style={{ width: 34, textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.ink }}>
          {hours > 0 ? `${hours}h` : 'Off'}
        </Text>
        <StepPill label="+" disabled={hours >= MAX_REMINDER_HOURS} onPress={() => step(1)} />
      </View>
    </View>
  );
}

function StepPill({ label, disabled, onPress }: { label: string; disabled: boolean; onPress(): void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 32,
        height: 32,
        borderRadius: 11,
        backgroundColor: colors.screen,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '600', color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}

function AccountCard() {
  const { session, signOut } = useAuth();
  const { sync, clearLocalData } = useStreak();
  const [busy, setBusy] = React.useState(false);

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
        {
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          padding: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        shadowCard,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: colors.subtext }}>Signed in as</Text>
        <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink, marginTop: 2 }}>
          {session?.user.email ?? 'Unknown account'}
        </Text>
        <View style={{ marginTop: 4 }}>
          <SyncIndicator />
        </View>
      </View>
      <Pressable disabled={busy} onPress={confirmSignOut} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.dangerSoft, opacity: busy ? 0.5 : 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>Sign out</Text>
      </Pressable>
    </View>
  );
}

