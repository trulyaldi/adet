// Core data model — ported 1:1 from the Streak v2 design (DCLogic state shape).

import type { Frequency } from './frequency';
import type { ProjectColor } from './look';

export type { Frequency } from './frequency';

/**
 * v1: legacy goals/goalId shape; v2: projects/projectId without required targets;
 * v3: habits have daily and weekly targets;
 * v4: habits have a frequency and a minimum; days have a plan (local-only);
 * v5: the redesign — habit kinds, done marks, capacity, daily logs, badges.
 */
export const CURRENT_SCHEMA_VERSION = 5;

/** `timed`: a count-up timer toward a target. `check`: tap to complete, no timer. */
export type HabitKind = 'timed' | 'check';

export type IconKey =
  | 'code'
  | 'target'
  | 'book'
  | 'briefcase'
  | 'gym'
  | 'meditate'
  | 'walk'
  | 'art'
  | 'music'
  | 'pen'
  | 'leaf'
  | 'globe'
  | 'heart'
  | 'chart';

/** The animated scene behind the focus timer. */
export type SceneKind = 'plant' | 'orbit' | 'fill' | 'constellation';

export interface Project {
  id: string;
  name: string;
  /** Weekly target in hours. */
  weeklyTarget: number;
  /** Epoch ms the project was started; backfilled from earliest session on load. */
  started?: number | null;
  /**
   * Epoch ms the project was archived; null/absent when active. Archived
   * projects leave Today, Projects and pace/target counts, but their history
   * still counts in Stats.
   */
  archivedAt?: number | null;
  /** Epoch ms of the last local edit; set by the store, used for sync conflicts. */
  updatedAt?: number;
  /** Used everywhere the project appears (v5; see projectLook for the fallback). */
  color?: ProjectColor;
  icon?: IconKey;
  scene?: SceneKind;
}

export interface Habit {
  id: string;
  projectId: string;
  name: string;
  icon: IconKey;
  /** Pastel tile background color. */
  tile: string;
  /** The full session length in minutes (the habit's timer length). */
  dailyTargetMin: number;
  /**
   * Weekly time target in minutes. Kept and synced for older app versions,
   * which show it; set from the full length and frequency on save.
   */
  weeklyTargetMin: number;
  /** Epoch ms of the last local edit; set by the store, used for sync conflicts. */
  updatedAt?: number;
  /** How often the habit is due. */
  frequency: Frequency;
  /**
   * The v4 minimum session in minutes (1..dailyTargetMin). No longer shown:
   * any time counts now. Kept and synced for older app versions.
   */
  minTargetMin: number;
  /** v5; absent means timed. */
  kind?: HabitKind;
}

/**
 * A habit marked done on a day: a check-off, or "done" tapped on a timer.
 * One per habit per day (id = habitId:dkey), soft-deleted to undo.
 */
export interface Mark {
  id: string;
  habitId: string;
  /** dkey of the day it counts on. */
  day: string;
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

/**
 * The old streak, kept when the plan-based streak replaced it (schema v4) so
 * the new rules never show less than the user already had.
 */
export interface StreakCarry {
  /** The old current streak, counted through `day`. */
  current: number;
  /** The old longest streak. */
  longest: number;
  /** dkey of the last day the old streak counted (the migration day, or the day before if untracked). */
  day: string;
}

/**
 * Synced per-user preferences (one record, id "prefs"): planning capacity per
 * weekday and where weeks start.
 */
export interface UserPrefs {
  /** Minutes of planned time per weekday, 0 = Monday … 6 = Sunday. */
  capacityMin: number[];
  /** Date.getDay() of the first day of the week: 1 = Monday, 0 = Sunday. */
  weekStart: 0 | 1;
  updatedAt?: number;
}

/** One planned habit on a day's log. */
export interface LogItem {
  habitId: string;
  projectId: string;
  /** The habit's share of the day in minutes (0 for check-offs). */
  shareMin: number;
}

/**
 * A finished day's plan against what actually happened (synced, id = dkey),
 * written once after the day ends, for history and a future AI planner.
 */
export interface DailyLog {
  id: string;
  /** Capacity that day in minutes, after the light/normal/heavy tap. */
  capacityMin: number;
  plannedMin: number;
  actualMin: number;
  items: LogItem[];
  /** Planned habits done (marked, or their share reached). */
  doneCount: number;
  updatedAt?: number;
}

/** An earned milestone (synced, id = the badge key, e.g. "streak-7"). */
export interface Badge {
  id: string;
  /** Epoch ms it was earned. */
  earnedAt: number;
  updatedAt?: number;
}

/** How heavy a day feels, tapped on first open: 0.5×, 1× or 1.5× capacity. */
export type DayLevel = 'light' | 'normal' | 'heavy';

/** Local-only edits to one day's suggestion. */
export interface DayOverride {
  /** Habit ids in the order dragged to. */
  order?: string[];
  /** Habits set aside for the day (their time goes to the rest of the week). */
  aside?: string[];
  level?: DayLevel;
  /** The capacity tap was answered or dismissed. */
  prompted?: boolean;
}

/** The slice of state that is persisted to device storage. */
export interface PersistedState {
  schemaVersion: number;
  projects: Project[];
  habits: Habit[];
  sessions: Session[];
  /** v5: done marks (synced). */
  marks: Mark[];
  /** v5: capacity and week start (synced). */
  prefs: UserPrefs;
  /** v5: plan vs actual per finished day (synced). */
  dailyLogs: DailyLog[];
  /** v5: earned milestones (synced). */
  badges: Badge[];
  active: ActiveTimer | null;
  historyClearedAt: number;
  // Local-only (not synced), like historyClearedAt:
  /** Each day's plan (habit ids), fixed when the day is first shown and edited by swap/remove. */
  plans: Record<string, string[]>;
  /**
   * dkey from which days are judged by their plan. Earlier days (before this
   * device had plans) count as complete when anything was tracked.
   */
  planSince: string;
  streakCarry: StreakCarry | null;
  /** The one-time rebalance screen is still to be shown (set by the v4 migration). */
  rebalancePending: boolean;
  /** v5, local-only: per-day edits to the plan (order, set aside, capacity tap). */
  days: Record<string, DayOverride>;
  /**
   * v5, local-only: milestones already reached at the update were recorded
   * quietly (so upgrading doesn't set off a pile of celebrations).
   */
  badgesPrimed: boolean;
}

/** A [name, thresholdHours] stage tuple. */
export type Stage = [name: string, hours: number];
