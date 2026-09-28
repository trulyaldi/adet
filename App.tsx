import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdetMark } from './src/components/AdetMark';
import { TabBar } from './src/components/TabBar';
import { MessageToast, UndoToast } from './src/components/UndoToast';
import { ActivityDaySheet } from './src/overlays/ActivityDaySheet';
import { ActivityHistorySheet } from './src/overlays/ActivityHistorySheet';
import { EditSessionSheet } from './src/overlays/EditSessionSheet';
import { HabitSheet } from './src/overlays/HabitSheet';
import { LogTimeSheet } from './src/overlays/LogTimeSheet';
import { ProjectSheet } from './src/overlays/ProjectSheet';
import { RecapSheet } from './src/overlays/RecapSheet';
import { SettingsSheet } from './src/overlays/SettingsSheet';
import { StageSheet } from './src/overlays/StageSheet';
import { TimerOverlay } from './src/overlays/TimerOverlay';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { StreakProvider, useStreak } from './src/store/StreakStore';
import { AuthProvider, useAuth } from './src/sync/AuthProvider';
import { colors } from './src/theme/tokens';

function Root() {
  const { ready, ui, actions } = useStreak();
  const insets = useSafeAreaInsets();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.screen, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <AdetMark height={44} />
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      {/* Screens scroll below the status bar, never under it. */}
      <View style={{ height: insets.top, backgroundColor: colors.screen }} />
      <View style={{ flex: 1 }}>
        {ui.screen === 'today' && <TodayScreen />}
        {ui.screen === 'projects' && <ProjectsScreen />}
        {ui.screen === 'stats' && <StatsScreen />}
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 12, gap: 8 }}>
          <MessageToast />
          {/* The day sheet is a modal over this view, so it shows its own copy. */}
          {ui.heatSel == null && <UndoToast />}
        </View>
      </View>

      <TabBar active={ui.screen} onChange={actions.setScreen} />

      {/* Overlays (each is a Modal, safe to always mount) */}
      <TimerOverlay />
      <HabitSheet />
      <ProjectSheet />
      <StageSheet />
      <LogTimeSheet />
      <EditSessionSheet />
      <ActivityHistorySheet />
      <ActivityDaySheet />
      <RecapSheet />
      <SettingsSheet />
    </View>
  );
}

function AuthGate() {
  const { ready, session } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.screen, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <AdetMark height={44} />
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (!session) return <SignInScreen />;

  // Keyed by user so a sign-out/sign-in never reuses the previous user's in-memory state.
  return (
    <StreakProvider key={session.user.id} userId={session.user.id}>
      <Root />
    </StreakProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
