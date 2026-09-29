// An NPC speaking: portrait, name and a line typed out letter by letter.
// Tap to finish the line; tap again to continue. VoiceOver reads the whole
// line at once. Reduced motion shows it instantly.

import React, { useEffect, useRef, useState } from 'react';
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
}: {
  name: string;
  /** Sprite id base, e.g. 'npc.sage' (its .talk / .idle animations). */
  portrait: string;
  lines: string[];
  onDone(): void;
  reduced?: boolean;
  /** Called every few letters (soft typing sound). */
  onBlip?(): void;
}) {
  const u = useUiUnit();
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(reduced ? Infinity : 0);
  const line = lines[index] ?? '';
  const typing = shown < line.length;
  const blip = useRef(onBlip);
  blip.current = onBlip;

  useEffect(() => {
    setShown(reduced ? Infinity : 0);
  }, [index, reduced]);
  useEffect(() => {
    if (!typing) return;
    const t = setInterval(() => {
      setShown((s) => {
        if (s % 4 === 0) blip.current?.();
        return s + 1;
      });
    }, CHAR_MS);
    return () => clearInterval(t);
  }, [typing, index]);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${name}: ${line}`);
  }, [name, line]);

  const next = () => {
    if (typing) return setShown(Infinity);
    if (index + 1 < lines.length) setIndex(index + 1);
    else onDone();
  };

  return (
    <Pressable onPress={next} accessibilityRole="button" accessibilityLabel={`${name}: ${line}`} accessibilityHint={index + 1 < lines.length ? 'Next' : 'Close'}>
      <PixelPanel tone="parchment" style={{ flexDirection: 'row', gap: 3 * u, alignItems: 'center', minHeight: 96 }}>
        <View style={{ backgroundColor: QUI.parchmentDark, padding: u, borderRadius: 0 }}>
          <SpriteView id={`${portrait}.${typing ? 'talk' : 'idle'}`} scale={4} animate={!reduced} />
        </View>
        <View style={{ flex: 1, gap: u }}>
          <PixelText size="sm" bold color={QUI.wood}>
            {name}
          </PixelText>
          <PixelText size="md">{line.slice(0, shown)}</PixelText>
        </View>
        {!typing && <PixelText size="md" color={QUI.wood} style={{ alignSelf: 'flex-end' }}>▼</PixelText>}
      </PixelPanel>
    </Pressable>
  );
}
