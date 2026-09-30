// Quest Mode's part of the focus view: the weak points row under the header
// and the Stage (your character fighting the current enemy). Both are optional:
// nothing shows before the journey starts, and the Stage can be turned off in
// Quest settings (your character then stands alone in a corner).

import React from 'react';
import { View } from 'react-native';

import { useQuestStarted } from '../../../data/itemsRepo';
import { StageBand, stageSize } from '../../../domain/game/stage';
import { QUEST_ENABLED } from '../../../game/enabled';
import { loadStage } from '../../../game/render/screens';
import { SkiaGate } from '../../../game/render/SkiaGate';
import { useQuestReduced, useQuestSettings } from '../../../game/state/settings';
import { useQuestTables } from '../../../sync/questTables';
import { useAppActive } from '../../../theme/useMotion';
import { WeakPointsRow } from './WeakPointsRow';

export function QuestFocusRow({ habitId, top }: { habitId: string; top: number }) {
  if (!QUEST_ENABLED) return null;
  return (
    <View style={{ position: 'absolute', top, left: 16, right: 16, zIndex: 6 }}>
      <WeakPointsRow habitId={habitId} />
    </View>
  );
}

/**
 * The timer screen's scene (the Stage) once the journey has started and the
 * setting is on; otherwise `portrait`, your character alone. The Stage never
 * reaches the timer ring, and a failed draw falls back to the portrait.
 */
export function QuestFocusStage({ band, paused, dimmed, portrait }: { band: StageBand; paused: boolean; dimmed: boolean; portrait: React.ReactNode }) {
  if (!QUEST_ENABLED) return <>{portrait}</>;
  return <StageSlot band={band} paused={paused} dimmed={dimmed} portrait={portrait} />;
}

function StageSlot({ band, dimmed, portrait }: { band: StageBand; paused: boolean; dimmed: boolean; portrait: React.ReactNode }) {
  const started = useQuestStarted();
  const { battleStrip } = useQuestSettings();
  const tables = useQuestTables();
  const reduced = useQuestReduced();
  const active = useAppActive();
  if (!started || tables !== 'available' || !battleStrip) return <>{portrait}</>;
  const { height, slim } = stageSize(band);
  if (height < 48) return <>{portrait}</>;
  const w = band.width - 32;
  return (
    <View style={{ position: 'absolute', left: 16, top: band.bottom - height, width: w, height }}>
      <SkiaGate load={loadStage} props={{ width: w, height, slim, live: active && !dimmed, reduced }} errorFallback={portrait} />
    </View>
  );
}
