// Choose: the focus header's chip (a pixel sword and a count). Opened, a
// drop-down lists the habit's open weak points (the first three picked by
// order) with a quick add. Starting a timer never waits on it.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Glyph } from '../../../components/Glyph';
import { useQuestStarted, useQuestWrites } from '../../../data/itemsRepo';
import { openTasksFor, TASK_TITLE_MAX } from '../../../domain/items/ops';
import { pickWeakPoints, useQuestLocal } from '../../../game/state/local';
import { useData } from '../../../store/StreakStore';
import { useQuestTables } from '../../../sync/questTables';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text, TextInput } from '../../../components/Text';

const MAX = 3;

/** The habit's open weak points and this session's picks (null before the journey or without the tables). */
function useWeakPoints(habitId: string) {
  const data = useData();
  const started = useQuestStarted();
  const tables = useQuestTables();
  const local = useQuestLocal();
  const tasks = useMemo(() => openTasksFor(data.items, habitId), [data.items, habitId]);
  const plan = local.plan && local.plan.habitId === habitId ? local.plan : null;
  const picked = plan?.taskIds.filter((id) => tasks.some((t) => t.id === id)) ?? [];
  if (!started || tables !== 'available') return null;
  return { tasks, plan, picked };
}

/** The header chip: a pixel sword and the number picked. Nothing before the journey starts. */
export function WeakPointsChip({ habitId, open, onToggle }: { habitId: string; open: boolean; onToggle(): void }) {
  const { colors, radius } = useTheme();
  const wp = useWeakPoints(habitId);
  if (!wp) return null;
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`Weak points for this session: ${wp.picked.length}. ${open ? 'Hide' : 'Choose'}`}
      accessibilityState={{ expanded: open }}
      hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: open ? colors.well : colors.card }}
    >
      <Glyph name="sword" size={16} color={wp.picked.length ? colors.brand : colors.sub} />
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{wp.picked.length}</Text>
    </Pressable>
  );
}

/** The drop-down: pick up to three weak points, or add one. */
export function WeakPointsList({ habitId }: { habitId: string }) {
  const { colors, radius } = useTheme();
  const writes = useQuestWrites();
  const wp = useWeakPoints(habitId);
  const [text, setText] = useState('');
  const tasks = wp?.tasks;
  const hasPlan = !!wp?.plan;

  // First open: the top three by order are preselected.
  useEffect(() => {
    if (!tasks || hasPlan || !tasks.length) return;
    pickWeakPoints(habitId, tasks.slice(0, MAX).map((t) => t.id));
  }, [tasks, hasPlan, habitId]);

  if (!wp) return null;
  const { picked } = wp;
  const toggle = (id: string) => {
    const on = picked.includes(id);
    const next = on ? picked.filter((x) => x !== id) : [...picked, id].slice(-MAX);
    pickWeakPoints(habitId, next);
  };
  const add = () => {
    const t = text.trim();
    if (!t) return;
    writes.addTask(habitId, t);
    setText('');
  };

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: 10, gap: 6 }}>
      {wp.tasks.map((t) => {
        const on = picked.includes(t.id);
        return (
          <Pressable
            key={t.id}
            onPress={() => toggle(t.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={t.title}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? colors.brand : colors.muted, backgroundColor: on ? colors.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {on && <Glyph name="done" size={14} color={colors.onBrand} />}
            </View>
            <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, color: colors.ink }}>
              {t.title}
            </Text>
          </Pressable>
        );
      })}
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={add}
        placeholder="Add a weak point"
        placeholderTextColor={colors.muted}
        maxLength={TASK_TITLE_MAX}
        returnKeyType="done"
        accessibilityLabel="Add a weak point"
        style={{ minHeight: 40, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: colors.well, color: colors.ink, fontSize: 15 }}
      />
    </View>
  );
}
