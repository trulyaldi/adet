// Quest Mode's part of the focus view: the weak points row under the header
// and the battle strip beside Ilmek. Both are optional: nothing shows before
// the journey starts, and the strip can be turned off in Quest settings.

import React from 'react';
import { useWindowDimensions, View } from 'react-native';

import { useQuestStarted } from '../../../data/itemsRepo';
import { QUEST_ENABLED } from '../../../game/enabled';
import { loadBattleStrip } from '../../../game/render/screens';
import { SkiaGate } from '../../../game/render/SkiaGate';
import { useQuestReduced, useQuestSettings } from '../../../game/state/settings';
import { useQuestTables } from '../../../sync/questTables';
import { useAppActive } from '../../../theme/useMotion';
import { STRIP_H } from './stripSize';
import { WeakPointsRow } from './WeakPointsRow';

export function QuestFocusRow({ habitId, top }: { habitId: string; top: number }) {
  if (!QUEST_ENABLED) return null;
  return (
    <View style={{ position: 'absolute', top, left: 16, right: 16, zIndex: 6 }}>
      <WeakPointsRow habitId={habitId} />
    </View>
  );
}

export function QuestFocusStrip(p: { bottom: number; left: number; paused: boolean; dimmed: boolean }) {
  return QUEST_ENABLED ? <Strip {...p} /> : null;
}


function Strip({ bottom, left, paused, dimmed }: { bottom: number; left: number; paused: boolean; dimmed: boolean }) {
  const started = useQuestStarted();
  const { battleStrip } = useQuestSettings();
  const tables = useQuestTables();
  const reduced = useQuestReduced();
  const active = useAppActive();
  const { width } = useWindowDimensions();
  if (!started || tables !== 'available' || !battleStrip) return null;
  const w = width - left - 16;
  return (
    <View style={{ position: 'absolute', left, bottom, width: w, height: STRIP_H }}>
      <SkiaGate load={loadBattleStrip} props={{ running: active && !paused && !dimmed, reduced, width: w }} />
    </View>
  );
}
