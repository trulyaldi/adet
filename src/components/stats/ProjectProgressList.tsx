import React, { memo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ProjectProgress } from '../../domain/stats';
import { fmtDur, fmtH, sayDur } from '../../domain/time';
import { useTheme } from '../../theme/ThemeProvider';
import { Glyph } from '../Glyph';
import { Icon } from '../Icon';
import { AnimatedBar } from '../motion/AnimatedBar';
import { useLayoutMotion } from '../motion/Appear';
import { Press } from '../motion/Press';
import { StatsCard, TextNum, TrendMark } from './common';

/** Each active project's week toward its target; tap a row for its last four weeks and all-time total. */
export const ProjectProgressList = memo(function ProjectProgressList({ rows }: { rows: ProjectProgress[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const layout = useLayoutMotion();
  if (!rows.length) return null;
  return (
    <StatsCard glyph="target" label="Projects this week">
      {rows.map((r) => (
        <Animated.View key={r.projectId} layout={layout}>
          <Row row={r} expanded={open === r.projectId} onToggle={() => setOpen((o) => (o === r.projectId ? null : r.projectId))} />
        </Animated.View>
      ))}
    </StatsCard>
  );
});

function Row({ row, expanded, onToggle }: { row: ProjectProgress; expanded: boolean; onToggle(): void }) {
  const t = useTheme();
  const { colors, radius } = t;
  const sw = t.swatch(row.look.color);
  const spoken = `${row.name}, ${sayDur(row.weekSec)}${row.targetSec ? ` of ${fmtH(row.targetSec)} this week${row.reached ? ', target reached' : ''}` : ' this week'}`;
  return (
    <Press kind="card" onPress={onToggle} accessibilityRole="button" accessibilityLabel={spoken} accessibilityState={{ expanded }} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: radius.md, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
          <Icon path={row.iconPath} size={18} color={sw.on} />
        </View>
        <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.ink }}>
          {row.name}
        </Text>
        <TrendMark trend={row.trend} deltaSec={row.weekSec - row.lastSec} size={14} showDelta={false} />
        <TextNum style={{ fontSize: 14 }}>
          {fmtDur(row.weekSec)}
          {row.targetSec !== null && <Text style={{ color: colors.sub }}>{` / ${fmtH(row.targetSec)}`}</Text>}
        </TextNum>
      </View>
      {row.targetSec !== null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={[
              { flex: 1 },
              // Reached: a soft glow in the project color.
              row.reached && { backgroundColor: sw.light, borderRadius: 6, shadowColor: sw.base, shadowOpacity: t.dark ? 0.6 : 0.45, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
            ]}
          >
            <AnimatedBar value={row.frac} color={sw.base} track={sw.light} height={12} />
          </View>
          {row.reached && (
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
              <Glyph name="done" size={14} color={sw.on} bg={sw.base} label="Target reached" />
            </View>
          )}
        </View>
      )}
      {expanded && <History row={row} />}
    </Press>
  );
}

/** The last four weeks as mini bars (this week last, in full color) and the all-time total. */
function History({ row }: { row: ProjectProgress }) {
  const t = useTheme();
  const { colors } = t;
  const sw = t.swatch(row.look.color);
  const max = Math.max(1, ...row.last4, row.targetSec ?? 0);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, paddingLeft: 44, paddingTop: 4 }}>
      <View accessible accessibilityLabel={`Last four weeks: ${row.last4.map((s) => sayDur(s)).join(', ')}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 44 }}>
        {row.last4.map((s, i) => (
          <View key={i} style={{ width: 14, height: Math.max(3, (s / max) * 44), borderRadius: 4, backgroundColor: i === 3 ? sw.base : sw.light }} />
        ))}
      </View>
      <View accessible accessibilityLabel={`${sayDur(row.allTimeSec)} in total`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Glyph name="clock" size={16} color={colors.sub} />
        <TextNum style={{ fontSize: 14 }}>{fmtH(row.allTimeSec)}</TextNum>
      </View>
    </View>
  );
}
