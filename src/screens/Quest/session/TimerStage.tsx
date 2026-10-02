// The timer Stage (the pixel redesign): the hero of the focus screen. One
// canvas draws the world as a clock (the skin, driven by today's time
// against the target), your character, and, when the session targets a
// quest (World Mode), that quest's enemy with its hearts above it.
//
// Two signals, one each: the skin shows the target, the hearts show the
// enemy. Time never damages it: only the result told after the session
// does (world-4). The result sheet draws this same Stage to play it: Done,
// a swing and the enemy falls; Partly, a swing, a flash and one heart pops.
//
// Calm: no sound, no haptics, nothing white or flashing, nothing red. The
// world runs on a stepped ~8 fps clock that stops while paused, dimmed, in
// the background or with reduced motion; the skin moves with the time, not
// the clock, so a relaunch draws the same picture.

import { Atlas, Canvas, Group, Rect, useRectBuffer, useRSXformBuffer } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SharedValue, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { useQuestMeta } from '../../../data/itemsRepo';
import { QUEST_HEARTS } from '../../../domain/game/balance';
import type { BiomeId } from '../../../domain/game/biomes';
import type { ColorMatrix } from '../../../domain/game/daylight';
import { nodeAt } from '../../../domain/game/derive';
import { gameStateOf } from '../../../domain/game/fromData';
import { encounterOf, SceneState, STAGE_TIMING, stageStep, StageState, TimerState } from '../../../domain/game/stage';
import type { TimerSkin } from '../../../domain/game/timerSkin';
import type { ResultEffect } from '../../../domain/world/target';
import { sprite } from '../../../game/assets/manifest';
import { avatarLayers, AvatarLook } from '../../../game/avatar';
import { BIOMES } from '../../../game/content/biomes';
import { PALETTES } from '../../../game/content/palettes';
import { useAtlas } from '../../../game/render/atlas';
import { useGameClock } from '../../../game/render/clock';
import { Graded } from '../../../game/render/Lighting';
import { Particles } from '../../../game/render/Particles';
import { NEAREST } from '../../../game/render/pixel';
import { AnimatedSprite } from '../../../game/render/Sprite';
import { SpriteBatch } from '../../../game/render/SpriteBatch';
import { QUEST_MS } from '../../../game/ui/motion';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { useData } from '../../../store/StreakStore';
import { mix } from '../../../theme/palette';
import { SkinProps } from './skins/common';
import { skinRenderer } from './skins';

const SCENE_CODE: Record<SceneState, number> = { fight: 0, defeat: 1, walkIn: 2, nap: 4, wake: 5, ended: 6 };
/** A soft warm tint for a hit (never white). */
const WARM: ColorMatrix = [1.18, 0, 0, 0, 0.1, 0, 0.96, 0, 0, 0.04, 0, 0, 0.72, 0, 0, 0, 0, 0, 1, 0];
/** The world's clock steps at 8 fps. */
const STEP_MS = 125;
/** A cheer: two small hops. */
const CHEER_MS = 900;
/** The Sage flies over once, this far into a session. */
const OWL_AFTER_SEC = 20 * 60;
const OWL_FLIGHT_MS = 7000;
/** A boss's phase pips: cleared ones in gold. */
const PIP_ON = '#f4c542';
/** Done: the swing lands, then the enemy falls. */
const KO_AFTER_MS = 450;

/** Habits the Sage has already flown over for, this app run (once per session, roughly). */
const owlFlown = new Set<string>();

export interface TimerStageProps {
  width: number;
  height: number;
  skin: TimerSkin;
  /** Today's time toward the target, 0…1 (see skinProgress). */
  progress: number;
  past: boolean;
  /** This session's focused seconds (the owl's cue). */
  sessionSec: number;
  /** The timer is paused: your character rests and the world goes dim and still. */
  paused: boolean;
  reduced: boolean;
  /** The clock may run (app in front, screen not dimmed). */
  live: boolean;
  /** Show the enemy and its hearts (a quest is targeted and the setting is on). */
  battle: boolean;
  /** Bumped when the target is reached: a one-shot cheer. */
  payoff: number;
  /** Done was pressed: a short victory pose before the chest. */
  victory: boolean;
  /** The quest's enemy on stage (null: a free session, no enemy). */
  target?: StageTarget | null;
  /** The result sheet: what the told result does, played once. */
  reaction?: ResultEffect | null;
  /** QA: hold one scene. */
  force?: SceneState;
}

/** The enemy a session fights: its sprite from the realm's biome, and its hearts. */
export interface StageTarget {
  biome: BiomeId;
  /** The sprite's base id (mob or boss). */
  enemyId: string;
  boss: boolean;
  name: string;
  hearts: number;
  /** A boss's phases (pips under the hearts). */
  phases: { cleared: number; total: number } | null;
}

export default function TimerStage({ width, height, skin, progress, past, sessionSec, paused, reduced, live, battle, payoff, victory, target, reaction, force }: TimerStageProps) {
  const data = useData();
  const meta = useQuestMeta();
  const active = data.active;
  const timer: TimerState = !active ? 'ended' : paused ? 'paused' : 'running';
  // The scene (nap, wake…) only; the legacy journey no longer moves, so its encounter stays put.
  const game = gameStateOf(data);
  const enc = encounterOf(game);
  const at = active?.startedAt ?? Date.now();

  // The scene machine: stepped when its inputs change and when a timed scene ends.
  const [stage, setStage] = useState<StageState>(() => stageStep(null, timer, enc, at));
  const [tick, setTick] = useState(0);
  const encKey = `${enc.global}:${enc.hp}`;
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
  // Done on the result sheet: the swing lands, then the enemy falls.
  const [ko, setKo] = useState(false);
  useEffect(() => {
    if (reaction !== 'cleared') return;
    const t = setTimeout(() => setKo(true), reduced ? 0 : KO_AFTER_MS);
    return () => clearTimeout(t);
  }, [reaction, reduced]);
  const scene: SceneState = force ?? (ko ? 'defeat' : reduced ? (timer === 'paused' ? 'nap' : 'fight') : stage.scene);
  // Free sessions keep the scenery of the journey's (now still) node.
  const shown = reduced ? enc : stage.enemy;

  // Shared values the canvas reads. The clock runs for a victory even while paused.
  const clock = useGameClock(!reduced && ((live && !paused) || victory), STEP_MS);
  const sceneCode = useSharedValue(SCENE_CODE[scene]);
  const since = useSharedValue(0);
  const attackAt = useSharedValue(-1e9);
  const cheerAt = useSharedValue(-1e9);
  const owlAt = useSharedValue(-1e9);
  const dusk = useSharedValue(scene === 'nap' ? STAGE_TIMING.napDusk : 0);
  useEffect(() => {
    sceneCode.value = SCENE_CODE[scene];
    since.value = clock.value;
    dusk.value = reduced ? (scene === 'nap' ? STAGE_TIMING.napDusk : 0) : withTiming(scene === 'nap' ? STAGE_TIMING.napDusk : 0, { duration: QUEST_MS.light });
  }, [scene, reduced, clock, sceneCode, since, dusk]);

  // A swing for a Done or a Partly (time alone never hits).
  useEffect(() => {
    if (reduced || (reaction !== 'cleared' && reaction !== 'heart')) return;
    attackAt.value = clock.value;
  }, [reaction, reduced, clock, attackAt]);

  // One-shot cheers: reaching the target, and Done.
  const firstPayoff = useRef(payoff);
  useEffect(() => {
    if (reduced || (payoff === firstPayoff.current && !victory)) return;
    cheerAt.value = clock.value;
  }, [payoff, victory, reduced, clock, cheerAt]);

  // The Sage flies over once, twenty minutes in.
  const owlKey = active?.habitId ?? '';
  const owlDue = !reduced && live && !paused && sessionSec >= OWL_AFTER_SEC && !owlFlown.has(owlKey);
  useEffect(() => {
    if (!owlDue) return;
    owlFlown.add(owlKey);
    owlAt.value = clock.value;
  }, [owlDue, owlKey, clock, owlAt]);

  // The world: a fixed pixel scale for the whole Stage.
  const b: BiomeId = target?.biome ?? nodeAt(shown.global).biome;
  const boss = !!target?.boss;
  const fight = battle && !!target;
  const scale = Math.max(2, Math.min(5, Math.floor(Math.min(height / 64, width / 96))));
  const worldW = Math.floor(width / scale);
  const worldH = Math.floor(height / scale);
  const horizon = Math.round(worldH * 0.62);
  const look: AvatarLook = { tier: game.rank.tier, gear: meta?.props.avatar.gear ?? {} };
  const name = target?.name ?? '';
  const renderer = skinRenderer(skin);
  const skinProps: SkinProps = { biome: b, worldW, worldH, horizon, progress, past, clock, reduced };
  const heroX = Math.round(worldW * 0.24);

  const [named, setNamed] = useState(false);
  const namedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (namedTimer.current && clearTimeout(namedTimer.current)), []);
  const tap = () => {
    setNamed(true);
    if (namedTimer.current) clearTimeout(namedTimer.current);
    namedTimer.current = setTimeout(() => setNamed(false), 2500);
  };
  const pose = scene === 'nap' ? 'resting' : scene === 'wake' ? 'stretching' : victory ? 'cheering' : fight ? 'fighting' : 'standing ready';
  const label = [
    renderer.say(progress, past),
    fight && target ? `${name}, ${target.hearts} of ${QUEST_HEARTS} hearts` : null,
    `Your character, ${pose}`,
  ]
    .filter(Boolean)
    .join('. ');

  const { Back, Mid, Front } = renderer;
  return (
    <Pressable
      onPress={fight ? tap : undefined}
      accessibilityRole={fight ? 'button' : 'image'}
      accessibilityLabel={label}
      accessibilityHint={fight ? "Shows the quest's name" : undefined}
      style={{ width, height, borderRadius: 8, overflow: 'hidden' }}
    >
      <Canvas style={{ width, height }}>
        <Group transform={[{ scale }]}>
          <Back {...skinProps} />
          <Hills biome={b} worldW={worldW} worldH={worldH} horizon={horizon} shift={renderer.farShift?.(progress) ?? 0} clock={clock} />
          {Mid && <Mid {...skinProps} />}
          <Ground biome={b} worldW={worldW} worldH={worldH} />
          {Front && <Front {...skinProps} />}
          {!reduced && <Ambient biome={b} kind={renderer.ambient} worldW={worldW} horizon={horizon} clock={clock} />}
          <StageAvatar look={look} x={heroX} y={worldH - 4} clock={clock} scene={sceneCode} since={since} attackAt={attackAt} cheerAt={cheerAt} />
          {scene === 'nap' && <SpriteBatch atlas="shared" items={[{ id: 'fx.zzz', x: heroX + 8, y: worldH - 24 }]} clock={reduced ? undefined : clock} />}
          {!reduced && <Particles kind="sparkle" x={heroX - 8} y={worldH - 40} w={16} h={14} count={10} clock={clock} startAt={cheerAt} />}
          {fight && target && !(reduced && ko) && <Enemy id={target.enemyId} boss={boss} worldW={worldW} worldH={worldH} scene={scene} clock={clock} since={since} attackAt={attackAt} reduced={reduced} biome={b} hearts={target.hearts} popped={reaction === 'heart'} phases={target.phases} />}
          {!reduced && <Owl worldW={worldW} y={Math.max(18, Math.round(horizon * 0.5))} clock={clock} owlAt={owlAt} />}
          <Rect x={0} y={0} width={worldW} height={worldH} color="#2a2350" opacity={dusk} />
          <Rect x={0} y={0} width={worldW} height={worldH} color="#ffb46a" opacity={0.05} />
        </Group>
      </Canvas>
      {fight && named && (
        <View style={{ position: 'absolute', top: 8, right: 10, alignItems: 'flex-end', gap: 4, pointerEvents: 'none' }}>
          <PixelText size="tiny" color={QUI.ink} numberOfLines={1}>
            {name}
          </PixelText>
        </View>
      )}
    </Pressable>
  );
}

/** Far hills (and clouds), scrolled by the skin and drifting slowly with the clock. */
function Hills({ biome, worldW, worldH, horizon, shift, clock }: { biome: BiomeId; worldW: number; worldH: number; horizon: number; shift: number; clock: SharedValue<number> }) {
  const far = useMemo(() => {
    const out = [];
    for (let i = 0; i * 44 < worldW + 132; i++) out.push({ id: `parallax.${biome}.far.${i % 2 ? 'a' : 'b'}`, x: 16 + i * 44, y: horizon + 10 });
    return out;
  }, [biome, worldW, horizon]);
  const farT = useDerivedValue(() => [{ translateX: -((Math.round(clock.value / 4000) + shift) % 88) }]);
  const cloudT = useDerivedValue(() => [{ translateX: -Math.round(clock.value / 1500) % (worldW + 40) }]);
  // The ground's colour fills from the hills down, under the tiles.
  const pal = PALETTES[biome];
  return (
    <Group>
      <Group transform={cloudT}>
        <SpriteBatch atlas={biome} items={[{ id: `parallax.${biome}.cloud`, x: Math.round(worldW * 0.72), y: 12 }, { id: `parallax.${biome}.cloud`, x: worldW + 30, y: 20 }]} />
      </Group>
      <Rect x={0} y={horizon + 8} width={worldW} height={worldH} color={mix(pal.ground[2], pal.sky[1], 0.35)} />
      <Group transform={farT}>
        <SpriteBatch atlas={biome} items={far} />
      </Group>
    </Group>
  );
}

function Ground({ biome, worldW, worldH }: { biome: BiomeId; worldW: number; worldH: number }) {
  const ground = useMemo(() => {
    const out = [];
    for (let x = 0; x < worldW + 16; x += 16) out.push({ id: `tile.${biome}.ground.${'abc'[(x / 16) % 3]}`, x: x + 8, y: worldH + 8 });
    return out;
  }, [biome, worldW, worldH]);
  return <SpriteBatch atlas={biome} items={ground} />;
}

/** The biome's own drifting particles: up to two kinds (leaves, snow, embers, sand, stars…). */
function Ambient({ biome, kind, worldW, horizon, clock }: { biome: BiomeId; kind: 'day' | 'night'; worldW: number; horizon: number; clock: SharedValue<number> }) {
  const kinds = BIOMES[biome].ambient[kind].slice(0, 2);
  return (
    <Group>
      {kinds.map((k, i) => (
        <Particles key={k} kind={k} x={0} y={0} w={worldW} h={horizon + 20} count={i ? 4 : 7} clock={clock} intensity={0.7} />
      ))}
    </Group>
  );
}

/** The Sage, crossing the sky once (an easter egg). */
function Owl({ worldW, y, clock, owlAt }: { worldW: number; y: number; clock: SharedValue<number>; owlAt: SharedValue<number> }) {
  const ox = useDerivedValue(() => {
    const k = (clock.value - owlAt.value) / OWL_FLIGHT_MS;
    return k < 0 || k > 1 ? -40 : Math.round(-12 + (worldW + 24) * k);
  });
  const oy = useDerivedValue(() => y + (Math.floor(clock.value / 500) % 2));
  return <AnimatedSprite id="npc.sage.idle@flip" x={ox} y={oy} clock={clock} />;
}

/** The avatar's layers in one Atlas draw, posed from the scene on the UI thread. */
function StageAvatar({ look, x, y, clock, scene, since, attackAt, cheerAt }: { look: AvatarLook; x: number; y: number; clock: SharedValue<number>; scene: SharedValue<number>; since: SharedValue<number>; attackAt: SharedValue<number>; cheerAt: SharedValue<number> }) {
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
    let f = Math.floor(t / 500) % 2; // breathing, two frames
    if (s === 4) f = 7 + (Math.floor(t / 2000) % 2); // resting: slow breaths
    else if (s === 5) f = t - since.value < wakeMs * 0.6 ? 9 : 0; // stretching: half up, then standing
    else {
      const dt = t - attackAt.value;
      if (dt >= 0 && dt < 250) f = 5;
      else if (dt >= 250 && dt < 500) f = 6;
    }
    const fr = data.frames[i][Math.min(f, data.frames[i].length - 1)];
    r.setXYWH(fr[0], fr[1], fr[2], fr[3]);
  });
  const transforms = useRSXformBuffer(n, (xf) => {
    'worklet';
    let hop = 0;
    const t = clock.value;
    // A cheer: two small hops (the target, Done, or the enemy starting to fade).
    const c = t - cheerAt.value;
    const d = scene.value === 1 ? t - since.value - 500 : -1;
    const k = c >= 0 && c < CHEER_MS ? c : d >= 0 && d < 800 ? d : -1;
    if (k >= 0) hop = -Math.round(Math.abs(Math.sin(k / 130)) * 2);
    xf.set(1, 0, x - data.ax, y - data.ay + hop);
  });
  if (!image) return null;
  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={NEAREST} />;
}

/** The enemy: idle, a soft recoil and warm tint when hit; dissolving. Its hearts ride above it (a boss's phase pips under them). */
function Enemy({ id, boss, worldW, worldH, scene, clock, since, attackAt, reduced, biome, hearts, popped, phases }: { id: string; boss: boolean; worldW: number; worldH: number; scene: SceneState; clock: SharedValue<number>; since: SharedValue<number>; attackAt: SharedValue<number>; reduced: boolean; biome: BiomeId; hearts: number; popped: boolean; phases: { cleared: number; total: number } | null }) {
  const home = worldW - (boss ? 30 : 24);
  const feet = worldH - 4;
  const pose = `${id}.idle`;
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
    const dt = t - attackAt.value - 250;
    return home + (dt >= 0 && dt < 250 ? 1 : 0);
  });
  const y = useDerivedValue(() => (code === 2 ? feet - (Math.floor(clock.value / 250) % 2) : feet));
  const opacity = useDerivedValue(() => {
    if (code !== 1) return 1;
    const dt = clock.value - since.value - 300;
    return dt <= 0 ? 1 : Math.max(0, 1 - dt / 900);
  });
  const tint = useDerivedValue(() => {
    const dt = clock.value - attackAt.value - 250;
    return dt >= 0 && dt < 375 ? 0.55 * (1 - dt / 375) : 0;
  });
  const petalsAt = useDerivedValue(() => since.value + 300);
  const coinAt = useDerivedValue(() => since.value + 1000);
  const coinY = useDerivedValue(() => feet - m.h - 2 - Math.min(8, Math.max(0, (clock.value - since.value - 1000) / 90)));
  const coinOpacity = useDerivedValue(() => {
    const dt = clock.value - since.value - 1000;
    return code === 1 && dt >= 0 && dt < 1200 ? 1 - dt / 1200 : 0;
  });
  const hitAt = useDerivedValue(() => attackAt.value + 250);
  const embers = rgb(PALETTES[biome].accentA[1]);
  // Hearts anchored above the enemy (they follow it in and fade with it). A
  // Partly pops the last full one just as the swing lands.
  const pal = PALETTES[biome];
  const heart = sprite('icon.heart');
  const rowW = QUEST_HEARTS * (heart.w + 1) - 1;
  const barT = useDerivedValue(() => [{ translateX: x.value - home }]);
  const rowX = home - Math.round(rowW / 2);
  const pipsH = phases ? 3 : 0;
  const rowY = feet - m.h - heart.h - 2 - pipsH;
  const full = popped ? hearts - 1 : hearts;
  const popT = useDerivedValue(() => {
    const dt = clock.value - attackAt.value - 250;
    return [{ translateY: popped && !reduced && dt >= 0 ? -Math.min(4, Math.floor(dt / 80)) : 0 }];
  });
  const popOpacity = useDerivedValue(() => {
    if (reduced) return 0.3;
    const dt = clock.value - attackAt.value - 250;
    return dt < 0 ? 1 : Math.max(0.3, 1 - dt / 500);
  });
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
        <Group transform={barT}>
          {Array.from({ length: QUEST_HEARTS }, (_, i) => {
            const hx = rowX + i * (heart.w + 1) + heart.ax;
            const hy = rowY + heart.ay;
            if (popped && i === full) {
              return (
                <Group key={i} opacity={popOpacity} transform={popT}>
                  <AnimatedSprite id="icon.heart" x={hx} y={hy} clock={clock} />
                </Group>
              );
            }
            return (
              <Group key={i} opacity={i < full ? 1 : 0.3}>
                <AnimatedSprite id="icon.heart" x={hx} y={hy} clock={clock} />
              </Group>
            );
          })}
          {phases &&
            Array.from({ length: phases.total }, (_, i) => (
              <Rect key={`p${i}`} x={home - Math.round((phases.total * 3 - 1) / 2) + i * 3} y={feet - m.h - 3} width={2} height={2} color={i < phases.cleared ? PIP_ON : mix(pal.outline, PIP_ON, 0.25)} />
            ))}
        </Group>
      </Group>
      {!reduced && scene !== 'defeat' && scene !== 'walkIn' && <AnimatedSprite id="fx.hit" x={home - 2} y={feet - Math.round(m.h / 2)} clock={clock} startAt={hitAt} transient />}
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
