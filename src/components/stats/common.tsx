import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, TextProps, View, ViewStyle } from 'react-native';

import { ICONS } from '../../domain/constants';
import { ProjectLook, projectLook } from '../../domain/look';
import { Trend } from '../../domain/stats';
import { fmtDur } from '../../domain/time';
import { Project } from '../../domain/types';
import { useTheme } from '../../theme/ThemeProvider';
import { Glyph, GlyphName } from '../Glyph';
import { Text } from '../Text';

/** A Stats card: a glyph (with a spoken label) in place of a title, then the content. */
export function StatsCard({ glyph, label, right, children, style }: { glyph: GlyphName; label: string; right?: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.colors.card, borderRadius: t.radius.xxl, padding: 16, gap: 14 }, t.shadow, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 24 }}>
        <Glyph name={glyph} size={22} color={t.colors.sub} label={label} />
        {right}
      </View>
      {children}
    </View>
  );
}

export interface ProjectInfo {
  name: string;
  look: ProjectLook;
  iconPath: string;
}

/** Name, color and icon per project id (archived ones too: their history shows in charts). */
export function projectInfoMap(projects: Project[]): Map<string, ProjectInfo> {
  return new Map(
    projects.map((p) => {
      const look = projectLook(p);
      return [p.id, { name: p.name, look, iconPath: ICONS[look.icon] }];
    })
  );
}

/** Up (brand blue), down (soft gray, never red) or about the same, with the difference. */
export function TrendMark({ trend, deltaSec, size = 16, showDelta = true }: { trend: Trend; deltaSec: number; size?: number; showDelta?: boolean }) {
  const { colors } = useTheme();
  const color = trend === 'up' ? colors.brand : trend === 'down' ? colors.muted : colors.sub;
  const glyph: GlyphName = trend === 'up' ? 'chevronUp' : trend === 'down' ? 'chevronDown' : 'minus';
  const spoken =
    trend === 'even' ? 'About the same as this time last week' : `${fmtDur(Math.abs(deltaSec))} ${trend === 'up' ? 'more' : 'less'} than this time last week`;
  return (
    <View accessible accessibilityLabel={spoken} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Glyph name={glyph} size={size} color={color} />
      {showDelta && trend !== 'even' && <TextNum style={{ fontSize: size - 1, color }}>{fmtDur(Math.abs(deltaSec))}</TextNum>}
    </View>
  );
}

/** Bold tabular numbers. */
export function TextNum({ style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <Text {...rest} style={[{ fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }, style]} />;
}

/**
 * A number counting up from zero once `start` turns true (0.7s, ease out),
 * e.g. when its card first scrolls into view; later changes jump. With
 * reduce motion it just shows the value.
 */
export function useCountUpOnce(value: number, reduced: boolean, start = true): number {
  const [shown, setShown] = useState(reduced ? value : 0);
  const done = useRef(reduced);
  useEffect(() => {
    if (done.current) {
      setShown(value);
      return;
    }
    if (!start) return;
    done.current = true;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / 700);
      setShown(value * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, start]);
  return shown;
}

/** An SVG arc path on a circle, clockwise from `from` to `to` degrees (0 = 12 o'clock). */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const pt = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`;
  };
  return `M${pt(from)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${pt(to)}`;
}
