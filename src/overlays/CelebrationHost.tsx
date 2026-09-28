import React, { useEffect } from 'react';
import { Modal, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Button } from '../components/Button';
import { BadgeArt } from '../components/celebrate/BadgeArt';
import { Companion } from '../components/Companion';
import { badgeInfo } from '../domain/milestones';
import { feedback } from '../feedback/feedback';
import { useStreak } from '../store/StreakStore';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../theme/useMotion';

/**
 * Full-screen milestone cards, one at a time from the queue: a big animated
 * badge, the milestone sound, and a single check to continue. Waits while
 * focus or a sheet is open (iOS shows one modal at a time).
 */
export function CelebrationHost() {
  const t = useTheme();
  const { colors, radius } = t;
  const { data, ui, settings, actions } = useStreak();
  const reduced = useReducedMotion();
  const busy =
    !settings.welcomeSeen ||
    ui.timerOpen || ui.settingsOpen || ui.weekOpen || ui.startSheet || ui.capacityFix || !!ui.habitSheet || !!ui.projectSheet || !!ui.logSheet || !!ui.sessionSheet || !!ui.recapSheet || !!ui.stageSheet;
  const id = !busy ? ui.celebrations[0] : undefined;
  const info = id ? badgeInfo(id, data) : null;
  useEffect(() => {
    if (id && !info) actions.dismissCelebration();
    else if (id) feedback('milestone');
  }, [id, info, actions]);
  const project = info?.projectId ? data.projects.find((p) => p.id === info.projectId) : undefined;

  return (
    <Modal visible={!!info} transparent animationType="fade" onRequestClose={actions.dismissCelebration} statusBarTranslucent>
      {info && (
        <View style={{ flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Animated.View
            key={info.id}
            entering={reduced ? FadeIn : ZoomIn.springify().damping(13)}
            style={[{ width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: radius.xxl, paddingTop: 44, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center', gap: 16 }, t.shadow]}
          >
            <BadgeArt info={info} size={150} animated />
            {!!project && (
              <Text numberOfLines={2} style={{ fontSize: 18, fontWeight: '800', color: colors.ink, textAlign: 'center' }}>
                {project.name}
              </Text>
            )}
            <View style={{ position: 'absolute', right: 14, top: 14 }}>
              <Companion mood="cheer" size={56} />
            </View>
            <Button icon="done" label="Continue" onPress={actions.dismissCelebration} quiet style={{ alignSelf: 'stretch', marginTop: 8 }} />
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}
