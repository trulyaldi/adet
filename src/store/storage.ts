import AsyncStorage from '@react-native-async-storage/async-storage';

import { hydrate } from '../domain/migrations';
import { Outbox, SyncTable } from '../domain/sync';
import { PersistedState } from '../domain/types';

const KEY = 'streak-v3';
const SYNC_KEY = 'streak-sync-v1';

/** Sync bookkeeping, saved alongside the data so the two never drift apart. */
export interface SyncMeta {
  /** The account this device's data belongs to; null until first sign-in. */
  ownerId: string | null;
  outbox: Outbox;
  /** Latest server_updated_at (epoch ms) pulled, per table. */
  cursors: Partial<Record<SyncTable, number>>;
}

export const EMPTY_SYNC_META: SyncMeta = { ownerId: null, outbox: {}, cursors: {} };

/**
 * Load + migrate persisted state, mirroring the design's load().
 * Handles the legacy goals->projects / goalId->projectId migration and
 * backfills each project's `started` from its earliest session.
 */
export async function loadState(now: number = Date.now()): Promise<PersistedState> {
  let v3: string | null = null;
  let v2: string | null = null;
  try {
    v3 = await AsyncStorage.getItem(KEY);
    if (v3 === null) v2 = await AsyncStorage.getItem('streak-v2');
  } catch {
    v3 = null;
    v2 = null;
  }
  return hydrate({ v3, v2 }, now);
}

export async function loadSyncMeta(): Promise<SyncMeta> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (!saved || typeof saved !== 'object') return EMPTY_SYNC_META;
    return {
      ownerId: typeof saved.ownerId === 'string' ? saved.ownerId : null,
      outbox: saved.outbox && typeof saved.outbox === 'object' ? saved.outbox : {},
      cursors: saved.cursors && typeof saved.cursors === 'object' ? saved.cursors : {},
    };
  } catch {
    return EMPTY_SYNC_META;
  }
}

/** Remove all persisted app data from this device (used on sign-out). */
export async function clearState(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY, 'streak-v2', SYNC_KEY]);
  } catch {
    // ignore
  }
}

/** Persist the durable slice and sync bookkeeping in one write. */
export async function saveState(data: PersistedState, sync: SyncMeta): Promise<void> {
  try {
    const { schemaVersion, projects, habits, sessions, active, historyClearedAt } = data;
    await AsyncStorage.multiSet([
      [KEY, JSON.stringify({ schemaVersion, projects, habits, sessions, active, historyClearedAt })],
      [SYNC_KEY, JSON.stringify(sync)],
    ]);
  } catch {
    // ignore write errors (parity with the design's try/catch)
  }
}
