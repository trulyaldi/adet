// Choose: a collapsed row on the focus view (a sword and a count). Opened,
// it lists the habit's open weak points (the first three picked by order)
// with a quick add. Starting a timer never waits on it.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Glyph } from '../../../components/Glyph';
import { useQuestStarted, useQuestWrites } from '../../../data/itemsRepo';
import { openTasksFor, TASK_TITLE_MAX } from '../../../domain/items/ops';
import { pickWeakPoints, useQuestLocal } from '../../../game/state/local';
import { useData } from '../../../store/StreakStore';
import { useQuestTables } from '../../../sync/questTables';
import { useTheme } from '../../../theme/ThemeProvider';

const MAX = 3;

export function WeakPointsRow({ habitId }: { habitId: string }) {
  const { colors, radius } = useTheme();
  const data = useData();
  const started = useQuestStarted();
  const tables = useQuestTables();
  const writes = useQuestWrites();
  const local = useQuestLocal();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const tasks = useMemo(() => openTasksFor(data.items, habitId), [data.items, habitId]);
  const plan = local.plan && local.plan.habitId === habitId ? local.plan : null;
  const picked = plan?.taskIds.filter((id) => tasks.some((t) => t.id === id)) ?? [];

  // First open: the top three by order are preselected.
  useEffect(() => {
    if (!open || plan || !tasks.length) return;
    pickWeakPoints(habitId, tasks.slice(0, MAX).map((t) => t.id));
  }, [open, plan, tasks, habitId]);

  if (!started || tables !== 'available') return null;

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
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityLabel={`Weak points for this session: ${picked.length}. ${open ? 'Hide' : 'Choose'}`}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.card, minHeight: 36 }}
      >
        <Glyph name="sword" size={16} color={picked.length ? colors.brand : colors.sub} />
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{picked.length}</Text>
        <Glyph name={open ? 'chevronUp' : 'chevronDown'} size={14} color={colors.sub} />
      </Pressable>
      {open && (
        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: 10, gap: 6 }}>
          {tasks.map((t) => {
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
      )}
    </View>
  );
}
