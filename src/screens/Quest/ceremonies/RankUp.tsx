// The one layered Avatar kneels, then reveals the new rank a piece at a time.
import { Rect } from '@shopify/react-native-skia';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { AvatarLayer } from '../../../domain/game/avatar';
import { RANKS } from '../../../domain/game/balance';
import { AvatarLook } from '../../../game/avatar';
import { SHOP } from '../../../game/content/shop';
import { feedback } from '../../../game/feedback';
import { Avatar } from '../../../game/render/Avatar';
import { IrisWipe } from '../../../game/render/Transitions';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { IconGrid } from '../sheets/common';
import { CeremonyStage, useCeremonySize } from './Stage';

const REVEAL: AvatarLayer[] = ['back', 'outfit', 'head', 'hand', 'pip'];

export function RankUp({ tier, level = RANKS[tier].fromLevel, look, onDone, reduced }: { tier: number; level?: number; look: AvatarLook; onDone(): void; reduced: boolean }) {
  const { worldW, worldH, scale, width } = useCeremonySize();
  const iris = useSharedValue(reduced ? 1 : 0);
  const banner = useSharedValue(reduced ? 1 : 0);
  const [shown, setShown] = useState(reduced ? REVEAL.length : -1);
  const unlocked = SHOP.filter((s) => s.rankRequired === tier);
  useEffect(() => {
    if (reduced) return;
    feedback.sfx('rank_up', 'ceremony');
    iris.value = withTiming(1, { duration: 500 });
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => { banner.value = withTiming(1, { duration: 650 }); setShown(0); }, 500));
    REVEAL.forEach((_, i) => timers.push(setTimeout(() => {
      setShown(i + 1);
      feedback.haptic('light', 'ceremony');
    }, 1250 + i * 360)));
    timers.push(setTimeout(() => feedback.haptic('success', 'ceremony'), 1250 + REVEAL.length * 360));
    return () => timers.forEach(clearTimeout);
  }, [reduced, iris, banner]);
  const bannerHeight = useDerivedValue(() => Math.round(banner.value * 48));
  const x = Math.round(worldW / 2);
  const y = Math.round(worldH * 0.4);
  const title = RANKS[tier].title;
  const visible: AvatarLayer[] = ['body', ...REVEAL.slice(0, Math.max(0, shown))];
  return (
    <CeremonyStage background={QUI.night} onTap={onDone} label={`Promoted to ${title}, level ${level}`} scene={
      <>
        <Rect x={x - 16} y={y - 44} width={32} height={2} color={QUI.goldLight} />
        <Rect x={x - 14} y={y - 42} width={28} height={bannerHeight} color={QUI.red} />
      </>
    }>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 48 }}>
        <Avatar tier={shown < 0 ? Math.max(0, tier - 1) : tier} gear={look.gear} animation={shown < REVEAL.length ? 'kneel' : 'idle'}
          visibleLayers={shown < 0 ? undefined : visible} scale={Math.max(3, Math.min(4, scale))} animate={!reduced} />
        {(shown === REVEAL.length || reduced) && (
          <>
            <PixelText size="xl" bold color={QUI.goldLight} accessibilityRole="header">{title}</PixelText>
            <PixelText size="md" color={QUI.white}>LV {level}</PixelText>
            {unlocked.length > 0 && <IconGrid cells={unlocked.map((s) => ({ key: s.sku, icon: s.icon, label: `Unlocked: ${s.name}` }))}
              columns={Math.min(4, unlocked.length)} cell={Math.max(44, Math.min(64, Math.floor((width - 80) / 4)))} scale={Math.max(2, scale - 1)} />}
          </>
        )}
      </View>
      {!reduced && <IrisWipe progress={iris} scale={scale} />}
    </CeremonyStage>
  );
}
