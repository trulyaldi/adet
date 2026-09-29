// Quest bookkeeping that runs whatever tab is open: loads this account's
// device-local quest state, and records newly reached milestones
// (append-only achievements) once sync has settled, so a device that hasn't
// pulled yet never re-records what another already did.

import { useEffect } from 'react';

import { useQuestWrites } from '../../data/itemsRepo';
import { gameStateOf } from '../../domain/game/fromData';
import { useData, useStoreNow, useSyncStatus } from '../../store/StreakStore';
import { useAuth } from '../../sync/AuthProvider';
import { useQuestTables } from '../../sync/questTables';
import { useQuestLocalFor } from './local';

export function QuestWatcher() {
  const { session } = useAuth();
  useQuestLocalFor(session?.user.id ?? 'anon');
  const data = useData();
  const now = useStoreNow();
  const { settled } = useSyncStatus();
  const tables = useQuestTables();
  const writes = useQuestWrites();
  const game = gameStateOf(data, now);
  const pending = game.newAchievements;
  const started = game.journey.started;
  useEffect(() => {
    if (!settled || tables !== 'available' || !started || !pending.length) return;
    writes.addAchievements(pending);
  }, [settled, tables, started, pending, writes]);
  return null;
}
