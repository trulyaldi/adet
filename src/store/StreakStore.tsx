import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AppConfig, DEFAULT_CONFIG } from '../domain/config';
import { TILES } from '../domain/constants';
import { activeSec } from '../domain/engine';
import {
  ActiveTimer,
  Habit,
  IconKey,
  PersistedState,
  Session,
} from '../domain/types';
import { loadState, saveState } from './storage';

export type Screen = 'today' | 'projects' | 'stats';

export interface HabitSheetState {
  id: string | null;
  name: string;
  icon: IconKey;
  projectId: string;
}
export interface ProjectSheetState {
  id: string | null;
  name: string;
  weeklyTarget: number;
}

export interface UIState {
  screen: Screen;
  timerOpen: boolean;
  heatSel: string | null;
  heatExpanded: boolean;
  clearArmed: boolean;
  habitSheet: HabitSheetState | null;
  projectSheet: ProjectSheetState | null;
  stageSheet: string | null; // projectId
}

const INITIAL_UI: UIState = {
  screen: 'today',
  timerOpen: false,
  heatSel: null,
  heatExpanded: false,
  clearArmed: false,
  habitSheet: null,
  projectSheet: null,
  stageSheet: null,
};

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
  toggleHeatExpanded(): void;
  pickHeat(key: string): void;
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
}

interface StreakContextValue {
  ready: boolean;
  data: PersistedState;
  ui: UIState;
  now: number;
  config: AppConfig;
  actions: StreakActions;
}

const StreakContext = createContext<StreakContextValue | null>(null);

const EMPTY_DATA: PersistedState = {
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

export function StreakProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<PersistedState>(EMPTY_DATA);
  const [ui, setUi] = useState<UIState>(INITIAL_UI);
  const [now, setNow] = useState(() => Date.now());

  // Load persisted state once.
  useEffect(() => {
    let mounted = true;
    loadState().then((loaded) => {
      if (!mounted) return;
      setData(loaded);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Persist durable slice whenever it changes (after initial load).
  const readyRef = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (!readyRef.current) {
      readyRef.current = true;
      // Skip persisting the freshly-loaded value back immediately, but do
      // persist the seed on a genuine first run so it survives restarts.
    }
    saveState(data);
  }, [data, ready]);

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

      toggleHeatExpanded: () =>
        setUi((p) => ({ ...p, heatExpanded: !p.heatExpanded })),
      pickHeat: (key) =>
        setUi((p) => ({ ...p, heatSel: p.heatSel === key ? null : key })),

      armClear: () => patchUi({ clearArmed: true }),
      cancelClear: () => patchUi({ clearArmed: false }),
      confirmClear: () => {
        setData((d) => ({ ...d, historyClearedAt: Date.now() }));
        patchUi({ clearArmed: false });
      },

      openNewHabit: (projectId) =>
        patchUi({
          habitSheet: { id: null, name: '', icon: 'code', projectId },
        }),
      openEditHabit: (habit) =>
        patchUi({
          habitSheet: {
            id: habit.id,
            name: habit.name,
            icon: habit.icon,
            projectId: habit.projectId,
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
    };
    // `data` referenced only inside deleteHabit's timerOpen decision; actions
    // otherwise use functional updates. Recreate when data identity changes so
    // that read is fresh.
  }, [data]);

  const value = useMemo<StreakContextValue>(
    () => ({ ready, data, ui, now, config: DEFAULT_CONFIG, actions }),
    [ready, data, ui, now, actions]
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
