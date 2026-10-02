// The result sheet (World Mode, world-4), shown app-wide after a session
// that targeted a quest: three big icons, Done (check), Partly (half a
// heart) and Not yet (hourglass). It never blocks: swiping it away, tapping
// outside or Back counts as Not yet. A told result plays on the same Stage
// as the timer (Done: a swing and the enemy falls; Partly: a swing, a flash
// and one heart pops; Not yet: a calm "See you soon") with a 6 s Undo, then
// the chest (if the session earned one) opens. Loaded at first use
// (ResultHost), so Skia stays off the start-up path.

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useWorldWrites } from '../../../data/worldRepo';
import { RESULT_UNDO_MS } from '../../../domain/game/balance';
import { resolveTimerSkin } from '../../../domain/game/timerSkin';
import type { ResultKind } from '../../../domain/items/types';
import { StageReaction, stageReactionOf } from '../../../domain/world/target';
import { sprite } from '../../../game/assets/manifest';
import { ceremonyHost } from '../../../game/ceremonies/host';
import { loadStage } from '../../../game/render/screens';
import { SkiaGate } from '../../../game/render/SkiaGate';
import { SpriteView } from '../../../game/render/SpriteView';
import { createLatch, Latch } from '../../../game/state/latch';
import { openLoot } from '../../../game/state/loot';
import { closeResult, ResultRequest } from '../../../game/state/result';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { useDevicePrefs } from '../../../store/devicePrefs';
import { MODAL_GAP_MS } from '../../../theme/motion';
import { useAppActive } from '../../../theme/useMotion';
import { stageTargetOf } from '../realm/realmModel';

const STAGE_H = 132;

interface Told {
  kind: ResultKind;
  resultId: string | null;
  reaction: StageReaction;
}

/** Close once: after the sheet has gone, the chest opens, or the ceremony host looks. */
function finish(closing: Latch): void {
  if (!closing.take()) return;
  closeResult(MODAL_GAP_MS, (lootFor) => (lootFor ? openLoot({ sessionId: lootFor, fresh: true }) : ceremonyHost.evaluate()));
}

export default function ResultSheet({ req, reduced }: { req: ResultRequest; reduced: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const world = useWorldWrites();
  const { prefs } = useDevicePrefs();
  const appActive = useAppActive();
  const [told, setTold] = useState<Told | null>(null);
  // Each undo replays the Stage from the start.
  const [attempt, setAttempt] = useState(0);
  // One result per tap burst, and one close.
  const [answer] = useState(createLatch);
  const [closing] = useState(createLatch);
  const base = useMemo(() => stageTargetOf(req.target), [req.target]);
  // A phase that fell lights its pip; the boss stands.
  const target = told?.reaction === 'phaseHit' && base.phases ? { ...base, phases: { ...base.phases, cleared: base.phases.cleared + 1 } } : base;
  const quest = req.target.quest;

  const tell = (kind: ResultKind) => {
    if (!answer.take()) return;
    const resultId = world.recordResult(quest.id, kind, req.sessionId);
    // Rejected (the quest fell meanwhile on another device): nothing happens, calmly.
    setTold({ kind, resultId, reaction: resultId ? stageReactionOf(kind, req.target) : 'none' });
  };
  /** Away without an answer: that's Not yet, and the sheet simply goes. */
  const dismiss = () => {
    if (!told && answer.take()) world.recordResult(quest.id, 'not_yet', req.sessionId);
    finish(closing);
  };
  const undo = () => {
    if (!told?.resultId) return;
    world.undoResult(told.resultId);
    setTold(null);
    setAttempt((n) => n + 1);
    answer.release();
  };

  // The undo window, then the chest.
  useEffect(() => {
    if (!told) return;
    const t = setTimeout(() => finish(closing), RESULT_UNDO_MS);
    return () => clearTimeout(t);
  }, [told, closing]);

  const swipe = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetX([-30, 30])
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 800) scheduleOnRN(dismiss);
    });

  const panelW = Math.min(width - 24, 440);
  const stageW = panelW - 24;
  const blank = <View style={{ width: stageW, height: STAGE_H }} />;

  return (
    <Modal visible transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={dismiss} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,20,0.55)' }]} onPress={dismiss} accessibilityRole="button" accessibilityLabel={told ? 'Continue' : 'Not yet'} />
        <GestureDetector gesture={swipe}>
          <View style={{ marginTop: 'auto', alignSelf: 'center', width: panelW, paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
            <PixelPanel tone="parchment" padding={3}>
              <View style={{ gap: 10, alignItems: 'center' }}>
                <PixelText size="md" bold numberOfLines={2} style={{ textAlign: 'center' }}>
                  {quest.title}
                </PixelText>
                <View style={{ width: stageW, height: STAGE_H, borderRadius: 6, overflow: 'hidden' }}>
                  <SkiaGate
                    key={attempt}
                    load={loadStage}
                    props={{
                      width: stageW,
                      height: STAGE_H,
                      skin: resolveTimerSkin(prefs.timerSkin, undefined),
                      progress: 1,
                      past: false,
                      sessionSec: 0,
                      paused: false,
                      reduced,
                      live: appActive,
                      battle: true,
                      payoff: 0,
                      victory: told?.reaction === 'ko',
                      target,
                      reaction: told?.reaction ?? null,
                    }}
                    fallback={blank}
                    errorFallback={blank}
                  />
                </View>
                {!told ? (
                  <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
                    <BigChoice label="Done" tone="gold" icon={<SpriteView id="icon.check" scale={3} />} onPress={() => tell('done')} />
                    <BigChoice label="Partly" tone="parchment" icon={<HalfHeart />} onPress={() => tell('partly')} />
                    <BigChoice label="Not yet" tone="parchment" icon={<Hourglass />} onPress={() => tell('not_yet')} />
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', minHeight: 72 }}>
                    {told.kind === 'not_yet' && <PixelText size="md">See you soon</PixelText>}
                    {told.resultId && <PixelButton small tone="parchment" label="Undo" accessibilityLabel="Undo the result" onPress={undo} />}
                    <PixelButton small tone="gold" label="OK" accessibilityLabel={req.lootFor ? 'Continue to the chest' : 'Continue'} onPress={() => finish(closing)} />
                  </View>
                )}
              </View>
            </PixelPanel>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

function BigChoice({ label, icon, tone, onPress }: { label: string; icon: React.ReactNode; tone: 'gold' | 'parchment'; onPress(): void }) {
  return (
    <PixelButton
      accessibilityLabel={label}
      tone={tone}
      onPress={onPress}
      style={{ minWidth: 80, minHeight: 72 }}
      icon={<View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>}
    />
  );
}

/** Partly: half a heart, the other half faint. */
function HalfHeart({ scale = 3 }: { scale?: number }) {
  const w = sprite('icon.heart').w * scale;
  const half = Math.round(w / 2);
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: half, overflow: 'hidden' }}>
        <SpriteView id="icon.heart" scale={scale} />
      </View>
      <View style={{ width: w - half, overflow: 'hidden', opacity: 0.25 }}>
        <View style={{ marginLeft: -half }}>
          <SpriteView id="icon.heart" scale={scale} />
        </View>
      </View>
    </View>
  );
}

const HOURGLASS = ['#######', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#.#.#.', '#######'];

/** Not yet: an hourglass, drawn in pixels (the atlas has none). */
function Hourglass({ px = 4 }: { px?: number }) {
  return (
    <View>
      {HOURGLASS.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {[...row].map((c, x) => (
            <View key={x} style={{ width: px, height: px, backgroundColor: c === '#' ? QUI.ink : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}
