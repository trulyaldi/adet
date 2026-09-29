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
import { primeIds } from '../ceremonies';
import { primeLocal, useQuestLocal, useQuestLocalFor } from './local';

export function QuestWatcher() {
  const { session } = useAuth();
  useQuestLocalFor(session?.user.id ?? 'anon');
  const data = useData();
  const now = useStoreNow();
  const { settled } = useSyncStatus();
  const tables = useQuestTables();
  const writes = useQuestWrites();
  const game = gameStateOf(data);
  const pending = game.newAchievements;
  const started = game.journey.started;
  useEffect(() => {
    if (!settled || tables !== 'available' || !started || !pending.length) return;
    writes.addAchievements(pending);
  }, [settled, tables, started, pending, writes]);

  // A device seeing an already-started journey for the first time (a second
  // device, a reinstall) records the history as played: no replayed cutscenes.
  const local = useQuestLocal();
  useEffect(() => {
    if (!local.loaded || local.primed || !started || !settled) return;
    primeLocal(primeIds(game), game.xp.level);
  }, [local.loaded, local.primed, started, settled, game]);
  return null;
}
