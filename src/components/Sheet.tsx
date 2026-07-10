import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { colors } from '../theme/tokens';

interface SheetProps {
  visible: boolean;
  onClose(): void;
  children: React.ReactNode;
  /** Max height as a fraction of the screen (0..1). */
  maxHeightPct?: number;
}

/** Bottom sheet modal with a dimmed backdrop and rounded top corners. */
export function Sheet({
  visible,
  onClose,
  children,
  maxHeightPct = 0.82,
}: SheetProps) {
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
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(23,24,26,0.35)',
          }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: `${Math.round(maxHeightPct * 100)}%`,
              paddingTop: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 5,
                borderRadius: 999,
                backgroundColor: '#E3E4E8',
                alignSelf: 'center',
              }}
            />
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 42 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
