// The migration safety kit, run against real Postgres (PGlite, in-process):
// every migration applies (006 and 007 twice: idempotent), the verify
// scripts pass, row-level security keeps users apart, the rollbacks are
// locked until edited, and a rollback followed by a re-run is clean.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { PGlite } from '@electric-sql/pglite';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const MIGRATIONS = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
const unlock = (sql: string) => sql.replace(/-- SAFETY LOCK[\s\S]*?-- END SAFETY LOCK/, '');

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

/** Just enough of Supabase: its roles, auth.users, auth.uid() and default grants. */
async function supabaseLike(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create schema auth;
    grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${A}'), ('${B}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  return db;
}

async function migrate(db: PGlite, from = '') {
  for (const f of MIGRATIONS.filter((m) => m >= from)) {
    await db.exec(read(`migrations/${f}`));
    // 001 predates this kit and isn't re-runnable; every later one must be.
    if (f >= '002') await db.exec(read(`migrations/${f}`));
  }
}

async function verify(db: PGlite, file: string): Promise<Record<string, boolean>> {
  const r = await db.query<{ check_name: string; pass: boolean }>(read(`manual/${file}`));
  return Object.fromEntries(r.rows.map((row) => [row.check_name, row.pass]));
}

const asUser = async (db: PGlite, id: string, sql: string) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role;');
  }
};

test('migrations apply (006 and 007 twice) and the verify scripts pass', async () => {
  const db = await supabaseLike();
  await migrate(db);
  const v6 = await verify(db, 'verify_006.sql');
  assert.ok(Object.keys(v6).length > 10);
  assert.deepEqual(Object.entries(v6).filter(([, pass]) => !pass), []);
  const v7 = await verify(db, 'verify_007.sql');
  assert.deepEqual(Object.entries(v7).filter(([, pass]) => !pass), []);
});

test('verify scripts fail (without erroring) before the migrations run', async () => {
  const db = await supabaseLike();
  await db.exec(read('migrations/001_init.sql'));
  assert.equal((await verify(db, 'verify_006.sql'))['== ALL 006 CHECKS'], false);
  assert.equal((await verify(db, 'verify_007.sql'))['== ALL 007 CHECKS'], false);
});

test('row-level security: a user sees and writes only their own items', async () => {
  const db = await supabaseLike();
  await migrate(db);
  await asUser(db, A, `insert into public.items (user_id, id, type) values ('${A}', 'quest_meta', 'quest_meta')`);
  await asUser(db, B, `insert into public.items (user_id, id, type) values ('${B}', 'quest_meta', 'quest_meta')`);
  const seen = await asUser(db, A, 'select user_id from public.items');
  assert.deepEqual(seen.rows, [{ user_id: A }]);
  await assert.rejects(asUser(db, A, `insert into public.items (user_id, id, type) values ('${B}', 'x', 'task')`));
  // The Sage counter is server-only.
  await assert.rejects(asUser(db, A, 'select * from public.sage_usage'));
  await assert.rejects(asUser(db, A, `select public.sage_take_call('${A}', 30)`));
});

test('the daily Sage limit is atomic and stops at the limit', async () => {
  const db = await supabaseLike();
  await migrate(db);
  const takes: boolean[] = [];
  for (let i = 0; i < 4; i++) takes.push((await db.query<{ ok: boolean }>(`select public.sage_take_call('${A}', 3) as ok`)).rows[0].ok);
  assert.deepEqual(takes, [true, true, true, false]);
});

test('rollbacks are locked until edited; unlocked, they undo cleanly and 006/007 re-run', async () => {
  const db = await supabaseLike();
  await migrate(db);
  await assert.rejects(db.exec(read('manual/007_sage_usage_down.sql')), /locked/);
  await assert.rejects(db.exec(read('manual/006_quest_down.sql')), /locked/);
  assert.equal((await verify(db, 'verify_006.sql'))['== ALL 006 CHECKS'], true);

  await db.exec(unlock(read('manual/007_sage_usage_down.sql')));
  await db.exec(unlock(read('manual/006_quest_down.sql')));
  assert.equal((await verify(db, 'verify_006.sql'))['items table exists'], false);
  assert.equal((await verify(db, 'verify_007.sql'))['sage_usage table exists'], false);

  await migrate(db, '006');
  assert.equal((await verify(db, 'verify_006.sql'))['== ALL 006 CHECKS'], true);
  assert.equal((await verify(db, 'verify_007.sql'))['== ALL 007 CHECKS'], true);
});
