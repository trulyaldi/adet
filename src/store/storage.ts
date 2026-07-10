import AsyncStorage from '@react-native-async-storage/async-storage';

import { seed } from '../domain/seed';
import { PersistedState } from '../domain/types';

const KEY = 'streak-v2';

/**
 * Load + migrate persisted state, mirroring the design's load().
 * Handles the legacy goals->projects / goalId->projectId migration and
 * backfills each project's `started` from its earliest session.
 */
export async function loadState(now: number = Date.now()): Promise<PersistedState> {
  let saved: any = null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }

  const list = saved && (saved.projects || saved.goals);
  if (!saved || (!saved.projects && !saved.goals) || !list || !list.length) {
    return seed(now);
  }

  const projects = (saved.projects || saved.goals).map((p: any) => ({
    id: p.id,
    name: p.name,
    weeklyTarget: p.weeklyTarget || 8,
    started: p.started || null,
  }));
  const habits = (saved.habits || []).map((h: any) => ({
    ...h,
    projectId: h.projectId || h.goalId,
  }));
  const sessions = saved.sessions || [];

  for (const p of projects) {
    if (p.started) continue;
    const hids = habits
      .filter((h: any) => h.projectId === p.id)
      .map((h: any) => h.id);
    let min: number | null = null;
    for (const s of sessions) {
      if (hids.includes(s.habitId) && (min === null || s.start < min)) min = s.start;
    }
    p.started = min || now;
  }

  return {
    projects,
    habits,
    sessions,
    active: saved.active || null,
    historyClearedAt: saved.historyClearedAt || 0,
  };
}

/** Persist only the durable slice, mirroring the design's commit(). */
export async function saveState(data: PersistedState): Promise<void> {
  try {
    const { projects, habits, sessions, active, historyClearedAt } = data;
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ projects, habits, sessions, active, historyClearedAt })
    );
  } catch {
    // ignore write errors (parity with the design's try/catch)
  }
}
