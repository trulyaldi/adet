// Quest state that stays on this device (never synced): the journey
// position last shown (for the reveal), ceremonies already played, and the
// weak points picked for the running timer. Kept per account.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

export interface ActivePlan {
  habitId: string;
  /** The timer it belongs to (ActiveTimer identity: habit + first start). */
  timerKey: string;
  taskIds: string[];
}

export interface QuestLocal {
  /** Journey position when the map was last shown: node index and HP left. */
  seen: { global: number; hp: number } | null;
  /** Ceremony event ids already played (level:12, rank:Knight, boss:forest:0…). */
  played: string[];
  plan: ActivePlan | null;
  /** The level the ceremonies last caught up to. */
  shownLevel: number | null;
  /** History up to the first view was recorded as played (no replays). */
  primed: boolean;
}

const EMPTY: QuestLocal = { seen: null, played: [], plan: null, shownLevel: null, primed: false };
const MAX_PLAYED = 400;

let user: string | null = null;
let state: QuestLocal = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();
const key = (u: string) => `adet-quest-local-v1:${u}`;

function emit() {
  listeners.forEach((l) => l());
}

function parse(raw: string | null): QuestLocal {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') return EMPTY;
    const seen = v.seen && Number.isFinite(v.seen.global) && Number.isFinite(v.seen.hp) ? { global: v.seen.global, hp: v.seen.hp } : null;
    const plan =
      v.plan && typeof v.plan.habitId === 'string' && typeof v.plan.timerKey === 'string' && Array.isArray(v.plan.taskIds)
        ? { habitId: v.plan.habitId, timerKey: v.plan.timerKey, taskIds: v.plan.taskIds.filter((t: unknown) => typeof t === 'string').slice(0, 3) }
        : null;
    return {
      seen,
      played: Array.isArray(v.played) ? v.played.filter((p: unknown) => typeof p === 'string').slice(-MAX_PLAYED) : [],
      plan,
      shownLevel: Number.isFinite(v.shownLevel) ? v.shownLevel : null,
      primed: v.primed === true,
    };
  } catch {
    return EMPTY;
  }
}

/** Load this account's state (once per sign-in). */
export function useQuestLocalFor(userId: string): void {
  useEffect(() => {
    if (user === userId && loaded) return;
    user = userId;
    loaded = false;
    state = EMPTY;
    emit();
    AsyncStorage.getItem(key(userId))
      .then((raw) => {
        if (user !== userId) return;
        state = parse(raw);
        loaded = true;
        emit();
      })
      .catch(() => {
        loaded = true;
        emit();
      });
  }, [userId]);
}

export function getQuestLocal(): QuestLocal {
  return state;
}

export function questLocalLoaded(): boolean {
  return loaded;
}

export function updateQuestLocal(fn: (s: QuestLocal) => QuestLocal): void {
  const next = fn(state);
  if (next === state) return;
  state = next;
  if (user) AsyncStorage.setItem(key(user), JSON.stringify(state)).catch(() => {});
  emit();
}

/** Record every event reached so far as played (first view on this device). */
export function primeLocal(ids: string[], level: number): void {
  updateQuestLocal((s) => (s.primed ? s : { ...s, primed: true, shownLevel: level, played: [...new Set([...s.played, ...ids])].slice(-MAX_PLAYED) }));
}

export function markPlayed(id: string): void {
  updateQuestLocal((s) => (s.played.includes(id) ? s : { ...s, played: [...s.played, id].slice(-MAX_PLAYED) }));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useQuestLocal(): QuestLocal & { loaded: boolean } {
  const s = useSyncExternalStore(subscribe, () => state);
  const l = useSyncExternalStore(subscribe, () => loaded);
  return { ...s, loaded: l };
}
