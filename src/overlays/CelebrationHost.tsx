import React, { useEffect, useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Button } from '../components/Button';
import { BadgeArt } from '../components/celebrate/BadgeArt';
import { Ilmek } from '../components/ilmek/Ilmek';
import { projectLook } from '../domain/look';
import { badgeInfo } from '../domain/milestones';
import { feedback } from '../feedback/feedback';
import { useLootRequest } from '../game/state/loot';
import { anyModalOpen, useActions, useData, useSettings, useUi } from '../store/StreakStore';
import { MODAL_GAP_MS } from '../theme/motion';
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
  const data = useData();
  // The Quest Loot sheet lives outside the store's UI state; it counts too.
  const loot = useLootRequest();
  const modalOpen = useUi(anyModalOpen) || !!loot;
  const first = useUi((u) => u.celebrations[0]);
  const settings = useSettings();
  const actions = useActions();
  const reduced = useReducedMotion();
  const busy =
    !settings.welcomeSeen ||
    modalOpen;
  // Wait for the previous modal's dismiss animation before presenting.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (busy) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), MODAL_GAP_MS);
    return () => clearTimeout(timer);
  }, [busy]);
  const id = !busy && settled ? first : undefined;
  const info = id ? badgeInfo(id, data) : null;
  const known = !!info;
  const played = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    if (!known) actions.dismissCelebration();
    else if (played.current !== id) {
      played.current = id;
      feedback('milestone');
    }
    // actions changes identity with data; only a new card should react.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, known]);
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
              <Ilmek state={info.kind === 'week' ? 'relaxed' : 'celebrating'} size={56} tint={project ? projectLook(project).color : undefined} decorative />
            </View>
            <Button icon="done" label="Continue" onPress={actions.dismissCelebration} quiet style={{ alignSelf: 'stretch', marginTop: 8 }} />
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}
