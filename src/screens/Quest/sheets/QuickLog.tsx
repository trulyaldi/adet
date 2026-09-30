// A quick log (v2 N8): record something you did, at any time, without a
// session: pick the skill, write a line and/or an amount of its measure, save.
// The first three with a line each day earn a little XP and Insight.

import React, { useState } from 'react';
import { View } from 'react-native';

import { TextInput } from '../../../components/Text';
import { useQuestWrites } from '../../../data/itemsRepo';
import { LOG_BODY_MAX } from '../../../domain/items/ops';
import { itemsOfType, metricDefId } from '../../../domain/items/types';
import { activeHabits } from '../../../domain/projects';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { QUI } from '../../../game/ui/theme';
import { useData } from '../../../store/StreakStore';
import { AmountField, amountOf } from './AmountField';
import { Row } from './common';

export function QuickLog({ onDone }: { onDone(): void }) {
  const data = useData();
  const writes = useQuestWrites();
  const habits = activeHabits(data).filter((h) => h.kind !== 'check');
  const [habitId, setHabitId] = useState(habits[0]?.id ?? '');
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const metric = itemsOfType(data.items, 'metric_def').find((m) => m.id === metricDefId(habitId)) ?? null;
  const counted = amountOf(amount, metric?.id ?? null);
  const canSave = !!habitId && (text.trim().length > 0 || !!counted);
  const save = () => {
    if (!canSave) return;
    writes.addQuickLog(habitId, text, counted);
    onDone();
  };
  if (!habits.length) return null;
  return (
    <PixelPanel tone="parchment" padding={2} style={{ gap: 8 }}>
      <Row style={{ flexWrap: 'wrap', gap: 4 }}>
        {habits.map((h) => (
          <PixelButton key={h.id} small tone={habitId === h.id ? 'gold' : 'parchment'} label={h.name.slice(0, 12)} accessibilityLabel={`Log for ${h.name}`} onPress={() => setHabitId(h.id)} />
        ))}
      </Row>
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={LOG_BODY_MAX}
        placeholder="What did you do?"
        placeholderTextColor={QUI.muted}
        returnKeyType="done"
        accessibilityLabel="What did you do? One line"
        style={{ minHeight: 44, paddingHorizontal: 10, backgroundColor: QUI.white, color: QUI.ink, fontSize: 16, borderWidth: 2, borderColor: QUI.ink }}
      />
      {metric && <AmountField value={amount} onChange={setAmount} label={metric.props.label} unit={metric.props.unit} />}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <PixelButton label="Later" tone="parchment" accessibilityLabel="Close the quick log" onPress={onDone} style={{ flex: 1 }} />
        <PixelButton label="Save" accessibilityLabel="Save the quick log" onPress={save} disabled={!canSave} style={{ flex: 2 }} />
      </View>
    </PixelPanel>
  );
}
