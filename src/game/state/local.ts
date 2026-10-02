// Quest state that stays on this device (never synced): the journey
// position last shown (for the reveal) and the Overworld's current realm
// slot (where the hero token stands). Kept per account. Ceremony marks have
// their own v1 key. An old `plan` key (weak points, removed) is ignored.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

export interface QuestLocal {
  /** Journey position when the map was last shown: node index and HP left. */
  seen: { global: number; hp: number } | null;
  /** The Overworld slot the hero token stands on (null: none chosen yet). */
  slot: number | null;
}

const EMPTY: QuestLocal = { seen: null, slot: null };

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
    const slot = Number.isInteger(v.slot) && v.slot >= 0 && v.slot <= 6 ? (v.slot as number) : null;
    return { seen, slot };
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

/** Move the hero token's home to this slot (this device only). */
export function setCurrentSlot(slot: number): void {
  updateQuestLocal((s) => (s.slot === slot ? s : { ...s, slot }));
}
