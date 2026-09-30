// The Stage (v2 N6): a small, warm pixel scene on the timer screen. Your
// character fights the current enemy with a gentle swing every 4–6 seconds,
// naps while the timer is paused and wakes when it resumes; an enemy the
// preview beats dissolves into warm petals and the next one walks in; a boss
// without its seals kneels, dazed. Presentation only: the numbers come from a
// live preview of the session through the game's own rules (domain/game/stage),
// and the real outcome is worked out when the session is saved.
//
// Calm: no sound, no haptics, nothing white or flashing, nothing full-frame.
// One canvas, shared values for motion, React state only when the scene
// changes; the clock stops with reduced motion, a dimmed screen or the app in
// the background.

import { Atlas, Canvas, Group, Rect, useRectBuffer, useRSXformBuffer } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SharedValue, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { useQuestMeta } from '../../../data/itemsRepo';
import { NODE_MOBS } from '../../../domain/game/balance';
import type { BiomeId } from '../../../domain/game/biomes';
import type { ColorMatrix } from '../../../domain/game/daylight';
import { nodeAt } from '../../../domain/game/derive';
import { gameInput } from '../../../domain/game/fromData';
import { dkey } from '../../../domain/time';
import { attackGap, encounterOf, liveSession, previewGame, SceneState, STAGE_TIMING, stageStep, StageState, TimerState } from '../../../domain/game/stage';
import { sprite } from '../../../game/assets/manifest';
import { avatarLayers, AvatarLook } from '../../../game/avatar';
import { BIOMES } from '../../../game/content/biomes';
import { PALETTES } from '../../../game/content/palettes';
import { bossId, mobId, ROSTER } from '../../../game/content/roster';
import { useAtlas } from '../../../game/render/atlas';
import { useGameClock } from '../../../game/render/clock';
import { Graded } from '../../../game/render/Lighting';
import { Particles } from '../../../game/render/Particles';
import { NEAREST } from '../../../game/render/pixel';
import { AnimatedSprite } from '../../../game/render/Sprite';
import { SpriteBatch } from '../../../game/render/SpriteBatch';
import { HPBar } from '../../../game/ui/HPBar';
import { PixelText } from '../../../game/ui/PixelText';
import { SealPips, sealsLabel } from '../../../game/ui/SealPips';
import { QUI } from '../../../game/ui/theme';
import { useData } from '../../../store/StreakStore';

const SCENE_CODE: Record<SceneState, number> = { fight: 0, defeat: 1, walkIn: 2, stagger: 3, nap: 4, wake: 5, ended: 6 };
/** A soft warm tint for a hit (never white). */
const WARM: ColorMatrix = [1.18, 0, 0, 0, 0.1, 0, 0.96, 0, 0, 0.04, 0, 0, 0.72, 0, 0, 0, 0, 0, 1, 0];
const HP_ROW = 16;
const SEAL_ROW = 24;

export interface StageProps {
  width: number;
  /** Total height, the HP bar and seal row included. */
  height: number;
  /** Short screens: a slim strip (scene left, bars right). */
  slim: boolean;
  /** The clock may run (app in front, screen not dimmed). */
  live: boolean;
  reduced: boolean;
  /** QA: hold one scene. */
  force?: SceneState;
}

export default function Stage({ width, height, slim, live, reduced, force }: StageProps) {
  const data = useData();
  const meta = useQuestMeta();
  const active = data.active;
  const timer: TimerState = !active ? 'ended' : active.startedAt ? 'running' : 'paused';
  // The preview moves once a focused minute (damage is per minute): the clock
  // is checked every 5 s, and the game is derived again only when the minute turns.
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000) * 60_000);
  useEffect(() => {
    if (timer !== 'running') return;
    const t = setInterval(() => setMinute(Math.floor(Date.now() / 60_000) * 60_000), 5000);
    return () => clearInterval(t);
  }, [timer]);
  const at = Math.max(minute, active?.startedAt ?? 0);
  const game = useMemo(() => previewGame(gameInput(data, 0, undefined, dkey(new Date(at))), liveSession(active, at)), [data, active, at]);
  const enc = encounterOf(game);

  // The scene machine: stepped when its inputs change and when a timed scene ends.
  const [stage, setStage] = useState<StageState>(() => stageStep(null, timer, enc, at));
  const [tick, setTick] = useState(0);
  const encKey = `${enc.global}:${enc.hp}:${enc.staggered}`;
  useEffect(() => {
    // Stepping a state machine from new inputs: the one place the scene moves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStage((s) => stageStep(s, timer, enc, Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, encKey, tick]);
  useEffect(() => {
    const left = stage.scene === 'defeat' ? STAGE_TIMING.defeatMs : stage.scene === 'walkIn' ? STAGE_TIMING.walkInMs : stage.scene === 'wake' ? STAGE_TIMING.wakeMs : 0;
    if (!left) return;
    const t = setTimeout(() => setTick((n) => n + 1), Math.max(0, stage.since + left - Date.now()) + 20);
    return () => clearTimeout(t);
  }, [stage]);
  const scene: SceneState = force ?? (reduced ? (stage.scene === 'nap' || stage.scene === 'stagger' ? stage.scene : timer === 'paused' ? 'nap' : 'fight') : stage.scene);
  // On stage: the machine's enemy (the falling one during a defeat); with reduced motion, simply the current one.
  const shown = force === 'stagger' ? { ...stage.enemy, hp: 0, staggered: true } : reduced ? enc : stage.enemy;

  // Shared values the canvas reads.
  const clock = useGameClock(live && !reduced);
  const sceneCode = useSharedValue(SCENE_CODE[scene]);
  const since = useSharedValue(0);
  const attackAt = useSharedValue(-1e9);
  const dusk = useSharedValue(scene === 'nap' ? STAGE_TIMING.napDusk : 0);
  useEffect(() => {
    sceneCode.value = SCENE_CODE[scene];
    since.value = clock.value;
    dusk.value = reduced ? (scene === 'nap' ? STAGE_TIMING.napDusk : 0) : withTiming(scene === 'nap' ? STAGE_TIMING.napDusk : 0, { duration: 1200 });
  }, [scene, reduced, clock, sceneCode, since, dusk]);
  // A gentle swing every 4–6 s while fighting (clock time, no React state).
  useEffect(() => {
    if (reduced || !live || (scene !== 'fight' && scene !== 'stagger')) return;
    let n = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        attackAt.value = clock.value;
        n++;
        next();
      }, attackGap(n));
    };
    next();
    return () => clearTimeout(t);
  }, [scene, reduced, live, clock, attackAt]);

  // Layout: the canvas, then the HP bar and seal pips (fixed rows: no layout shift).
  const node = nodeAt(shown.global);
  const b = node.biome;
  const boss = node.kind === 'boss';
  const canvasW = slim ? Math.round(width * 0.58) : width;
  const canvasH = slim ? height : height - HP_ROW - SEAL_ROW - 8;
  const scale = Math.max(1, Math.min(4, Math.floor(canvasH / (boss ? 70 : 36))));
  const worldW = Math.floor(canvasW / scale);
  const worldH = Math.floor(canvasH / scale);
  const look: AvatarLook = { tier: game.rank.tier, gear: meta?.props.avatar.gear ?? {} };
  const mob = ROSTER[b].mobs[Math.max(0, NODE_MOBS[node.node] as number)];
  const name = boss ? ROSTER[b].boss.name : mob.name;
  const enemyBase = boss ? bossId(b) : mobId(b, mob.key);
  const [named, setNamed] = useState(false);
  const namedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (namedTimer.current && clearTimeout(namedTimer.current)), []);
  const tap = () => {
    setNamed(true);
    if (namedTimer.current) clearTimeout(namedTimer.current);
    namedTimer.current = setTimeout(() => setNamed(false), 2500);
  };
  const label = `${name}, ${Math.ceil(shown.hp)} of ${shown.maxHp} health${shown.staggered ? ', staggered' : ''}. ${sealsLabel(shown.seals)}. Your character, ${scene === 'nap' ? 'napping' : scene === 'wake' ? 'waking up' : 'fighting'}`;

  const bars = (
    <View style={{ gap: 4, flex: slim ? 1 : undefined, justifyContent: 'center' }}>
      <View style={{ height: HP_ROW, justifyContent: 'center' }}>
        <HPBar hp={shown.hp} max={shown.maxHp} width={slim ? width - canvasW - 12 : width} segments={boss ? 16 : 10} reduced={reduced} label={`${name} health`} />
      </View>
      <View style={{ height: SEAL_ROW, justifyContent: 'center' }}>
        {named ? (
          <PixelText size="tiny" color={QUI.ink} numberOfLines={1}>
            {name}
          </PixelText>
        ) : null}
        {boss && <SealPips seals={shown.seals} counts={named} />}
      </View>
    </View>
  );

  return (
    <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Shows the enemy's name and seals" style={{ width, height, flexDirection: slim ? 'row' : 'column', gap: slim ? 12 : 8 }}>
      <View style={{ width: canvasW, height: canvasH, overflow: 'hidden', borderRadius: 6 }}>
        <Canvas style={{ width: canvasW, height: canvasH }}>
          <Group transform={[{ scale }]}>
            <Backdrop biome={b} worldW={worldW} worldH={worldH} clock={clock} reduced={reduced} />
            <StageAvatar look={look} x={Math.round(worldW * 0.26)} y={worldH - 4} clock={clock} scene={sceneCode} since={since} attackAt={attackAt} />
            <Enemy id={enemyBase} boss={boss} worldW={worldW} worldH={worldH} scene={scene} clock={clock} since={since} attackAt={attackAt} reduced={reduced} biome={b} />
            {scene === 'nap' && !reduced && <SpriteBatch atlas="shared" items={[{ id: 'fx.zzz', x: Math.round(worldW * 0.26) + 8, y: worldH - 24 }]} clock={clock} />}
            <Rect x={0} y={0} width={worldW} height={worldH} color="#2a2350" opacity={dusk} />
            <Rect x={0} y={0} width={worldW} height={worldH} color="#ffb46a" opacity={0.06} />
          </Group>
        </Canvas>
      </View>
      {bars}
    </Pressable>
  );
}

/** Sky, far hills (slow parallax), clouds and ground; sparse ambient particles. */
function Backdrop({ biome, worldW, worldH, clock, reduced }: { biome: BiomeId; worldW: number; worldH: number; clock: SharedValue<number>; reduced: boolean }) {
  const pal = PALETTES[biome];
  const ground = useMemo(() => {
    const out = [];
    for (let x = 0; x < worldW + 16; x += 16) out.push({ id: `tile.${biome}.ground.${'abc'[(x / 16) % 3]}`, x: x + 8, y: worldH + 8 });
    return out;
  }, [biome, worldW, worldH]);
  const far = useMemo(() => [0, 1, 2].map((i) => ({ id: `parallax.${biome}.far.${i % 2 ? 'a' : 'b'}`, x: 16 + i * 44, y: worldH - 6 })), [biome, worldH]);
  // Far hills drift a pixel every few seconds; clouds a little faster.
  const farT = useDerivedValue(() => [{ translateX: -Math.round(clock.value / 4000) % 44 }]);
  const cloudT = useDerivedValue(() => [{ translateX: -Math.round(clock.value / 1500) % (worldW + 40) }]);
  const ambient = BIOMES[biome].ambient.day[0];
  return (
    <Group>
      <Rect x={0} y={0} width={worldW} height={worldH} color={pal.sky[0]} />
      <Rect x={0} y={Math.round(worldH * 0.55)} width={worldW} height={worldH} color={pal.sky[1]} opacity={0.6} />
      <Group transform={cloudT}>
        <SpriteBatch atlas={biome} items={[{ id: `parallax.${biome}.cloud`, x: Math.round(worldW * 0.7), y: 10 }, { id: `parallax.${biome}.cloud`, x: worldW + 30, y: 16 }]} />
      </Group>
      <Group transform={farT}>
        <SpriteBatch atlas={biome} items={[...far, ...far.map((f) => ({ ...f, x: f.x + 132 }))]} />
      </Group>
      <SpriteBatch atlas={biome} items={ground} />
      {!reduced && ambient && <Particles kind={ambient} x={0} y={0} w={worldW} h={worldH - 8} count={6} clock={clock} intensity={0.7} />}
    </Group>
  );
}

/** The avatar's layers in one Atlas draw, posed from the scene on the UI thread. */
function StageAvatar({ look, x, y, clock, scene, since, attackAt }: { look: AvatarLook; x: number; y: number; clock: SharedValue<number>; scene: SharedValue<number>; since: SharedValue<number>; attackAt: SharedValue<number> }) {
  const image = useAtlas('shared');
  const layers = useMemo(() => avatarLayers(look), [look]);
  const data = useMemo(() => {
    const metas = layers.map((l) => sprite(l));
    return { frames: metas.map((m) => m.frames), ax: metas[0].ax, ay: metas[0].ay };
  }, [layers]);
  const n = layers.length;
  const wakeMs = STAGE_TIMING.wakeMs;
  const sprites = useRectBuffer(n, (r, i) => {
    'worklet';
    const t = clock.value;
    const s = scene.value;
    let f = Math.floor(t / 600) % 2; // breathing
    if (s === 4) f = 7 + (Math.floor(t / 2000) % 2); // nap: slow breaths
    else if (s === 5) f = t - since.value < wakeMs * 0.6 ? 9 : 0; // wake: half up, then standing
    else {
      const dt = t - attackAt.value;
      if (dt >= 0 && dt < 200) f = 5;
      else if (dt >= 200 && dt < 420) f = 6;
    }
    const fr = data.frames[i][Math.min(f, data.frames[i].length - 1)];
    r.setXYWH(fr[0], fr[1], fr[2], fr[3]);
  });
  const transforms = useRSXformBuffer(n, (xf) => {
    'worklet';
    let hop = 0;
    // Defeat: a small cheer (two hops) once the enemy starts to fade.
    if (scene.value === 1) {
      const dt = clock.value - since.value;
      if (dt > 500 && dt < 1300) hop = -Math.round(Math.abs(Math.sin((dt - 500) / 130)) * 2);
    }
    xf.set(1, 0, x - data.ax, y - data.ay + hop);
  });
  if (!image) return null;
  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={NEAREST} />;
}

/** The enemy: idle, a soft recoil and warm tint when hit; stagger; dissolving; walking in. */
function Enemy({ id, boss, worldW, worldH, scene, clock, since, attackAt, reduced, biome }: { id: string; boss: boolean; worldW: number; worldH: number; scene: SceneState; clock: SharedValue<number>; since: SharedValue<number>; attackAt: SharedValue<number>; reduced: boolean; biome: BiomeId }) {
  const home = worldW - (boss ? 30 : 22);
  const feet = worldH - 4;
  const pose = scene === 'stagger' && boss ? `${id}.low` : `${id}.idle`;
  const m = sprite(pose);
  const walkMs = STAGE_TIMING.walkInMs;
  const code = SCENE_CODE[scene];
  const x = useDerivedValue(() => {
    const t = clock.value;
    if (code === 2) {
      const p = Math.min(1, (t - since.value) / walkMs);
      return Math.round(home + (1 - p) * (worldW - home + m.w));
    }
    // A soft recoil just after the swing lands.
    const dt = t - attackAt.value - 200;
    return home + (dt >= 0 && dt < 160 ? 1 : 0);
  });
  const y = useDerivedValue(() => (code === 2 ? feet - (Math.floor(clock.value / 180) % 2) : feet));
  const opacity = useDerivedValue(() => {
    if (code !== 1) return 1;
    const dt = clock.value - since.value - 300;
    return dt <= 0 ? 1 : Math.max(0, 1 - dt / 900);
  });
  const tint = useDerivedValue(() => {
    const dt = clock.value - attackAt.value - 200;
    return dt >= 0 && dt < 220 ? 0.55 * (1 - dt / 220) : 0;
  });
  const petalsAt = useDerivedValue(() => since.value + 300);
  const coinAt = useDerivedValue(() => since.value + 1000);
  const coinY = useDerivedValue(() => feet - m.h - 2 - Math.min(8, Math.max(0, (clock.value - since.value - 1000) / 90)));
  const coinOpacity = useDerivedValue(() => {
    const dt = clock.value - since.value - 1000;
    return code === 1 && dt >= 0 && dt < 1200 ? 1 - dt / 1200 : 0;
  });
  const hitAt = useDerivedValue(() => attackAt.value + 200);
  const embers = rgb(PALETTES[biome].accentA[1]);
  return (
    <Group>
      <Group opacity={opacity}>
        <AnimatedSprite id={pose} x={x} y={y} clock={clock} />
        {!reduced && (
          <Group opacity={tint}>
            <Graded matrix={WARM}>
              <AnimatedSprite id={pose} x={x} y={y} clock={clock} />
            </Graded>
          </Group>
        )}
      </Group>
      {scene === 'stagger' && <SpriteBatch atlas="shared" items={[{ id: 'fx.dazed', x: home, y: feet - m.h + 6 }]} clock={reduced ? undefined : clock} />}
      {!reduced && (scene === 'fight' || scene === 'stagger') && <AnimatedSprite id="fx.hit" x={home - 2} y={feet - Math.round(m.h / 2)} clock={clock} startAt={hitAt} transient />}
      {!reduced && scene === 'defeat' && (
        <>
          <Particles kind="dissolve" x={home - m.w / 2 + 2} y={feet - m.h + 2} w={m.w - 4} h={m.h - 4} count={boss ? 50 : 24} clock={clock} startAt={petalsAt} tint={embers} />
          <Particles kind="sparkle" x={home - 8} y={feet - m.h - 10} w={16} h={12} count={10} clock={clock} startAt={coinAt} />
          <Group opacity={coinOpacity}>
            <AnimatedSprite id="icon.coin" x={home} y={coinY} clock={clock} />
          </Group>
        </>
      )}
    </Group>
  );
}

function rgb(h: string): [number, number, number] {
  const v = parseInt(h.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
