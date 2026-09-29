// Quest state that stays on this device (never synced): the journey
// position last shown (for the reveal) and the weak points picked for the
// running timer. Kept per account. Ceremony marks have their own v1 key.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * Weak points picked for the running timer. Matched to the saved session at
 * stop by habit and time (a pause/resume changes the timer's start, so its
 * start can't identify it).
 */
export interface ActivePlan {
  habitId: string;
  /** Epoch ms the plan was made. */
  createdAt: number;
  taskIds: string[];
}

export interface QuestLocal {
  /** Journey position when the map was last shown: node index and HP left. */
  seen: { global: number; hp: number } | null;
  plan: ActivePlan | null;
}

const EMPTY: QuestLocal = { seen: null, plan: null };

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
      v.plan && typeof v.plan.habitId === 'string' && Number.isFinite(v.plan.createdAt) && Array.isArray(v.plan.taskIds)
        ? { habitId: v.plan.habitId, createdAt: v.plan.createdAt, taskIds: v.plan.taskIds.filter((t: unknown) => typeof t === 'string').slice(0, 3) }
        : null;
    return {
      seen,
      plan,
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

/** The plan that belongs to a just-saved session: same habit, made during it. */
export function planForSession(plan: ActivePlan | null, session: { habitId: string; start: number; end: number }): string[] {
  if (!plan || plan.habitId !== session.habitId) return [];
  if (plan.createdAt < session.start - 60_000 || plan.createdAt > session.end + 1000) return [];
  return plan.taskIds;
}

export function setActivePlan(plan: ActivePlan | null): void {
  updateQuestLocal((s) => ({ ...s, plan }));
}
