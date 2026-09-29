// Shows the Loot sheet app-wide (it opens right after the focus view closes,
// whichever tab is showing). The sheet itself loads lazily. Closing it,
// opened or "Later", asks the ceremony host to evaluate.

import React, { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ceremonyHost } from '../../../game/ceremonies/host';
import { SkiaGate } from '../../../game/render/SkiaGate';
import { closeLoot, useLootRequest } from '../../../game/state/loot';
import { useQuestReduced } from '../../../game/state/settings';
import { MODAL_GAP_MS } from '../../../theme/motion';

export function LootHost() {
  const req = useLootRequest();
  const insets = useSafeAreaInsets();
  const reduced = useQuestReduced();
  const close = useCallback(() => {
    closeLoot();
    // After this modal has gone (iOS drops a modal presented during another's dismissal).
    setTimeout(() => ceremonyHost.evaluate(), MODAL_GAP_MS);
  }, []);
  return (
    <Modal visible={!!req} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={close} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,20,0.55)' }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} accessible={false} />
      <View style={{ marginTop: 'auto', paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
        {req && <SkiaGate key={req.sessionId} load={() => import('./LootSheet')} props={{ sessionId: req.sessionId, fresh: req.fresh, onClose: close }} />}
      </View>
    </Modal>
  );
}
