// Everything the Quest screen shows, from the synced data: the derived game,
// the avatar's look, the camp, and today's campfire.

import { useMemo } from 'react';

import { useQuestMeta } from '../../data/itemsRepo';
import { gameStateOf } from '../../domain/game/fromData';
import { dayPhase, DayPhase } from '../../domain/game/daylight';
import { todayOf } from '../../domain/selectors';
import type { AvatarLook } from '../../game/avatar';
import { biomeMaps } from '../../game/content/biomes';
import { fireStyleOf } from '../../game/content/shop';
import { useData, useStoreNow } from '../../store/StreakStore';
import { spotFor } from './model';

export function useQuestModel() {
  const data = useData();
  const now = useStoreNow();
  const meta = useQuestMeta();
  const game = gameStateOf(data);
  const maps = biomeMaps();
  const look: AvatarLook = useMemo(() => ({ tier: game.rank.tier, gear: meta?.props.avatar.gear ?? {} }), [game.rank.tier, meta?.props.avatar.gear]);
  const at = useMemo(() => spotFor(maps, game.journey.position.global), [maps, game.journey.position.global]);
  const today = todayOf(data, now);
  const phase: DayPhase = dayPhase(new Date(now).getHours());
  return {
    data,
    now,
    meta,
    game,
    maps,
    look,
    at,
    phase,
    fireLit: today.complete,
    fireStyle: fireStyleOf(meta?.props.campfire),
    pet: meta?.props.companion ?? null,
    chests: game.chests.unopened.length,
  };
}

export type QuestModel = ReturnType<typeof useQuestModel>;
