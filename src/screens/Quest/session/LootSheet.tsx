// Loot: after a session of 10+ minutes a chest bounces in. Write one line
// (the quill field), then Open: the chest bursts, XP and credits count up. Later sends the
// chest to the camp pile. No guilt either way. Whatever it earned (a level,
// a boss) plays once the sheet closes: the ceremony host evaluates then.

import { Canvas, Group } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { useSharedValue } from 'react-native-reanimated';

import { Icon } from '../../../components/Icon';
import { useQuestWrites } from '../../../data/itemsRepo';
import { ICONS } from '../../../domain/constants';
import { NODE_MOBS } from '../../../domain/game/balance';
import type { NodeRef } from '../../../domain/game/derive';
import { ClaimPreview, gameStateOf, previewClaim } from '../../../domain/game/fromData';
import { LOG_BODY_MAX } from '../../../domain/items/ops';
import { itemsOfType, metricDefId } from '../../../domain/items/types';
import { PIXEL_FONT, PIXEL_TEXT } from '../../../game/assets/fonts';
import { bossId, mobId, ROSTER } from '../../../game/content/roster';
import { feedback } from '../../../game/feedback';
import { useGameClock } from '../../../game/render/clock';
import { Particles } from '../../../game/render/Particles';
import { AnimatedSprite } from '../../../game/render/Sprite';
import { SpriteBatch } from '../../../game/render/SpriteBatch';
import { SpriteView } from '../../../game/render/SpriteView';
import { useQuestReduced } from '../../../game/state/settings';
import { CountUp } from '../../../game/ui/CountUp';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI, useUiUnit } from '../../../game/ui/theme';
import { useData } from '../../../store/StreakStore';
import { AmountField, amountOf } from '../sheets/AmountField';
import { TextInput } from '../../../components/Text';

type Phase = { kind: 'offer' } | { kind: 'opening'; preview: ClaimPreview } | { kind: 'rewards'; preview: ClaimPreview };

export default function LootSheet({ sessionId, fresh, onClose }: { sessionId: string; fresh: boolean; onClose(): void }) {
  const data = useData();
  const writes = useQuestWrites();
  const reduced = useQuestReduced();
  const u = useUiUnit();
  const { width } = useWindowDimensions();
  const clock = useGameClock(!reduced);
  const session = data.sessions.find((s) => s.id === sessionId);
  const habit = data.habits.find((h) => h.id === session?.habitId);
  const claimed = itemsOfType(data.items, 'chest_claim').some((c) => c.props.sessionId === sessionId);

  const [text, setText] = useState(session?.notes ?? '');
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'offer' });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Scene: the chest bouncing in, the enemy waiting.
  const chestAt = useSharedValue(0);
  const openAt = useSharedValue(-1e9);
  useEffect(() => {
    chestAt.value = clock.value;
    feedback.sfx('chest_open', 'loot');
  }, [chestAt, clock]);

  // Already opened (another device, a double tap), or the session is gone.
  const gone = !session || (claimed && phase.kind === 'offer');
  useEffect(() => {
    if (gone) onClose();
  }, [gone, onClose]);
  if (!session || gone) return null;

  const metric = itemsOfType(data.items, 'metric_def').find((m) => m.id === metricDefId(session.habitId)) ?? null;
  const counted = amountOf(amount, metric?.id ?? null);
  const canOpen = text.trim().length > 0 || !!counted;
  const open = () => {
    if (!canOpen || phase.kind !== 'offer') return;
    const claim = { sessionId, habitId: session.habitId, text, amount: counted };
    const preview = previewClaim(data, Date.now(), claim);
    writes.claimChest(claim);
    feedback.haptic('medium', 'loot');
    feedback.sfx('chest_open', 'loot');
    if (reduced) {
      setPhase({ kind: 'rewards', preview });
      return;
    }
    setPhase({ kind: 'opening', preview });
    openAt.value = clock.value;
    timers.current.push(setTimeout(() => setPhase({ kind: 'rewards', preview }), 750));
  };

  const pre = phase.kind === 'offer' ? null : phase.preview;
  const enemyPos = (pre?.before ?? null)?.journey.position;
  const gameEnemy = gameStateOf(data).journey.position;
  const stageW = Math.min(width - 48, 300);
  // A boss needs a taller, finer stage.
  const bossStage = (enemyPos ?? gameEnemy)?.kind === 'boss';
  const scale = bossStage ? 2 : 3;
  const worldW = Math.floor(stageW / scale);
  const worldH = bossStage ? 68 : 40;

  return (
    <View style={{ gap: 3 * u }}>
      <PixelPanel tone="parchment" padding={3} style={{ gap: 3 * u }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 * u }}>
          {habit && <Icon path={ICONS[habit.icon] || ICONS.code} size={18} color={QUI.wood} />}
          <PixelText size="md" bold numberOfLines={1} style={{ flex: 1 }}>
            {habit?.name ?? 'A chest'}
          </PixelText>
          <PixelText size="sm" color={QUI.muted}>
            {Math.round(session.duration / 60)} min
          </PixelText>
        </View>

        <View style={{ alignSelf: 'center', width: worldW * scale, height: worldH * scale }} accessible accessibilityLabel={phase.kind === 'offer' ? 'A treasure chest' : 'The chest bursts open'}>
          <LootStage
            worldW={worldW}
            worldH={worldH}
            scale={scale}
            clock={clock}
            chestAt={chestAt}
            openAt={openAt}
            opened={phase.kind !== 'offer'}
            enemy={enemyPos ?? gameEnemy}
            reduced={reduced}
          />
        </View>

        {phase.kind === 'offer' && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 * u }}>
              <SpriteView id="icon.quill" scale={2} />
              <TextInput
                value={text}
                onChangeText={setText}
                maxLength={LOG_BODY_MAX}
                returnKeyType="done"
                blurOnSubmit
                accessibilityLabel="What did you do? One line"
                style={{ flex: 1, minHeight: 44, paddingHorizontal: 10, backgroundColor: QUI.white, color: QUI.ink, ...PIXEL_TEXT, fontFamily: PIXEL_FONT, fontSize: 16, borderWidth: u, borderColor: QUI.ink }}
              />
            </View>
            {metric && <AmountField value={amount} onChange={setAmount} label={metric.props.label} unit={metric.props.unit} />}
            <View style={{ flexDirection: 'row', gap: 3 * u }}>
              <PixelButton label="Later" tone="parchment" accessibilityLabel="Later: the chest waits at camp" onPress={onClose} style={{ flex: 1 }} />
              <PixelButton label="Open" accessibilityLabel="Open the chest" onPress={open} disabled={!canOpen} style={{ flex: 2 }} />
            </View>
          </>
        )}

        {phase.kind === 'rewards' && (
          <View style={{ gap: 2 * u, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: 6 * u, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: u }}>
                <SpriteView id="icon.xp" scale={2} />
                <CountUp from={0} to={phase.preview.xpGained} prefix="+" color={QUI.blue} reduced={reduced} onTick={() => feedback.haptic('light', 'loot')} accessibilityLabel={`${phase.preview.xpGained} XP`} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: u }}>
                <SpriteView id="icon.coin" scale={2} />
                <CountUp from={0} to={phase.preview.creditsGained} prefix="+" color={QUI.goldDark} reduced={reduced} accessibilityLabel={`${phase.preview.creditsGained} credits`} />
              </View>
            </View>
            <PixelButton label="Onward" accessibilityLabel="Close" onPress={onClose} style={{ alignSelf: 'stretch' }} />
          </View>
        )}
      </PixelPanel>
    </View>
  );
}

/** The chest and the enemy it strikes, drawn on whole pixels. */
function LootStage(p: {
  worldW: number;
  worldH: number;
  scale: number;
  clock: ReturnType<typeof useGameClock>;
  chestAt: ReturnType<typeof useSharedValue<number>>;
  openAt: ReturnType<typeof useSharedValue<number>>;
  opened: boolean;
  enemy: NodeRef | null;
  reduced: boolean;
}) {
  const { worldW, worldH, scale, clock } = p;
  const e = p.enemy;
  const enemyId = e
    ? e.kind === 'boss'
      ? `${bossId(e.biome)}.idle`
      : `${mobId(e.biome, ROSTER[e.biome].mobs[Math.max(0, NODE_MOBS[e.node] as number)].key)}.idle`
    : null;
  const boss = e?.kind === 'boss';
  const ex = worldW - (boss ? 26 : 18);
  const shadow = [{ id: 'prop.shadow', x: 26, y: worldH - 2 }, ...(enemyId ? [{ id: 'prop.shadow', x: ex, y: worldH - 2 }] : [])];
  return (
    <Canvas style={{ width: worldW * scale, height: worldH * scale }}>
      <Group transform={[{ scale }]}>
        <SpriteBatch atlas="shared" items={shadow} />
        {p.opened ? (
          <AnimatedSprite id="prop.chest.open" x={26} y={worldH - 2} clock={clock} />
        ) : (
          <AnimatedSprite id={p.reduced ? 'prop.chest.closed' : 'prop.chest.bounce'} x={26} y={worldH - 2} clock={clock} startAt={p.reduced ? undefined : p.chestAt} />
        )}
        {enemyId && <AnimatedSprite id={enemyId} x={ex} y={worldH - 2} clock={clock} />}
        {!p.reduced && p.opened && <Particles kind="sparkle" x={18} y={worldH - 24} w={16} h={16} count={18} clock={clock} startAt={p.openAt} />}
      </Group>
    </Canvas>
  );
}
