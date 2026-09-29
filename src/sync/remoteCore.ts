// Network side of sync, against any Supabase-shaped client (the app passes
// its own; tests pass a fake): push outbox changes, pull rows since a cursor.

import { Change, parseTimestamp, SyncTable } from '../domain/sync';
import { isMissingTableError } from './questRows';
import { setQuestTables } from './questTables';
import { changeToRow, CONFLICT_TARGET, OPTIONAL_TABLES, PULL_ORDER, PUSH_ORDER, Row, rowToChange } from './rows';

/** The slice of the Supabase client sync uses (loose on purpose: the real query builder is chainable). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SyncDb = { from(table: string): any };

const PUSH_CHUNK = 500;
const PULL_PAGE = 1000;
/**
 * Re-read this much history before each cursor. server_updated_at is the
 * writer's transaction start, so a slow commit can land "behind" a cursor we
 * already advanced past; re-reading is harmless because merging is idempotent.
 */
const PULL_OVERLAP_MS = 30_000;

/** An optional table (Quest Mode, 006) the server doesn't have: skip it and say so. */
function skipMissing(table: SyncTable, error: unknown): boolean {
  if (!OPTIONAL_TABLES.includes(table) || !isMissingTableError(error)) return false;
  setQuestTables('missing');
  return true;
}

/**
 * Upsert changes parent tables first. `onConfirmed` runs after each chunk the
 * server accepts, so a failure part-way keeps only the unsent changes queued.
 * Changes for an optional table the server lacks stay queued.
 */
export async function pushChangesWith(
  db: SyncDb,
  changes: Change[],
  userId: string,
  onConfirmed: (confirmed: Change[]) => void
): Promise<void> {
  tables: for (const table of PUSH_ORDER) {
    const forTable = changes.filter((c) => c.table === table);
    for (let i = 0; i < forTable.length; i += PUSH_CHUNK) {
      const chunk = forTable.slice(i, i + PUSH_CHUNK);
      const { error } = await db
        .from(table)
        .upsert(chunk.map((c) => changeToRow(c, userId)), { onConflict: CONFLICT_TARGET[table] });
      if (error) {
        if (skipMissing(table, error)) continue tables;
        throw error;
      }
      onConfirmed(chunk);
    }
  }
}

/** Fetch every row changed since each table's cursor, children first. */
export async function pullChangesWith(
  db: SyncDb,
  cursors: Partial<Record<SyncTable, number>>,
  userId: string
): Promise<{ changes: Change[]; cursors: Partial<Record<SyncTable, number>> }> {
  const changes: Change[] = [];
  const nextCursors: Partial<Record<SyncTable, number>> = {};
  let questOk = true;

  tables: for (const table of PULL_ORDER) {
    const since = cursors[table];
    // A fixed lower bound for the whole pull; one bulk write shares one
    // server_updated_at, so paging must be by offset, not by timestamp.
    const lower = since ? new Date(since - PULL_OVERLAP_MS).toISOString() : null;
    const tiebreak = table === 'active_timers' ? 'user_id' : 'id';
    let latest = since ?? 0;

    for (let from = 0; ; from += PULL_PAGE) {
      let query = db.from(table).select('*').eq('user_id', userId);
      if (lower) query = query.gte('server_updated_at', lower);
      const { data, error } = await query
        .order('server_updated_at', { ascending: true })
        .order(tiebreak, { ascending: true })
        .range(from, from + PULL_PAGE - 1);
      if (error) {
        if (skipMissing(table, error)) {
          questOk = false;
          continue tables;
        }
        throw error;
      }
      const rows = (data ?? []) as Row[];
      for (const row of rows) {
        const c = rowToChange(table, row);
        if (c) changes.push(c);
        const ts = parseTimestamp(String(row.server_updated_at));
        if (ts > latest) latest = ts;
      }
      if (rows.length < PULL_PAGE) break;
    }

    if (latest) nextCursors[table] = latest;
  }

  if (questOk) setQuestTables('available');
  return { changes, cursors: nextCursors };
}
