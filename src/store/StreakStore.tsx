import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { AppConfig, DEFAULT_CONFIG } from '../domain/config';
import { TILES } from '../domain/constants';
import { activeSec, recommendedHabitId } from '../domain/engine';
import { clampReminderHours, reminderFireAt } from '../domain/reminder';
import { seed } from '../domain/seed';
import {
  applySessionEdit,
  checkSessionTimes,
  defaultManualStart,
  manualSession,
  restoreSession,
} from '../domain/sessions';
import { allAsChanges, enqueue, isUntouchedSeed, stampLocalChanges } from '../domain/sync';
import {
  ActiveTimer,
  CURRENT_SCHEMA_VERSION,
  Habit,
  IconKey,
  PersistedState,
  Session,
} from '../domain/types';
import { requestReminderPermission, syncReminder } from '../notifications/reminder';
import { SyncStatus, useSync } from '../sync/useSync';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';
import { clearState, EMPTY_SYNC_META, loadState, loadSyncMeta, saveState, SyncMeta } from './storage';

export type Screen = 'today' | 'projects' | 'stats';

export interface HabitSheetState {
  id: string | null;
  name: string;
  icon: IconKey;
  projectId: string;
  dailyTargetMin: number;
  weeklyTargetMin: number;
}
export interface ProjectSheetState {
  id: string | null;
  name: string;
  weeklyTarget: number;
}
export interface LogSheetState {
  habitId: string | null;
  /** Epoch ms. */
  start: number;
  /** Whether the length is entered as a duration or as an end time. */
  mode: 'duration' | 'end';
  /** Duration in minutes (mode 'duration'). */
  minutes: number;
  /** Epoch ms (mode 'end'). */
  end: number;
  note: string;
  /** Validation message from the last save attempt. */
  error: string | null;
  /** True once the user was asked to confirm a long (>8h) session. */
  confirmLong: boolean;
}

/** The end time a log sheet currently describes, whichever way it's entered. */
export function logSheetEnd(sh: LogSheetState): number {
  return sh.mode === 'duration' ? sh.start + sh.minutes * 60000 : sh.end;
}
export interface SessionSheetState {
  id: string;
  habitId: string;
  /** Epoch ms. */
  start: number;
  /** Epoch ms. */
  end: number;
  note: string;
  /** Validation message from the last save attempt. */
  error: string | null;
  /** True once the user was asked to confirm a long (>8h) session. */
  confirmLong: boolean;
}

export interface UIState {
  screen: Screen;
  timerOpen: boolean;
  heatSel: string | null;
  heatSheet: boolean;
  clearArmed: boolean;
  habitSheet: HabitSheetState | null;
  projectSheet: ProjectSheetState | null;
  stageSheet: string | null; // projectId
  logSheet: LogSheetState | null;
  sessionSheet: SessionSheetState | null;
  /** The last deleted session, offered for undo until the toast expires. */
  undo: Session | null;
}

const INITIAL_UI: UIState = {
  screen: 'today',
  timerOpen: false,
  heatSel: null,
  heatSheet: false,
  clearArmed: false,
  habitSheet: null,
  projectSheet: null,
  stageSheet: null,
  logSheet: null,
  sessionSheet: null,
  undo: null,
};

/** How long the "Session deleted · Undo" toast stays up. */
export const UNDO_MS = 5000;

export interface StreakActions {
  // navigation
  setScreen(s: Screen): void;
  // timer
  startTimer(habitId: string): void;
  openTimer(): void;
  closeTimer(): void;
  togglePause(): void;
  stopTimer(): void;
  // heatmap
  openHeatSheet(): void;
  closeHeatSheet(): void;
  pickHeat(key: string): void;
  closeHeatSel(): void;
  // recent-sessions clear
  armClear(): void;
  cancelClear(): void;
  confirmClear(): void;
  // habit sheet
  openNewHabit(projectId: string): void;
  openEditHabit(habit: Habit): void;
  closeHabitSheet(): void;
  patchHabitSheet(patch: Partial<HabitSheetState>): void;
  saveHabitSheet(): void;
  deleteHabit(id: string): void;
  mergeHabit(fromId: string, intoId: string): void;
  // project sheet
  openNewProject(): void;
  openEditProject(project: { id: string; name: string; weeklyTarget: number }): void;
  closeProjectSheet(): void;
  patchProjectSheet(patch: Partial<ProjectSheetState>): void;
  saveProjectSheet(): void;
  deleteProject(id: string): void;
  // stage sheet
  openStageSheet(projectId: string): void;
  closeStageSheet(): void;
  // log-time sheet
  openLogSheet(): void;
  closeLogSheet(): void;
  patchLogSheet(patch: Partial<LogSheetState>): void;
  saveLogSheet(): void;
  // edit-session sheet
  openSessionSheet(sessionId: string): void;
  closeSessionSheet(): void;
  patchSessionSheet(patch: Partial<SessionSheetState>): void;
  saveSessionSheet(): void;
  deleteSession(id: string): void;
  undoDelete(): void;
  // device settings
  setReminderHours(hours: number): void;
}

interface StreakContextValue {
  ready: boolean;
  data: PersistedState;
  ui: UIState;
  now: number;
  config: AppConfig;
  /** Device-only preferences (not synced). */
  settings: AppSettings;
  actions: StreakActions;
  sync: SyncStatus;
  /** Stop syncing and erase this device's data and sync state (before sign-out). */
  clearLocalData(): Promise<void>;
}

const StreakContext = createContext<StreakContextValue | null>(null);

const EMPTY_DATA: PersistedState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  projects: [],
  habits: [],
  sessions: [],
  active: null,
  historyClearedAt: 0,
};

/** Build a completed session from the active timer (mirrors saveActive()). */
function sessionFromActive(active: ActiveTimer, end: number): Session {
  const dur = Math.max(
    1,
    Math.round(active.baseSec + (active.startedAt ? (end - active.startedAt) / 1000 : 0))
  );
  return {
    id: 's' + end,
    habitId: active.habitId,
    start: end - dur * 1000,
    end,
    duration: dur,
  };
}

interface StoreState {
  data: PersistedState;
  sync: SyncMeta;
  /** Bumped on every local data change (drives the debounced sync). */
  localRev: number;
  /** Bumped when a local change touches the active timer (syncs immediately). */
  activeRev: number;
}

const SAVE_DEBOUNCE_MS = 500;

/**
 * Prepare freshly loaded data for `userId`. On this device's first sign-in to
 * that account, untouched seed data is dropped (the server is the source of
 * truth) and anything else is queued so it's pushed before the first pull.
 */
function forUser(data: PersistedState, meta: SyncMeta, userId: string, now: number): StoreState {
  const base = { localRev: 0, activeRev: 0 };
  if (meta.ownerId === userId) return { ...base, data, sync: meta };
  const fresh: SyncMeta = { ...EMPTY_SYNC_META, ownerId: userId };
  // Data owned by a different account is never uploaded into this one.
  if (meta.ownerId !== null || isUntouchedSeed(data, seed(now))) {
    return { ...base, data: EMPTY_DATA, sync: fresh };
  }
  return { ...base, data, sync: { ...fresh, outbox: enqueue({}, allAsChanges(data)) } };
}

export function StreakProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [wiped, setWiped] = useState(false);
  const [store, setStore] = useState<StoreState>({
    data: EMPTY_DATA,
    sync: EMPTY_SYNC_META,
    localRev: 0,
    activeRev: 0,
  });
  const data = store.data;
  const [ui, setUi] = useState<UIState>(INITIAL_UI);
  const [now, setNow] = useState(() => Date.now());
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  /** Bumped when notification permission is granted, so the reminder reschedules. */
  const [permRev, setPermRev] = useState(0);

  const storeRef = useRef(store);
  storeRef.current = store;
  const wipedRef = useRef(false);

  // Load persisted state once.
  useEffect(() => {
    let mounted = true;
    Promise.all([loadState(), loadSyncMeta(), loadSettings()]).then(([loaded, meta, prefs]) => {
      if (!mounted) return;
      const next = forUser(loaded, meta, userId, Date.now());
      setStore(next);
      setSettings(prefs);
      if (next.sync !== meta) saveState(next.data, next.sync);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [userId]);

  /**
   * Every local mutation goes through here: records the action touched are
   * stamped and queued for push. Remote merges bypass this (see useSync).
   */
  const setData = useCallback((fn: (d: PersistedState) => PersistedState) => {
    setStore((s) => {
      const next = fn(s.data);
      if (next === s.data) return s;
      const { data: stamped, changes } = stampLocalChanges(s.data, next, Date.now());
      if (!changes.length) return { ...s, data: stamped };
      return {
        ...s,
        data: stamped,
        sync: { ...s.sync, outbox: enqueue(s.sync.outbox, changes) },
        localRev: s.localRev + 1,
        activeRev: changes.some((c) => c.table === 'active_timers') ? s.activeRev + 1 : s.activeRev,
      };
    });
  }, []);

  // Persist data + sync state, debounced; flushed when the app backgrounds or
  // the provider unmounts so a quick close doesn't lose the last change.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (wipedRef.current) return;
    saveState(storeRef.current.data, storeRef.current.sync);
  }, []);
  useEffect(() => {
    if (!ready || wipedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }, [store.data, store.sync, ready, flushSave]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && saveTimer.current) flushSave();
    });
    return () => {
      sub.remove();
      if (saveTimer.current) flushSave();
    };
  }, [flushSave]);

  const sync = useSync({
    enabled: ready && !wiped,
    userId,
    storeRef,
    setStore,
    localRev: store.localRev,
    activeRev: store.activeRev,
  });

  const clearLocalData = useCallback(async () => {
    wipedRef.current = true;
    setWiped(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    await clearState();
  }, []);

  // The long-timer reminder follows the timer state, whichever device changed
  // it (remote merges update data.active too). Cancelled once data is wiped.
  const reminderHabit = data.active
    ? data.habits.find((h) => h.id === data.active!.habitId)?.name ?? 'your habit'
    : '';
  const reminderAt = wiped ? null : reminderFireAt(data.active, settings.reminderHours);
  useEffect(() => {
    if (!ready) return;
    syncReminder({ fireAt: reminderAt, habitName: reminderHabit, hours: settings.reminderHours });
  }, [ready, reminderAt, reminderHabit, settings.reminderHours, permRev]);

  // The undo toast expires on its own; a newer delete restarts the clock.
  useEffect(() => {
    if (!ui.undo) return;
    const t = setTimeout(() => setUi((p) => (p.undo === ui.undo ? { ...p, undo: null } : p)), UNDO_MS);
    return () => clearTimeout(t);
  }, [ui.undo]);

  // 1s tick drives the running timer + "Start" button clocks.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const actions = useMemo<StreakActions>(() => {
    const patchUi = (patch: Partial<UIState>) =>
      setUi((prev) => ({ ...prev, ...patch }));

    return {
      setScreen: (screen) => patchUi({ screen }),

      startTimer: (habitId) => {
        setData((d) => {
          if (d.active && d.active.habitId === habitId) return d; // already running
          let sessions = d.sessions;
          if (d.active) sessions = [...sessions, sessionFromActive(d.active, Date.now())];
          return {
            ...d,
            sessions,
            active: { habitId, startedAt: Date.now(), baseSec: 0 },
          };
        });
        patchUi({ timerOpen: true });
        // Reminder permission is asked on timer start; iOS only prompts the first time.
        if (settingsRef.current.reminderHours > 0) {
          requestReminderPermission().then((ok) => ok && setPermRev((r) => r + 1));
        }
      },
      openTimer: () => patchUi({ timerOpen: true }),
      closeTimer: () => patchUi({ timerOpen: false }),
      togglePause: () =>
        setData((d) => {
          const a = d.active;
          if (!a) return d;
          if (a.startedAt) {
            return {
              ...d,
              active: {
                ...a,
                baseSec: a.baseSec + (Date.now() - a.startedAt) / 1000,
                startedAt: null,
              },
            };
          }
          return { ...d, active: { ...a, startedAt: Date.now() } };
        }),
      stopTimer: () => {
        setData((d) => {
          if (!d.active) return d;
          return {
            ...d,
            sessions: [...d.sessions, sessionFromActive(d.active, Date.now())],
            active: null,
          };
        });
        patchUi({ timerOpen: false });
      },

      openHeatSheet: () => patchUi({ heatSheet: true }),
      closeHeatSheet: () => patchUi({ heatSheet: false }),
      pickHeat: (key) =>
        setUi((p) => ({ ...p, heatSel: p.heatSel === key ? null : key })),
      closeHeatSel: () => patchUi({ heatSel: null }),

      armClear: () => patchUi({ clearArmed: true }),
      cancelClear: () => patchUi({ clearArmed: false }),
      confirmClear: () => {
        setData((d) => ({ ...d, historyClearedAt: Date.now() }));
        patchUi({ clearArmed: false });
      },

      openNewHabit: (projectId) =>
        patchUi({
          habitSheet: {
            id: null,
            name: '',
            icon: 'code',
            projectId,
            dailyTargetMin: 30,
            weeklyTargetMin: 150,
          },
        }),
      openEditHabit: (habit) =>
        patchUi({
          habitSheet: {
            id: habit.id,
            name: habit.name,
            icon: habit.icon,
            projectId: habit.projectId,
            dailyTargetMin: habit.dailyTargetMin,
            weeklyTargetMin: habit.weeklyTargetMin,
          },
        }),
      closeHabitSheet: () => patchUi({ habitSheet: null }),
      patchHabitSheet: (patch) =>
        setUi((p) =>
          p.habitSheet
            ? { ...p, habitSheet: { ...p.habitSheet, ...patch } }
            : p
        ),
      saveHabitSheet: () => {
        setUi((prevUi) => {
          const sh = prevUi.habitSheet;
          if (!sh || !sh.name.trim()) return prevUi;
          setData((d) => {
            if (sh.id) {
              return {
                ...d,
                habits: d.habits.map((h) =>
                  h.id === sh.id
                    ? {
                        ...h,
                        name: sh.name.trim(),
                        icon: sh.icon,
                        projectId: sh.projectId,
                        dailyTargetMin: sh.dailyTargetMin,
                        weeklyTargetMin: sh.weeklyTargetMin,
                      }
                    : h
                ),
              };
            }
            const dup = d.habits.find(
              (h) => h.name.trim().toLowerCase() === sh.name.trim().toLowerCase()
            );
            if (dup) return d; // silently skip duplicates (parity with design)
            const tile = TILES[d.habits.length % TILES.length];
            const newHabit: Habit = {
              id: 'h' + Date.now(),
              projectId: sh.projectId,
              name: sh.name.trim(),
              icon: sh.icon,
              tile,
              dailyTargetMin: sh.dailyTargetMin,
              weeklyTargetMin: sh.weeklyTargetMin,
            };
            return { ...d, habits: [...d.habits, newHabit] };
          });
          return { ...prevUi, habitSheet: null };
        });
      },
      deleteHabit: (id) => {
        setData((d) => {
          const habits = d.habits.filter((h) => h.id !== id);
          const sessions = d.sessions.filter((s) => s.habitId !== id);
          const active =
            d.active && d.active.habitId === id ? null : d.active;
          return { ...d, habits, sessions, active };
        });
        setUi((p) => ({
          ...p,
          habitSheet: null,
          timerOpen:
            data.active && data.active.habitId === id ? false : p.timerOpen,
        }));
      },
      mergeHabit: (fromId, intoId) => {
        setData((d) => {
          const sessions = d.sessions.map((s) =>
            s.habitId === fromId ? { ...s, habitId: intoId } : s
          );
          const habits = d.habits.filter((h) => h.id !== fromId);
          let active = d.active;
          if (active && active.habitId === fromId)
            active = { ...active, habitId: intoId };
          return { ...d, sessions, habits, active };
        });
        patchUi({ habitSheet: null });
      },

      openNewProject: () =>
        patchUi({ projectSheet: { id: null, name: '', weeklyTarget: 8 } }),
      openEditProject: (project) =>
        patchUi({
          projectSheet: {
            id: project.id,
            name: project.name,
            weeklyTarget: project.weeklyTarget,
          },
        }),
      closeProjectSheet: () => patchUi({ projectSheet: null }),
      patchProjectSheet: (patch) =>
        setUi((p) =>
          p.projectSheet
            ? { ...p, projectSheet: { ...p.projectSheet, ...patch } }
            : p
        ),
      saveProjectSheet: () => {
        setUi((prevUi) => {
          const sh = prevUi.projectSheet;
          if (!sh || !sh.name.trim()) return prevUi;
          setData((d) => {
            if (sh.id) {
              return {
                ...d,
                projects: d.projects.map((p) =>
                  p.id === sh.id
                    ? { ...p, name: sh.name.trim(), weeklyTarget: sh.weeklyTarget }
                    : p
                ),
              };
            }
            return {
              ...d,
              projects: [
                ...d.projects,
                {
                  id: 'g' + Date.now(),
                  name: sh.name.trim(),
                  weeklyTarget: sh.weeklyTarget,
                  started: Date.now(),
                },
              ],
            };
          });
          return { ...prevUi, projectSheet: null };
        });
      },
      deleteProject: (id) => {
        setData((d) => {
          const hids = d.habits
            .filter((h) => h.projectId === id)
            .map((h) => h.id);
          const habits = d.habits.filter((h) => h.projectId !== id);
          const sessions = d.sessions.filter((s) => !hids.includes(s.habitId));
          let active = d.active;
          if (active && hids.includes(active.habitId)) active = null;
          return {
            ...d,
            projects: d.projects.filter((p) => p.id !== id),
            habits,
            sessions,
            active,
          };
        });
        patchUi({ projectSheet: null });
      },

      openStageSheet: (projectId) => patchUi({ stageSheet: projectId }),
      closeStageSheet: () => patchUi({ stageSheet: null }),

      openLogSheet: () => {
        const def =
          recommendedHabitId(data, DEFAULT_CONFIG, Date.now()) ??
          (data.habits[0] ? data.habits[0].id : null);
        const start = defaultManualStart(Date.now(), 30);
        patchUi({
          logSheet: {
            habitId: def,
            start,
            mode: 'duration',
            minutes: 30,
            end: start + 30 * 60000,
            note: '',
            error: null,
            confirmLong: false,
          },
        });
      },
      closeLogSheet: () => patchUi({ logSheet: null }),
      patchLogSheet: (patch) =>
        setUi((p) =>
          p.logSheet
            ? {
                ...p,
                // Any field change invalidates the last error and confirmation.
                logSheet: { ...p.logSheet, error: null, confirmLong: false, ...patch },
              }
            : p
        ),
      saveLogSheet: () => {
        setUi((prevUi) => {
          const sh = prevUi.logSheet;
          if (!sh || !sh.habitId) return prevUi;
          const habitId = sh.habitId;
          const end = logSheetEnd(sh);
          const check = checkSessionTimes(sh.start, end, Date.now());
          if (!check.ok) return { ...prevUi, logSheet: { ...sh, error: check.error } };
          if (check.needsConfirm && !sh.confirmLong) {
            return { ...prevUi, logSheet: { ...sh, error: null, confirmLong: true } };
          }
          setData((d) => {
            if (!d.habits.some((h) => h.id === habitId)) return d;
            const session = manualSession('s' + Date.now(), { habitId, start: sh.start, end, note: sh.note });
            return { ...d, sessions: [...d.sessions, session] };
          });
          return { ...prevUi, logSheet: null };
        });
      },

      openSessionSheet: (sessionId) => {
        const s = data.sessions.find((x) => x.id === sessionId);
        if (!s) return;
        patchUi({
          sessionSheet: {
            id: s.id,
            habitId: s.habitId,
            start: s.start,
            end: s.end,
            note: s.notes ?? '',
            error: null,
            confirmLong: false,
          },
        });
      },
      closeSessionSheet: () => patchUi({ sessionSheet: null }),
      patchSessionSheet: (patch) =>
        setUi((p) =>
          p.sessionSheet
            ? {
                ...p,
                // Any field change invalidates the last error and confirmation.
                sessionSheet: { ...p.sessionSheet, error: null, confirmLong: false, ...patch },
              }
            : p
        ),
      saveSessionSheet: () => {
        setUi((prevUi) => {
          const sh = prevUi.sessionSheet;
          if (!sh) return prevUi;
          const check = checkSessionTimes(sh.start, sh.end, Date.now(), { existing: true });
          if (!check.ok) return { ...prevUi, sessionSheet: { ...sh, error: check.error } };
          if (check.needsConfirm && !sh.confirmLong) {
            return { ...prevUi, sessionSheet: { ...sh, error: null, confirmLong: true } };
          }
          setData((d) => {
            if (!d.habits.some((h) => h.id === sh.habitId)) return d;
            return {
              ...d,
              sessions: d.sessions.map((s) =>
                s.id === sh.id
                  ? applySessionEdit(s, { habitId: sh.habitId, start: sh.start, end: sh.end, note: sh.note })
                  : s
              ),
            };
          });
          return { ...prevUi, sessionSheet: null };
        });
      },
      deleteSession: (id) => {
        const deleted = data.sessions.find((s) => s.id === id) ?? null;
        setData((d) => ({
          ...d,
          sessions: d.sessions.filter((s) => s.id !== id),
        }));
        patchUi({ sessionSheet: null, undo: deleted });
      },
      undoDelete: () => {
        setUi((prevUi) => {
          const s = prevUi.undo;
          if (s) setData((d) => restoreSession(d, s));
          return { ...prevUi, undo: null };
        });
      },

      setReminderHours: (hours) => {
        const next = { ...settingsRef.current, reminderHours: clampReminderHours(hours) };
        setSettings(next);
        saveSettings(next);
        if (next.reminderHours > 0) {
          requestReminderPermission().then((ok) => ok && setPermRev((r) => r + 1));
        }
      },
    };
    // A few actions read `data` directly (deleteHabit's timerOpen decision,
    // openLogSheet, openSessionSheet, deleteSession's undo copy); the rest use
    // functional updates. Recreate when data identity changes so reads are fresh.
  }, [data, setData]);

  const value = useMemo<StreakContextValue>(
    () => ({ ready, data, ui, now, config: DEFAULT_CONFIG, settings, actions, sync, clearLocalData }),
    [ready, data, ui, now, settings, actions, sync, clearLocalData]
  );

  return <StreakContext.Provider value={value}>{children}</StreakContext.Provider>;
}

export function useStreak(): StreakContextValue {
  const ctx = useContext(StreakContext);
  if (!ctx) throw new Error('useStreak must be used within StreakProvider');
  return ctx;
}

/** Convenience: current active-timer seconds (unused-safe helper for screens). */
export function currentActiveSec(data: PersistedState, now: number): number {
  return activeSec(data.active, now);
}
