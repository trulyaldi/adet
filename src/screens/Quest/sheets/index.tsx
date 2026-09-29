// The sheets behind the camp's NPCs and objects (Q7) and the character (Q10).

import React from 'react';

import type { QuestModel } from '../useQuestModel';

export type SheetId = 'sage' | 'board' | 'merchant' | 'scribe' | 'chests' | 'character';

export function QuestSheets(_: { sheet: SheetId | null; onClose(): void; onOpen(id: SheetId): void; model: QuestModel }) {
  return null;
}
