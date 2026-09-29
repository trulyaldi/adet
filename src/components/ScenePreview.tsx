import React from 'react';
import { View } from 'react-native';

import { SceneKind } from '../domain/types';
import { Scene } from '../scenes/Scene';
import { Swatch } from '../theme/palette';
import { useTheme } from '../theme/ThemeProvider';
import { useAppActive, useReducedMotion } from '../theme/useMotion';

/** A small live preview of a focus scene, part-way to its target. */
export function ScenePreview({ kind, swatch, width = 92, height = 112, progress = 0.65 }: { kind: SceneKind; swatch: Swatch; width?: number; height?: number; progress?: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const active = useAppActive();
  return (
    <View style={{ width, height, overflow: 'hidden', borderRadius: 16, backgroundColor: swatch.light, pointerEvents: 'none' }}>
      {/* Scenes are laid out for a full screen; draw at 3x and scale down. */}
      <View style={{ width: width * 3, height: height * 3, transform: [{ translateX: -width }, { translateY: -height }, { scale: 1 / 3 }] }}>
        <Scene
          kind={kind}
          width={width * 3}
          height={height * 3}
          cx={width * 1.5}
          cy={height * 1.4}
          ringR={width * 0.9}
          progress={progress}
          sessionSec={40 * 60}
          swatch={swatch}
          payoff={0}
          moving={!reduced && active}
          reduced={reduced}
          dark={t.dark}
        />
      </View>
    </View>
  );
}
