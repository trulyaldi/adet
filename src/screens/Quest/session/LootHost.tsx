// Shows the Loot sheet app-wide (it opens right after the focus view closes,
// whichever tab is showing). The sheet itself loads lazily. Closing it,
// opened or "Later", asks the ceremony host to evaluate.

import React, { useCallback } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ceremonyHost } from '../../../game/ceremonies/host';
import { loadLootSheet } from '../../../game/render/screens';
import { SkiaGate } from '../../../game/render/SkiaGate';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { closeLootAfter, useLootRequest } from '../../../game/state/loot';
import { useQuestReduced } from '../../../game/state/settings';
import { MODAL_GAP_MS } from '../../../theme/motion';


export function LootHost() {
  const req = useLootRequest();
  const insets = useSafeAreaInsets();
  const reduced = useQuestReduced();
  const close = useCallback(() => {
    // After this modal has gone (iOS drops a modal presented during another's dismissal).
    closeLootAfter(MODAL_GAP_MS, () => ceremonyHost.evaluate());
  }, []);
  return (
    <Modal visible={!!req} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={close} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,20,0.55)' }]} />
      <View style={{ marginTop: 'auto', paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
        {req && <SkiaGate key={req.sessionId} load={loadLootSheet} props={{ sessionId: req.sessionId, fresh: req.fresh, onClose: close }} errorFallback={<LootFallback onClose={close} />} />}
      </View>
    </Modal>
  );
}

/** If the chest scene can't draw, the chest simply waits at camp. */
function LootFallback({ onClose }: { onClose(): void }) {
  return (
    <PixelPanel tone="parchment" padding={3}>
      <PixelButton label="Later" accessibilityLabel="Later: the chest waits at camp" onPress={onClose} />
    </PixelPanel>
  );
}
