import React, { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

interface StepSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(v: number): void;
  accent: string;
  /** Spoken name, e.g. "Daily time budget, minutes". */
  label: string;
}

const THUMB = 26;

/**
 * A stepped slider: tap or drag along the track. Screen readers get it as an
 * adjustable control (swipe up / down to step).
 */
export function StepSlider({ value, min, max, step, onChange, accent, label }: StepSliderProps) {
  const { colors, radius, shadow } = useTheme();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const startX = useRef(0);
  const last = useRef(value);
  const cb = useRef(onChange);
  cb.current = onChange;
  last.current = value;

  const valueAt = (x: number) => {
    const w = Math.max(1, widthRef.current - THUMB);
    const t = Math.min(1, Math.max(0, (x - THUMB / 2) / w));
    return Math.round((min + t * (max - min)) / step) * step;
  };
  const set = (v: number) => {
    const c = Math.min(max, Math.max(min, v));
    if (c !== last.current) {
      last.current = c;
      cb.current(c);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the drag even when it drifts vertically (e.g. inside a page sheet).
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.locationX;
        set(valueAt(startX.current));
      },
      onPanResponderMove: (_e, g) => set(valueAt(startX.current + g.dx)),
    })
  ).current;

  const t = (value - min) / (max - min || 1);
  const thumbLeft = t * Math.max(0, width - THUMB);

  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? step : -step))}
      style={{ height: 36, justifyContent: 'center' }}
    >
      <View pointerEvents="none" style={{ height: 6, marginHorizontal: THUMB / 2, borderRadius: radius.pill, backgroundColor: colors.track }}>
        <View style={{ width: `${t * 100}%`, height: '100%', borderRadius: radius.pill, backgroundColor: accent }} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: thumbLeft,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: colors.card,
          borderWidth: 2,
          borderColor: accent,
          shadowColor: colors.shadow,
          shadowOpacity: 0.12,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </View>
  );
}
