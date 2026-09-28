import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { confirmPushed, mergeRemote } from '../domain/sync';
import { PersistedState } from '../domain/types';
import type { SyncMeta } from '../store/storage';
import { pullChanges, pushChanges } from './remote';

export type SyncState = 'synced' | 'syncing' | 'offline';
export interface SyncStatus {
  state: SyncState;
  /** Local changes not yet confirmed by the server. */
  pending: number;
  /**
   * True once this launch's first sync attempt finished (pulled, or failed
   * offline). Records derived from all data wait for it, so they aren't
   * stamped newer than what another device already pushed.
   */
  settled: boolean;
}

interface SyncStore {
  data: PersistedState;
  sync: SyncMeta;
}

interface Options<S extends SyncStore> {
  /** False until local data is loaded, and after sign-out has started. */
  enabled: boolean;
  userId: string;
  storeRef: React.MutableRefObject<S>;
  setStore: React.Dispatch<React.SetStateAction<S>>;
  /** Bumped on every local change; syncs after LOCAL_DEBOUNCE_MS of quiet. */
  localRev: number;
  /** Bumped when the active timer changes; syncs immediately. */
  activeRev: number;
}

const LOCAL_DEBOUNCE_MS = 3000;
/** The first sync waits this long after local data loads, so the first screen draws first. */
const STARTUP_DELAY_MS = 300;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 60_000;
/** Extra push/pull rounds per run for changes queued while syncing. */
const MAX_ROUNDS = 3;

export function useSync<S extends SyncStore>({
  enabled,
  userId,
  storeRef,
  setStore,
  localRev,
  activeRev,
}: Options<S>): SyncStatus {
  const [phase, setPhase] = useState<'idle' | 'syncing' | 'error'>('syncing');
  const [settled, setSettled] = useState(false);
  const running = useRef(false);
  const again = useRef(false);
  const failures = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const unmounted = useRef(false);

  const clearTimers = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    retryTimer.current = null;
    debounceTimer.current = null;
  };

  const run = useCallback(async () => {
    if (!enabledRef.current) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    clearTimers();
    setPhase('syncing');
    try {
      let round = 0;
      do {
        again.current = false;
        const pending = Object.values(storeRef.current.sync.outbox);
        await pushChanges(pending, userId, (confirmed) => {
          if (!enabledRef.current) return;
          setStore((s) => ({ ...s, sync: { ...s.sync, outbox: confirmPushed(s.sync.outbox, confirmed) } }));
        });
        const pulled = await pullChanges(storeRef.current.sync.cursors, userId);
        if (!enabledRef.current) return;
        setStore((s) => {
          const merged = mergeRemote(s.data, s.sync.outbox, pulled.changes, Date.now());
          return {
            ...s,
            data: merged.data,
            sync: { ...s.sync, outbox: merged.outbox, cursors: { ...s.sync.cursors, ...pulled.cursors } },
          };
        });
        // Let React apply the merge, then go again if anything is still queued
        // (edits made while syncing, or follow-ups the merge produced).
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (Object.keys(storeRef.current.sync.outbox).length) again.current = true;
      } while (again.current && enabledRef.current && ++round < MAX_ROUNDS);
      failures.current = 0;
      setPhase('idle');
      setSettled(true);
      // Still queued after the last round: pick it up on the normal debounce.
      if (again.current && enabledRef.current && !unmounted.current) {
        debounceTimer.current = setTimeout(run, LOCAL_DEBOUNCE_MS);
      }
    } catch (e) {
      // Offline or server error: retry silently with exponential backoff.
      if (__DEV__) console.warn('[sync]', e);
      failures.current += 1;
      setPhase('error');
      setSettled(true);
      if (enabledRef.current && !unmounted.current) {
        const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (failures.current - 1));
        retryTimer.current = setTimeout(run, delay);
      }
    } finally {
      running.current = false;
    }
  }, [storeRef, setStore, userId]);

  // On start (once local data is loaded), just after the first screen.
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }
    const t = setTimeout(run, STARTUP_DELAY_MS);
    return () => clearTimeout(t);
  }, [enabled, run]);

  // On return to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => {
      sub.remove();
      clearTimers();
    };
  }, [run]);

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  // A few seconds after the last local change.
  useEffect(() => {
    if (!localRev || !enabled) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(run, LOCAL_DEBOUNCE_MS);
  }, [localRev, enabled, run]);

  // Right away when the timer starts, pauses or stops.
  useEffect(() => {
    if (activeRev && enabled) run();
  }, [activeRev, enabled, run]);

  const pending = Object.keys(storeRef.current.sync.outbox).length;
  const state: SyncState =
    phase === 'error' ? 'offline' : phase === 'syncing' || pending > 0 ? 'syncing' : 'synced';
  return useMemo(() => ({ state, pending, settled }), [state, pending, settled]);
}
