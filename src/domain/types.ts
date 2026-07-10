// Core data model — ported 1:1 from the Streak v2 design (DCLogic state shape).

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
}

export interface Habit {
  id: string;
  projectId: string;
  name: string;
  icon: IconKey;
  /** Pastel tile background color. */
  tile: string;
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
}

export interface ActiveTimer {
  habitId: string;
  /** Epoch ms when the current running segment began, or null when paused. */
  startedAt: number | null;
  /** Accumulated seconds from previous (paused) segments. */
  baseSec: number;
}

/** The slice of state that is persisted to device storage. */
export interface PersistedState {
  projects: Project[];
  habits: Habit[];
  sessions: Session[];
  active: ActiveTimer | null;
  historyClearedAt: number;
}

/** A [name, thresholdHours] stage tuple. */
export type Stage = [name: string, hours: number];
