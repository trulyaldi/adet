import React from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { feedback } from '../feedback/feedback';
import { useStreak } from '../store/StreakStore';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../theme/useMotion';
import { Glyph, IconButton } from './Glyph';

function useToastIn() {
  const reduced = useReducedMotion();
  return reduced ? FadeIn.duration(160) : FadeInDown.springify().damping(16).stiffness(260);
}

/** A deleted session, offered for undo until the store clears it (UNDO_MS). */
export function UndoToast() {
  const { ui, actions } = useStreak();
  const { colors, radius } = useTheme();
  const entering = useToastIn();
  if (!ui.undo) return null;

  return (
    <Animated.View
      entering={entering}
      exiting={FadeOut.duration(150)}
      style={{
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.ink,
        borderRadius: radius.pill,
        paddingVertical: 6,
        paddingLeft: 16,
        paddingRight: 6,
      }}
    >
      <Glyph name="trash" size={18} color={colors.bg} bg={colors.ink} label="Session deleted" />
      <IconButton
        label="Undo"
        name="undo"
        size={18}
        color={colors.ink}
        bg={colors.bg}
        diameter={34}
        quiet
        onPress={() => {
          feedback('undo');
          actions.undoDelete();
        }}
      />
    </Animated.View>
  );
}

/** A brief icon toast from the store (ui.toast); its label is spoken, not shown. */
export function MessageToast() {
  const { ui } = useStreak();
  const { colors, radius } = useTheme();
  const entering = useToastIn();
  if (!ui.toast) return null;

  return (
    <Animated.View entering={entering} exiting={FadeOut.duration(150)} style={{ alignSelf: 'center' }}>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={ui.toast.label}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 16 }}
      >
        <Glyph name={ui.toast.glyph} size={20} color={colors.bg} bg={colors.ink} />
        <Glyph name="clock" size={16} color={colors.muted} bg={colors.ink} />
      </View>
    </Animated.View>
  );
}
