import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { activeProgress, TodayItem } from '../../domain/day';
import { fmtClock, sayDur } from '../../domain/time';
import { useStreak } from '../../store/StreakStore';
import { useNow } from '../../store/useNow';
import { useStopTimer } from '../../store/useStopTimer';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';
import { Glyph, IconButton } from '../Glyph';
import { Icon } from '../Icon';
import { ProgressRing } from '../motion/ProgressRing';

/**
 * The running session, standing out on Today: project-colored, a live
 * count-up, the target marker ring, and pause and done. Tap to open focus.
 */
export function ActiveSessionCard({ item }: { item: TodayItem }) {
  const t = useTheme();
  const { colors, radius } = t;
  const { data, actions } = useStreak();
  const reduced = useReducedMotion();
  const now = useNow(1000);
  const stop = useStopTimer();
  const sw = t.swatch(item.color);
  const p = useMemo(() => activeProgress(data, now), [data, now]);
  if (!p) return null;
  const frac = p.sec / p.targetSec;

  return (
    <Animated.View entering={reduced ? FadeIn : ZoomIn.springify().damping(14)} style={{ marginTop: 18 }}>
      <Pressable
        onPress={actions.openTimer}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${p.paused ? 'paused' : 'running'}, ${sayDur(p.sessionSec)}. Open focus`}
        style={[{ backgroundColor: sw.base, borderRadius: radius.xxl, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 5, borderBottomColor: sw.dark }, t.shadow]}
      >
        <ProgressRing size={92} stroke={9} value={frac} color={sw.on} bonusColor={sw.light} track={sw.dark} live={!p.paused} marker>
          <Icon path={item.iconPath} size={28} color={sw.on} />
        </ProgressRing>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: sw.on, opacity: 0.9 }}>
            {item.name}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 34, fontWeight: '800', color: sw.on, fontVariant: ['tabular-nums'], opacity: p.paused ? 0.6 : 1 }}>
            {fmtClock(p.sessionSec)}
          </Text>
          {frac >= 1 && <Glyph name="sparkle" size={18} color={sw.on} bg={sw.base} label="Past the target, bonus time" />}
        </View>
        <View style={{ gap: 10 }}>
          <IconButton
            label={p.paused ? 'Resume' : 'Pause'}
            name={p.paused ? 'play' : 'pause'}
            size={20}
            color={sw.dark}
            bg={colors.card}
            edge={sw.dark}
            variant="chunky"
            diameter={46}
            onPress={actions.togglePause}
          />
          <IconButton label="Done" name="done" size={22} color={sw.dark} bg={colors.card} edge={sw.dark} variant="chunky" diameter={46} quiet onPress={stop} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
