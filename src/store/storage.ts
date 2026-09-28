import AsyncStorage from '@react-native-async-storage/async-storage';

import { hydrate, MigrationContext, persistedSlice } from '../domain/migrations';
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
 * Bumped when synced rows gain columns. A device saved under an older version
 * re-pulls the tables that changed, since its cursors skipped rows whose new
 * columns an older build ignored (v2: project looks and habit kind, 005).
 */
const ROWS_VERSION = 2;
const CHANGED_TABLES: SyncTable[] = ['projects', 'habits'];

/**
 * Load + migrate persisted state, mirroring the design's load().
 * Handles the legacy goals->projects / goalId->projectId migration and
 * backfills each project's `started` from its earliest session.
 */
export async function loadState(now: number = Date.now(), ctx?: MigrationContext): Promise<PersistedState> {
  let v3: string | null = null;
  let v2: string | null = null;
  try {
    v3 = await AsyncStorage.getItem(KEY);
    if (v3 === null) v2 = await AsyncStorage.getItem('streak-v2');
  } catch {
    v3 = null;
    v2 = null;
  }
  return hydrate({ v3, v2 }, now, ctx);
}

export async function loadSyncMeta(): Promise<SyncMeta> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (!saved || typeof saved !== 'object') return EMPTY_SYNC_META;
    const cursors: SyncMeta['cursors'] = saved.cursors && typeof saved.cursors === 'object' ? { ...saved.cursors } : {};
    if (saved.rowsVersion !== ROWS_VERSION) for (const t of CHANGED_TABLES) delete cursors[t];
    return {
      ownerId: typeof saved.ownerId === 'string' ? saved.ownerId : null,
      outbox: saved.outbox && typeof saved.outbox === 'object' ? saved.outbox : {},
      cursors,
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
    await AsyncStorage.multiSet([
      [KEY, JSON.stringify(persistedSlice(data))],
      [SYNC_KEY, JSON.stringify({ ...sync, rowsVersion: ROWS_VERSION })],
    ]);
  } catch {
    // ignore write errors (parity with the design's try/catch)
  }
}
