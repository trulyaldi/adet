// Shows the result sheet app-wide after a session that targeted a quest (it
// opens once the focus view has gone, whichever tab is showing). The sheet
// loads lazily. If it can't draw, a plain one asks the same question.

import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWorldWrites } from '../../../data/worldRepo';
import type { ResultKind } from '../../../domain/items/types';
import { ceremonyHost } from '../../../game/ceremonies/host';
import { loadResultSheet } from '../../../game/render/screens';
import { SkiaGate } from '../../../game/render/SkiaGate';
import { createLatch } from '../../../game/state/latch';
import { openLoot } from '../../../game/state/loot';
import { closeResult, ResultRequest, useResultRequest } from '../../../game/state/result';
import { useQuestReduced } from '../../../game/state/settings';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { MODAL_GAP_MS } from '../../../theme/motion';
import { NamingStep, useNamedTarget } from './NamingStep';

export function ResultHost() {
  const req = useResultRequest();
  const reduced = useQuestReduced();
  if (!req) return null;
  return <SkiaGate key={req.sessionId} load={loadResultSheet} props={{ req, reduced }} errorFallback={<ResultFallback req={req} />} />;
}

/**
 * No Stage: three plain buttons; any of them (or Back) records and moves on to the chest.
 * A free session offered a name asks that first; Back there is Skip and records nothing.
 */
function ResultFallback({ req }: { req: ResultRequest }) {
  const insets = useSafeAreaInsets();
  const world = useWorldWrites();
  const { session, pick, create } = useNamedTarget(req, world);
  const [once] = useState(createLatch);
  const leave = () => closeResult(MODAL_GAP_MS, (lootFor) => (lootFor ? openLoot({ sessionId: lootFor, fresh: true }) : ceremonyHost.evaluate()));
  const tell = (kind: ResultKind) => {
    if (!once.take()) return;
    if (session) world.recordResult(session.quest.id, kind, req.sessionId);
    leave();
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => tell('not_yet')} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,20,0.55)' }]} />
      <KeyboardAvoidingView enabled={!session} behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View style={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
          {session ? (
            <PixelPanel tone="parchment" padding={3} style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
              <PixelButton label="Done" accessibilityLabel="Done" onPress={() => tell('done')} />
              <PixelButton tone="parchment" label="Partly" accessibilityLabel="Partly" onPress={() => tell('partly')} />
              <PixelButton tone="parchment" label="Not yet" accessibilityLabel="Not yet" onPress={() => tell('not_yet')} />
            </PixelPanel>
          ) : (
            <PixelPanel tone="parchment" padding={3}>
              <NamingStep req={req} onPick={pick} onCreate={(title) => !create(title) && tell('not_yet')} onSkip={() => tell('not_yet')} />
            </PixelPanel>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
