// Quest bookkeeping that runs whatever tab is open: loads this account's
// device-local map state and writes deterministic boss achievements. Their
// IDs merge harmlessly across devices, including after an offline session.

import { useEffect } from 'react';

import { useQuestWrites } from '../../data/itemsRepo';
import { gameStateOf } from '../../domain/game/fromData';
import { useData } from '../../store/StreakStore';
import { useAuth } from '../../sync/AuthProvider';
import { useQuestTables } from '../../sync/questTables';
import { useQuestFonts } from '../assets/fonts';
import { feedback } from '../feedback';
import { useQuestLocalFor } from './local';
import { useTimerQuestPersistence } from './useTimerQuestPersistence';

export function QuestWatcher() {
  // The pixel fonts, app-wide (a Loot sheet can open before the Quest tab ever has).
  useQuestFonts();
  const { session } = useAuth();
  useQuestLocalFor(session?.user.id ?? 'anon');
  useTimerQuestPersistence();
  const data = useData();
  const tables = useQuestTables();
  const writes = useQuestWrites();
  const game = gameStateOf(data);
  const pending = game.newAchievements;
  const started = game.journey.started;
  useEffect(() => {
    if (tables !== 'available' || !started || !pending.length) return;
    writes.addAchievements(pending);
  }, [tables, started, pending, writes]);

  // Quest sounds stay off while a timer runs; toggles apply at once.
  const running = !!data.active;
  useEffect(() => {
    feedback.setTimerActive(running);
  }, [running]);
  return null;
}
