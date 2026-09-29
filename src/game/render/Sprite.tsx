// One animated sprite that can move: the avatar walking, a chest bouncing, a
// boss taking a hit. Position, facing and flash are shared values, so motion
// runs on the UI thread. Positions snap to the game-pixel grid.

import { Atlas, Group, useRectBuffer, useRSXformBuffer } from '@shopify/react-native-skia';
import React, { memo, useMemo } from 'react';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

import { AtlasName, sprite } from '../assets/manifest';
import { useAtlas } from './atlas';
import { NEAREST } from './pixel';

type Num = number | SharedValue<number>;
type Bool = boolean | SharedValue<boolean>;

export interface AnimatedSpriteProps {
  id: string;
  atlas?: AtlasName;
  x: Num;
  y: Num;
  clock: SharedValue<number>;
  /** Override the sprite's own fps. */
  fps?: number;
  /** Play once from this clock time, then hold the last frame. */
  startAt?: Num;
  flip?: Bool;
  /** Show the white silhouette while clock < flashUntil (one hit-flash frame). */
  flashUntil?: SharedValue<number>;
  opacity?: Num;
  /** Integer upscale inside the world (1 = world density). */
  scale?: number;
}

type Rect4 = [number, number, number, number];

export const AnimatedSprite = memo(function AnimatedSprite(p: AnimatedSpriteProps) {
  const base = sprite(p.id);
  const atlas = p.atlas ?? base.atlas;
  const image = useAtlas(atlas);
  const d = useMemo(() => {
    const flip = sprite(`${p.id}@flip`);
    const flash = sprite(`${p.id}@flash`);
    const hasFlip = flip.id === `${p.id}@flip` && flip.frames.length === base.frames.length;
    const hasFlash = flash.id === `${p.id}@flash` && flash.frames.length === base.frames.length;
    return {
      f: base.frames as Rect4[],
      ff: (hasFlip ? flip.frames : base.frames) as Rect4[],
      fl: (hasFlash ? flash.frames : base.frames) as Rect4[],
      fps: p.fps ?? base.fps,
      loop: p.startAt === undefined ? base.loop || base.frames.length > 1 : false,
      ax: base.ax,
      ay: base.ay,
      fax: hasFlip ? flip.ax : base.ax,
      w: base.w,
    };
  }, [p.id, p.fps, p.startAt === undefined, base]);
  const { x, y, flip, startAt, flashUntil, clock } = p;
  const k = p.scale ?? 1;

  const sprites = useRectBuffer(1, (r) => {
    'worklet';
    const t = clock.value;
    const flipped = typeof flip === 'boolean' ? flip : flip ? flip.value : false;
    const flashing = flashUntil ? t < flashUntil.value : false;
    const frames = flashing ? d.fl : flipped ? d.ff : d.f;
    let i = 0;
    if (frames.length > 1 && d.fps > 0) {
      const t0 = startAt === undefined ? 0 : typeof startAt === 'number' ? startAt : startAt.value;
      const step = Math.floor(((t - t0) / 1000) * d.fps);
      i = d.loop ? ((step % frames.length) + frames.length) % frames.length : Math.max(0, Math.min(frames.length - 1, step));
    }
    const fr = frames[i];
    r.setXYWH(fr[0], fr[1], fr[2], fr[3]);
  });
  const transforms = useRSXformBuffer(1, (xf) => {
    'worklet';
    const flipped = typeof flip === 'boolean' ? flip : flip ? flip.value : false;
    const px = typeof x === 'number' ? x : x.value;
    const py = typeof y === 'number' ? y : y.value;
    const ax = flipped ? d.fax : d.ax;
    xf.set(k, 0, Math.round(px) - ax * k, Math.round(py) - d.ay * k);
  });
  const opacity = useDerivedValue(() => (p.opacity === undefined ? 1 : typeof p.opacity === 'number' ? p.opacity : p.opacity.value));
  if (!image) return null;
  return (
    <Group opacity={opacity}>
      <Atlas image={image} sprites={sprites} transforms={transforms} sampling={NEAREST} />
    </Group>
  );
});
