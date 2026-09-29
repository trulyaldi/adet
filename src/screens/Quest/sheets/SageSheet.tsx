// Aqyl the Owl, the Sage: up to three suggested weak points (pin adds or
// lifts one onto the Quest Board, dismiss hides it for today) and one line
// about the player's pattern.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '../../../components/Icon';
import { useQuestWrites } from '../../../data/itemsRepo';
import { ICONS } from '../../../domain/constants';
import { openTasksFor } from '../../../domain/items/ops';
import { Suggestion } from '../../../domain/game/sageFallback';
import { greeting, npcName } from '../../../game/content/npcs';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { useSageAdvice } from '../../../services/sage';
import type { QuestModel } from '../useQuestModel';
import { QuestSheet, Row } from './common';

const DISMISS_KEY = 'adet-sage-dismissed-v1';
const keyOf = (s: Suggestion) => `${s.habitId}:${s.taskId ?? s.title}`;

export function SageSheet({ model, onClose, reduced }: { model: QuestModel; onClose(): void; reduced: boolean }) {
  const settings = model.meta?.props.settings;
  const { advice, source, loading } = useSageAdvice(model.data, model.now);
  const writes = useQuestWrites();
  const today = new Date(model.now).toDateString();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY)
      .then((raw) => {
        const v = raw ? JSON.parse(raw) : null;
        if (v && v.day === today && Array.isArray(v.keys)) setDismissed(v.keys);
      })
      .catch(() => {});
  }, [today]);
  const dismiss = (k: string) => {
    const next = [...dismissed, k];
    setDismissed(next);
    AsyncStorage.setItem(DISMISS_KEY, JSON.stringify({ day: today, keys: next })).catch(() => {});
  };
  const pin = (s: Suggestion) => {
    if (s.taskId) {
      // Lift it to the top of its habit's board.
      const ids = openTasksFor(model.data.items, s.habitId).map((t) => t.id);
      writes.reorderTasks(s.habitId, [s.taskId, ...ids.filter((i) => i !== s.taskId)]);
    } else writes.addTask(s.habitId, s.title);
    setPinned((p) => [...p, keyOf(s)]);
  };
  const habitOf = (id: string) => model.data.habits.find((h) => h.id === id);
  const shown = advice.suggestions.filter((s) => !dismissed.includes(keyOf(s)) && habitOf(s.habitId));
  return (
    <QuestSheet visible title={npcName('sage', settings)} portrait="npc.sage" greeting={greeting('sage', model.now >> 20)} onClose={onClose} reduced={reduced}>
      <PixelPanel tone="wood" padding={2}>
        <PixelText color={QUI.white} accessibilityLabel={`Insight: ${advice.insight}`}>
          {advice.insight}
        </PixelText>
      </PixelPanel>
      {loading && <PixelText size="sm" color={QUI.muted}>Thinking…</PixelText>}
      {shown.length === 0 && !loading && (
        <PixelText size="sm" color={QUI.muted}>
          Nothing to add today. Write a line after your next session.
        </PixelText>
      )}
      {shown.map((s) => {
        const h = habitOf(s.habitId)!;
        const k = keyOf(s);
        const done = pinned.includes(k);
        return (
          <PixelPanel key={k} tone="parchment" padding={2}>
            <Row>
              <Icon path={ICONS[h.icon] || ICONS.code} size={20} color={QUI.wood} />
              <View style={{ flex: 1 }}>
                <PixelText size="tiny" color={QUI.muted}>
                  {h.name}
                </PixelText>
                <PixelText size="md">{s.title}</PixelText>
              </View>
              <PixelButton small tone={done ? 'parchment' : 'gold'} label={done ? '✓' : 'Pin'} accessibilityLabel={done ? `${s.title}, pinned` : `Pin ${s.title} to the Quest Board`} onPress={() => !done && pin(s)} disabled={done} />
              {!done && <PixelButton small tone="parchment" label="✕" accessibilityLabel={`Dismiss ${s.title}`} onPress={() => dismiss(k)} />}
            </Row>
          </PixelPanel>
        );
      })}
      {source === 'ai' && (
        <PixelText size="tiny" color={QUI.muted}>
          From the AI Sage
        </PixelText>
      )}
    </QuestSheet>
  );
}
