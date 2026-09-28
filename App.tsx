import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdetMark } from './src/components/AdetMark';
import { TabBar } from './src/components/TabBar';
import { ScreenIn } from './src/components/motion/Appear';
import { MessageToast, UndoToast } from './src/components/UndoToast';
import { EditSessionSheet } from './src/overlays/EditSessionSheet';
import { HabitSheet } from './src/overlays/HabitSheet';
import { LogTimeSheet } from './src/overlays/LogTimeSheet';
import { ProjectSheet } from './src/overlays/ProjectSheet';
import { RebalanceScreen } from './src/overlays/RebalanceScreen';
import { SettingsSheet } from './src/overlays/SettingsSheet';
import { StageSheet } from './src/overlays/StageSheet';
import { StartSheet } from './src/overlays/StartSheet';
import { CapacityFixSheet } from './src/overlays/CapacityFixSheet';
import { FocusView } from './src/overlays/FocusView';
import { WeekSheet } from './src/overlays/WeekSheet';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { StreakProvider, useStreak } from './src/store/StreakStore';
import { Watchers } from './src/store/Watchers';
import { CelebrationHost } from './src/overlays/CelebrationHost';
import { BurstHost } from './src/components/celebrate/Burst';
import { ConfettiHost } from './src/components/celebrate/Confetti';
import { AuthProvider, useAuth } from './src/sync/AuthProvider';
import { preloadSounds } from './src/feedback/audio';
import { DevicePrefsProvider } from './src/store/devicePrefs';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

function Root() {
  const { ready, ui, actions } = useStreak();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <AdetMark height={44} color={colors.brand} />
        <ActivityIndicator color={colors.sub} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Screens scroll below the status bar, never under it. */}
      <View style={{ height: insets.top, backgroundColor: colors.bg }} />
      <View style={{ flex: 1 }}>
        <ScreenIn key={ui.screen}>
          {ui.screen === 'today' && <TodayScreen />}
          {ui.screen === 'projects' && <ProjectsScreen />}
          {ui.screen === 'stats' && <StatsScreen />}
        </ScreenIn>
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 12, gap: 8 }}>
          <MessageToast />
          <UndoToast />
        </View>
      </View>

      <TabBar active={ui.screen} onChange={actions.setScreen} />

      {/* Overlays (each is a Modal, safe to always mount) */}
      <FocusView />
      <CelebrationHost />
      <Watchers />
      <ConfettiHost />
      <BurstHost />
      <HabitSheet />
      <ProjectSheet />
      <StageSheet />
      <LogTimeSheet />
      <EditSessionSheet />
      <SettingsSheet />
      <StartSheet />
      <CapacityFixSheet />
      <WeekSheet />
      <RebalanceScreen />
    </View>
  );
}

function AuthGate() {
  const { ready, session } = useAuth();
  const { colors } = useTheme();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <AdetMark height={44} color={colors.brand} />
        <ActivityIndicator color={colors.sub} />
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

function ThemedStatusBar() {
  const { dark } = useTheme();
  return <StatusBar style={dark ? 'light' : 'dark'} />;
}

export default function App() {
  useEffect(preloadSounds, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DevicePrefsProvider>
          <ThemeProvider>
            <AuthProvider>
              <ThemedStatusBar />
              <AuthGate />
            </AuthProvider>
          </ThemeProvider>
        </DevicePrefsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
