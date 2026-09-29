// An NPC speaking: portrait, name and a line typed out letter by letter.
// Tap to finish the line; tap again to continue. VoiceOver reads the whole
// line at once. Reduced motion shows it instantly.

import React, { useEffect, useEffectEvent, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';

import { SpriteView } from '../render/SpriteView';
import { PixelPanel } from './PixelPanel';
import { PixelText } from './PixelText';
import { QUI, useUiUnit } from './theme';

const CHAR_MS = 28;

export function DialogBox({
  name,
  portrait,
  lines,
  onDone,
  reduced,
  onBlip,
  portraitStatic,
}: {
  name: string;
  /** Sprite id base, e.g. 'npc.sage' (its .talk / .idle animations), or one sprite id with `portraitStatic`. */
  portrait: string;
  /** Use `portrait` as-is (no .talk/.idle), at this scale. */
  portraitStatic?: number;
  lines: string[];
  onDone(): void;
  reduced?: boolean;
  /** Called every few letters (soft typing sound). */
  onBlip?(): void;
}) {
  const u = useUiUnit();
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const line = lines[index] ?? '';
  // Reduced motion: every line appears whole.
  const visible = reduced ? Infinity : shown;
  const typing = visible < line.length;
  const blip = useEffectEvent(() => onBlip?.());

  useEffect(() => {
    if (!typing) return;
    let letters = 0;
    const t = setInterval(() => {
      if (letters++ % 4 === 0) blip();
      setShown((s) => s + 1);
    }, CHAR_MS);
    return () => clearInterval(t);
  }, [typing, index]);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${name}: ${line}`);
  }, [name, line]);

  const next = () => {
    if (typing) return setShown(Infinity);
    if (index + 1 < lines.length) {
      setIndex(index + 1);
      setShown(0);
    } else onDone();
  };

  return (
    <Pressable onPress={next} accessibilityRole="button" accessibilityLabel={`${name}: ${line}`} accessibilityHint={index + 1 < lines.length ? 'Next' : 'Close'}>
      <PixelPanel tone="parchment" style={{ flexDirection: 'row', gap: 3 * u, alignItems: 'center', minHeight: 96 }}>
        <View style={{ backgroundColor: QUI.parchmentDark, padding: u, borderRadius: 0 }}>
          <SpriteView id={portraitStatic ? portrait : `${portrait}.${typing ? 'talk' : 'idle'}`} scale={portraitStatic ?? 4} animate={!reduced} />
        </View>
        <View style={{ flex: 1, gap: u }}>
          <PixelText size="sm" bold color={QUI.wood}>
            {name}
          </PixelText>
          <PixelText size="md">{line.slice(0, visible)}</PixelText>
        </View>
        {!typing && <PixelText size="md" color={QUI.wood} style={{ alignSelf: 'flex-end' }}>▼</PixelText>}
      </PixelPanel>
    </Pressable>
  );
}
