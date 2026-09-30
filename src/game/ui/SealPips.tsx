// A boss's seals as three small icons under its HP bar: dim until filled.
// `counts` adds "2/3" (the tap that opens a boss panel reveals them). Not a
// button itself: it sits inside tappable panels. Words are for VoiceOver.

import React from 'react';
import { View } from 'react-native';

import type { SealKind, SealState } from '../../domain/game/derive';
import { SpriteView } from '../render/SpriteView';
import { PixelText } from './PixelText';
import { QUI } from './theme';

export const SEAL_ICON: Record<SealKind, string> = { days: 'icon.calendar', depth: 'icon.sword', insight: 'icon.quill' };
const SEAL_WORD: Record<SealKind, string> = { days: 'days', depth: 'deep sessions', insight: 'insights' };

export function sealsLabel(seals: readonly SealState[]): string {
  if (!seals.length) return '';
  return 'Seals: ' + seals.map((s) => `${SEAL_WORD[s.kind]} ${Math.min(s.have, s.need)} of ${s.need}`).join(', ');
}

export function SealPips({ seals, counts = false, color = QUI.ink, scale = 2 }: { seals: readonly SealState[]; counts?: boolean; color?: string; scale?: number }) {
  if (!seals.length) return null;
  return (
    <View accessible accessibilityLabel={sealsLabel(seals)} style={{ flexDirection: 'row', gap: 8, minHeight: 24, alignItems: 'center', justifyContent: 'center' }}>
      {seals.map((s) => {
        const full = s.have >= s.need;
        return (
          <View key={s.kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, opacity: full ? 1 : 0.35 }}>
            <SpriteView id={SEAL_ICON[s.kind]} scale={scale} />
            {counts && (
              <PixelText size="tiny" color={color}>
                {Math.min(s.have, s.need)}/{s.need}
              </PixelText>
            )}
          </View>
        );
      })}
    </View>
  );
}
