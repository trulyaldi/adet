// Mapping between domain changes and Supabase rows (see supabase/migrations).
// Pure: no client import, so it can be unit-tested under node.

import { clampMinMin, defaultMinMin, parseFrequency } from '../domain/frequency';
import { isIconKey, isProjectColor, isScene } from '../domain/look';
import { ACTIVE_ID, Change, parseTimestamp, SyncTable } from '../domain/sync';
import { IconKey } from '../domain/types';

export type Row = Record<string, unknown>;

/** Push order: parents before children. */
export const PUSH_ORDER: SyncTable[] = ['projects', 'habits', 'sessions', 'active_timers'];
/** Pull order: children before parents, so a child is never fetched after a parent it depends on is. */
export const PULL_ORDER: SyncTable[] = ['sessions', 'active_timers', 'habits', 'projects'];

export const CONFLICT_TARGET: Record<SyncTable, string> = {
  projects: 'user_id,id',
  habits: 'user_id,id',
  sessions: 'user_id,id',
  active_timers: 'user_id',
};

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (v: unknown): number | null => (v === null || v === undefined ? null : parseTimestamp(String(v)));
const num = (v: unknown): number => Number(v);
const optNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export function changeToRow(c: Change, userId: string): Row {
  const meta = {
    user_id: userId,
    updated_at: iso(c.record.updatedAt ?? 0),
    deleted_at: c.deletedAt === null ? null : iso(c.deletedAt),
  };
  switch (c.table) {
    case 'projects': {
      const r = c.record;
      // archived_at is always sent (null when active) so an unarchive clears it
      // on the server. Needs migration 003_archive.
      return {
        ...meta,
        id: r.id,
        name: r.name,
        weekly_target: r.weeklyTarget,
        started: r.started ?? null,
        archived_at: r.archivedAt ?? null,
        // Needs migration 005_redesign.
        color: r.color ?? null,
        icon: r.icon ?? null,
        scene: r.scene ?? null,
      };
    }
    case 'habits': {
      const r = c.record;
      return {
        ...meta,
        id: r.id,
        project_id: r.projectId,
        name: r.name,
        icon: r.icon,
        tile: r.tile,
        daily_target_min: r.dailyTargetMin,
        weekly_target_min: r.weeklyTargetMin,
        // Needs migration 004_doable_day.
        frequency: r.frequency,
        min_target_min: r.minTargetMin,
        merged_into: c.deletedAt === null ? null : c.mergedInto ?? null,
      };
    }
    case 'sessions': {
      const r = c.record;
      return {
        ...meta,
        id: r.id,
        habit_id: r.habitId,
        start_ms: r.start,
        end_ms: r.end,
        duration: r.duration,
        notes: r.notes ?? null,
        manual: !!r.manual,
      };
    }
    case 'active_timers': {
      const r = c.record;
      return { ...meta, habit_id: r.habitId, started_at: r.startedAt, base_sec: r.baseSec };
    }
  }
}

export function rowToChange(table: SyncTable, row: Row): Change {
  const updatedAt = ms(row.updated_at) ?? 0;
  const deletedAt = ms(row.deleted_at);
  switch (table) {
    case 'projects':
      return {
        table,
        id: String(row.id),
        deletedAt,
        record: {
          id: String(row.id),
          name: String(row.name),
          weeklyTarget: num(row.weekly_target),
          started: optNum(row.started),
          ...(row.archived_at == null ? {} : { archivedAt: num(row.archived_at) }),
          // Unset (rows from before 005): projectLook() derives them from the id.
          ...(isProjectColor(row.color) ? { color: row.color } : {}),
          ...(isIconKey(row.icon) ? { icon: row.icon } : {}),
          ...(isScene(row.scene) ? { scene: row.scene } : {}),
          updatedAt,
        },
      };
    case 'habits': {
      // Rows written before migration 004, or by older app versions, have no
      // frequency or minimum: they read as daily with the default minimum.
      const dailyTargetMin = num(row.daily_target_min);
      const minTargetMin =
        row.min_target_min == null ? defaultMinMin(dailyTargetMin) : clampMinMin(num(row.min_target_min), dailyTargetMin);
      return {
        table,
        id: String(row.id),
        deletedAt,
        mergedInto: row.merged_into == null ? null : String(row.merged_into),
        record: {
          id: String(row.id),
          projectId: String(row.project_id),
          name: String(row.name),
          icon: String(row.icon) as IconKey,
          tile: String(row.tile),
          dailyTargetMin,
          weeklyTargetMin: num(row.weekly_target_min),
          updatedAt,
          frequency: parseFrequency(row.frequency),
          minTargetMin,
        },
      };
    }
    case 'sessions':
      return {
        table,
        id: String(row.id),
        deletedAt,
        record: {
          id: String(row.id),
          habitId: String(row.habit_id),
          start: num(row.start_ms),
          end: num(row.end_ms),
          duration: num(row.duration),
          ...(row.notes == null ? {} : { notes: String(row.notes) }),
          ...(row.manual ? { manual: true } : {}),
          updatedAt,
        },
      };
    case 'active_timers':
      return {
        table,
        id: ACTIVE_ID,
        deletedAt,
        record: {
          habitId: String(row.habit_id),
          startedAt: optNum(row.started_at),
          baseSec: num(row.base_sec),
          updatedAt,
        },
      };
  }
}
