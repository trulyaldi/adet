// The first open of the Quest tab: three panels. The avatar wakes by a
// campfire in the Whispering Forest; Aqyl says what focus and chests do; the
// rank earned by past focus is revealed. Then the journey starts.

import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type { GameState } from '../../../domain/game/derive';
import { avatarLayers, AvatarLook } from '../../../game/avatar';
import { PALETTES } from '../../../game/content/palettes';
import { questHaptic, questSound } from '../../../game/feedback';
import { useGameClock } from '../../../game/render/clock';
import { Particles } from '../../../game/render/Particles';
import { GRADES } from '../../../domain/game/daylight';
import { Graded } from '../../../game/render/Lighting';
import { BatchItem, SpriteBatch } from '../../../game/render/SpriteBatch';
import { DialogBox } from '../../../game/ui/DialogBox';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { CeremonyStage, useCeremonySize } from './Stage';
import { PE } from '../../../game/ui/pointer';

export function Onboarding({ game, look, sageName, onBegin, reduced }: { game: GameState; look: AvatarLook; sageName: string; onBegin(): void; reduced: boolean }) {
  const { worldW, worldH } = useCeremonySize();
  const clock = useGameClock(!reduced);
  const [panel, setPanel] = useState(0);
  const [awake, setAwake] = useState(reduced);
  const spark = useSharedValue(-1e9);
  useEffect(() => {
    if (panel !== 0 || reduced) return;
    const t = setTimeout(() => setAwake(true), 1100);
    return () => clearTimeout(t);
  }, [panel, reduced]);
  useEffect(() => {
    if (panel === 2) {
      spark.value = clock.value;
      questSound('levelup');
      questHaptic('success');
    }
  }, [panel, spark, clock]);

  const cx = Math.round(worldW / 2);
  const feet = Math.round(worldH * 0.5);
  const tier = panel === 2 ? game.rank.tier : 0;
  const layers = avatarLayers({ ...look, tier });
  const avatar = layers.map((id) => ({ id, x: cx + 4, y: feet, frame: panel === 0 && !awake ? 4 : undefined, seq: [0, 1], fps: 2 }));
  const already = game.rank.tier > 0;
  // A clearing in the Whispering Forest: ground, trees around, the camp in the middle.
  const clearing = useMemo(() => {
    const out: BatchItem[] = [];
    for (let y = 0; y < worldH + 16; y += 16) for (let x = 0; x < worldW + 16; x += 16) out.push({ id: `tile.forest.ground.${'abc'[((x * 7 + y * 3) >> 4) % 3]}`, x, y });
    const trees: [string, number, number][] = [
      ['tree.a', 12, feet - 40],
      ['tree.b', worldW - 14, feet - 34],
      ['tree.a', worldW - 30, feet + 58],
      ['tree.b', 22, feet + 66],
      ['bush', 40, feet + 24],
      ['flowers', worldW - 40, feet + 20],
      ['mushrooms', cx + 40, feet - 26],
      ['tuft', cx - 36, feet - 18],
      ['tree.a', cx + 10, feet - 70],
    ];
    for (const [n, x, y] of trees) out.push({ id: `decor.forest.${n}`, x, y });
    out.push({ id: 'critter.forest.rabbit.idle', x: cx + 44, y: feet + 36, wander: reduced ? 0 : 8 });
    return out.sort((a, b) => (a.id.startsWith('tile.') ? -1 : 0) - (b.id.startsWith('tile.') ? -1 : 0) || a.y - b.y);
  }, [worldW, worldH, feet, cx, reduced]);
  const next = () => setPanel((p) => Math.min(2, p + 1));

  return (
    <CeremonyStage
      background={PALETTES.forest.layers[2]}
      onTap={panel === 0 ? next : () => {}}
      label={panel === 0 ? 'You wake by a campfire in the Whispering Forest' : panel === 2 ? game.rank.title : sageName}
      scene={
        <>
          <Graded matrix={GRADES.dusk}>
            <SpriteBatch atlas="forest" items={clearing} clock={clock} />
          </Graded>
          <SpriteBatch atlas="shared" items={[{ id: 'fx.glow.warm', x: cx - 16, y: feet - 6 }]} additive />
          <SpriteBatch atlas="shared" items={[{ id: 'prop.campfire.default.lit', x: cx - 16, y: feet + 2 }, ...(panel >= 1 ? [{ id: 'npc.sage.idle', x: cx + 26, y: feet }] : [])]} clock={clock} />
          {avatar.map((a) => (
            <SpriteBatch key={a.id} atlas="shared" items={[a]} clock={awake ? clock : undefined} />
          ))}
          {!reduced && <Particles kind="fireflies" x={0} y={feet - 60} w={worldW} h={80} count={14} clock={clock} />}
          {!reduced && panel === 2 && <Particles kind="sparkle" x={cx - 10} y={feet - 30} w={24} h={28} count={30} clock={clock} startAt={spark} />}
        </>
      }
    >
      <View style={[PE.boxNone, { flex: 1, justifyContent: 'flex-end', padding: 16, paddingBottom: 48, gap: 12 }]}>
        {panel === 0 && (
          <PixelText size="sm" color={QUI.parchment} style={{ textAlign: 'center' }}>
            ▼
          </PixelText>
        )}
        {panel === 1 && (
          <DialogBox name={sageName} portrait="npc.sage" lines={['Focus is your blade.', 'After a session, open your chest: tick a task, or write a line.']} onDone={next} reduced={reduced} />
        )}
        {panel === 2 && (
          <View style={{ gap: 14, alignItems: 'center' }}>
            <PixelText size="xl" bold color={QUI.goldLight} accessibilityRole="header">
              {game.rank.title}
            </PixelText>
            <PixelText size="md" color={QUI.white} style={{ textAlign: 'center' }}>
              {already ? `Your past focus already made you a ${game.rank.title}.` : 'Every journey starts with one step.'}
            </PixelText>
            <PixelButton label="Begin" accessibilityLabel="Begin the journey" onPress={onBegin} style={{ alignSelf: 'stretch' }} />
          </View>
        )}
      </View>
    </CeremonyStage>
  );
}
