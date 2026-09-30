// Loot: after a session of 10+ minutes a chest bounces in. Tick the weak
// points done and/or write one line (the quill field), then Open: the chest
// bursts, crits strike the enemy, XP and credits count up. Later sends the
// chest to the camp pile. No guilt either way. Whatever it earned (a level,
// a boss) plays once the sheet closes: the ceremony host evaluates then.

import { Canvas, Group } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { useDerivedValue, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Icon } from '../../../components/Icon';
import { useQuestWrites } from '../../../data/itemsRepo';
import { ICONS } from '../../../domain/constants';
import { MAX_CRITS, NODE_MOBS } from '../../../domain/game/balance';
import type { NodeRef } from '../../../domain/game/derive';
import { ClaimPreview, gameStateOf, previewClaim } from '../../../domain/game/fromData';
import { LOG_BODY_MAX, openTasksFor } from '../../../domain/items/ops';
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
import { PixelCheck } from '../../../game/ui/PixelCheck';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI, useUiUnit } from '../../../game/ui/theme';
import { useData } from '../../../store/StreakStore';
import { AmountField, amountOf } from '../sheets/AmountField';
import { TextInput } from '../../../components/Text';

type Phase = { kind: 'offer' } | { kind: 'opening'; preview: ClaimPreview; crits: number } | { kind: 'rewards'; preview: ClaimPreview };

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

  // The weak points on offer: the ones planned for this session, else the
  // habit's top three (a chest from camp, or a session started without a plan).
  const tasks = useMemo(() => {
    const planned = data.links.filter((l) => l.kind === 'planned_for' && l.toId === sessionId).map((l) => l.fromId);
    const all = itemsOfType(data.items, 'task');
    const byPlan = planned.map((id) => all.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t && t.props.status === 'open');
    return byPlan.length ? byPlan : session ? openTasksFor(data.items, session.habitId).slice(0, MAX_CRITS) : [];
    // Fixed for the sheet's life: ticking one shouldn't reshuffle the list.
  }, [sessionId]);
  const [ticked, setTicked] = useState<string[]>([]);
  const [text, setText] = useState(session?.notes ?? '');
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'offer' });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Scene: the chest bouncing in, the enemy waiting.
  const chestAt = useSharedValue(0);
  const openAt = useSharedValue(-1e9);
  const hitAt = useSharedValue(-1e9);
  const flashUntil = useSharedValue(0);
  const shake = useSharedValue(0);
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
  const canOpen = ticked.length > 0 || text.trim().length > 0 || !!counted;
  const open = () => {
    if (!canOpen || phase.kind !== 'offer') return;
    const claim = { sessionId, habitId: session.habitId, doneTaskIds: ticked, text, amount: counted };
    const preview = previewClaim(data, Date.now(), claim);
    writes.claimChest(claim);
    const crits = Math.min(MAX_CRITS, ticked.length);
    feedback.haptic('medium', 'loot');
    feedback.sfx('chest_open', 'loot');
    if (reduced) {
      setPhase({ kind: 'rewards', preview });
      return;
    }
    setPhase({ kind: 'opening', preview, crits });
    openAt.value = clock.value;
    for (let i = 0; i < crits; i++) {
      timers.current.push(
        setTimeout(() => {
          hitAt.value = clock.value;
          flashUntil.value = clock.value + 70; // one white frame
          shake.value = withSequence(withTiming(2, { duration: 40 }), withTiming(-2, { duration: 40 }), withTiming(0, { duration: 60 }));
          feedback.haptic('light', 'loot');
          feedback.sfx('crit', 'loot');
        }, 450 + i * 320)
      );
    }
    timers.current.push(setTimeout(() => setPhase({ kind: 'rewards', preview }), 500 + crits * 320 + 250));
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
            hitAt={hitAt}
            flashUntil={flashUntil}
            shake={shake}
            opened={phase.kind !== 'offer'}
            enemy={enemyPos ?? gameEnemy}
            reduced={reduced}
          />
        </View>

        {phase.kind === 'offer' && (
          <>
            {tasks.map((t) => {
              const on = ticked.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTicked(on ? ticked.filter((x) => x !== t.id) : [...ticked, t.id])}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t.title}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 2 * u, minHeight: 44 }}
                >
                  <View style={{ width: 24, height: 24, borderWidth: u, borderColor: QUI.ink, backgroundColor: on ? QUI.gold : QUI.white, alignItems: 'center', justifyContent: 'center' }}>
                    {on && <PixelCheck px={2} />}
                  </View>
                  <PixelText size="md" style={{ flex: 1 }}>
                    {t.title}
                  </PixelText>
                </Pressable>
              );
            })}
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
            {phase.preview.critDamage > 0 && (
              <PixelText size="sm" color={QUI.red} accessibilityLabel={`${phase.preview.critDamage} critical damage`}>
                Crit! {phase.preview.critDamage}
              </PixelText>
            )}
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
  hitAt: ReturnType<typeof useSharedValue<number>>;
  flashUntil: ReturnType<typeof useSharedValue<number>>;
  shake: ReturnType<typeof useSharedValue<number>>;
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
  const shakeT = useDerivedValue(() => [{ translateX: Math.round(p.shake.value) }]);
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
        {enemyId && (
          <Group transform={shakeT}>
            <AnimatedSprite id={enemyId} x={ex} y={worldH - 2} clock={clock} flashUntil={p.flashUntil} />
          </Group>
        )}
        {!p.reduced && p.opened && (
          <>
            <Particles kind="sparkle" x={18} y={worldH - 24} w={16} h={16} count={18} clock={clock} startAt={p.openAt} />
            <AnimatedSprite id="fx.hit" x={ex} y={worldH - (boss ? 30 : 10)} clock={clock} startAt={p.hitAt} transient />
          </>
        )}
      </Group>
    </Canvas>
  );
}
