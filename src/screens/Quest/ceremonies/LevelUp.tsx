// Level up: a short burst, "LV N" in the pixel font, the XP bar refilling.

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { GameState } from '../../../domain/game/derive';
import { questHaptic, questSound } from '../../../game/feedback';
import { useGameClock } from '../../../game/render/clock';
import { Particles } from '../../../game/render/Particles';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { CeremonyStage, useCeremonySize } from './Stage';
import { PE } from '../../../game/ui/pointer';

export function LevelUp({ level, game, onDone, reduced }: { level: number; game: GameState; onDone(): void; reduced: boolean }) {
  const { worldW, worldH, width } = useCeremonySize();
  const clock = useGameClock(!reduced);
  const burst = useSharedValue(-1e9);
  const fill = useSharedValue(0);
  useEffect(() => {
    questSound('levelup');
    questHaptic('success');
    burst.value = clock.value;
    const f = game.xp.xpForNextLevel ? game.xp.xpIntoLevel / game.xp.xpForNextLevel : 0;
    fill.value = reduced ? f : withTiming(f, { duration: 900 });
    const t = setTimeout(onDone, reduced ? 2400 : 2200);
    return () => clearTimeout(t);
  }, [burst, clock, fill, game, onDone, reduced]);
  const barW = Math.min(260, width - 80);
  const barStyle = useAnimatedStyle(() => ({ width: Math.round(fill.value * barW) }));
  return (
    <CeremonyStage
      background={QUI.night}
      onTap={onDone}
      label={`Level ${level}`}
      scene={!reduced && <Particles kind="sparkle" x={worldW / 2 - 30} y={worldH / 2 - 50} w={60} h={60} count={40} clock={clock} startAt={burst} />}
    >
      <View style={[PE.boxNone, { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }]}>
        <PixelText size="hero" bold color={QUI.goldLight}>
          LV {level}
        </PixelText>
        <View style={{ width: barW, height: 10, backgroundColor: QUI.ink, padding: 2 }}>
          <Animated.View style={[{ height: '100%', backgroundColor: QUI.xp }, barStyle]} />
        </View>
      </View>
    </CeremonyStage>
  );
}
