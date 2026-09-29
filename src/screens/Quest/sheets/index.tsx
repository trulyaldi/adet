// The sheets behind the camp's NPCs and objects, and the character (Q10).

import React from 'react';

import { useQuestReduced } from '../../../game/state/settings';
import type { QuestModel } from '../useQuestModel';
import { BoardSheet } from './BoardSheet';
import { MerchantSheet } from './MerchantSheet';
import { SageSheet } from './SageSheet';
import { ScribeSheet } from './ScribeSheet';

export type SheetId = 'sage' | 'board' | 'merchant' | 'scribe' | 'chests' | 'character';

export function QuestSheets({ sheet, onClose, model }: { sheet: SheetId | null; onClose(): void; onOpen(id: SheetId): void; model: QuestModel }) {
  const reduced = useQuestReduced();
  switch (sheet) {
    case 'sage':
      return <SageSheet model={model} onClose={onClose} reduced={reduced} />;
    case 'board':
      return <BoardSheet model={model} onClose={onClose} reduced={reduced} />;
    case 'merchant':
      return <MerchantSheet model={model} onClose={onClose} reduced={reduced} />;
    case 'scribe':
      return <ScribeSheet model={model} onClose={onClose} reduced={reduced} />;
    case 'chests':
      return <ScribeSheet model={model} onClose={onClose} reduced={reduced} initialTab="chests" />;
    default:
      return null;
  }
}
