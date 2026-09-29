import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isMissingTableError } from './questRows';

test('missing-table errors from Postgres and PostgREST are recognised', () => {
  assert.ok(isMissingTableError({ code: '42P01', message: 'relation "public.items" does not exist' }));
  assert.ok(isMissingTableError({ code: 'PGRST205', message: "Could not find the table 'public.items' in the schema cache" }));
  assert.ok(isMissingTableError({ message: 'relation "public.links" does not exist' }));
});

test('other errors are not treated as a missing table', () => {
  assert.equal(isMissingTableError({ code: 'PGRST204', message: "Could not find the 'props' column of 'items'" }), false);
  assert.equal(isMissingTableError({ code: '42703', message: 'column "props" does not exist' }), false);
  assert.equal(isMissingTableError(new Error('Network request failed')), false);
  assert.equal(isMissingTableError(null), false);
});
