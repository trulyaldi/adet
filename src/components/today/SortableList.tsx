import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Gesture, GestureType } from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { feedback } from '../../feedback/feedback';
import { springs } from '../../theme/motion';

interface SortableListProps<T> {
  items: T[];
  keyOf(item: T): string;
  /** Row height plus the gap below it. */
  slot: number;
  gap: number;
  renderItem(item: T, drag: GestureType, move: (dir: -1 | 1) => void): React.ReactNode;
  onReorder(keys: string[]): void;
}

type Positions = Record<string, number>;

function toPositions(keys: string[]): Positions {
  'worklet';
  const out: Positions = {};
  keys.forEach((k, i) => (out[k] = i));
  return out;
}

/**
 * A list reordered by dragging each row's handle. Rows move on the UI
 * thread with the reorder spring; the new order is reported on release.
 */
export function SortableList<T>({ items, keyOf, slot, gap, renderItem, onReorder }: SortableListProps<T>) {
  // Keyed on the order itself so a re-render mid-drag (store tick, sync) keeps the dragged positions.
  const keyStr = items.map(keyOf).join('\u0001');
  const keys = useMemo(() => (keyStr ? keyStr.split('\u0001') : []), [keyStr]);
  const positions = useSharedValue<Positions>(toPositions(keys));
  useEffect(() => {
    positions.value = toPositions(keys);
  }, [keys, positions]);

  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;
  const commit = useCallback(
    (pos: Positions) => {
      const next = Object.keys(pos).sort((a, b) => pos[a] - pos[b]);
      if (next.join() !== keys.join()) reorderRef.current(next);
    },
    [keys]
  );
  const move = (key: string, dir: -1 | 1) => {
    const i = keys.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= keys.length) return;
    const next = [...keys];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  };

  return (
    <View style={{ height: Math.max(0, items.length * slot - gap) }}>
      {items.map((item) => {
        const k = keyOf(item);
        return (
          <SortableRow key={k} id={k} count={items.length} slot={slot} positions={positions} onDrop={commit}>
            {(drag) => renderItem(item, drag, (dir) => move(k, dir))}
          </SortableRow>
        );
      })}
    </View>
  );
}

function SortableRow({
  id,
  count,
  slot,
  positions,
  onDrop,
  children,
}: {
  id: string;
  count: number;
  slot: number;
  positions: SharedValue<Positions>;
  onDrop(p: Positions): void;
  children(drag: GestureType): React.ReactNode;
}) {
  const top = useSharedValue((positions.value[id] ?? 0) * slot);
  const dragging = useSharedValue(false);
  const start = useSharedValue(0);

  useAnimatedReaction(
    () => positions.value[id],
    (p, prev) => {
      if (p === undefined || dragging.value) return;
      top.value = prev === null ? p * slot : withSpring(p * slot, springs.reorder);
    }
  );

  const drag = useMemo(
    () =>
      Gesture.Pan()
        // A short hold on the handle picks the row up, so scrolling still works.
        .activateAfterLongPress(120)
        .onStart(() => {
          dragging.value = true;
          start.value = top.value;
          scheduleOnRN(feedback, 'tap');
        })
        .onUpdate((e) => {
          top.value = Math.max(-slot * 0.3, Math.min((count - 1 + 0.3) * slot, start.value + e.translationY));
          const to = Math.max(0, Math.min(count - 1, Math.round(top.value / slot)));
          const from = positions.value[id];
          if (to === from) return;
          const next = { ...positions.value };
          for (const k of Object.keys(next)) if (next[k] === to) next[k] = from;
          next[id] = to;
          positions.value = next;
        })
        .onFinalize(() => {
          if (!dragging.value) return;
          dragging.value = false;
          top.value = withSpring(positions.value[id] * slot, springs.reorder);
          scheduleOnRN(onDrop, positions.value);
        }),
    [count, slot, id, positions, top, dragging, start, onDrop]
  );

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    right: 0,
    top: top.value,
    zIndex: dragging.value ? 10 : 0,
    transform: [{ scale: withSpring(dragging.value ? 1.03 : 1, springs.press) }],
    shadowOpacity: withSpring(dragging.value ? 0.18 : 0),
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  }));

  return <Animated.View style={style}>{children(drag)}</Animated.View>;
}
