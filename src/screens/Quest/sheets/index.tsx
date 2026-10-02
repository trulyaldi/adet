// The sheets behind the camp's NPCs and objects, and the character.

import React from 'react';

import { SkiaBoundary } from '../../../game/render/SkiaBoundary';
import { useQuestReduced } from '../../../game/state/settings';
import type { QuestModel } from '../useQuestModel';
import { CharacterSheet } from './CharacterSheet';
import { MerchantSheet } from './MerchantSheet';
import { SageSheet } from './SageSheet';
import { ScribeSheet } from './ScribeSheet';

export type SheetId = 'sage' | 'merchant' | 'scribe' | 'chests' | 'character' | 'quicklog' | 'trail';

export function QuestSheets(p: { sheet: SheetId | null; onClose(): void; onOpen(id: SheetId): void; onReplayIntro(): void; model: QuestModel }) {
  // A sheet that fails to draw just closes; the map behind it stays.
  return (
    <SkiaBoundary key={p.sheet ?? 'none'} fallback={null} onError={p.onClose}>
      <Sheet {...p} />
    </SkiaBoundary>
  );
}

function Sheet({ sheet, onClose, onReplayIntro, model }: { sheet: SheetId | null; onClose(): void; onReplayIntro(): void; model: QuestModel }) {
  const reduced = useQuestReduced();
  switch (sheet) {
    case 'sage':
      return <SageSheet model={model} onClose={onClose} reduced={reduced} />;
    case 'merchant':
      return <MerchantSheet model={model} onClose={onClose} reduced={reduced} />;
    case 'scribe':
      return <ScribeSheet model={model} onClose={onClose} onReplayIntro={onReplayIntro} reduced={reduced} />;
    case 'character':
      return <CharacterSheet model={model} onClose={onClose} reduced={reduced} />;
    case 'chests':
      return <ScribeSheet model={model} onClose={onClose} onReplayIntro={onReplayIntro} reduced={reduced} initialTab="chests" />;
    case 'quicklog':
      return <ScribeSheet model={model} onClose={onClose} onReplayIntro={onReplayIntro} reduced={reduced} quickLog />;
    case 'trail':
      return <ScribeSheet model={model} onClose={onClose} onReplayIntro={onReplayIntro} reduced={reduced} initialTab="trail" />;
    default:
      return null;
  }
}
