import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TabBar } from './src/components/TabBar';
import { ActivityDaySheet } from './src/overlays/ActivityDaySheet';
import { ActivityHistorySheet } from './src/overlays/ActivityHistorySheet';
import { EditSessionSheet } from './src/overlays/EditSessionSheet';
import { HabitSheet } from './src/overlays/HabitSheet';
import { LogTimeSheet } from './src/overlays/LogTimeSheet';
import { ProjectSheet } from './src/overlays/ProjectSheet';
import { StageSheet } from './src/overlays/StageSheet';
import { TimerOverlay } from './src/overlays/TimerOverlay';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { StreakProvider, useStreak } from './src/store/StreakStore';
import { colors } from './src/theme/tokens';

function Root() {
  const { ready, ui, actions } = useStreak();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.screen, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      <View style={{ flex: 1 }}>
        {ui.screen === 'today' && <TodayScreen />}
        {ui.screen === 'projects' && <ProjectsScreen />}
        {ui.screen === 'stats' && <StatsScreen />}
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
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StreakProvider>
        <StatusBar style="dark" />
        <Root />
      </StreakProvider>
    </SafeAreaProvider>
  );
}
