import React, { useRef } from 'react';
import { Pressable, View } from 'react-native';

import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { TodayItem } from '../../domain/day';
import { sayDur } from '../../domain/time';
import { useActions } from '../../store/StreakStore';
import { TIMER_FRAME_MS, useActiveProgress } from '../../store/useActiveProgress';
import { useStopTimer } from '../../store/useStopTimer';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';
import { Glyph, IconButton } from '../Glyph';
import { Icon } from '../Icon';
import { usePressMotion } from '../motion/Press';
import { ProgressRing } from '../motion/ProgressRing';
import { SessionClock } from '../SessionClock';
import { Text } from '../Text';

/**
 * The running session, standing out on Today: project-colored, a live
 * count-up, the target marker ring, and pause and done. Tap to open focus.
 */
export function ActiveSessionCard({ item }: { item: TodayItem }) {
  const t = useTheme();
  const { colors, radius } = t;
  const actions = useActions();
  const reduced = useReducedMotion();
  const stop = useStopTimer();
  const sw = t.swatch(item.color);
  // Refreshes slowly; the clock and the bonus sparkle tick on their own.
  const p = useActiveProgress(TIMER_FRAME_MS);
  const doneRef = useRef<View>(null);
  // The whole card dims on press, like a hero Press.
  const open = usePressMotion('hero');
  if (!p) return null;
  const frac = p.sec / p.targetSec;

  return (
    <Animated.View entering={reduced ? FadeIn : FadeInDown.duration(220)} style={{ marginTop: 18 }}>
      {/* The open-focus press and the buttons are siblings: a button inside a button is invalid (web renders both as <button>). */}
      <Animated.View
        style={[{ backgroundColor: sw.base, borderRadius: radius.xxl, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 5, borderBottomColor: sw.dark }, t.shadow, open.style]}
      >
        <Pressable
          onPress={actions.openTimer}
          onPressIn={open.onPressIn}
          onPressOut={open.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${p.paused ? 'paused' : 'running'}, ${sayDur(p.sessionSec)}. Open focus`}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}
        >
          <ProgressRing size={92} stroke={9} value={frac} color={sw.on} bonusColor={sw.light} track={sw.dark} live={!p.paused} rate={1 / p.targetSec} marker>
            <Icon path={item.iconPath} size={28} color={sw.on} />
          </ProgressRing>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={2} style={{ fontSize: 16, fontWeight: '800', color: sw.on, opacity: 0.9 }}>
              {item.name}
            </Text>
            <SessionClock numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 34, fontWeight: '800', color: sw.on, fontVariant: ['tabular-nums'], opacity: p.paused ? 0.6 : 1 }} />
            <BonusSparkle color={sw.on} bg={sw.base} />
          </View>
        </Pressable>
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
          <View ref={doneRef} collapsable={false}>
            <IconButton
              label="Done"
              name="done"
              size={22}
              color={sw.dark}
              bg={colors.card}
              edge={sw.dark}
              variant="chunky"
              diameter={46}
              quiet
              onPress={() => {
                doneRef.current?.measureInWindow((x, y, w, h) => actions.burst(x + w / 2, y + h / 2, sw.base));
                stop();
              }}
            />
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** Shows once today's time passes the target; checks every second on its own. */
function BonusSparkle({ color, bg }: { color: string; bg: string }) {
  const p = useActiveProgress(1000);
  if (!p || p.sec < p.targetSec) return null;
  return <Glyph name="sparkle" size={18} color={color} bg={bg} label="Past the target, bonus time" />;
}
