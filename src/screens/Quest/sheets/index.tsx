// The sheets behind the camp's NPCs and objects, and the character.

import React from 'react';

import { useQuestReduced } from '../../../game/state/settings';
import type { QuestModel } from '../useQuestModel';
import { BoardSheet } from './BoardSheet';
import { CharacterSheet } from './CharacterSheet';
import { MerchantSheet } from './MerchantSheet';
import { SageSheet } from './SageSheet';
import { ScribeSheet } from './ScribeSheet';

export type SheetId = 'sage' | 'board' | 'merchant' | 'scribe' | 'chests' | 'character';

export function QuestSheets({ sheet, onClose, onReplayIntro, model }: { sheet: SheetId | null; onClose(): void; onOpen(id: SheetId): void; onReplayIntro(): void; model: QuestModel }) {
  const reduced = useQuestReduced();
  switch (sheet) {
    case 'sage':
      return <SageSheet model={model} onClose={onClose} reduced={reduced} />;
    case 'board':
      return <BoardSheet model={model} onClose={onClose} reduced={reduced} />;
    case 'merchant':
      return <MerchantSheet model={model} onClose={onClose} reduced={reduced} />;
    case 'scribe':
      return <ScribeSheet model={model} onClose={onClose} onReplayIntro={onReplayIntro} reduced={reduced} />;
    case 'character':
      return <CharacterSheet model={model} onClose={onClose} reduced={reduced} />;
    case 'chests':
      return <ScribeSheet model={model} onClose={onClose} onReplayIntro={onReplayIntro} reduced={reduced} initialTab="chests" />;
    default:
      return null;
  }
}
