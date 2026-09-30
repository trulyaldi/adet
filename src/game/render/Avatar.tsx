// The avatar, the one way it is drawn everywhere. Both forms resolve their
// layers with resolveAvatarLayers and draw every layer from one position,
// one pose and one clock, so gear moves as one:
//   <Avatar>        its own small canvas (HUD portrait, character sheet, ceremonies)
//   <AvatarSprite>  inside the map's canvas, driven by shared values
//                   (`mode`: 0 idle (breathing), 1 walking, 2 kneeling)

import { Atlas, useRectBuffer, useRSXformBuffer } from '@shopify/react-native-skia';
import React, { memo, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import type { AvatarLayer } from '../../domain/game/avatar';
import { MAX_PIPS } from '../../domain/game/avatar';
import type { GearSlot } from '../../domain/items/types';
import { sprite } from '../assets/manifest';
import { AvatarAnimation, avatarLayers, AvatarLook, POSE } from '../avatar';
import { useAtlas } from './atlas';
import { NEAREST } from './pixel';
import { SpriteView } from './SpriteView';
import { QUEST_MS } from '../ui/motion';

/** Slow and calm: a nap breathes once every two seconds. */
const FPS: Record<AvatarAnimation, number> = { idle: 2, walk: 6, kneel: 1, cheer: 1, wave: 4, attack: 5, nap: 1, wake: 2, sit: 1 };
/** Where the pips float, in avatar pixels: above the right shoulder. */
const pipAt = (i: number) => ({ x: 13 + i * 4, y: 1 + (i % 2) });

export interface AvatarProps {
  /** Rank tier 0–6 (the outfit). */
  tier: number;
  gear: Partial<Record<GearSlot, string>>;
  /** Ascension loops (a star pip each, at most three). */
  stars?: number;
  animation?: AvatarAnimation;
  facing?: 'left' | 'right';
  /** Integer scale. */
  scale?: number;
  /** Only these layers (the rank ceremony's piece-by-piece reveal). */
  visibleLayers?: readonly AvatarLayer[];
  /** False holds a still frame (reduced motion, off screen). */
  animate?: boolean;
  accessibilityLabel?: string;
}

export const Avatar = memo(function Avatar({ tier, gear, stars = 0, animation = 'idle', facing = 'right', scale = 3, visibleLayers, animate = true, accessibilityLabel }: AvatarProps) {
  const s = Math.max(1, Math.round(scale));
  const vis = visibleLayers?.join(',');
  const gearKey = JSON.stringify(gear);
  const layers = useMemo(() => avatarLayers({ tier, gear }, visibleLayers), [tier, gearKey, vis]);
  const base = sprite('avatar.body');
  const seq = POSE[animation] as readonly number[];
  const moving = animate && seq.length > 1;
  const showPips = !visibleLayers || visibleLayers.includes('pip');
  const pips = showPips ? Math.max(0, Math.min(MAX_PIPS, Math.floor(stars))) : 0;
  const flip = facing === 'left';

  // Cheer: a small hop on the idle frame.
  const hop = useSharedValue(0);
  useEffect(() => {
    if (animation === 'cheer' && animate) hop.value = withRepeat(withSequence(withTiming(-2 * s, { duration: QUEST_MS.hop }), withTiming(0, { duration: 180 })), -1);
    else {
      cancelAnimation(hop);
      hop.value = 0;
    }
  }, [animation, animate, s, hop]);
  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hop.value }] }));

  return (
    <View
      style={{ width: base.w * s, height: base.h * s }}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
    >
      <Animated.View style={[{ width: base.w * s, height: base.h * s }, hopStyle]}>
        {layers.length > 0 && <SpriteView id={layers} scale={s} animate={moving} seq={moving ? [...seq] : undefined} frame={moving ? undefined : seq[0]} fps={FPS[animation]} flip={flip} />}
        {animation === 'wave' && (
          <SpriteView id="avatar.wave" scale={s} animate={animate} seq={animate ? [0, 1] : undefined} frame={animate ? undefined : 0} fps={FPS.wave} flip={flip} style={{ position: 'absolute', left: 0, top: 0 }} />
        )}
        {animation === 'nap' && animate && (
          <SpriteView id="fx.zzz" scale={s} animate style={{ position: 'absolute', left: (flip ? 1 : base.w - 7) * s, top: 0 }} />
        )}
        {Array.from({ length: pips }, (_, i) => {
          const p = pipAt(i);
          return <SpriteView key={i} id="avatar.pip" scale={s} style={{ position: 'absolute', left: (flip ? base.w - p.x - 5 : p.x) * s, top: p.y * s }} />;
        })}
      </Animated.View>
    </View>
  );
});

export const AvatarSprite = memo(function AvatarSprite({
  look,
  x,
  y,
  mode,
  clock,
  pips = 0,
}: {
  look: AvatarLook;
  x: SharedValue<number>;
  y: SharedValue<number>;
  mode: SharedValue<number>;
  clock: SharedValue<number>;
  /** Ascension star pips. */
  pips?: number;
}) {
  const image = useAtlas('shared');
  const layers = useMemo(() => avatarLayers(look), [look]);
  const data = useMemo(() => {
    const metas = layers.map((l) => sprite(l));
    const pip = sprite('avatar.pip');
    return { frames: metas.map((m) => m.frames), ax: metas[0].ax, ay: metas[0].ay, pip: pip.frames[0] };
  }, [layers]);
  const n = layers.length + Math.min(MAX_PIPS, pips);
  const nl = layers.length;
  const sprites = useRectBuffer(n, (r, i) => {
    'worklet';
    if (i >= nl) {
      r.setXYWH(data.pip[0], data.pip[1], data.pip[2], data.pip[3]);
      return;
    }
    const t = clock.value;
    const m = mode.value;
    const f = m === 2 ? 4 : m === 1 ? 2 + (Math.floor(t / 160) % 2) : Math.floor(t / 520) % 2;
    const fr = data.frames[i][Math.min(f, data.frames[i].length - 1)];
    r.setXYWH(fr[0], fr[1], fr[2], fr[3]);
  });
  const transforms = useRSXformBuffer(n, (xf, i) => {
    'worklet';
    const px = Math.round(x.value) - data.ax;
    const py = Math.round(y.value) - data.ay;
    if (i >= nl) {
      // Pips float above the right shoulder (pipAt, inlined for the worklet).
      xf.set(1, 0, px + 13 + (i - nl) * 4, py + 1 + ((i - nl) % 2));
      return;
    }
    xf.set(1, 0, px, py);
  });
  if (!image) return null;
  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={NEAREST} />;
});
