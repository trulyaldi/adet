import AsyncStorage from '@react-native-async-storage/async-storage';

import { hydrate } from '../domain/migrations';
import { PersistedState } from '../domain/types';

const KEY = 'streak-v3';

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

/** Persist only the durable slice, mirroring the design's commit(). */
export async function saveState(data: PersistedState): Promise<void> {
  try {
    const { schemaVersion, projects, habits, sessions, active, historyClearedAt } = data;
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ schemaVersion, projects, habits, sessions, active, historyClearedAt })
    );
  } catch {
    // ignore write errors (parity with the design's try/catch)
  }
}
