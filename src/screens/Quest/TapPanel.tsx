// Small panels from a tap on the map: a mob (sprite and HP, no prose), the
// boss at its gate, a villager's line, a critter's little heart.

import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';

import type { SealState } from '../../domain/game/derive';
import { SpriteView } from '../../game/render/SpriteView';
import { HPBar } from '../../game/ui/HPBar';
import { PixelPanel } from '../../game/ui/PixelPanel';
import { PixelText } from '../../game/ui/PixelText';
import { SealPips, sealsLabel } from '../../game/ui/SealPips';
import { QUI } from '../../game/ui/theme';

export type Panel =
  | { kind: 'mob'; sprite: string; name: string; hp: number; max: number; x: number; y: number }
  | { kind: 'boss'; sprite: string; name: string; hp: number; max: number; active: boolean; line?: string; seals?: SealState[]; staggered?: boolean; x: number; y: number }
  | { kind: 'say'; text: string; x: number; y: number }
  | { kind: 'emote'; x: number; y: number };

/** What VoiceOver reads: the panel's content (the sprite and bar are pictures). */
export function panelLabel(panel: Panel): string {
  switch (panel.kind) {
    case 'emote': return 'A happy little critter';
    case 'say': return panel.text;
    case 'mob': return `${panel.name}, ${Math.ceil(panel.hp)} of ${panel.max} health`;
    case 'boss': return [`${panel.name}, ${Math.ceil(panel.hp)} of ${panel.max} health`, panel.staggered ? 'Staggered, waiting for its seals' : '', panel.seals ? sealsLabel(panel.seals) : '', panel.line].filter(Boolean).join('. ');
  }
}

export function TapPanel({ panel, width, onClose, reduced }: { panel: Panel; width: number; onClose(): void; reduced: boolean }) {
  const label = panelLabel(panel);
  // iOS has no live regions: say it once when the panel appears.
  useEffect(() => { AccessibilityInfo.announceForAccessibility(label); }, [label]);
  useEffect(() => {
    if (panel.kind !== 'emote' && panel.kind !== 'say') return;
    const t = setTimeout(onClose, panel.kind === 'emote' ? 1000 : 3500);
    return () => clearTimeout(t);
  }, [panel, onClose]);
  const w = panel.kind === 'boss' ? 200 : panel.kind === 'mob' ? 150 : panel.kind === 'say' ? 210 : 40;
  const left = Math.max(8, Math.min(width - w - 8, panel.x - w / 2));
  const top = Math.max(70, panel.y - (panel.kind === 'boss' ? (panel.line ? 230 : 190) : panel.kind === 'mob' ? 120 : 76));
  return (
    <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Tap to close" style={{ position: 'absolute', left, top, width: w }}>
      {panel.kind === 'emote' ? (
        <SpriteView id="icon.heart" scale={3} accessibilityLabel="A happy little critter" />
      ) : panel.kind === 'say' ? (
        <PixelPanel tone="parchment" padding={2}>
          <PixelText size="sm" accessibilityLiveRegion="polite">
            {panel.text}
          </PixelText>
        </PixelPanel>
      ) : (
        <PixelPanel tone="parchment" padding={2} style={{ alignItems: 'center', gap: 6 }}>
          <SpriteView id={panel.sprite} scale={panel.kind === 'boss' ? 2 : 4} animate={!reduced} accessibilityLabel={panel.name} />
          {panel.kind === 'boss' && (
            <PixelText size="sm" bold color={QUI.wood}>
              {panel.name}
            </PixelText>
          )}
          {panel.kind === 'boss' && panel.line && (
            <PixelText size="sm" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
              {panel.line}
            </PixelText>
          )}
          <View>
            <HPBar hp={panel.hp} max={panel.max} width={w - 30} reduced={reduced} label={`${panel.name}, ${Math.ceil(panel.hp)} of ${panel.max} health`} />
          </View>
          {panel.kind === 'boss' && panel.seals && <SealPips seals={panel.seals} counts />}
        </PixelPanel>
      )}
    </Pressable>
  );
}
