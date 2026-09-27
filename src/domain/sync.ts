// Pure sync logic: change detection, the outbox, and last-write-wins merging.
// No React or Supabase here; src/sync/ does the I/O.

import { ActiveTimer, Habit, PersistedState, Project, Session } from './types';

export type SyncTable = 'projects' | 'habits' | 'sessions' | 'active_timers';

/** The active timer is a per-user singleton; this is its id in the outbox. */
export const ACTIVE_ID = 'active';

interface ChangeBase {
  id: string;
  /** Epoch ms of the delete, or null for an upsert. */
  deletedAt: number | null;
}

/**
 * One record's latest state. Deletes carry the last known record so a push can
 * still satisfy the server's NOT NULL columns.
 */
export type Change =
  | (ChangeBase & { table: 'projects'; record: Project })
  | (ChangeBase & { table: 'habits'; record: Habit; mergedInto?: string | null })
  | (ChangeBase & { table: 'sessions'; record: Session })
  | (ChangeBase & { table: 'active_timers'; record: ActiveTimer });

/** Pending local changes, keyed by changeKey(); newer changes replace older ones. */
export type Outbox = Record<string, Change>;

export function changeKey(c: { table: SyncTable; id: string }): string {
  return `${c.table}:${c.id}`;
}

/** The time a change happened: its delete time, else its last edit. */
export function changeVersion(c: Change): number {
  return c.deletedAt ?? c.record.updatedAt ?? 0;
}

// ---------------------------------------------------------------------------
// Local change detection
// ---------------------------------------------------------------------------

interface Stamped<T> {
  list: T[];
  upserts: T[];
  deletes: T[];
}

/**
 * Records whose object identity changed are treated as edited and stamped with
 * `now`; ids missing from `next` are deletes. Store actions only replace the
 * objects they actually change, which is what makes identity a reliable signal.
 */
function stampList<T extends { id: string; updatedAt?: number }>(
  prev: T[],
  next: T[],
  now: number
): Stamped<T> {
  if (prev === next) return { list: next, upserts: [], deletes: [] };
  const prevById = new Map(prev.map((r) => [r.id, r]));
  const nextIds = new Set<string>();
  const upserts: T[] = [];
  const list = next.map((r) => {
    nextIds.add(r.id);
    if (prevById.get(r.id) === r) return r;
    const stamped = { ...r, updatedAt: now };
    upserts.push(stamped);
    return stamped;
  });
  const deletes = prev.filter((r) => !nextIds.has(r.id));
  return { list: upserts.length ? list : next, upserts, deletes };
}

/**
 * Compare two states produced by a local action. Returns `next` with edited
 * records stamped, plus the changes to queue for push.
 */
export function stampLocalChanges(
  prev: PersistedState,
  next: PersistedState,
  now: number
): { data: PersistedState; changes: Change[] } {
  const projects = stampList(prev.projects, next.projects, now);
  const habits = stampList(prev.habits, next.habits, now);
  const sessions = stampList(prev.sessions, next.sessions, now);
  const changes: Change[] = [];

  for (const record of projects.upserts) changes.push({ table: 'projects', id: record.id, record, deletedAt: null });
  for (const r of projects.deletes)
    changes.push({ table: 'projects', id: r.id, record: { ...r, updatedAt: now }, deletedAt: now });

  // A deleted habit whose sessions moved to another habit was merged into it.
  const nextSessionHabit = new Map(next.sessions.map((s) => [s.id, s.habitId]));
  for (const record of habits.upserts) changes.push({ table: 'habits', id: record.id, record, deletedAt: null });
  for (const r of habits.deletes) {
    const moved = prev.sessions.find((s) => {
      if (s.habitId !== r.id) return false;
      const to = nextSessionHabit.get(s.id);
      return to !== undefined && to !== r.id;
    });
    changes.push({
      table: 'habits',
      id: r.id,
      record: { ...r, updatedAt: now },
      deletedAt: now,
      mergedInto: moved ? nextSessionHabit.get(moved.id)! : null,
    });
  }

  for (const record of sessions.upserts) changes.push({ table: 'sessions', id: record.id, record, deletedAt: null });
  for (const r of sessions.deletes)
    changes.push({ table: 'sessions', id: r.id, record: { ...r, updatedAt: now }, deletedAt: now });

  let active = next.active;
  if (prev.active !== next.active) {
    if (next.active) {
      active = { ...next.active, updatedAt: now };
      changes.push({ table: 'active_timers', id: ACTIVE_ID, record: active, deletedAt: null });
    } else if (prev.active) {
      changes.push({
        table: 'active_timers',
        id: ACTIVE_ID,
        record: { ...prev.active, updatedAt: now },
        deletedAt: now,
      });
    }
  }

  if (!changes.length) return { data: next, changes };
  return {
    data: { ...next, projects: projects.list, habits: habits.list, sessions: sessions.list, active },
    changes,
  };
}

export function enqueue(outbox: Outbox, changes: Change[]): Outbox {
  if (!changes.length) return outbox;
  const next = { ...outbox };
  for (const c of changes) next[changeKey(c)] = c;
  return next;
}

/**
 * Every local record as an upsert (first sign-in with existing local data).
 * Records never edited since sync existed go up with version 0, so they can't
 * overwrite anything the server already has.
 */
export function allAsChanges(data: PersistedState): Change[] {
  const stamp = <T extends { updatedAt?: number }>(r: T): T => ({ ...r, updatedAt: r.updatedAt ?? 0 });
  const changes: Change[] = [
    ...data.projects.map((r) => ({ table: 'projects' as const, id: r.id, record: stamp(r), deletedAt: null })),
    ...data.habits.map((r) => ({ table: 'habits' as const, id: r.id, record: stamp(r), deletedAt: null })),
    ...data.sessions.map((r) => ({ table: 'sessions' as const, id: r.id, record: stamp(r), deletedAt: null })),
  ];
  if (data.active) {
    changes.push({ table: 'active_timers', id: ACTIVE_ID, record: stamp(data.active), deletedAt: null });
  }
  return changes;
}

/**
 * Drop outbox entries the server has confirmed, unless they were replaced by a
 * newer local change while the push was in flight.
 */
export function confirmPushed(outbox: Outbox, pushed: Change[]): Outbox {
  let next: Outbox | null = null;
  for (const c of pushed) {
    const key = changeKey(c);
    if (outbox[key] !== c) continue;
    next = next ?? { ...outbox };
    delete next[key];
  }
  return next ?? outbox;
}

// ---------------------------------------------------------------------------
// Remote merge
// ---------------------------------------------------------------------------

/** Apply order: children before parents, so cascades see the latest children. */
const APPLY_ORDER: Record<SyncTable, number> = { sessions: 0, active_timers: 1, habits: 2, projects: 3 };

/**
 * Merge pulled rows into local state with last-write-wins per record.
 *
 * - The side with the later version wins; on a tie a delete beats an edit.
 * - A pending local change is compared by its own version; if the remote side
 *   wins, the pending change is dropped so it can't overwrite newer data.
 * - A winning remote habit delete re-points local sessions (and the timer) to
 *   `mergedInto` when the habit was merged, otherwise deletes them. A winning
 *   project delete removes its habits and their sessions. Those follow-on edits
 *   are stamped with `now` and queued for push.
 */
export function mergeRemote(
  data: PersistedState,
  outbox: Outbox,
  remote: Change[],
  now: number
): { data: PersistedState; outbox: Outbox } {
  if (!remote.length) return { data, outbox };

  const projects = new Map(data.projects.map((r) => [r.id, r]));
  const habits = new Map(data.habits.map((r) => [r.id, r]));
  const sessions = new Map(data.sessions.map((r) => [r.id, r]));
  let active = data.active;
  const ob: Outbox = { ...outbox };
  const followUps: Change[] = [];
  let changed = false;

  const lookup = (c: Change): { updatedAt?: number } | null | undefined => {
    switch (c.table) {
      case 'projects':
        return projects.get(c.id);
      case 'habits':
        return habits.get(c.id);
      case 'sessions':
        return sessions.get(c.id);
      case 'active_timers':
        return active;
    }
  };

  const deleteSession = (s: Session) => {
    sessions.delete(s.id);
    delete ob[changeKey({ table: 'sessions', id: s.id })];
    followUps.push({ table: 'sessions', id: s.id, record: { ...s, updatedAt: now }, deletedAt: now });
  };
  const clearActiveFor = (habitId: string) => {
    if (!active || active.habitId !== habitId) return;
    followUps.push({ table: 'active_timers', id: ACTIVE_ID, record: { ...active, updatedAt: now }, deletedAt: now });
    active = null;
  };
  const removeHabit = (habitId: string, mergedInto: string | null | undefined) => {
    habits.delete(habitId);
    for (const s of [...sessions.values()]) {
      if (s.habitId !== habitId) continue;
      if (mergedInto) {
        const moved = { ...s, habitId: mergedInto, updatedAt: now };
        sessions.set(s.id, moved);
        followUps.push({ table: 'sessions', id: s.id, record: moved, deletedAt: null });
      } else {
        deleteSession(s);
      }
    }
    if (mergedInto && active && active.habitId === habitId) {
      active = { ...active, habitId: mergedInto, updatedAt: now };
      followUps.push({ table: 'active_timers', id: ACTIVE_ID, record: active, deletedAt: null });
    } else {
      clearActiveFor(habitId);
    }
  };

  const ordered = [...remote].sort((a, b) => APPLY_ORDER[a.table] - APPLY_ORDER[b.table]);
  for (const rc of ordered) {
    const key = changeKey(rc);
    const pending = ob[key];
    const local = lookup(rc);
    const remoteDeleted = rc.deletedAt !== null;

    let localVersion: number | null = null;
    let localDeleted = false;
    if (pending) {
      localVersion = changeVersion(pending);
      localDeleted = pending.deletedAt !== null;
    } else if (local) {
      localVersion = local.updatedAt ?? 0;
    }

    if (localVersion === null) {
      // Unknown locally: take remote upserts, ignore remote deletes.
      if (remoteDeleted) continue;
    } else {
      const rv = changeVersion(rc);
      const remoteWins = rv > localVersion || (rv === localVersion && remoteDeleted && !localDeleted);
      if (!remoteWins) continue;
      if (pending) delete ob[key];
    }

    changed = true;
    switch (rc.table) {
      case 'projects':
        if (remoteDeleted) {
          projects.delete(rc.id);
          for (const h of [...habits.values()]) {
            if (h.projectId !== rc.id) continue;
            delete ob[changeKey({ table: 'habits', id: h.id })];
            followUps.push({ table: 'habits', id: h.id, record: { ...h, updatedAt: now }, deletedAt: now, mergedInto: null });
            removeHabit(h.id, null);
          }
        } else projects.set(rc.id, rc.record);
        break;
      case 'habits':
        if (remoteDeleted) removeHabit(rc.id, rc.mergedInto);
        else habits.set(rc.id, rc.record);
        break;
      case 'sessions':
        if (remoteDeleted) sessions.delete(rc.id);
        else sessions.set(rc.id, rc.record);
        break;
      case 'active_timers':
        active = remoteDeleted ? null : rc.record;
        break;
    }
  }

  if (!changed) return { data, outbox };
  return {
    data: {
      ...data,
      projects: [...projects.values()],
      habits: [...habits.values()],
      sessions: [...sessions.values()],
      active,
    },
    outbox: enqueue(ob, followUps),
  };
}

// ---------------------------------------------------------------------------
// First sign-in
// ---------------------------------------------------------------------------

/**
 * True when `data` is the untouched sample data from `seedData`: nothing has
 * been stamped by an edit and every record matches the seed, ignoring the
 * date-dependent timestamps (session start/end, project started).
 */
export function isUntouchedSeed(data: PersistedState, seedData: PersistedState): boolean {
  if (data.active) return false;
  const all = [...data.projects, ...data.habits, ...data.sessions];
  if (all.some((r) => r.updatedAt !== undefined)) return false;
  const strip = (s: PersistedState) => ({
    projects: s.projects.map(({ started: _s, ...r }) => r),
    habits: s.habits,
    sessions: s.sessions.map(({ start: _a, end: _b, ...r }) => r),
  });
  return JSON.stringify(strip(data)) === JSON.stringify(strip(seedData));
}

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

/**
 * Parse a Postgres timestamptz as returned by PostgREST
 * (e.g. "2026-09-27T10:00:00.123456+00:00") to epoch ms. Fractions are
 * normalised to milliseconds because Hermes only accepts three digits.
 */
export function parseTimestamp(value: string): number {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(value.trim());
  if (!m) return NaN;
  const ms = (m[3] ?? '').padEnd(3, '0').slice(0, 3);
  let zone = m[4] ?? 'Z';
  if (zone !== 'Z') {
    const sign = zone[0];
    const digits = zone.slice(1).replace(':', '');
    zone = `${sign}${digits.slice(0, 2)}:${(digits.slice(2) || '00').padEnd(2, '0')}`;
  }
  return Date.parse(`${m[1]}T${m[2]}.${ms}${zone}`);
}
