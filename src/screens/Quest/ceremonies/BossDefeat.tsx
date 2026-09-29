// A boss falls: it staggers and flashes, pixel-dissolves into loot, Aqyl
// gives a short battle report, and the gate to the next land swings open.

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { BIOME_IDS, parseBiomeRef } from '../../../domain/game/biomes';
import { BOSS_CREDITS, BOSS_XP } from '../../../domain/game/balance';
import type { GameState } from '../../../domain/game/derive';
import { sprite } from '../../../game/assets/manifest';
import { bossRun } from '../../../game/ceremonies';
import { npcName } from '../../../game/content/npcs';
import { PALETTES } from '../../../game/content/palettes';
import { bossId, ROSTER } from '../../../game/content/roster';
import { feedback } from '../../../game/feedback';
import { useGameClock } from '../../../game/render/clock';
import { Particles } from '../../../game/render/Particles';
import { Camera } from '../../../game/render/PixelStage';
import { AnimatedSprite } from '../../../game/render/Sprite';
import { SpriteBatch } from '../../../game/render/SpriteBatch';
import { DialogBox } from '../../../game/ui/DialogBox';
import { CountUp } from '../../../game/ui/CountUp';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { useSageRecap } from '../../../services/sage';
import { CeremonyStage, useCeremonySize } from './Stage';
import { PE } from '../../../game/ui/pointer';

const rgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

type Step = 'fall' | 'report' | 'gate';

export function BossDefeat({ refId, game, onDone, reduced, settings }: { refId: string; game: GameState; onDone(): void; reduced: boolean; settings?: { npcNames: Record<string, string>; ai?: boolean } }) {
  const { worldW, worldH } = useCeremonySize();
  const r = parseBiomeRef(refId) ?? { biome: 'forest' as const, loop: 0 };
  const b = r.biome;
  const next = BIOME_IDS[(BIOME_IDS.indexOf(b) + 1) % BIOME_IDS.length];
  const nextLoop = BIOME_IDS.indexOf(b) === BIOME_IDS.length - 1 ? r.loop + 1 : r.loop;
  const boss = ROSTER[b].boss;
  const run = bossRun(game, refId);
  const { recap } = useSageRecap(boss.name, run, !!settings?.ai, ROSTER[b].name);
  const clock = useGameClock(!reduced);
  const flash = useSharedValue(0);
  const shake = useSharedValue(0);
  const still = useSharedValue(0);
  const dissolveAt = useSharedValue(-1e9);
  const rainAt = useSharedValue(-1e9);
  const [step, setStep] = useState<Step>(reduced ? 'report' : 'fall');
  const [gone, setGone] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    feedback.sfx('boss_defeat', 'ceremony');
    feedback.haptic('success', 'ceremony');
    const ts: ReturnType<typeof setTimeout>[] = [];
    [0, 260].forEach((d) =>
      ts.push(
        setTimeout(() => {
          flash.value = clock.value + 70;
          shake.value = withSequence(withTiming(2, { duration: 40 }), withTiming(-2, { duration: 40 }), withTiming(0, { duration: 60 }));
        }, 200 + d)
      )
    );
    ts.push(
      setTimeout(() => {
        setGone(true);
        dissolveAt.value = clock.value;
      }, 900)
    );
    ts.push(setTimeout(() => (rainAt.value = clock.value), 1400));
    ts.push(setTimeout(() => setStep('report'), 2300));
    return () => ts.forEach(clearTimeout);
  }, [reduced, flash, shake, clock, dissolveAt, rainAt]);

  const m = sprite(`${bossId(b)}.low`);
  const cx = Math.round(worldW / 2);
  const feet = Math.round(worldH * 0.45);
  const tint = rgb(PALETTES[b].accentA[1]);
  const skip = () => (step === 'gate' ? onDone() : step === 'fall' ? setStep('report') : undefined);

  return (
    <CeremonyStage
      background={step === 'gate' ? PALETTES[next].sky[1] : PALETTES[b].sky[0]}
      onTap={skip}
      label={step === 'gate' ? `The way to ${ROSTER[next].name} is open` : `${boss.name} is defeated`}
      scene={
        <Camera y={still} shake={shake}>
          {step !== 'gate' && !gone && <AnimatedSprite id={`${bossId(b)}.low`} x={cx} y={feet} clock={clock} flashUntil={flash} />}
          {step !== 'gate' && !reduced && (
            <>
              <Particles kind="dissolve" x={cx - m.w / 2 + 6} y={feet - m.h + 6} w={m.w - 12} h={m.h - 10} count={60} clock={clock} startAt={dissolveAt} tint={tint} />
              <Particles kind="sparkle" x={cx - 30} y={feet - 50} w={60} h={40} count={40} clock={clock} startAt={rainAt} />
            </>
          )}
          {step === 'gate' && (
            <>
              <SpriteBatch atlas={b} items={[{ id: `prop.${b}.gate.open`, x: cx, y: feet }]} />
              <SpriteBatch atlas="shared" items={[{ id: 'fx.glow.warm', x: cx, y: feet - 14 }]} additive />
            </>
          )}
        </Camera>
      }
    >
      <View style={[PE.boxNone, { flex: 1, justifyContent: 'flex-end', padding: 16, paddingBottom: 48, gap: 12 }]}>
        {step === 'report' && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
              <CountUp from={0} to={BOSS_XP} prefix="+" color={QUI.goldLight} reduced={reduced} accessibilityLabel={`${BOSS_XP} boss XP`} />
              <CountUp from={0} to={BOSS_CREDITS} prefix="+" color={QUI.goldLight} reduced={reduced} accessibilityLabel={`${BOSS_CREDITS} credits`} />
            </View>
            <DialogBox name={npcName('sage', settings)} portrait="npc.sage" lines={splitSentences(recap)} onDone={() => {
              if (b === 'astral') onDone();
              else { feedback.sfx('gate_open', 'ceremony'); setStep('gate'); }
            }} reduced={reduced} />
          </>
        )}
        {step === 'gate' && (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <PixelText size="xl" bold color={QUI.white} accessibilityRole="header">
              {ROSTER[next].name}
            </PixelText>
            {nextLoop > r.loop && (
              <PixelText size="sm" color={QUI.goldLight}>
                Ascension {nextLoop}
              </PixelText>
            )}
          </View>
        )}
      </View>
    </CeremonyStage>
  );
}

/** A recap as dialog lines: one or two sentences each. */
function splitSentences(s: string): string[] {
  const parts = s.match(/[^.!?]+[.!?]+/g)?.map((x) => x.trim()) ?? [s];
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 2) out.push(parts.slice(i, i + 2).join(' '));
  return out;
}
