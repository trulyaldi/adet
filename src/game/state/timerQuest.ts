// The quest a timer was started for (World Mode). The Realm screen's Start
// (or a typed objective or chip on the start sheet) sets it pending; the start
// sheet binds it to the habit it starts, or drops it when closed without
// starting. The binding lasts until the session's result is told. It lives in
// memory; with Projects as Realms on, a copy is kept on this device (never
// synced; see useTimerQuestPersistence) so a relaunch mid-session keeps it.

import { SESSION_MAX_SEC } from '../../domain/sessions';

export interface TimerBinding {
  questId: string;
  habitId: string;
  /** Epoch ms it was bound; a copy older than a session can last is not trusted. */
  at: number;
}

let pending: string | null = null;
let bound: TimerBinding | null = null;
/** The binding changed here, so a copy read later from this device is stale. */
let touched = false;
const listeners = new Set<(b: TimerBinding | null) => void>();

function setBound(next: TimerBinding | null): void {
  if (!bound && !next) return;
  bound = next;
  touched = true;
  listeners.forEach((l) => l(bound));
}

export function setTimerQuest(questId: string | null): void {
  pending = questId;
}

/** The quest set pending, shown on the start sheet as the chosen objective. */
export function pendingTimerQuest(): string | null {
  return pending;
}

/** The start sheet started `habitId`: the pending quest (if any) is now this session's. */
export function bindTimerQuest(habitId: string, now: number = Date.now()): void {
  const questId = pending;
  pending = null;
  setBound(questId ? { questId, habitId, at: now } : null);
}

/** The start sheet closed without starting a timer. */
export function dropTimerQuest(): void {
  pending = null;
}

/** The quest the running session for `habitId` targets, if any. */
export function boundQuest(habitId: string | null | undefined): string | null {
  return bound && habitId && bound.habitId === habitId ? bound.questId : null;
}

/** The session ended (or another habit took the timer): the binding is used up. */
export function releaseTimerQuest(): void {
  setBound(null);
}

/** Be told whenever the binding changes (to keep a copy on the device). Returns the unsubscribe. */
export function onTimerQuestChange(fn: (b: TimerBinding | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Whether `v` looks like a stored binding (shape only). */
export function isBindingShape(v: unknown): v is TimerBinding {
  const b = v as Partial<TimerBinding> | null;
  return !!b && typeof b === 'object' && typeof b.questId === 'string' && !!b.questId && typeof b.habitId === 'string' && !!b.habitId && typeof b.at === 'number' && Number.isFinite(b.at);
}

/**
 * A stored binding that still belongs to the running timer: same habit, bound
 * no longer ago than a session can last. Anything else (the timer ended, was
 * stopped on another device, or never was this one's) is null.
 */
export function parseBinding(v: unknown, activeHabitId: string | null | undefined, now: number): TimerBinding | null {
  if (!isBindingShape(v) || !activeHabitId || v.habitId !== activeHabitId) return null;
  const age = now - v.at;
  return age >= 0 && age <= SESSION_MAX_SEC * 1000 ? { questId: v.questId, habitId: v.habitId, at: v.at } : null;
}

/** Take back a binding read from the device at launch; ignored if one was made or released here since. */
export function adoptTimerQuest(b: TimerBinding | null): void {
  if (touched || !b) return;
  bound = b;
}

/** Forget everything (tests). */
export function resetTimerQuest(): void {
  pending = null;
  bound = null;
  touched = false;
  listeners.clear();
}
