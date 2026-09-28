import React, { memo } from 'react';
import { View } from 'react-native';

import { Records } from '../../domain/stats';
import { fmtDur, sayDur } from '../../domain/time';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';
import { Glyph, GlyphName } from '../Glyph';
import { StatsCard, TextNum, useCountUpOnce } from './common';

/** Four records, each an icon and a number that counts up the first time it shows. */
export const RecordsGrid = memo(function RecordsGrid({ records }: { records: Records }) {
  const items: { glyph: GlyphName; label: string; sec: number }[] = [
    { glyph: 'today', label: 'Best day', sec: records.bestDaySec },
    { glyph: 'clock', label: 'Longest session', sec: records.longestSessionSec },
    { glyph: 'calendar', label: 'Average session this month', sec: records.avgSessionSec },
    { glyph: 'stats', label: 'Total, all time', sec: records.totalSec },
  ];
  return (
    <StatsCard glyph="badge" label="Records">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((it) => (
          <Tile key={it.label} {...it} />
        ))}
      </View>
    </StatsCard>
  );
});

function Tile({ glyph, label, sec }: { glyph: GlyphName; label: string; sec: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const shown = useCountUpOnce(sec, reduced);
  return (
    <View accessible accessibilityLabel={`${label}, ${sayDur(sec)}`} style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: t.colors.well, borderRadius: t.radius.lg, padding: 12, gap: 8 }}>
      <Glyph name={glyph} size={20} color={t.colors.sub} />
      <TextNum numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 22, letterSpacing: -0.3 }}>
        {fmtDur(shown)}
      </TextNum>
    </View>
  );
}
