// Dev-only: every render-kit primitive on one screen, at 3× and 4×, for
// checking crispness, motion and reduced-motion variants. Opened with a long
// press on the Quest HUD in development builds.

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BIOME_IDS, BiomeId } from '../../domain/game/biomes';
import { DayPhase, nightLight } from '../../domain/game/daylight';
import { PALETTES } from '../../game/content/palettes';
import { bossId, mobId, ROSTER } from '../../game/content/roster';
import { useGameClock } from '../../game/render/clock';
import { Graded, Lights, worldMatrix } from '../../game/render/Lighting';
import { ParticleKind, Particles } from '../../game/render/Particles';
import { Camera, PixelStage } from '../../game/render/PixelStage';
import { AnimatedSprite } from '../../game/render/Sprite';
import { SpriteView } from '../../game/render/SpriteView';
import { TILE, Tilemap } from '../../game/render/Tilemap';
import { IrisWipe, PixelDissolve } from '../../game/render/Transitions';
import { coverWorld } from '../../game/state/focus';
import { useQuestFonts } from '../../game/assets/fonts';
import { CountUp } from '../../game/ui/CountUp';
import { DialogBox } from '../../game/ui/DialogBox';
import { HPBar, XPBar } from '../../game/ui/HPBar';
import { PixelButton } from '../../game/ui/PixelButton';
import { PixelPanel } from '../../game/ui/PixelPanel';
import { PixelText } from '../../game/ui/PixelText';
import { QUI } from '../../game/ui/theme';

const PARTICLES: ParticleKind[] = ['fireflies', 'leaves', 'spores', 'fog', 'bubbles', 'sand', 'heat', 'snow', 'embers', 'stars', 'aurora', 'ash', 'dust', 'sparkle', 'dissolve'];
const PHASES: DayPhase[] = ['dawn', 'day', 'dusk', 'night'];

export default function Playground({ onClose }: { onClose(): void }) {
  useQuestFonts();
  useEffect(() => coverWorld(), []);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [scale, setScale] = useState(3);
  const [biome, setBiome] = useState<BiomeId>('forest');
  const [phase, setPhase] = useState<DayPhase>('day');
  const [reduced, setReduced] = useState(false);
  const [pk, setPk] = useState(0);
  const [hp, setHp] = useState(25);
  const [count, setCount] = useState(0);
  const [dialog, setDialog] = useState(false);
  const clock = useGameClock(!reduced);
  const cam = useSharedValue(0);
  const shake = useSharedValue(0);
  const flashUntil = useSharedValue(0);
  const burstAt = useSharedValue(-10_000);
  const iris = useSharedValue(1);
  const dissolve = useSharedValue(0);
  const w = Math.floor(width / scale) * scale;
  const h = 180 * (scale / 3);
  const worldW = w / scale;

  const ground = useMemo(() => {
    const cols = Math.ceil(worldW / TILE) + 1;
    return {
      x: 0,
      y: 0,
      grid: Array.from({ length: 4 }, (_, j) => Array.from({ length: cols }, (_, i) => `tile.${biome}.ground.${'abc'[(i * 7 + j * 3) % 3]}`)),
    };
  }, [biome, worldW]);
  const mobs = ROSTER[biome].mobs;
  const decor = useMemo(
    () => [
      { id: `decor.${biome}.tree.a`, x: 14, y: 40 },
      { id: `decor.${biome}.light`, x: worldW - 12, y: 30 },
      { id: `tile.${biome}.liquid`, x: worldW - 24, y: 52 },
      ...mobs.map((m, i) => ({ id: `${mobId(biome, m.key)}.idle`, x: 30 + i * 18, y: 56, phase: i })),
      { id: `critter.${biome}.${ROSTER[biome].critters[0]}.idle`, x: 60, y: 24, wander: 8 },
      { id: 'npc.sage.idle', x: worldW - 40, y: 26 },
      { id: 'prop.campfire.default.lit', x: worldW - 60, y: 62 },
    ],
    [biome, mobs, worldW]
  );
  const lights = useMemo(() => [{ id: 'fx.glow.warm', x: worldW - 60, y: 56 }, { id: 'fx.glow.small', x: worldW - 12, y: 20 }], [worldW]);

  const hit = () => {
    flashUntil.value = clock.value + 70; // one white frame
    if (!reduced) shake.value = withSequence(withTiming(2, { duration: 40 }), withTiming(-2, { duration: 40 }), withTiming(0, { duration: 60 }));
    setHp((v) => (v <= 0 ? 25 : Math.max(0, v - 7)));
  };
  const wipe = (sv: typeof iris, from: number, to: number) => {
    if (reduced) return;
    sv.value = from;
    sv.value = withSequence(withTiming(to, { duration: 500 }), withTiming(from, { duration: 500 }));
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: QUI.night, paddingTop: insets.top }}>
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: insets.bottom + 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 }}>
            <PixelText size="lg" color={QUI.white}>
              Playground
            </PixelText>
            <PixelButton small label="Close" accessibilityLabel="Close the playground" onPress={onClose} tone="night" />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12 }}>
            <PixelButton small label={`${scale}×`} accessibilityLabel="Change scale" onPress={() => setScale(scale === 3 ? 4 : 3)} />
            <PixelButton small label={phase} accessibilityLabel="Change time of day" onPress={() => setPhase(PHASES[(PHASES.indexOf(phase) + 1) % 4])} />
            <PixelButton small label={biome} accessibilityLabel="Change biome" onPress={() => setBiome(BIOME_IDS[(BIOME_IDS.indexOf(biome) + 1) % 7])} />
            <PixelButton small label={reduced ? 'still' : 'motion'} accessibilityLabel="Toggle reduced motion" onPress={() => setReduced(!reduced)} />
          </View>

          {/* Stage: tilemap, sprites, lighting, particles, camera shake */}
          <Pressable onPress={hit} accessibilityRole="button" accessibilityLabel="Hit the boss">
            <PixelStage width={w} height={h} scale={scale} style={{ alignSelf: 'center', backgroundColor: PALETTES[biome].sky[1] }}>
              <Camera y={cam} shake={shake}>
                <Graded matrix={worldMatrix(phase)}>
                  <Tilemap atlas={biome} ground={ground} decor={decor} clock={clock}>
                    <AnimatedSprite id={`${bossId(biome)}.idle`} x={worldW / 2} y={h / scale - 2} clock={clock} flashUntil={flashUntil} />
                  </Tilemap>
                </Graded>
                <Lights items={lights} clock={clock} intensity={nightLight(phase)} />
                {!reduced && <Particles kind={PARTICLES[pk]} x={0} y={0} w={worldW} h={h / scale} count={24} clock={clock} startAt={burstAt} />}
              </Camera>
            </PixelStage>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 12, flexWrap: 'wrap' }}>
            <PixelButton small label={PARTICLES[pk]} accessibilityLabel="Next particle preset" onPress={() => setPk((pk + 1) % PARTICLES.length)} />
            <PixelButton small label="burst" accessibilityLabel="Play the burst" onPress={() => (burstAt.value = clock.value)} />
            <PixelButton small label="iris" accessibilityLabel="Play the iris wipe" onPress={() => wipe(iris, 1, 0)} />
            <PixelButton small label="dissolve" accessibilityLabel="Play the pixel dissolve" onPress={() => wipe(dissolve, 0, 1)} />
          </View>

          {/* Sprites in UI */}
          <PixelPanel tone="parchment" style={{ marginHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['icon.sword', 'icon.quill', 'icon.coin', 'icon.xp', 'icon.chest', 'icon.lock', 'icon.freeze', 'trophy.' + biome].map((id) => (
              <SpriteView key={id} id={id} scale={scale} />
            ))}
            <SpriteView id="prop.chest.closed" scale={scale} animate={!reduced} />
            <SpriteView id={['avatar.back.3', 'avatar.body', 'avatar.outfit.3', 'avatar.weapon.basic']} scale={scale} animate={!reduced} seq={[0, 1]} fps={2} />
          </PixelPanel>

          {/* UI primitives */}
          <View style={{ paddingHorizontal: 12, gap: 10 }}>
            <HPBar hp={hp} max={25} width={w - 24} reduced={reduced} label="Moss Slime health" />
            <XPBar value={(count % 100) / 100} width={w - 24} />
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <CountUp from={Math.max(0, count - 40)} to={count} reduced={reduced} color={QUI.goldLight} prefix="+" />
              <PixelButton small label="+40 XP" accessibilityLabel="Add forty XP" onPress={() => setCount(count + 40)} />
              <PixelButton small label="disabled" accessibilityLabel="A disabled button" onPress={() => {}} disabled />
            </View>
            <PixelPanel tone="wood">
              <PixelText color={QUI.white}>Wood panel, pixel text.</PixelText>
            </PixelPanel>
            {dialog ? (
              <DialogBox name="Aqyl" portrait="npc.sage" lines={['Focus is your blade.', 'Open a chest by ticking what you did.']} onDone={() => setDialog(false)} reduced={reduced} />
            ) : (
              <PixelButton label="Talk to Aqyl" accessibilityLabel="Open a dialog" onPress={() => setDialog(true)} />
            )}
          </View>
        </ScrollView>
        <IrisWipe progress={iris} scale={scale} />
        <PixelDissolve progress={dissolve} block={scale * 8} />
      </View>
    </Modal>
  );
}
