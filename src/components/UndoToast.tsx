import React from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { feedback } from '../feedback/feedback';
import { useActions, useUi } from '../store/StreakStore';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../theme/useMotion';
import { Glyph, IconButton } from './Glyph';

function useToastIn() {
  const reduced = useReducedMotion();
  return reduced ? FadeIn.duration(160) : FadeInDown.springify().damping(16).stiffness(260);
}

/** A deleted session, offered for undo until the store clears it (UNDO_MS). */
export function UndoToast() {
  const undo = useUi((u) => u.undo);
  const actions = useActions();
  const { colors, radius } = useTheme();
  const entering = useToastIn();
  if (!undo) return null;

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
  const toast = useUi((u) => u.toast);
  const { colors, radius } = useTheme();
  const entering = useToastIn();
  if (!toast) return null;

  return (
    <Animated.View entering={entering} exiting={FadeOut.duration(150)} style={{ alignSelf: 'center' }}>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={toast.label}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 16 }}
      >
        <Glyph name={toast.glyph} size={20} color={colors.bg} bg={colors.ink} />
        <Glyph name="clock" size={16} color={colors.muted} bg={colors.ink} />
      </View>
    </Animated.View>
  );
}
