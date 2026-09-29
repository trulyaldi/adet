// Quest settings (Q12): kept in quest_meta.settings so they follow the player.

import React from 'react';

import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import type { QuestModel } from '../useQuestModel';

export function QuestSettingsPanel(_: { model: QuestModel }) {
  return (
    <PixelText size="sm" color={QUI.muted}>
      Settings
    </PixelText>
  );
}
