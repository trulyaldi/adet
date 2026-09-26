// Core data model — ported 1:1 from the Streak v2 design (DCLogic state shape).

/**
 * v1: legacy goals/goalId shape; v2: projects/projectId without required targets;
 * v3: habits have daily and weekly targets.
 */
export const CURRENT_SCHEMA_VERSION = 3;

export type IconKey =
  | 'code'
  | 'target'
  | 'book'
  | 'briefcase'
  | 'gym'
  | 'meditate'
  | 'walk'
  | 'art';

export interface Project {
  id: string;
  name: string;
  /** Weekly target in hours. */
  weeklyTarget: number;
  /** Epoch ms the project was started; backfilled from earliest session on load. */
  started?: number | null;
  /** Epoch ms of the last local edit; set by the store, used for sync conflicts. */
  updatedAt?: number;
}

export interface Habit {
  id: string;
  projectId: string;
  name: string;
  icon: IconKey;
  /** Pastel tile background color. */
  tile: string;
  /** Daily time target in minutes. */
  dailyTargetMin: number;
  /** Weekly time target in minutes. */
  weeklyTargetMin: number;
  /** Epoch ms of the last local edit; set by the store, used for sync conflicts. */
  updatedAt?: number;
}

export interface Session {
  id: string;
  habitId: string;
  /** Epoch ms. */
  start: number;
  /** Epoch ms. */
  end: number;
  /** Duration in seconds. */
  duration: number;
  notes?: string;
  /** True when the session was logged manually rather than via the timer. */
  manual?: boolean;
  /** Epoch ms of the last local edit; set by the store, used for sync conflicts. */
  updatedAt?: number;
}

export interface ActiveTimer {
  habitId: string;
  /** Epoch ms when the current running segment began, or null when paused. */
  startedAt: number | null;
  /** Accumulated seconds from previous (paused) segments. */
  baseSec: number;
  /** Epoch ms of the last local edit; set by the store, used for sync conflicts. */
  updatedAt?: number;
}

/** The slice of state that is persisted to device storage. */
export interface PersistedState {
  schemaVersion: number;
  projects: Project[];
  habits: Habit[];
  sessions: Session[];
  active: ActiveTimer | null;
  historyClearedAt: number;
}

/** A [name, thresholdHours] stage tuple. */
export type Stage = [name: string, hours: number];
