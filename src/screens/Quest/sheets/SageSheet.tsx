// Aqyl the Owl, the Sage: one line about the player's pattern.

import React from 'react';

import { greeting, npcName } from '../../../game/content/npcs';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { useSageAdvice } from '../../../services/sage';
import type { QuestModel } from '../useQuestModel';
import { QuestSheet } from './common';

export function SageSheet({ model, onClose, reduced }: { model: QuestModel; onClose(): void; reduced: boolean }) {
  const settings = model.meta?.props.settings;
  const { advice, source, loading } = useSageAdvice(model.data, model.now);
  return (
    <QuestSheet visible title={npcName('sage', settings)} portrait="npc.sage" greeting={greeting('sage', model.now >> 20)} onClose={onClose} reduced={reduced}>
      <PixelPanel tone="wood" padding={2}>
        <PixelText color={QUI.white} accessibilityLabel={`Insight: ${advice.insight}`}>
          {advice.insight}
        </PixelText>
      </PixelPanel>
      {loading && <PixelText size="sm" color={QUI.muted}>Thinking…</PixelText>}
      {source === 'ai' && (
        <PixelText size="tiny" color={QUI.muted}>
          From the AI Sage
        </PixelText>
      )}
    </QuestSheet>
  );
}
