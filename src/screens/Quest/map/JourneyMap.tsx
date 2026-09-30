// The journey: biomes stacked bottom (Whispering Forest) to top (Astral
// Citadel), one winding path. Vertical pan with momentum and a rubber band at
// the ends, no zoom. Only the biomes in view (and their neighbours) are drawn
// and decoded.

import React, { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SharedValue, useAnimatedReaction, useSharedValue, withDecay, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DayPhase, nightLight } from '../../../domain/game/daylight';
import type { JourneyState } from '../../../domain/game/derive';
import { BIOMES } from '../../../game/content/biomes';
import { BIOME_H, BiomeMap, WORLD_H, WORLD_W } from '../../../game/content/biomes/layout';
import type { FireStyle } from '../../../game/content/shop';
import type { AvatarLook } from '../../../game/avatar';
import { Particles } from '../../../game/render/Particles';
import { Camera, PixelStage } from '../../../game/render/PixelStage';
import { pixelScale } from '../../../game/render/pixel';
import { AnimatedSprite } from '../../../game/render/Sprite';
import { biomeStatus } from '../model';
import { BiomeLayer } from './BiomeLayer';
import { CampLayer } from './CampLayer';
import { SkyBands, SkyParallax } from './Sky';

export interface MapFx {
  /** Clock time a sparkle burst starts at each spot (reveal pops, loot). */
  pops: { x: number; y: number; at: SharedValue<number> }[];
  dust: { x: SharedValue<number>; y: SharedValue<number>; at: SharedValue<number> };
}

export interface JourneyMapProps {
  width: number;
  height: number;
  maps: BiomeMap[];
  journey: JourneyState;
  phase: DayPhase;
  camY: SharedValue<number>;
  clock: SharedValue<number>;
  reduced: boolean;
  camp: {
    at: { x: number; y: number };
    fireLit: boolean;
    fireStyle: FireStyle;
    chests: number;
    pet: string | null;
  };
  look: AvatarLook;
  avatarX: SharedValue<number>;
  avatarY: SharedValue<number>;
  avatarMode: SharedValue<number>;
  fx: MapFx;
  shake: SharedValue<number>;
  /** A tap at a world point (and the screen point, for panels). */
  onTap(wx: number, wy: number, sx: number, sy: number): void;
  /** The user touched the map (skips the reveal). */
  onTouch(): void;
}

/** How far past either end the map can be pulled. */
const OVERSCROLL = 60;
/** Sky below the forest island. */
const FOOT = 44;

export const JourneyMap = memo(function JourneyMap(p: JourneyMapProps) {
  const scale = pixelScale(p.width);
  const viewW = Math.ceil(p.width / scale);
  const viewH = Math.ceil(p.height / scale);
  const camX = Math.round((WORLD_W - viewW) / 2);
  const minY = -24;
  // A little past the forest's foot, so the first camp sits clear of the tab bar.
  const maxY = WORLD_H - viewH + FOOT;

  // Culling: which biomes are near the view (updated only when that changes).
  const [band, setBand] = useState(() => Math.floor(p.camY.value / 100));
  useAnimatedReaction(
    () => Math.floor(p.camY.value / 100),
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setBand, v);
    }
  );
  const visible = useMemo(() => {
    const top = band * 100 - 160;
    const bottom = band * 100 + viewH + 260;
    return p.maps.filter((m) => m.top + BIOME_H > top && m.top < bottom);
  }, [band, viewH, p.maps]);

  // Pan: drag follows the finger (resisting past the ends), release coasts.
  const start = useSharedValue(0);
  const touch = p.onTouch;
  const tap = p.onTap;
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetY([-6, 6])
      .onBegin(() => {
        start.value = p.camY.value;
        scheduleOnRN(touch);
      })
      .onUpdate((e) => {
        let y = start.value - e.translationY / scale;
        if (y < minY) y = minY - (minY - y) * 0.35;
        if (y > maxY) y = maxY + (y - maxY) * 0.35;
        p.camY.value = Math.max(minY - OVERSCROLL, Math.min(maxY + OVERSCROLL, y));
      })
      .onEnd((e) => {
        const y = p.camY.value;
        if (y < minY || y > maxY) {
          p.camY.value = withSpring(y < minY ? minY : maxY, { damping: 18, stiffness: 160 });
        } else {
          p.camY.value = withDecay({ velocity: -e.velocityY / scale, clamp: [minY, maxY], rubberBandEffect: true, rubberBandFactor: 0.6 });
        }
      });
    const tapG = Gesture.Tap()
      .maxDistance(10)
      .onEnd((e) => {
        scheduleOnRN(tap, e.x / scale + camX, e.y / scale + p.camY.value, e.x, e.y);
      });
    return Gesture.Race(pan, tapG);
  }, [p.camY, scale, minY, maxY, camX, start, touch, tap]);

  const pos = p.journey.position;
  const night = nightLight(p.phase);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: p.width, height: p.height }} collapsable={false}>
        <PixelStage width={p.width} height={p.height} scale={scale}>
          {/* Sky and far layers first (they move slower than the ground). */}
          <Camera x={camX} y={p.camY}>
            {visible.map((m) => (
              <SkyBands key={`sky-${m.id}`} map={m} x0={camX - 8} width={viewW + 16} />
            ))}
          </Camera>
          {visible.map((m) => (
            <SkyParallax key={`par-${m.id}`} map={m} camX={camX} camY={p.camY} factors={BIOMES[m.id].parallax} clock={p.reduced ? undefined : p.clock} />
          ))}
          <Camera x={camX} y={p.camY} shake={p.shake}>
            {visible.map((m) => (
              <BiomeLayer
                key={m.id}
                map={m}
                status={biomeStatus(m.index, pos)}
                position={pos}
                hp={p.journey.hp}
                maxHp={p.journey.maxHp}
                bossMaxHp={p.journey.bossMaxHp}
                staggered={p.journey.staggered}
                seals={p.journey.seals}
                phase={p.phase}
                ascension={pos.loop > 0}
                clock={p.clock}
                reduced={p.reduced}
              />
            ))}
            <CampLayer {...p.camp} look={p.look} pips={pos.loop} avatarX={p.avatarX} avatarY={p.avatarY} avatarMode={p.avatarMode} clock={p.clock} night={night} reduced={p.reduced} />
            {!p.reduced && (
              <>
                {p.fx.pops.map((pop, i) => (
                  <Particles key={i} kind="sparkle" x={pop.x - 8} y={pop.y - 16} w={16} h={16} count={14} clock={p.clock} startAt={pop.at} />
                ))}
                <AnimatedSprite id="fx.dust" x={p.fx.dust.x} y={p.fx.dust.y} clock={p.clock} startAt={p.fx.dust.at} transient />
              </>
            )}
          </Camera>
        </PixelStage>
      </View>
    </GestureDetector>
  );
});

/** Camera y that puts a world point a little below the middle of the view. */
export function cameraFor(y: number, height: number, width: number): number {
  const viewH = Math.ceil(height / pixelScale(width));
  return Math.max(-24, Math.min(WORLD_H - viewH + FOOT, Math.round(y - viewH * 0.55)));
}

