// A chunky HP bar: whole segments, and a gold "ghost" of the damage just
// taken that drains away a moment later.

import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { QUI, useUiUnit } from './theme';
import { QUEST_MS } from './motion';

export function HPBar({
  hp,
  max,
  width,
  segments = 12,
  reduced,
  color = QUI.hp,
  light = QUI.hpLight,
  label,
}: {
  hp: number;
  max: number;
  /** Width in points. */
  width: number;
  segments?: number;
  reduced?: boolean;
  color?: string;
  light?: string;
  label?: string;
}) {
  const u = useUiUnit();
  const frac = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  // Whole segments (a sliver left still shows one).
  const seg = hp > 0 ? Math.max(1, Math.ceil(frac * segments)) : 0;
  const inner = width - 4 * u;
  const segW = inner / segments;
  const ghost = useSharedValue(seg);
  const prev = useRef(seg);
  useEffect(() => {
    if (seg < prev.current && !reduced) ghost.value = withDelay(380, withTiming(seg, { duration: QUEST_MS.drain }));
    else ghost.value = seg;
    prev.current = seg;
  }, [seg, reduced, ghost]);
  const ghostStyle = useAnimatedStyle(() => ({ width: Math.round(ghost.value) * segW }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Health'}
      accessibilityValue={{ min: 0, max: Math.round(max), now: Math.max(0, Math.round(hp)) }}
      style={{ width, height: 6 * u, backgroundColor: QUI.ink, padding: u }}
    >
      <View style={{ flex: 1, backgroundColor: QUI.hpBack, padding: u }}>
        <Animated.View style={[{ position: 'absolute', left: u, top: u, bottom: u, backgroundColor: QUI.hpGhost }, ghostStyle]} />
        <View style={{ flexDirection: 'row', height: '100%' }}>
          {Array.from({ length: seg }, (_, i) => (
            <View key={i} style={{ width: segW, height: '100%', paddingRight: i < segments - 1 ? Math.max(1, u / 2) : 0 }}>
              <View style={{ flex: 1, backgroundColor: color }}>
                <View style={{ height: u, backgroundColor: light }} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** A thin XP bar (HUD, character sheet). */
export function XPBar({ value, width, label }: { value: number; width: number; label?: string }) {
  const u = useUiUnit();
  const f = Math.max(0, Math.min(1, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Experience'}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(f * 100) }}
      style={{ width, height: 3 * u, backgroundColor: QUI.ink, padding: u / 2 }}
    >
      <View style={{ flex: 1, backgroundColor: QUI.nightLight }}>
        <View style={{ width: `${f * 100}%`, height: '100%', backgroundColor: QUI.xp }}>
          <View style={{ height: Math.max(1, u / 2), backgroundColor: QUI.xpLight }} />
        </View>
      </View>
    </View>
  );
}
