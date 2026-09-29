// Batched sprites from one atlas in a single Skia Atlas draw. Static items
// cost nothing per frame; animated ones pick their frame from the game
// clock on the UI thread, and wanderers drift around a home spot.

import { Atlas, rect, Skia, useRectBuffer, useRSXformBuffer } from '@shopify/react-native-skia';
import React, { memo, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { AtlasName, sprite } from '../assets/manifest';
import { useAtlas } from './atlas';
import { NEAREST } from './pixel';

export interface BatchItem {
  id: string;
  /** Anchor position in game pixels. */
  x: number;
  y: number;
  flip?: boolean;
  /** Draw the white hit-flash silhouette. */
  flash?: boolean;
  /** Offset into the animation, in frames (so neighbours don't blink in sync). */
  phase?: number;
  /** Drift up to this many pixels around (x, y), facing the way it moves. */
  wander?: number;
  /** Bob up and down by a pixel (floating things). */
  bob?: boolean;
  /** Hold one frame. */
  frame?: number;
  /** Play these frame indices in order (e.g. a pose cycle), at `fps`. */
  seq?: number[];
  fps?: number;
}

type Rect4 = [number, number, number, number];

interface Resolved {
  frames: Rect4[];
  flipFrames: Rect4[];
  fps: number;
  loop: boolean;
  ax: number;
  ay: number;
  flipAx: number;
}

function resolve(it: BatchItem): Resolved {
  const base = it.flash ? `${it.id}@flash` : it.id;
  const m = sprite(it.flip && !it.flash ? `${it.id}@flip` : base);
  const f = sprite(`${it.id}@flip`);
  const flipOk = f.id === `${it.id}@flip` && f.frames.length === m.frames.length;
  const pick = (list: Rect4[]) =>
    it.frame !== undefined ? [list[Math.min(it.frame, list.length - 1)]] : it.seq ? it.seq.map((i) => list[Math.min(i, list.length - 1)]) : list;
  const frames = pick(m.frames);
  return {
    frames,
    flipFrames: flipOk ? pick(f.frames) : frames,
    fps: it.frame !== undefined ? 0 : it.fps ?? m.fps,
    loop: m.loop,
    ax: m.ax,
    ay: m.ay,
    flipAx: flipOk ? f.ax : m.ax,
  };
}

const isAnimated = (it: BatchItem, r: Resolved) => (r.frames.length > 1 && r.fps > 0) || !!it.wander || !!it.bob;

export const SpriteBatch = memo(function SpriteBatch({
  atlas,
  items,
  clock,
  additive,
}: {
  atlas: AtlasName;
  items: BatchItem[];
  clock?: SharedValue<number>;
  additive?: boolean;
}) {
  const image = useAtlas(atlas);
  const resolved = useMemo(() => items.map(resolve), [items]);
  const animated = !!clock && items.some((it, i) => isAnimated(it, resolved[i]));
  if (!image || !items.length) return null;
  return animated ? (
    <AnimatedBatch image={image} items={items} resolved={resolved} clock={clock!} additive={additive} />
  ) : (
    <StaticBatch image={image} items={items} resolved={resolved} additive={additive} />
  );
});

type Img = NonNullable<ReturnType<typeof useAtlas>>;

function StaticBatch({ image, items, resolved, additive }: { image: Img; items: BatchItem[]; resolved: Resolved[]; additive?: boolean }) {
  const { sprites, transforms } = useMemo(() => {
    const sprites = resolved.map((r) => {
      const [x, y, w, h] = r.frames[0];
      return rect(x, y, w, h);
    });
    const transforms = items.map((it, i) => Skia.RSXform(1, 0, Math.round(it.x - resolved[i].ax), Math.round(it.y - resolved[i].ay)));
    return { sprites, transforms };
  }, [items, resolved]);
  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={NEAREST} blendMode={additive ? 'plus' : undefined} />;
}

function AnimatedBatch({
  image,
  items,
  resolved,
  clock,
  additive,
}: {
  image: Img;
  items: BatchItem[];
  resolved: Resolved[];
  clock: SharedValue<number>;
  additive?: boolean;
}) {
  // Plain arrays, copied to the UI thread with the worklets.
  const data = useMemo(
    () =>
      items.map((it, i) => {
        const r = resolved[i];
        // A stable per-item seed from its home position.
        const seed = ((Math.round(it.x) * 73856093) ^ (Math.round(it.y) * 19349663)) >>> 0;
        return {
          f: r.frames,
          ff: r.flipFrames,
          fps: r.fps,
          loop: r.loop,
          phase: it.phase ?? seed % 7,
          x: Math.round(it.x - r.ax),
          y: Math.round(it.y - r.ay),
          fx: Math.round(it.x - r.flipAx),
          wander: it.wander ?? 0,
          bob: !!it.bob,
          seed: (seed % 1000) / 1000,
        };
      }),
    [items, resolved]
  );
  const n = data.length;
  const sprites = useRectBuffer(n, (r, i) => {
    'worklet';
    const d = data[i];
    const t = clock.value;
    let flip = false;
    if (d.wander) flip = Math.cos(t / 2600 + d.seed * 6.283) < 0;
    const frames = flip ? d.ff : d.f;
    let k = 0;
    if (frames.length > 1 && d.fps > 0) {
      const step = Math.floor((t / 1000) * d.fps) + d.phase;
      k = d.loop ? step % frames.length : Math.min(frames.length - 1, step);
    }
    const fr = frames[k];
    r.setXYWH(fr[0], fr[1], fr[2], fr[3]);
  });
  const transforms = useRSXformBuffer(n, (xf, i) => {
    'worklet';
    const d = data[i];
    const t = clock.value;
    let x = d.x;
    let y = d.y;
    if (d.wander) {
      const a = t / 2600 + d.seed * 6.283;
      x = Math.round((Math.cos(a) < 0 ? d.fx : d.x) + Math.sin(a) * d.wander);
      y = Math.round(y + Math.sin(a * 0.7 + 1) * d.wander * 0.4);
    }
    if (d.bob) y += Math.round(Math.sin(t / 600 + d.seed * 6.283));
    xf.set(1, 0, x, y);
  });
  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={NEAREST} blendMode={additive ? 'plus' : undefined} />;
}
