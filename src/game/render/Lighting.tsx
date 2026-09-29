// Light: a colour grade for the time of day (and the ascension night
// palette), and additive glow sprites for light sources.

import { ColorMatrix, Group, Paint } from '@shopify/react-native-skia';
import React, { memo, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { ASCENSION_NIGHT, ColorMatrix as Matrix, DayPhase, desaturate, GRADES, IDENTITY, mulMatrix } from '../../domain/game/daylight';
import { BatchItem, SpriteBatch } from './SpriteBatch';

/** Children seen through a colour matrix. */
export function Graded({ matrix, children }: { matrix: Matrix; children: React.ReactNode }) {
  if (matrix === IDENTITY) return <>{children}</>;
  return (
    <Group
      layer={
        <Paint>
          <ColorMatrix matrix={matrix} />
        </Paint>
      }
    >
      {children}
    </Group>
  );
}

/** The grade for a phase, optionally at night palette (ascension) or greyed (not reached). */
export function worldMatrix(phase: DayPhase, opts: { ascension?: boolean; locked?: boolean } = {}): Matrix {
  let m = GRADES[phase];
  if (opts.ascension) m = mulMatrix(ASCENSION_NIGHT, m);
  if (opts.locked) m = mulMatrix(desaturate(0.75, 0.7), m);
  return m;
}

/** Additive glows (torches, lanterns, lava, crystals), stronger at night. */
export const Lights = memo(function Lights({ items, clock, intensity }: { items: BatchItem[]; clock?: SharedValue<number>; intensity: number }) {
  const lit = useMemo(() => items, [items]);
  if (intensity <= 0 || !lit.length) return null;
  return (
    <Group opacity={Math.min(1, intensity)} blendMode="plus">
      <SpriteBatch atlas="shared" items={lit} clock={clock} additive />
    </Group>
  );
});
