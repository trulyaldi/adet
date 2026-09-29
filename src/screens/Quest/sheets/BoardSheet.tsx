// The Quest Board: weak points planned ahead, per habit. The board face pins
// up to three per habit; tap a habit for its full list (add, reorder, done,
// delete).

import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Icon } from '../../../components/Icon';
import { useQuestWrites } from '../../../data/itemsRepo';
import { ICONS } from '../../../domain/constants';
import { openTasksFor, tasksFor, TASK_TITLE_MAX } from '../../../domain/items/ops';
import { activeHabits } from '../../../domain/projects';
import type { Habit } from '../../../domain/types';
import { greeting } from '../../../game/content/npcs';
import { PIXEL_FONT } from '../../../game/assets/fonts';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import type { QuestModel } from '../useQuestModel';
import { QuestSheet, Row } from './common';

export function BoardSheet({ model, onClose, reduced, initialHabit }: { model: QuestModel; onClose(): void; reduced: boolean; initialHabit?: string | null }) {
  const habits = activeHabits(model.data).filter((h) => h.kind !== 'check');
  const [open, setOpen] = useState<string | null>(initialHabit ?? null);
  const habit = habits.find((h) => h.id === open);
  return (
    <QuestSheet visible title={habit ? habit.name : 'Quest Board'} portrait="prop.board" greeting={habit ? undefined : greeting('board', 0)} onClose={onClose} reduced={reduced}>
      {habit ? (
        <HabitTasks model={model} habit={habit} onBack={() => setOpen(null)} />
      ) : habits.length ? (
        habits.map((h) => {
          const top = openTasksFor(model.data.items, h.id).slice(0, 3);
          return (
            <Pressable key={h.id} onPress={() => setOpen(h.id)} accessibilityRole="button" accessibilityLabel={`${h.name}: ${top.length ? top.map((t) => t.title).join(', ') : 'no weak points yet'}. Open the list`}>
              <PixelPanel tone="parchment" padding={2} style={{ gap: 4 }}>
                <Row>
                  <Icon path={ICONS[h.icon] || ICONS.code} size={18} color={QUI.wood} />
                  <PixelText size="md" bold style={{ flex: 1 }} numberOfLines={1}>
                    {h.name}
                  </PixelText>
                  <PixelText size="md" color={QUI.wood}>
                    ›
                  </PixelText>
                </Row>
                {top.map((t) => (
                  <PixelText key={t.id} size="sm" numberOfLines={1}>
                    • {t.title}
                  </PixelText>
                ))}
                {!top.length && (
                  <PixelText size="sm" color={QUI.muted}>
                    + Add a weak point
                  </PixelText>
                )}
              </PixelPanel>
            </Pressable>
          );
        })
      ) : (
        <PixelText size="sm" color={QUI.muted}>
          Add a habit on Projects to pin weak points here.
        </PixelText>
      )}
    </QuestSheet>
  );
}

function HabitTasks({ model, habit, onBack }: { model: QuestModel; habit: Habit; onBack(): void }) {
  const writes = useQuestWrites();
  const [text, setText] = useState('');
  const [showDone, setShowDone] = useState(false);
  const all = tasksFor(model.data.items, habit.id);
  const open = all.filter((t) => t.props.status === 'open');
  const done = all.filter((t) => t.props.status === 'done');
  const move = (id: string, dir: -1 | 1) => {
    const ids = open.map((t) => t.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    writes.reorderTasks(habit.id, ids);
  };
  const add = () => {
    if (!text.trim()) return;
    writes.addTask(habit.id, text);
    setText('');
  };
  return (
    <View style={{ gap: 8 }}>
      <PixelButton small tone="parchment" label="‹ Board" accessibilityLabel="Back to the board" onPress={onBack} style={{ alignSelf: 'flex-start' }} />
      {open.map((t, i) => (
        <PixelPanel key={t.id} tone="parchment" padding={1}>
          <Row>
            <PixelButton small tone="parchment" label="☐" accessibilityLabel={`Mark ${t.title} done`} onPress={() => writes.setTaskStatus(t.id, 'done')} />
            <PixelText size="md" style={{ flex: 1 }}>
              {i < 3 ? '• ' : ''}
              {t.title}
            </PixelText>
            <PixelButton small tone="parchment" label="↑" accessibilityLabel={`Move ${t.title} up`} onPress={() => move(t.id, -1)} disabled={i === 0} />
            <PixelButton small tone="parchment" label="↓" accessibilityLabel={`Move ${t.title} down`} onPress={() => move(t.id, 1)} disabled={i === open.length - 1} />
            <PixelButton small tone="parchment" label="✕" accessibilityLabel={`Delete ${t.title}`} onPress={() => writes.deleteTask(t.id)} />
          </Row>
        </PixelPanel>
      ))}
      <Row>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
          placeholder="A weak point to strike…"
          placeholderTextColor={QUI.muted}
          maxLength={TASK_TITLE_MAX}
          returnKeyType="done"
          accessibilityLabel={`New weak point for ${habit.name}`}
          style={{ flex: 1, minHeight: 44, paddingHorizontal: 10, backgroundColor: QUI.white, color: QUI.ink, fontFamily: PIXEL_FONT, fontSize: 16, borderWidth: 2, borderColor: QUI.ink }}
        />
        <PixelButton small label="Add" accessibilityLabel="Add the weak point" onPress={add} disabled={!text.trim()} />
      </Row>
      {done.length > 0 && (
        <Pressable onPress={() => setShowDone(!showDone)} accessibilityRole="button" accessibilityLabel={`${done.length} done. ${showDone ? 'Hide' : 'Show'}`} style={{ minHeight: 44, justifyContent: 'center' }}>
          <PixelText size="sm" color={QUI.muted}>
            ✓ {done.length} done {showDone ? '▴' : '▾'}
          </PixelText>
        </Pressable>
      )}
      {showDone &&
        done.map((t) => (
          <Row key={t.id}>
            <PixelButton small tone="parchment" label="☑" accessibilityLabel={`Reopen ${t.title}`} onPress={() => writes.setTaskStatus(t.id, 'open')} />
            <PixelText size="sm" color={QUI.muted} style={{ flex: 1, textDecorationLine: 'line-through' }}>
              {t.title}
            </PixelText>
            <PixelButton small tone="parchment" label="✕" accessibilityLabel={`Delete ${t.title}`} onPress={() => writes.deleteTask(t.id)} />
          </Row>
        ))}
    </View>
  );
}
