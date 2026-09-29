// Mapping between Quest Mode's items/links and their Supabase rows (migration
// 006_quest). Pure, like rows.ts, which delegates here.

import { isLinkEnd, isLinkKind, Item, Link, parseItem } from '../domain/items/types';

type Row = Record<string, unknown>;

const iso = (ms: number) => new Date(ms).toISOString();

export function itemToRow(r: Item): Row {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    props: r.props,
    habit_id: r.habitId,
    created_at: iso(r.createdAt || 0),
  };
}

export function linkToRow(r: Link): Row {
  return {
    id: r.id,
    from_type: r.fromType,
    from_id: r.fromId,
    to_type: r.toType,
    to_id: r.toId,
    kind: r.kind,
    created_at: iso(r.createdAt || 0),
  };
}

/**
 * A pulled item row, or null for a type this build doesn't know (skipped, so
 * a newer app version's items never crash an older one).
 */
export function rowToItem(row: Row, updatedAt: number, parseTs: (v: unknown) => number | null): Item | null {
  return parseItem({
    id: row.id == null ? '' : String(row.id),
    type: row.type,
    title: row.title ?? '',
    body: row.body ?? '',
    props: row.props,
    habitId: row.habit_id == null ? null : String(row.habit_id),
    createdAt: parseTs(row.created_at) ?? 0,
    updatedAt,
  });
}

export function rowToLink(row: Row, updatedAt: number, parseTs: (v: unknown) => number | null): Link | null {
  if (!isLinkKind(row.kind) || !isLinkEnd(row.from_type) || !isLinkEnd(row.to_type)) return null;
  return {
    id: String(row.id),
    fromType: row.from_type,
    fromId: String(row.from_id),
    toType: row.to_type,
    toId: String(row.to_id),
    kind: row.kind,
    createdAt: parseTs(row.created_at) ?? 0,
    updatedAt,
  };
}

/**
 * The server doesn't have the table yet (migration 006 not run): Postgres
 * 42P01 ("relation does not exist") or PostgREST PGRST205 ("Could not find
 * the table … in the schema cache").
 */
export function isMissingTableError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const { code, message } = e as { code?: unknown; message?: unknown };
  if (code === '42P01' || code === 'PGRST205') return true;
  return typeof message === 'string' && /relation .* does not exist|could not find the table/i.test(message);
}
