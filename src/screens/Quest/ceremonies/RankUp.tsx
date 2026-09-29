// Rank promotion: an iris opens on the avatar kneeling; a banner unfurls;
// the new tier's gear materialises piece by piece; the title appears; the
// wares this rank unlocks show small at the bottom.

import { Group, Rect } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { RANKS } from '../../../domain/game/balance';
import { sprite } from '../../../game/assets/manifest';
import { avatarLayers, AvatarLook } from '../../../game/avatar';
import { SHOP } from '../../../game/content/shop';
import { questHaptic, questSound } from '../../../game/feedback';
import { useGameClock } from '../../../game/render/clock';
import { Particles } from '../../../game/render/Particles';
import { SpriteBatch } from '../../../game/render/SpriteBatch';
import { IrisWipe } from '../../../game/render/Transitions';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { IconGrid } from '../sheets/common';
import { CeremonyStage, useCeremonySize } from './Stage';
import { PE } from '../../../game/ui/pointer';

export function RankUp({ tier, look, onDone, reduced }: { tier: number; look: AvatarLook; onDone(): void; reduced: boolean }) {
  const { worldW, worldH, scale, width } = useCeremonySize();
  const clock = useGameClock(!reduced);
  const iris = useSharedValue(reduced ? 1 : 0);
  const banner = useSharedValue(reduced ? 1 : 0);
  const spark = useSharedValue(-1e9);
  const layers = useMemo(() => avatarLayers({ ...look, tier }), [look, tier]);
  const oldLayers = useMemo(() => avatarLayers({ ...look, tier: Math.max(0, tier - 1) }), [look, tier]);
  const [shown, setShown] = useState(reduced ? layers.length : 0);
  const [stand, setStand] = useState(reduced);
  const [title, setTitle] = useState(reduced);
  const unlocked = SHOP.filter((s) => s.minTier === tier);

  useEffect(() => {
    if (reduced) return;
    questSound('levelup');
    iris.value = withTiming(1, { duration: 550 });
    const ts: ReturnType<typeof setTimeout>[] = [];
    ts.push(setTimeout(() => (banner.value = withTiming(1, { duration: 700 })), 500));
    layers.forEach((_, i) =>
      ts.push(
        setTimeout(() => {
          setShown(i + 1);
          spark.value = clock.value;
          questHaptic('light');
        }, 1300 + i * 330)
      )
    );
    const end = 1300 + layers.length * 330;
    ts.push(setTimeout(() => setStand(true), end + 150));
    ts.push(
      setTimeout(() => {
        setTitle(true);
        questHaptic('success');
      }, end + 350)
    );
    return () => ts.forEach(clearTimeout);
  }, [reduced, iris, banner, spark, clock, layers]);

  const m = sprite('avatar.body');
  const cx = Math.round(worldW / 2);
  const feet = Math.round(worldH * 0.52);
  // The old gear, then the new tier piece by piece (body first), in draw order.
  const reveal = ['avatar.body', ...layers.filter((l) => l !== 'avatar.body')];
  const items = shown === 0 ? oldLayers : layers.filter((l) => reveal.indexOf(l) < shown);
  const pose = stand ? 0 : 4;
  const bh = useDerivedValue(() => Math.round(banner.value * 44));
  const title_ = RANKS[tier].title;

  return (
    <CeremonyStage
      background="#1b1830"
      onTap={onDone}
      label={`Promoted: ${title_}`}
      scene={
        <>
          {/* The banner unfurls behind the avatar. */}
          <Rect x={cx - 14} y={feet - 58} width={28} height={2} color={QUI.goldLight} />
          <Group>
            <Rect x={cx - 12} y={feet - 56} width={24} height={bh} color={QUI.red} />
            <Rect x={cx - 12} y={feet - 56} width={2} height={bh} color={QUI.goldDark} />
            <Rect x={cx + 10} y={feet - 56} width={2} height={bh} color={QUI.goldDark} />
          </Group>
          {items.map((id) => (
            <SpriteBatch key={id} atlas="shared" items={[{ id, x: cx, y: feet, frame: pose }]} />
          ))}
          {!reduced && <Particles kind="sparkle" x={cx - 12} y={feet - m.h} w={24} h={m.h} count={24} clock={clock} startAt={spark} />}
        </>
      }
    >
      <View style={[PE.boxNone, { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 60, gap: 16 }]}>
        {title && (
          <>
            <PixelText size="xl" bold color={QUI.goldLight} accessibilityRole="header">
              {title_}
            </PixelText>
            {unlocked.length > 0 && (
              <IconGrid
                cells={unlocked.map((s) => ({ key: s.sku, icon: s.icon, label: `Unlocked: ${s.name}` }))}
                columns={Math.min(4, unlocked.length)}
                cell={Math.min(64, Math.floor((width - 80) / 4))}
                scale={Math.max(2, scale - 1)}
                onPress={() => {}}
              />
            )}
          </>
        )}
      </View>
      {!reduced && <IrisWipe progress={iris} scale={scale} />}
    </CeremonyStage>
  );
}
