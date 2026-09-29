// Whether this account's server has Quest Mode's tables (migration 006).
// Sync sets it from each push/pull; the Quest tab and every quest write are
// gated on it, so a server without 006 never gets quest rows queued for it
// and never stalls the rest of syncing. The last known value is kept on the
// device, so Quest works offline once it has been seen available.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { Outbox } from '../domain/sync';
import { OPTIONAL_TABLES } from './rows';

export type QuestTables = 'unknown' | 'available' | 'missing';

const KEY = 'adet-quest-tables-v1';
let state: QuestTables = 'unknown';
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((v) => {
    // A sync result that arrived first wins over the saved value.
    if (state === 'unknown' && (v === 'available' || v === 'missing')) set(v, false);
  })
  .catch(() => {});

function set(next: QuestTables, persist: boolean) {
  if (next === state) return;
  state = next;
  if (persist) AsyncStorage.setItem(KEY, next).catch(() => {});
  listeners.forEach((l) => l());
}

export function getQuestTables(): QuestTables {
  return state;
}

/** Called by sync after talking to the server. */
export function setQuestTables(next: 'available' | 'missing'): void {
  set(next, true);
}

/** What the Quest tab shows: the setup note without 006, a short wait before the first answer, else the map. */
export function questTabView(tables: QuestTables): 'setup' | 'finding' | 'map' {
  return tables === 'missing' ? 'setup' : tables === 'unknown' ? 'finding' : 'map';
}

export function questTablesReady(): boolean {
  return state === 'available';
}

export function useQuestTables(): QuestTables {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => state
  );
}

/** Outbox entries sync can send: quest rows wait while the server lacks their tables. */
export function sendableCount(outbox: Outbox): number {
  if (state !== 'missing') return Object.keys(outbox).length;
  return Object.values(outbox).filter((c) => !OPTIONAL_TABLES.includes(c.table)).length;
}
