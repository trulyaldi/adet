import React from 'react';
import { View } from 'react-native';

import { Gesture, GestureDetector, GestureType } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { TodayItem } from '../../domain/day';
import { fmtDur, sayDur } from '../../domain/time';
import { feedback } from '../../feedback/feedback';
import { press } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { Glyph } from '../Glyph';
import { Icon } from '../Icon';
import { Press } from '../motion/Press';
import { ProgressRing } from '../motion/ProgressRing';
import { WeekDotsRow } from './WeekDotsRow';
import { Text } from '../Text';
import { SkillBadge } from './SkillBadge';

/** Height of a pending row (the sortable list's slot is this plus the gap). */
export const ROW_H = 78;

interface PlanRowProps {
  item: TodayItem;
  onStart(): void;
  onCheck(): void;
  onAside(): void;
  /** The drag handle's gesture from the sortable list. */
  dragGesture?: GestureType;
  onMove?(dir: -1 | 1): void;
}

/**
 * A planned habit: project color stripe and tile, icon, name, this week's
 * dots, and a small ring of today's time toward its share (tap to start).
 * Swipe left to set it aside for today (a moon shows through). Check-offs get
 * a round check button instead of the ring.
 */
export function PlanRow({ item, onStart, onCheck, onAside, dragGesture, onMove }: PlanRowProps) {
  const t = useTheme();
  const { colors, radius } = t;
  const sw = t.swatch(item.color);
  const x = useSharedValue(0);

  const swipe = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      x.value = Math.min(0, e.translationX);
    })
    .onEnd((e) => {
      if (e.translationX < -90 || e.velocityX < -800) {
        x.value = withTiming(-420, { duration: 180 }, () => scheduleOnRN(onAside));
      } else x.value = withSpring(0, press.out);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const moonStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, -x.value / 70), transform: [{ scale: 0.7 + Math.min(0.3, -x.value / 300) }] }));
  const frac = item.shareSec > 0 ? item.sec / item.shareSec : item.sec > 0 ? 1 : 0;
  const check = item.kind === 'check';

  return (
    <View style={{ height: ROW_H }}>
      {/* Behind the row: the set-aside moon. */}
      <Animated.View style={[{ position: 'absolute', right: 22, top: 0, bottom: 0, justifyContent: 'center' }, moonStyle]}>
        <Glyph name="moon" size={26} color={colors.sub} bg={colors.bg} />
      </Animated.View>
      <GestureDetector gesture={swipe}>
        <Animated.View style={[{ flex: 1 }, rowStyle]}>
          <Press
            kind="card"
            onPress={() => {
              feedback('tap');
              if (check) onCheck();
              else onStart();
            }}
            accessibilityRole="button"
            accessibilityLabel={
              check
                ? `${item.name}, check off`
                : `Start ${item.name}, ${sayDur(item.sec)} of ${sayDur(item.shareSec)} today`
            }
            accessibilityActions={[
              { name: 'aside', label: 'Set aside for today' },
              ...(onMove ? [{ name: 'up', label: 'Move up' }, { name: 'down', label: 'Move down' }] : []),
            ]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'aside') onAside();
              if (e.nativeEvent.actionName === 'up') onMove?.(-1);
              if (e.nativeEvent.actionName === 'down') onMove?.(1);
            }}
            style={[
              {
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: colors.card,
                borderRadius: radius.xl,
                paddingLeft: 16,
                paddingRight: 6,
                overflow: 'hidden',
              },
              t.shadow,
            ]}
          >
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: sw.base }} />
            <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={item.iconPath} size={22} color={sw.on} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text numberOfLines={2} style={{ fontSize: 16, lineHeight: 19, fontWeight: '800', color: colors.ink }}>
                {item.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <WeekDotsRow week={item.week} color={sw.base} size={7} />
                <SkillBadge habitId={item.habitId} />
              </View>
            </View>
            {check ? (
              <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: sw.base, alignItems: 'center', justifyContent: 'center' }} />
            ) : (
              <ProgressRing size={46} stroke={5} value={frac} color={sw.base} bonusColor={sw.bonus} track={sw.light}>
                <Glyph name="play" size={16} color={sw.dark} bg={colors.card} />
              </ProgressRing>
            )}
            {dragGesture ? (
              <GestureDetector gesture={dragGesture}>
                <View accessibilityLabel="Drag to reorder" style={{ width: 30, height: ROW_H, alignItems: 'center', justifyContent: 'center' }}>
                  <Glyph name="drag" size={20} color={colors.muted} />
                </View>
              </GestureDetector>
            ) : (
              <View style={{ width: 10 }} />
            )}
          </Press>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** A finished habit, collapsed: small tile, name, today's time and a check in the project color. */
export function DoneRow({ item, onPress, bonus }: { item: TodayItem; onPress(): void; bonus?: boolean }) {
  const t = useTheme();
  const { colors, radius } = t;
  const sw = t.swatch(item.color);
  return (
    <Press
      kind="card"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, done${item.sec > 0 ? `, ${sayDur(item.sec)}` : ''}${item.kind === 'check' ? ', tap to undo' : ', tap to keep going'}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: 50,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: radius.lg,
        backgroundColor: sw.light,
      }}
    >
      <View style={{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
        <Icon path={item.iconPath} size={16} color={sw.on} />
      </View>
      <Text numberOfLines={2} style={{ flex: 1, fontSize: 14.5, fontWeight: '800', color: colors.ink }}>
        {item.name}
      </Text>
      {item.sec > 0 && <Text style={{ fontSize: 13, fontWeight: '800', color: t.dark ? colors.ink : sw.dark, fontVariant: ['tabular-nums'] }}>{fmtDur(item.sec)}</Text>}
      {bonus && <Glyph name="sparkle" size={18} color={t.dark ? sw.base : sw.dark} bg={sw.light} label="Bonus" />}
      {(item.done || !bonus) && <Glyph name="done" size={22} color={t.dark ? sw.base : sw.dark} bg={sw.light} />}
    </Press>
  );
}
