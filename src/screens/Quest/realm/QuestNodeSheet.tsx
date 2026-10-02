// A quest's bottom sheet on the Realm screen (world-3): its title, 3 hearts
// (or a boss's phases), one big Start, a small Mark done, and an overflow
// menu to edit the title, add a phase or delete it. Adding a second phase
// turns a mob into a boss.

import React, { useState } from 'react';
import { View } from 'react-native';

import { TextInput } from '../../../components/Text';
import { QUEST_HEARTS } from '../../../domain/game/balance';
import type { PathNode, QuestView } from '../../../domain/world/select';
import { QUEST_TITLE_MAX } from '../../../domain/world/types';
import { PIXEL_FONT, PIXEL_TEXT } from '../../../game/assets/fonts';
import { SpriteView } from '../../../game/render/SpriteView';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelCheck } from '../../../game/ui/PixelCheck';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { QuestSheet, Row } from '../sheets/common';

type Edit = null | 'menu' | 'title' | 'phase' | 'delete';

export function Hearts({ n, size = 2 }: { n: number; size?: number }) {
  return (
    <Row style={{ gap: 2 }}>
      {Array.from({ length: QUEST_HEARTS }, (_, i) => (
        <View key={i} style={{ opacity: i < n ? 1 : 0.25 }}>
          <SpriteView id="icon.heart" scale={size} />
        </View>
      ))}
    </Row>
  );
}

export const inputStyle = { flex: 1, minHeight: 44, paddingHorizontal: 10, backgroundColor: QUI.white, color: QUI.ink, ...PIXEL_TEXT, fontFamily: PIXEL_FONT, fontSize: 16, borderWidth: 2, borderColor: QUI.ink };

export function QuestNodeSheet({
  node,
  reduced,
  onClose,
  onStart,
  onMarkDone,
  onRename,
  onAddPhase,
  onDelete,
}: {
  node: PathNode;
  reduced: boolean;
  onClose(): void;
  onStart(questId: string): void;
  onMarkDone(questId: string): void;
  onRename(questId: string, title: string): void;
  onAddPhase(questId: string, title: string): void;
  onDelete(questId: string): void;
}) {
  const [edit, setEdit] = useState<Edit>(null);
  const [text, setText] = useState('');
  const q = node.quest;
  const boss = node.kind === 'boss';
  const field = (label: string, submit: (t: string) => void) => (
    <Row>
      <TextInput
        value={text}
        onChangeText={setText}
        autoFocus
        maxLength={QUEST_TITLE_MAX}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (!text.trim()) return;
          submit(text);
          setText('');
          setEdit(null);
        }}
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={QUI.muted}
        style={inputStyle}
      />
    </Row>
  );
  return (
    <QuestSheet visible title={q.title} onClose={onClose} reduced={reduced}>
      <Row style={{ justifyContent: 'space-between' }}>
        {boss ? (
          <PixelText size="sm" color={QUI.wood} accessibilityLabel={`Boss: ${node.progress.cleared} of ${node.progress.total} phases cleared`}>
            Phases {node.progress.cleared}/{node.progress.total}
          </PixelText>
        ) : (
          <View accessible accessibilityLabel={`${node.hearts} of ${QUEST_HEARTS} hearts`}>
            <Hearts n={node.hearts} />
          </View>
        )}
        <PixelButton small tone="parchment" label="⋯" accessibilityLabel="More: edit, add a phase, delete" onPress={() => setEdit(edit ? null : 'menu')} />
      </Row>

      {edit === 'menu' && (
        <Row style={{ flexWrap: 'wrap' }}>
          <PixelButton small tone="parchment" label="Edit" accessibilityLabel="Edit the title" onPress={() => {
            setText(q.title);
            setEdit('title');
          }} />
          {!node.cleared && <PixelButton small tone="parchment" label="+ Phase" accessibilityLabel="Add a phase (two make a boss)" onPress={() => {
            setText('');
            setEdit('phase');
          }} />}
          <PixelButton small tone="parchment" label="Delete" accessibilityLabel="Delete this quest" onPress={() => setEdit('delete')} />
        </Row>
      )}
      {edit === 'title' && field('Title', (t) => onRename(q.id, t))}
      {edit === 'phase' && field('A phase of this quest', (t) => onAddPhase(q.id, t))}
      {edit === 'delete' && (
        <Row>
          <PixelText size="sm" style={{ flex: 1 }}>
            Delete {boss || node.phases.length ? 'it and its phases' : 'it'}?
          </PixelText>
          <PixelButton small tone="night" label="Delete" accessibilityLabel="Yes, delete it" onPress={() => onDelete(q.id)} />
          <PixelButton small tone="parchment" label="Keep" accessibilityLabel="Keep it" onPress={() => setEdit(null)} />
        </Row>
      )}

      {node.phases.map((p) => (
        <PhaseRow key={p.quest.id} phase={p} onMarkDone={onMarkDone} />
      ))}

      <Row>
        <PixelButton label="Start" accessibilityLabel={`Start a session on ${q.title}`} onPress={() => onStart(q.id)} style={{ flex: 1 }} />
        {!boss && !node.cleared && (
          <PixelButton small tone="parchment" icon={<PixelCheck />} accessibilityLabel="Mark done (finished away from the timer)" onPress={() => onMarkDone(q.id)} />
        )}
      </Row>
    </QuestSheet>
  );
}

function PhaseRow({ phase, onMarkDone }: { phase: QuestView; onMarkDone(questId: string): void }) {
  return (
    <Row style={{ minHeight: 44 }}>
      <View style={{ width: 20, alignItems: 'center' }}>{phase.cleared ? <PixelCheck /> : null}</View>
      <PixelText size="md" style={{ flex: 1, opacity: phase.cleared ? 0.55 : 1 }} accessibilityLabel={`${phase.quest.title}${phase.cleared ? ', cleared' : `, ${phase.hearts} hearts`}`}>
        {phase.quest.title}
      </PixelText>
      {!phase.cleared && <Hearts n={phase.hearts} size={1} />}
      {!phase.cleared && <PixelButton small tone="parchment" icon={<PixelCheck />} accessibilityLabel={`Mark ${phase.quest.title} done`} onPress={() => onMarkDone(phase.quest.id)} />}
    </Row>
  );
}
