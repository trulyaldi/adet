// Capacity: how much time each weekday is planned for. It's a planning target,
// never a limit — time past it counts in full as bonus.

import { weekdayIndex } from './frequency';
import { activeProjects } from './projects';
import { addDays, dkey, pkey } from './time';
import { DayLevel, PersistedState, Project, Session, UserPrefs } from './types';

/** Mon–Fri 3h, Sat–Sun 2h. */
export const DEFAULT_CAPACITY_MIN = [180, 180, 180, 180, 180, 120, 120];
export const CAPACITY_STEP_MIN = 15;
export const CAPACITY_MAX_MIN = 12 * 60;

export const DEFAULT_PREFS: UserPrefs = { capacityMin: DEFAULT_CAPACITY_MIN, weekStart: 1 };

export const LEVEL_FACTOR: Record<DayLevel, number> = { light: 0.5, normal: 1, heavy: 1.5 };

/** A stored capacity as seven 0..12h values in 15-minute steps. */
export function clampCapacity(v: unknown): number[] {
  if (!Array.isArray(v) || v.length !== 7) return DEFAULT_CAPACITY_MIN;
  return v.map((m, i) => {
    if (typeof m !== 'number' || !Number.isFinite(m)) return DEFAULT_CAPACITY_MIN[i];
    return Math.min(CAPACITY_MAX_MIN, Math.max(0, Math.round(m / CAPACITY_STEP_MIN) * CAPACITY_STEP_MIN));
  });
}

export function parsePrefs(v: unknown): UserPrefs {
  const raw = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return {
    capacityMin: clampCapacity(raw.capacityMin),
    weekStart: raw.weekStart === 0 ? 0 : 1,
    ...(typeof raw.updatedAt === 'number' ? { updatedAt: raw.updatedAt } : {}),
  };
}

/** Capacity of a day in minutes, with that day's light/normal/heavy tap. */
export function capacityOn(prefs: UserPrefs, day: string, level?: DayLevel): number {
  const base = prefs.capacityMin[weekdayIndex(pkey(day))] ?? 0;
  return Math.round(base * LEVEL_FACTOR[level ?? 'normal']);
}

/** Minutes of capacity in a whole week. */
export function weekCapacityMin(prefs: UserPrefs): number {
  return prefs.capacityMin.reduce((a, b) => a + b, 0);
}

// ---------- targets vs capacity ----------
export interface TargetCheck {
  /** Sum of active projects' weekly targets, in minutes. */
  targetMin: number;
  capacityMin: number;
  /** Targets ask for more than the week holds. */
  over: boolean;
  /** Identifies this exact conflict, so a dismissal lasts until something changes. */
  signature: string;
}

export function targetCheck(data: PersistedState): TargetCheck {
  const targetMin = Math.round(activeProjects(data).reduce((a, p) => a + p.weeklyTarget * 60, 0));
  const capacityMin = weekCapacityMin(data.prefs);
  return { targetMin, capacityMin, over: targetMin > capacityMin, signature: `${targetMin}/${capacityMin}` };
}

/**
 * Weekly targets scaled down proportionally to fit the capacity, in half
 * hours (at least half an hour each). Archived projects are left alone.
 */
export function scaleTargetsToFit(projects: Project[], capacityMin: number): Project[] {
  const live = projects.filter((p) => p.archivedAt == null);
  const total = live.reduce((a, p) => a + p.weeklyTarget * 60, 0);
  if (total <= capacityMin || total <= 0) return projects;
  const f = capacityMin / total;
  return projects.map((p) => {
    if (p.archivedAt != null) return p;
    // Round down to half hours so the sum never ends up over again.
    const next = Math.max(0.5, Math.floor(p.weeklyTarget * f * 2) / 2);
    return next === p.weeklyTarget ? p : { ...p, weeklyTarget: next };
  });
}

/** Capacity raised proportionally (rounded up to 15 minutes) until it holds `targetMin`. */
export function raiseCapacityToFit(capacityMin: number[], targetMin: number): number[] {
  const total = capacityMin.reduce((a, b) => a + b, 0);
  if (total >= targetMin) return capacityMin;
  if (total <= 0) {
    const even = Math.ceil(targetMin / 7 / CAPACITY_STEP_MIN) * CAPACITY_STEP_MIN;
    return capacityMin.map(() => Math.min(CAPACITY_MAX_MIN, even));
  }
  const f = targetMin / total;
  return capacityMin.map((m) => Math.min(CAPACITY_MAX_MIN, Math.ceil((m * f) / CAPACITY_STEP_MIN) * CAPACITY_STEP_MIN));
}

// ---------- learned capacity ----------
/** Days of history needed before suggesting a capacity. */
export const LEARN_AFTER_DAYS = 14;
/** How many past weeks each weekday's median looks at. */
const LEARN_WEEKS = 8;
/** Suggest only when some weekday would move by at least this much. */
const LEARN_MIN_CHANGE = 30;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * A capacity per weekday from what was actually done: the median minutes
 * tracked on each weekday over the last few weeks (days before the first
 * session don't count), in 15-minute steps. Null until there are
 * LEARN_AFTER_DAYS of history, or when it wouldn't change anything much.
 */
export function learnedCapacity(sessions: Session[], current: number[], today: string): number[] | null {
  if (!sessions.length) return null;
  let first = Infinity;
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    first = Math.min(first, s.start);
    const k = dkey(new Date(s.start));
    byDay.set(k, (byDay.get(k) || 0) + s.duration);
  }
  const firstDay = dkey(new Date(first));
  const t = pkey(today);
  if (dkey(addDays(t, -LEARN_AFTER_DAYS)) < firstDay) return null;

  const samples: number[][] = [[], [], [], [], [], [], []];
  for (let back = 1; back <= LEARN_WEEKS * 7; back++) {
    const d = addDays(t, -back);
    const k = dkey(d);
    if (k < firstDay) break;
    samples[weekdayIndex(d)].push((byDay.get(k) || 0) / 60);
  }
  const out = samples.map((xs, i) =>
    xs.length ? Math.min(CAPACITY_MAX_MIN, Math.round(median(xs) / CAPACITY_STEP_MIN) * CAPACITY_STEP_MIN) : current[i]
  );
  return out.some((m, i) => Math.abs(m - current[i]) >= LEARN_MIN_CHANGE) ? out : null;
}
