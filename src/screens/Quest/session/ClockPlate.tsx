// The focus screen's clock: this session's count-up in large pixel digits on
// a framed plate, with the target under it as a pixel icon and a few
// characters. The only part of the screen that re-renders every second; it
// reads the timer's timestamps, so it is right the moment the app returns.
//
// Tiny5 (the pixel font) gives every digit the same 0.5 em advance, so the
// count-up never jitters, and its 5 has a square top (no "S0").

import React from 'react';
import { View } from 'react-native';

import { Glyph } from '../../../components/Glyph';
import { fmtClock, fmtDur, sayDur } from '../../../domain/time';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { useActiveProgress } from '../../../store/useActiveProgress';
import { useTheme } from '../../../theme/ThemeProvider';

export function ClockPlate({ digits }: { digits: number }) {
  const t = useTheme();
  const p = useActiveProgress(1000);
  if (!p) return null;
  const ink = t.dark ? QUI.white : QUI.ink;
  const sub = t.dark ? QUI.goldLight : QUI.muted;
  const bg = t.dark ? QUI.night : QUI.parchment;
  const past = p.sec >= p.targetSec;
  const earlier = p.sec - p.sessionSec;
  const target = earlier >= 60 ? `${fmtDur(p.sec)} / ${fmtDur(p.targetSec)}` : fmtDur(p.targetSec);
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`${sayDur(p.sessionSec)} this session, ${sayDur(p.sec)} of ${sayDur(p.targetSec)} today${past ? ', past the target' : ''}${p.paused ? ', paused' : ''}`}
      style={{ alignSelf: 'center' }}
    >
      <PixelPanel tone={t.dark ? 'night' : 'parchment'} padding={4} style={{ alignItems: 'center', minWidth: digits * 3.4 }}>
        <PixelText
          allowFontScaling={false}
          style={{ fontSize: digits, lineHeight: digits, paddingTop: digits / 8, color: ink, opacity: p.paused ? 0.55 : 1 }}
        >
          {fmtClock(p.sessionSec)}
        </PixelText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, height: 18 }}>
          <Glyph name={past ? 'sparkle' : 'clock'} size={16} color={past ? QUI.gold : sub} bg={bg} />
          <PixelText size="md" color={sub}>
            {target}
          </PixelText>
        </View>
      </PixelPanel>
    </View>
  );
}
