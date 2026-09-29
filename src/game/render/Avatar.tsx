// The avatar in the world: every layer drawn from one position and one pose,
// so gear moves as one. `mode`: 0 idle (breathing), 1 walking, 2 kneeling.

import { Atlas, useRectBuffer, useRSXformBuffer } from '@shopify/react-native-skia';
import React, { memo, useMemo } from 'react';
import { SharedValue } from 'react-native-reanimated';

import { sprite } from '../assets/manifest';
import { avatarLayers, AvatarLook } from '../avatar';
import { useAtlas } from './atlas';
import { NEAREST } from './pixel';

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
  const n = layers.length + Math.min(3, pips);
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
      // Pips float above the right shoulder.
      xf.set(1, 0, px + 13 + (i - nl) * 4, py + 1 + ((i - nl) % 2));
      return;
    }
    xf.set(1, 0, px, py);
  });
  if (!image) return null;
  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={NEAREST} />;
});
