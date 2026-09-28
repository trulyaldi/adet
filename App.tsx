import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Loading } from './src/components/Loading';
import { TabBar } from './src/components/TabBar';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ScreenIn } from './src/components/motion/Appear';
import { MessageToast, UndoToast } from './src/components/UndoToast';
import { EditSessionSheet } from './src/overlays/EditSessionSheet';
import { HabitSheet } from './src/overlays/HabitSheet';
import { LogTimeSheet } from './src/overlays/LogTimeSheet';
import { ProjectSheet } from './src/overlays/ProjectSheet';
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
import { StreakProvider, useActions, useReady, useUi } from './src/store/StreakStore';
import { Watchers } from './src/store/Watchers';
import { CelebrationHost } from './src/overlays/CelebrationHost';
import { WelcomeFlow } from './src/overlays/WelcomeFlow';
import { BurstHost } from './src/components/celebrate/Burst';
import { ConfettiHost } from './src/components/celebrate/Confetti';
import { AuthProvider, useAuth } from './src/sync/AuthProvider';
import { preloadSounds } from './src/feedback/audio';
import { DevicePrefsProvider } from './src/store/devicePrefs';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

function Root() {
  const ready = useReady();
  const screen = useUi((u) => u.screen);
  const actions = useActions();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!ready) {
    return <Loading />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Screens scroll below the status bar, never under it. */}
      <View style={{ height: insets.top, backgroundColor: colors.bg }} />
      <View style={{ flex: 1 }}>
        <ErrorBoundary key={screen}>
          <ScreenIn>
            {screen === 'today' && <TodayScreen />}
            {screen === 'projects' && <ProjectsScreen />}
            {screen === 'stats' && <StatsScreen />}
          </ScreenIn>
        </ErrorBoundary>
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 12, gap: 8 }}>
          <MessageToast />
          <UndoToast />
        </View>
      </View>

      <TabBar active={screen} onChange={actions.setScreen} />

      {/* Overlays (each is a Modal, safe to always mount) */}
      <FocusView />
      <CelebrationHost />
      <WelcomeFlow />
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
    </View>
  );
}

function AuthGate() {
  const { ready, session } = useAuth();
  const { colors } = useTheme();

  if (!ready) {
    return <Loading />;
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
