import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '../components/Button';
import { Burst } from '../components/celebrate/Burst';
import { Ilmek } from '../components/ilmek/Ilmek';
import { Glyph, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { ProgressRing } from '../components/motion/ProgressRing';
import { SessionClock } from '../components/SessionClock';
import { MessageToast } from '../components/UndoToast';
import { ICONS } from '../domain/constants';
import { projectLook } from '../domain/look';
import { fmtDur, sayDur } from '../domain/time';
import { Scene } from '../scenes/Scene';
import { useDevicePrefs } from '../store/devicePrefs';
import { useActions, useData, useUi } from '../store/StreakStore';
import { TIMER_FRAME_MS, useActiveProgress } from '../store/useActiveProgress';
import { useStopTimer } from '../store/useStopTimer';
import { springs } from '../theme/motion';
import { Swatch } from '../theme/palette';
import { useTheme } from '../theme/ThemeProvider';
import { useAppActive, useReducedMotion } from '../theme/useMotion';

/** After this long in focus, a dim button appears. */
const DIM_OFFER_MS = 2 * 60_000;

/**
 * Full-screen focus: the count-up inside a ring in the project's color,
 * the project's scene growing behind it, Ilmek in a corner, and
 * pause / done. Swipe down to minimize back to Today; the session keeps
 * running. The screen stays awake while it's open.
 */
export function FocusView() {
  const data = useData();
  const timerOpen = useUi((u) => u.timerOpen);
  const actions = useActions();
  const open = timerOpen && !!data.active;
  return (
    <Modal visible={open} animationType="slide" onRequestClose={actions.closeTimer} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>{open && <FocusContent />}</GestureHandlerRootView>
    </Modal>
  );
}

function FocusContent() {
  useKeepAwake();
  const t = useTheme();
  const { colors, radius } = t;
  const data = useData();
  const targetHits = useUi((u) => u.targetHits);
  const cheerUntil = useUi((u) => u.cheerUntil);
  const actions = useActions();
  const { prefs, setPrefs } = useDevicePrefs();
  const reduced = useReducedMotion();
  const appActive = useAppActive();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const stop = useStopTimer();
  // The screen refreshes slowly; the clock text ticks on its own and the ring
  // moves on the UI thread.
  const p = useActiveProgress(TIMER_FRAME_MS);
  const [dimOffer, setDimOffer] = useState(false);
  const [dimmed, setDimmed] = useState(false);
  const [burst, setBurst] = useState<{ x: number; y: number } | null>(null);
  const doneRef = useRef<View>(null);
  const finishing = useRef(false);
  useEffect(() => {
    const tm = setTimeout(() => setDimOffer(true), DIM_OFFER_MS);
    return () => clearTimeout(tm);
  }, []);

  // The cheer ends on its own clock (the screen doesn't re-render every second).
  const [, endCheer] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const ms = cheerUntil - Date.now();
    if (ms <= 0) return;
    const tm = setTimeout(endCheer, ms + 50);
    return () => clearTimeout(tm);
  }, [cheerUntil]);

  const y = useSharedValue(0);
  // Built once, so re-renders don't rebuild the gesture.
  const closeRef = useRef(actions.closeTimer);
  closeRef.current = actions.closeTimer;
  const swipe = useMemo(() => {
    const close = () => closeRef.current();
    return Gesture.Pan()
      .activeOffsetY(14)
      .failOffsetX([-30, 30])
      .onUpdate((e) => {
        y.value = Math.max(0, e.translationY);
      })
      .onEnd((e) => {
        if (e.translationY > 140 || e.velocityY > 900) scheduleOnRN(close);
        y.value = withSpring(0, springs.appear);
      });
  }, [y]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  const habit = data.habits.find((h) => h.id === p?.habitId);
  if (!p || !habit) return null;
  const project = data.projects.find((x) => x.id === habit.projectId);
  const look = projectLook(project ?? { id: habit.projectId });
  const sw = t.swatch(look.color);
  const frac = p.sec / p.targetSec;
  const ringSize = Math.min(290, width - 70);
  const cy = insets.top + 70 + (height - insets.top - insets.bottom - 250) / 2;
  const cheering = cheerUntil > Date.now();
  const mascot = p.paused ? 'sleepy' : cheering ? 'cheering' : 'focused';

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View style={[{ flex: 1, backgroundColor: colors.bg }, sheetStyle]}>
        {/* Background wash in the project's color family */}
        <Svg width={width} height={height} style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={sw.light} stopOpacity={1} />
              <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#wash)" />
        </Svg>
        <Scene
          kind={look.scene}
          width={width}
          height={height}
          cx={width / 2}
          cy={cy}
          ringR={ringSize / 2}
          progress={frac}
          sessionSec={p.sessionSec}
          swatch={sw}
          payoff={targetHits}
          moving={!reduced && appActive && !dimmed}
          reduced={reduced}
          dark={t.dark}
        />

        {/* Header: what's running; minimize, sound, dim */}
        <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 5 }}>
          <View style={{ width: 42, height: 42, borderRadius: radius.md, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={ICONS[habit.icon] || ICONS.code} size={22} color={sw.on} />
          </View>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 17, fontWeight: '800', color: colors.ink }}>
            {habit.name}
          </Text>
          {dimOffer && <IconButton label="Dim the screen" name="dim" size={20} color={colors.sub} bg={colors.card} diameter={40} onPress={() => setDimmed(true)} tipBelow />}
          <IconButton
            label={prefs.sound ? 'Sounds off' : 'Sounds on'}
            name={prefs.sound ? 'soundOn' : 'soundOff'}
            size={20}
            color={colors.sub}
            bg={colors.card}
            diameter={40}
            selected={prefs.sound}
            onPress={() => setPrefs({ sound: !prefs.sound })}
            tipBelow
          />
          <IconButton label="Minimize" name="chevronDown" size={22} color={colors.sub} bg={colors.card} diameter={40} onPress={actions.closeTimer} tipBelow />
        </View>

        {/* The timer */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: cy - ringSize / 2, alignItems: 'center' }}>
          <ProgressRing
            size={ringSize}
            stroke={16}
            value={frac}
            color={sw.base}
            bonusColor={sw.bonus}
            track={t.dark ? colors.track : '#FFFFFF'}
            live={!p.paused}
            rate={1 / p.targetSec}
            marker
          >
            <View style={{ width: ringSize - 56, height: ringSize - 56, borderRadius: ringSize, backgroundColor: colors.card, opacity: 0.9, position: 'absolute' }} />
            <RingLabel ringSize={ringSize} swatch={sw} />
          </ProgressRing>
        </View>

        {/* Ilmek, bottom corner */}
        <View style={{ position: 'absolute', left: 14, bottom: insets.bottom + 108, pointerEvents: 'none' }}>
          <Ilmek state={mascot} size={78} tint={look.color} />
        </View>

        <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 100, alignItems: 'center' }}>
          <MessageToast />
        </View>

        {/* Controls */}
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 20, flexDirection: 'row', gap: 12 }}>
          <Button
            variant="secondary"
            icon={p.paused ? 'play' : 'pause'}
            label={p.paused ? 'Resume' : 'Pause'}
            onPress={actions.togglePause}
            style={{ flex: 1 }}
          />
          <View ref={doneRef} collapsable={false} style={{ flex: 1 }}>
            <Button
              icon="done"
              label="Done"
              swatch={sw}
              quiet
              onPress={() => {
                if (finishing.current) return;
                finishing.current = true;
                doneRef.current?.measureInWindow((x, yy, w, h) => setBurst({ x: x + w / 2, y: yy + h / 2 }));
                // Let the burst play, then save (and close).
                setTimeout(stop, reduced ? 0 : 520);
                // A long-session question may be cancelled; allow another try.
                setTimeout(() => (finishing.current = false), 1500);
              }}
            />
          </View>
        </View>

        {burst && !reduced && <Burst x={burst.x} y={burst.y} color={sw.base} />}

        {dimmed && (
          <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <Pressable
              onPress={() => setDimmed(false)}
              accessibilityRole="button"
              accessibilityLabel="Undim the screen"
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center' }}
            >
              <SessionClock style={{ fontSize: 44, fontWeight: '800', color: '#7C818B', fontVariant: ['tabular-nums'] }} />
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * The ring's center: the count-up and today's time against the target.
 * Re-renders every second on its own, leaving the rest of focus alone.
 */
function RingLabel({ ringSize, swatch: sw }: { ringSize: number; swatch: Swatch }) {
  const t = useTheme();
  const { colors } = t;
  const p = useActiveProgress(1000);
  if (!p) return null;
  const frac = p.sec / p.targetSec;
  const earlier = p.sec - p.sessionSec;
  return (
    <View
      accessible
      accessibilityLabel={`${sayDur(p.sessionSec)} this session, ${sayDur(p.sec)} of ${sayDur(p.targetSec)} today${frac >= 1 ? ', past the target' : ''}${p.paused ? ', paused' : ''}`}
      style={{ alignItems: 'center' }}
    >
      <SessionClock style={{ fontSize: ringSize * 0.19, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'], opacity: p.paused ? 0.55 : 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, height: 22 }}>
        {frac >= 1 ? (
          <Glyph name="sparkle" size={20} color={t.dark ? sw.base : sw.dark} bg={colors.card} />
        ) : (
          <Glyph name="clock" size={15} color={colors.sub} bg={colors.card} />
        )}
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.sub, fontVariant: ['tabular-nums'] }}>
          {earlier >= 60 ? `${fmtDur(p.sec)} / ${fmtDur(p.targetSec)}` : fmtDur(p.targetSec)}
        </Text>
      </View>
    </View>
  );
}
