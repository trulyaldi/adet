// Fight: a slim strip on the timer screen (64 pt). The current enemy idles,
// a chunky HP bar drains as minutes go by (a preview; the real numbers are
// worked out after the session), and a tiny sparkle marks each minute. No
// sound, no flashing; still with reduced motion; tap it for the enemy's name.

import { Canvas, Group } from '@shopify/react-native-skia';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { MIN_SESSION_MIN, NODE_MOBS } from '../../../domain/game/balance';
import { gameStateOf } from '../../../domain/game/fromData';
import { bossId, mobId, ROSTER } from '../../../game/content/roster';
import { sprite } from '../../../game/assets/manifest';
import { useGameClock } from '../../../game/render/clock';
import { Particles } from '../../../game/render/Particles';
import { SpriteBatch } from '../../../game/render/SpriteBatch';
import { HPBar } from '../../../game/ui/HPBar';
import { useActiveProgress } from '../../../store/useActiveProgress';
import { useData } from '../../../store/StreakStore';
import { useTheme } from '../../../theme/ThemeProvider';
import { STRIP_H } from './stripSize';


export default function BattleStrip({ running, reduced, width }: { running: boolean; reduced: boolean; width: number }) {
  const { colors, radius } = useTheme();
  const data = useData();
  const game = gameStateOf(data);
  const p = useActiveProgress(reduced ? 60_000 : 5_000);
  const clock = useGameClock(running && !reduced);
  const spark = useSharedValue(-1e9);
  const [named, setNamed] = useState(false);
  const j = game.journey;
  const pos = j.position;
  const isBoss = pos.kind === 'boss';
  const mob = ROSTER[pos.biome].mobs[Math.max(0, NODE_MOBS[pos.node] as number)];
  const id = isBoss ? `${bossId(pos.biome)}.idle` : `${mobId(pos.biome, mob.key)}.idle`;
  const name = isBoss ? ROSTER[pos.biome].boss.name : mob.name;
  const minutes = Math.floor((p?.sessionSec ?? 0) / 60);
  // A preview: about one damage per focused minute, once the session counts.
  const preview = minutes >= MIN_SESSION_MIN ? minutes : 0;
  const hp = Math.max(0, j.hp - preview);

  useEffect(() => {
    if (minutes > 0 && running && !reduced) spark.value = clock.value;
  }, [minutes, running, reduced, spark, clock]);
  useEffect(() => {
    if (!named) return;
    const t = setTimeout(() => setNamed(false), 2500);
    return () => clearTimeout(t);
  }, [named]);

  const m = sprite(id);
  const scale = isBoss ? 1 : 3;
  const size = m.w * scale;
  const boxH = Math.min(STRIP_H - 8, m.h * scale);
  return (
    <Pressable
      onPress={() => setNamed(true)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${Math.ceil(hp)} of ${j.maxHp} health`}
      style={{ height: STRIP_H, width, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: radius.lg, backgroundColor: colors.card, opacity: 0.94 }}
    >
      <View style={{ width: size, height: boxH, overflow: 'hidden' }}>
        <Canvas style={{ width: size, height: m.h * scale }}>
          <Group transform={[{ scale }, { translateY: isBoss ? -Math.max(0, (m.h * scale - boxH) / 2) : 0 }]}>
            <SpriteBatch atlas={m.atlas} items={[{ id, x: m.ax, y: m.ay, frame: reduced ? 0 : undefined }]} clock={reduced ? undefined : clock} />
            {!reduced && <Particles kind="sparkle" x={m.w / 2 - 6} y={m.h / 2 - 6} w={12} h={12} count={8} clock={clock} startAt={spark} />}
          </Group>
        </Canvas>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        {named ? (
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
            {name}
          </Text>
        ) : null}
        <HPBar hp={hp} max={j.maxHp} width={Math.max(80, width - size - 40)} segments={isBoss ? 16 : 10} reduced={reduced} label={`${name} health`} />
      </View>
    </Pressable>
  );
}
