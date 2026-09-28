import React, { useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

interface SheetProps {
  visible: boolean;
  onClose(): void;
  children: React.ReactNode;
  /** Max height as a fraction of the screen (0..1). */
  maxHeightPct?: number;
}

/** Past this downward drag (px) — or a fast flick — the sheet dismisses. */
const CLOSE_THRESHOLD = 120;

/** Bottom sheet modal with a dimmed backdrop, rounded top corners, and drag-to-dismiss. */
export function Sheet({
  visible,
  onClose,
  children,
  maxHeightPct = 0.82,
}: SheetProps) {
  const { colors, radius, shadow } = useTheme();
  const translateY = useRef(new Animated.Value(0)).current;

  // Reset the drag offset whenever the sheet (re)opens.
  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      // Only claim vertical, downward drags so inner scrolling still works.
      onMoveShouldSetPanResponder: (_evt, g) =>
        g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_evt, g) => {
        translateY.setValue(g.dy > 0 ? g.dy : g.dy * 0.2);
      },
      onPanResponderRelease: (_evt, g) => {
        if (g.dy > CLOSE_THRESHOLD || g.vy > 0.6) {
          Animated.timing(translateY, {
            toValue: 700,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.scrim,
          }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: `${Math.round(maxHeightPct * 100)}%`,
              paddingTop: 12,
              transform: [{ translateY }],
            }}
          >
            <View
              {...panResponder.panHandlers}
              style={{ alignSelf: 'stretch', alignItems: 'center', paddingVertical: 6, marginTop: -6 }}
            >
              <View
                style={{
                  width: 36,
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: colors.line,
                }}
              />
            </View>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 42 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
